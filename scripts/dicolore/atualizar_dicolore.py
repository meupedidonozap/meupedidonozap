"""
Automação Dicolore (versão Postgres): Views -> Google Sheets -> Painel Admin

Substitui o watch_and_update.py. Não usa mais Excel/WPS, então não
interfere mais no que você está fazendo na sua máquina.

Fluxo, para cada item escolhido (produtos, estoques, clientes):
1. Lê a VIEW correspondente no Postgres (somente leitura)
2. Escreve o resultado na aba correspondente do Google Sheets
3. Entra no painel admin do Meu Pedido no Zap (um único login) e clica
   no botão de atualizar de cada item
4. Registra tudo em automacao.log

Instalação (uma vez):
    pip install pandas gspread google-auth python-dotenv playwright sqlalchemy psycopg2-binary
    playwright install chromium

MODO MONITOR (fica rodando 24h, sem Agendador):
    python atualizar_dicolore.py --monitorar
    Fica checando as views de tempos em tempos. Só quando o conteúdo de uma view
    muda, grava a planilha daquele item e aciona o botão dele no painel.
    (Use o monitorar_dicolore.bat; para parar, feche a janela ou Ctrl+C.)

Uso:
    python atualizar_dicolore.py --once                      # tudo
    python atualizar_dicolore.py --once --only estoques      # só estoques
    python atualizar_dicolore.py --once --only produtos clientes
    python atualizar_dicolore.py --dry-run                   # só lê as views e mostra linhas/colunas
    python atualizar_dicolore.py --once --sem-painel         # atualiza o Sheets e não mexe no painel
    python atualizar_dicolore.py --transmitir-pedidos        # só envia pedidos liberados ao ERP
    python atualizar_dicolore.py --dry-pedidos               # só gera XML dos pedidos (não envia)

    O --monitorar também transmite os pedidos liberados a cada 60s
    (MONITOR_INTERVALO_TRANSMISSAO no dicolore.env; MONITOR_TRANSMITIR_PEDIDOS=nao desliga).
"""

import os
import re
import sys
import json
import time
import socket
import hashlib
import logging
import argparse
from logging.handlers import RotatingFileHandler
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# ---------------------------------------------------------------------------
# Configuração (tudo vem do arquivo .env)
# ---------------------------------------------------------------------------

# Aceita "dicolore.env" (fácil de criar no Windows) ou ".env", na pasta do script.
_BASE = Path(__file__).parent
load_dotenv(_BASE / "dicolore.env")
load_dotenv(_BASE / ".env")

# Postgres
PG_HOST = os.getenv("PG_HOST")
PG_PORT = int(os.getenv("PG_PORT", "5432"))
PG_DB = os.getenv("PG_DB")
PG_USER = os.getenv("PG_USER")
PG_PASS = os.getenv("PG_PASS")
PG_SSLMODE = os.getenv("PG_SSLMODE")  # opcional: require, prefer, disable...
PG_CONNECT_TIMEOUT = int(os.getenv("PG_CONNECT_TIMEOUT", "15"))
PG_STATEMENT_TIMEOUT_MS = int(os.getenv("PG_STATEMENT_TIMEOUT_MS", "120000"))

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

# Painel admin
ADMIN_URL = os.getenv("ADMIN_URL")
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
ADMIN_WAIT_AFTER_CLICK_MS = int(os.getenv("ADMIN_WAIT_AFTER_CLICK_MS", "45000"))

def _tarefa_argv() -> str:
    """v12: cada monitor separado (pedidos/cadastros/status) tem seu próprio log e trava."""
    for i, a in enumerate(sys.argv):
        if a == "--tarefa" and i + 1 < len(sys.argv):
            return sys.argv[i + 1].strip().lower()
        if a.startswith("--tarefa="):
            return a.split("=", 1)[1].strip().lower()
    return "todos"


TAREFA = _tarefa_argv()
_SUFIXO_LOG = "" if TAREFA == "todos" else f"_{TAREFA}"
LOG_PATH = Path(__file__).parent / f"automacao{_SUFIXO_LOG}.log"
ESTADO_PATH = Path(__file__).parent / "estado_monitor.json"


def _env_int(nome: str, padrao: int) -> int:
    try:
        return int(os.getenv(nome, str(padrao)))
    except ValueError:
        return padrao


# Modo monitor: de quanto em quanto tempo checar cada view (segundos) e o tempo
# mínimo entre duas atualizações do painel do mesmo item (segundos).
MONITOR_INTERVALO = {
    "produtos": _env_int("MONITOR_INTERVALO_PRODUTOS", 300),
    "estoques": _env_int("MONITOR_INTERVALO_ESTOQUES", 60),
    "clientes": _env_int("MONITOR_INTERVALO_CLIENTES", 600),
}
MONITOR_MIN_ENTRE = {
    "produtos": _env_int("MONITOR_MIN_ENTRE_PRODUTOS", 300),
    "estoques": _env_int("MONITOR_MIN_ENTRE_ESTOQUES", 300),
    "clientes": _env_int("MONITOR_MIN_ENTRE_CLIENTES", 600),
}
MONITOR_SYNC_INICIAL = os.getenv("MONITOR_SINCRONIZAR_AO_INICIAR", "sim").strip().lower() in ("sim", "s", "1", "true")
MONITOR_PORTA_TRAVA = _env_int("MONITOR_PORTA_TRAVA", 47653) + {"todos": 0, "pedidos": 1, "cadastros": 2, "status": 3, "titulos": 4, "boletos": 5}.get(TAREFA, 0)
MONITOR_INTERVALO_PEDIDOS_DEDICADO = _env_int("MONITOR_INTERVALO_PEDIDOS_DEDICADO", 30)
# Transmissão de pedidos MPZ -> ERP (integrador_pedidos.py na pasta importacao)
IMPORTACAO_DIR = _BASE / "importacao"
INTEGRADOR_PEDIDOS = IMPORTACAO_DIR / "integrador_pedidos.py"
MONITOR_INTERVALO_TRANSMISSAO = _env_int("MONITOR_INTERVALO_TRANSMISSAO", 60)
MONITOR_TRANSMITIR_PEDIDOS = os.getenv("MONITOR_TRANSMITIR_PEDIDOS", "sim").strip().lower() in ("sim", "s", "1", "true")


SYNC_PEDIDOS_ERP = _BASE / "sync_dicolore_financeiro_v5.py"
MONITOR_INTERVALO_STATUS_PEDIDOS = _env_int("MONITOR_INTERVALO_STATUS_PEDIDOS", 60)


def _desligar_modo_selecao():
    """Windows: clicar na janela (QuickEdit) pausa o programa. Desliga isso."""
    if os.name != "nt":
        return
    try:
        import ctypes
        k = ctypes.windll.kernel32
        h = k.GetStdHandle(-10)
        modo = ctypes.c_uint32()
        if k.GetConsoleMode(h, ctypes.byref(modo)):
            k.SetConsoleMode(h, (modo.value & ~0x0040) | 0x0080)
    except Exception:
        pass


import threading
_status_thread = None


def iniciar_status_pedidos_em_segundo_plano() -> bool:
    """Roda a busca de OF/NF sem travar os pedidos/estoque. Retorna False se ainda está rodando."""
    global _status_thread
    if _status_thread and _status_thread.is_alive():
        log.info("[status-pedidos] Busca anterior ainda em andamento; aguardando.")
        return False
    log.info("[status-pedidos] Buscando OF/NF no ERP (segundo plano)...")
    _status_thread = threading.Thread(target=_status_e_boletos, daemon=True)
    _status_thread.start()
    return True


_ultimo_boletos = 0.0
MONITOR_INTERVALO_BOLETOS = _env_int("MONITOR_INTERVALO_BOLETOS", 1800)


def _status_e_boletos() -> bool:
    """Depois do OF/NF, envia títulos, notas e boletos (a cada 30 min por padrão)."""
    global _ultimo_boletos
    ok = sincronizar_status_pedidos()
    if time.monotonic() - _ultimo_boletos >= MONITOR_INTERVALO_BOLETOS or _ultimo_boletos == 0.0:
        _ultimo_boletos = time.monotonic()
        log.info("[boletos] Enviando títulos, notas fiscais e boletos dos últimos %s dias...",
                 _env_int("MONITOR_BOLETOS_DIAS", 30))
        sincronizar_status_pedidos(["--somente-boletos", "--boletos-dias",
                                    str(_env_int("MONITOR_BOLETOS_DIAS", 30))], "boletos")
    return ok


MONITOR_INTERVALO_TITULOS = _env_int("MONITOR_INTERVALO_TITULOS", 600)
MONITOR_INTERVALO_BOLETOS_DEDICADO = _env_int("MONITOR_INTERVALO_BOLETOS_DEDICADO", 3600)
TITULOS_HORA_COMPLETO = _env_int("TITULOS_HORA_COMPLETO", 6)
_ultimo_completo = None


def _titulos_ciclo() -> bool:
    """v17: a cada ciclo, atualização rápida; 1x por dia (a partir das 6h), todos desde a data do admin."""
    global _ultimo_completo
    from datetime import date as _d, datetime as _dt
    if _ultimo_completo != _d.today() and _dt.now().hour >= TITULOS_HORA_COMPLETO:
        _ultimo_completo = _d.today()
        log.info("[titulos] Atualização diária completa (desde a data do admin)...")
        return sincronizar_status_pedidos(["--titulos", "completo"], "titulos")
    return sincronizar_status_pedidos(["--titulos", "rapido"], "titulos")


def sincronizar_status_pedidos(extra=None, tag="status-pedidos") -> bool:
    """Envia ao MPZ os pedidos do ERP com OF/NF atualizadas (bolinhas da aba Pedidos)."""
    import subprocess
    if not SYNC_PEDIDOS_ERP.exists():
        log.error("[status-pedidos] Não encontrei %s", SYNC_PEDIDOS_ERP)
        return False
    import queue
    lines = queue.Queue()
    process = None
    def read_output(pipe):
        try:
            for line in pipe:
                lines.put(line.rstrip())
        finally:
            pipe.close()
            lines.put(None)
    try:
        process = subprocess.Popen(
            [sys.executable, "-u", str(SYNC_PEDIDOS_ERP)] + (extra or ["--somente-pedidos", "--pendentes"]),
            cwd=str(_BASE), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", bufsize=1)
        if process.stdout is None:
            raise RuntimeError("Não foi possível ler o progresso.")
        threading.Thread(target=read_output, args=(process.stdout,), daemon=True).start()
        deadline = time.monotonic() + max(30, _env_int("MONITOR_TIMEOUT_STATUS_PEDIDOS", 600))
        while True:
            if time.monotonic() >= deadline:
                log.error("[status-pedidos] Limite do ciclo atingido; etapas já confirmadas preservadas. "
                          "Use --pedido para diagnóstico. Transmissões continuam normalmente.")
                return False
            try:
                line = lines.get(timeout=0.5)
            except queue.Empty:
                continue
            if line is None:
                break
            if line:
                log.info("[%s] %s", tag, line)
        code = process.wait(timeout=5)
        if code != 0:
            log.error("[status-pedidos] Encerrado com erro (código %s); confira a etapa acima.", code)
        return code == 0
    except Exception as e:
        log.error("[status-pedidos] Falha: %s", e)
        return False
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait(timeout=10)


def transmitir_pedidos(dry: bool = False, silencioso: bool = False) -> bool:
    """Roda o integrador de pedidos (MPZ -> SOAP SmartNet). Retorna True se rodou sem erro."""
    import subprocess
    if not INTEGRADOR_PEDIDOS.exists():
        if not silencioso:
            log.error("[pedidos-erp] Não encontrei %s", INTEGRADOR_PEDIDOS)
        return False
    cmd = [sys.executable, str(INTEGRADOR_PEDIDOS)] + (["--dry"] if dry else [])
    try:
        r = subprocess.run(cmd, cwd=str(IMPORTACAO_DIR), capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=300)
    except subprocess.TimeoutExpired:
        log.error("[pedidos-erp] Tempo esgotado (5 min) na transmissão.")
        return False
    except Exception as e:
        log.error("[pedidos-erp] Falha ao executar integrador: %s", e)
        return False
    linhas = [l for l in (r.stdout + r.stderr).splitlines() if l.strip()]
    sem_pedidos = any(" 0 pedido(s)" in l for l in linhas) and len(linhas) == 1
    if silencioso and sem_pedidos and r.returncode == 0:
        log.info("[pedidos-erp] Verificado: nenhum pedido pendente para transmitir.")
    else:
        for l in linhas[-30:]:
            log.info("[pedidos-erp] %s", l.split(" ", 2)[-1] if l[:4].isdigit() else l)
    if r.returncode != 0:
        log.error("[pedidos-erp] Integrador terminou com erro (código %s).", r.returncode)
        return False
    return True
# Tempo máximo (ms) esperando uma aba/botão do painel aparecer. A aba Clientes tem
# milhares de linhas e pode demorar quase 1 minuto para carregar.
ADMIN_TIMEOUT_MS = _env_int("ADMIN_TIMEOUT_MS", 90000)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        RotatingFileHandler(LOG_PATH, maxBytes=2_000_000, backupCount=5, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("automacao-dicolore")


@dataclass
class Entidade:
    chave: str          # produtos / estoques / clientes
    view: str           # nome da view no Postgres
    sheet_id: str       # planilha Google onde essa entidade é gravada
    aba_sheets: str     # aba dentro dessa planilha
    aba_painel: str     # aba/menu do painel admin
    botao_painel: str   # botão de atualizar no painel


def _env_entidade(chave: str, view_padrao: str, aba_sheets_padrao: str,
                  aba_painel_padrao: str, botao_padrao: str) -> Entidade:
    k = chave.upper()
    return Entidade(
        chave=chave,
        view=os.getenv(f"VIEW_{k}", view_padrao),
        sheet_id=os.getenv(f"GOOGLE_SHEET_ID_{k}", GOOGLE_SHEET_ID or ""),
        aba_sheets=os.getenv(f"SHEET_TAB_{k}", aba_sheets_padrao),
        aba_painel=os.getenv(f"ADMIN_TAB_{k}", aba_painel_padrao),
        botao_painel=os.getenv(f"ADMIN_BUTTON_{k}", botao_padrao),
    )


# Os valores padrão de estoques/clientes são chutes: ajuste no .env conforme
# os nomes reais que aparecem no painel e as abas reais do seu Google Sheets.
ENTIDADES = {
    "produtos": _env_entidade("produtos", "vw_mpz_produtos", "", "Produtos", "Atualizar Preços"),
    "estoques": _env_entidade("estoques", "vw_mpz_estoques", "", "Produtos", "Atualizar Estoque"),
    "clientes": _env_entidade("clientes", "vw_mpz_clientes", "", "Clientes", "Atualizar Clientes"),
}

_VIEW_REGEX = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$")


def _resolver_caminho(caminho: str) -> Path:
    """Caminho relativo é resolvido a partir da pasta do script (não do diretório atual)."""
    p = Path(caminho)
    return p if p.is_absolute() else _BASE / p


def check_config(usar_painel: bool, chaves: list):
    required = {
        "PG_HOST": PG_HOST,
        "PG_DB": PG_DB,
        "PG_USER": PG_USER,
        "PG_PASS": PG_PASS,
    }
    if not os.getenv("DRY_RUN_ONLY"):
        required["GOOGLE_SERVICE_ACCOUNT_JSON"] = GOOGLE_SERVICE_ACCOUNT_JSON
        if usar_painel:
            required.update({"ADMIN_URL": ADMIN_URL, "ADMIN_USER": ADMIN_USER, "ADMIN_PASS": ADMIN_PASS})

    faltando = [k for k, v in required.items() if not v]
    if (GOOGLE_SERVICE_ACCOUNT_JSON and not os.getenv("DRY_RUN_ONLY")
            and not _resolver_caminho(GOOGLE_SERVICE_ACCOUNT_JSON).exists()):
        faltando.append(
            f"GOOGLE_SERVICE_ACCOUNT_JSON: arquivo não encontrado em {_resolver_caminho(GOOGLE_SERVICE_ACCOUNT_JSON)}"
        )
    for chave in chaves:
        ent = ENTIDADES[chave]
        if not ent.sheet_id:
            faltando.append(f"GOOGLE_SHEET_ID (ou GOOGLE_SHEET_ID_{chave.upper()})")
        if not _VIEW_REGEX.match(ent.view):
            faltando.append(f"VIEW_{chave.upper()} inválida: {ent.view!r}")

    if faltando:
        log.error("Configuração incompleta no .env: %s", ", ".join(faltando))
        sys.exit(1)


# ---------------------------------------------------------------------------
# Etapa 1: ler a view no Postgres
# ---------------------------------------------------------------------------

def criar_engine():
    url = URL.create(
        "postgresql+psycopg2",
        username=PG_USER,
        password=PG_PASS,
        host=PG_HOST,
        port=PG_PORT,
        database=PG_DB,
    )
    connect_args = {
        "connect_timeout": PG_CONNECT_TIMEOUT,
        # Garante que esta automação nunca escreve nada no banco.
        "options": (
            "-c default_transaction_read_only=on "
            f"-c statement_timeout={PG_STATEMENT_TIMEOUT_MS}"
        ),
    }
    if PG_SSLMODE:
        connect_args["sslmode"] = PG_SSLMODE
    return create_engine(url, connect_args=connect_args, pool_pre_ping=True)


def ler_view(engine, ent: Entidade, silencioso: bool = False) -> pd.DataFrame:
    if not silencioso:
        log.info("[%s] Lendo view %s...", ent.chave, ent.view)
    with engine.connect() as conn:
        df = pd.read_sql(text(f"SELECT * FROM {ent.view}"), conn)
    if not silencioso:
        log.info("[%s] %d linhas, %d colunas: %s", ent.chave, len(df), len(df.columns), list(df.columns))
    return df


# ---------------------------------------------------------------------------
# Etapa 2: escrever no Google Sheets
# ---------------------------------------------------------------------------

def _normalizar_valor(v):
    """Converte tipos do Postgres/pandas em algo que o Sheets aceita (JSON)."""
    try:
        if pd.isna(v):
            return ""
    except (TypeError, ValueError):
        pass
    if hasattr(v, "item") and not isinstance(v, (str, bytes)):  # numpy -> python
        try:
            v = v.item()
        except (ValueError, AttributeError):
            pass
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, pd.Timestamp)):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    return v


def montar_valores(df: pd.DataFrame) -> list:
    linhas = df.astype(object).values.tolist()
    linhas = [[_normalizar_valor(c) for c in linha] for linha in linhas]
    return [[str(c) for c in df.columns]] + linhas


def conectar_google():
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(str(_resolver_caminho(GOOGLE_SERVICE_ACCOUNT_JSON)), scopes=scopes)
    return gspread.authorize(creds)


def atualizar_google_sheets(client, ent: Entidade, df: pd.DataFrame):
    if df.empty:
        # Proteção: uma view vazia (erro de filtro, banco fora do ar...)
        # não pode apagar a planilha que alimenta a loja.
        raise RuntimeError(f"A view {ent.view} voltou vazia. Planilha NÃO foi alterada.")

    sh = client.open_by_key(ent.sheet_id)
    if ent.aba_sheets:
        try:
            ws = sh.worksheet(ent.aba_sheets)
        except gspread.WorksheetNotFound:
            abas = [w.title for w in sh.worksheets()]
            raise RuntimeError(
                f"Aba '{ent.aba_sheets}' não existe na planilha '{sh.title}'. Abas disponíveis: {abas}"
            )
    else:
        ws = sh.sheet1  # primeira aba
    log.info("[%s] Gravando no Google Sheets (planilha '%s', aba '%s')...", ent.chave, sh.title, ws.title)

    valores = montar_valores(df)
    n_lin, n_col = len(valores), len(valores[0])

    if ws.row_count < n_lin or ws.col_count < n_col:
        ws.resize(rows=max(ws.row_count, n_lin), cols=max(ws.col_count, n_col))

    # Grava primeiro e limpa as sobras depois (em vez de clear() antes),
    # para a planilha nunca ficar vazia no meio da atualização.
    # RAW: texto continua texto (CEP, código, telefone, CPF/CNPJ não perdem zeros
    # à esquerda nem viram número/data) e números continuam números.
    ws.update(values=valores, range_name="A1", value_input_option="RAW")

    if ws.row_count > n_lin:
        ws.batch_clear([f"A{n_lin + 1}:{gspread.utils.rowcol_to_a1(ws.row_count, ws.col_count)}"])
    if ws.col_count > n_col:
        ws.batch_clear([
            f"{gspread.utils.rowcol_to_a1(1, n_col + 1)}:"
            f"{gspread.utils.rowcol_to_a1(n_lin, ws.col_count)}"
        ])

    log.info("[%s] Google Sheets atualizado (%d linhas).", ent.chave, len(df))


# ---------------------------------------------------------------------------
# Etapa 3: painel admin (um login, vários cliques)
# ---------------------------------------------------------------------------

def _clicar(page, texto: str, timeout_ms: int = None):
    """Clica em uma aba/botão pelo texto, tentando repetidamente até o tempo acabar.

    A tela de Clientes é pesada e o botão pode demorar a ficar clicável. Em vez de
    tentar cada forma uma única vez, repete todas até `timeout_ms`. Começa pelas
    formas mais exatas; só depois de ~8s aceita elementos que apenas CONTÊM o texto.
    Último recurso: clique por JavaScript.
    """
    timeout_ms = timeout_ms or ADMIN_TIMEOUT_MS
    padrao = re.compile(rf"^\s*{re.escape(texto)}\s*$", re.IGNORECASE)
    contem = re.compile(re.escape(texto), re.IGNORECASE)
    exatos = [
        page.get_by_role("tab", name=texto, exact=True),
        page.get_by_role("button", name=texto, exact=True),
        page.get_by_role("button", name=padrao),
        page.get_by_text(padrao),
    ]
    aproximados = [
        page.locator("button:visible", has_text=contem),
        page.locator("[role=tab]:visible, a:visible", has_text=contem),
    ]
    inicio = time.time()
    ultimo_erro = None
    while (time.time() - inicio) * 1000 < timeout_ms:
        grupos = exatos + (aproximados if time.time() - inicio > 8 else [])
        for loc in grupos:
            try:
                for i in range(min(loc.count(), 5)):
                    alvo = loc.nth(i)
                    if alvo.is_visible():
                        alvo.click(timeout=5000)
                        return
            except Exception as e:  # tenta a próxima forma / a próxima rodada
                ultimo_erro = e
        page.wait_for_timeout(500)

    # Último recurso: clicar via JavaScript (ignora sobreposição/visibilidade).
    try:
        clicou = page.evaluate(
            r"""(t) => {
                const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
                const el = Array.from(document.querySelectorAll('button, [role=tab], a'))
                    .find(e => norm(e.innerText) === norm(t));
                if (el) { el.click(); return true; }
                return false;
            }""",
            texto,
        )
        if clicou:
            log.warning("Cliquei em '%s' via JavaScript (o Playwright não o considerou clicável).", texto)
            return
    except Exception as e:
        ultimo_erro = e

    # Diagnóstico: o que o script está enxergando na tela naquele momento
    try:
        botoes = [t.strip().replace("\n", " ") for t in page.get_by_role("button").all_inner_texts() if t.strip()]
        log.error("Endereço atual: %s", page.url)
        log.error("Botões encontrados na tela: %s", botoes[:40])
    except Exception:
        pass
    raise RuntimeError(f"Não encontrei '{texto}' no painel em {timeout_ms // 1000}s: {ultimo_erro}")


def _ler_mensagens(page) -> list:
    """Textos de avisos/toasts visíveis no painel (ex.: 'Estoque atualizado')."""
    try:
        textos = page.locator(
            '[role="status"], [role="alert"], [class*="toast" i], [class*="Toastify"], [class*="snackbar" i]'
        ).all_inner_texts()
        return [t.strip().replace("\n", " ") for t in textos if t.strip()]
    except Exception:
        return []


def atualizar_painel(entidades: list, ver_navegador: bool = False) -> list:
    """Retorna a lista de chaves que falharam no painel."""
    falhas = []
    log.info("Abrindo o navegador para atualizar o painel admin...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not ver_navegador, slow_mo=400 if ver_navegador else 0)
        page = browser.new_page()
        try:
            respostas = []

            def _ao_responder(resp):
                try:
                    if resp.request.resource_type in ("fetch", "xhr"):
                        # sem a query string, que pode conter tokens
                        respostas.append(f"{resp.request.method} {resp.url.split('?')[0]} -> {resp.status}")
                except Exception:
                    pass

            page.on("response", _ao_responder)
            page.goto(ADMIN_URL, timeout=60000, wait_until="domcontentloaded")

            # Espera aparecer o formulário de login OU o painel já logado.
            campo_email = page.locator('input[type="email"], input[name="email"]').first
            aba_painel = page.get_by_text(entidades[0].aba_painel, exact=False).first
            logado = False
            for _ in range(60):  # até ~60s
                try:
                    if campo_email.is_visible():
                        break
                    if aba_painel.is_visible():
                        logado = True
                        break
                except Exception:
                    pass
                page.wait_for_timeout(1000)
            else:
                log.error("Login não apareceu. URL atual: %s | Título: %s", page.url, page.title())
                raise RuntimeError("Tela de login/painel não carregou em 60s")

            if logado:
                log.info("Painel já estava logado; pulando login.")
            else:
                campo_email.fill(ADMIN_USER)
                page.fill('input[type="password"], input[name="password"]', ADMIN_PASS)
                page.click('button[type="submit"]')
                try:
                    aba_painel.wait_for(state="visible", timeout=45000)
                except Exception:
                    log.error("Após login o painel não abriu. URL: %s | Título: %s", page.url, page.title())
                    raise

            for ent in entidades:
                try:
                    _clicar(page, ent.aba_painel)
                    try:
                        page.wait_for_load_state("networkidle", timeout=20000)
                    except Exception:
                        pass  # painel pode manter conexões abertas; segue mesmo assim
                    page.wait_for_timeout(1500)
                    respostas.clear()
                    _clicar(page, ent.botao_painel)
                    page.wait_for_timeout(1500)
                    mensagens = _ler_mensagens(page)
                    page.wait_for_timeout(max(0, ADMIN_WAIT_AFTER_CLICK_MS - 1500))
                    try:
                        page.wait_for_load_state("networkidle", timeout=60000)
                    except Exception:
                        log.warning("[%s] O painel continuava ocupado após 60s de espera.", ent.chave)
                    for m_ in _ler_mensagens(page):
                        if m_ not in mensagens:
                            mensagens.append(m_)
                    log.info("[%s] Chamadas do painel após o clique: %s", ent.chave,
                             respostas[-8:] or "nenhuma chamada de rede detectada")
                    if mensagens:
                        log.info("[%s] Mensagem do painel: %s", ent.chave, mensagens[:3])

                    log.info("[%s] Painel: '%s' > '%s' executado.", ent.chave, ent.aba_painel, ent.botao_painel)
                except Exception:
                    log.exception("[%s] Falha ao acionar o painel.", ent.chave)
                    falhas.append(ent.chave)
                    try:
                        page.screenshot(path=str(Path(__file__).parent / f"erro_painel_{ent.chave}.png"))
                    except Exception:
                        pass
        except Exception:
            log.exception("Falha no login/abertura do painel admin.")
            falhas = [e.chave for e in entidades]
            try:
                page.screenshot(path=str(Path(__file__).parent / "erro_painel_login.png"))
            except Exception:
                pass
        finally:
            browser.close()
    return falhas


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def rodar(chaves: list, usar_painel: bool, dry_run: bool, ver_navegador: bool = False) -> bool:
    """Retorna True se tudo deu certo."""
    log.info("=== Iniciando: %s%s ===", ", ".join(chaves), " (dry-run)" if dry_run else "")
    engine = criar_engine()
    client = None if dry_run else conectar_google()

    com_sucesso, falhas = [], []
    for chave in chaves:
        ent = ENTIDADES[chave]
        try:
            df = ler_view(engine, ent)
            if not dry_run:
                atualizar_google_sheets(client, ent, df)
            com_sucesso.append(ent)
        except Exception:
            log.exception("[%s] Falhou.", chave)
            falhas.append(chave)

    if usar_painel and not dry_run and com_sucesso:
        falhas += atualizar_painel(com_sucesso, ver_navegador)

    if falhas:
        log.error("=== Terminou COM FALHAS em: %s ===", ", ".join(sorted(set(falhas))))
        return False
    log.info("=== Concluído com sucesso ===")
    return True


# ---------------------------------------------------------------------------
# Modo monitor (24h): detecta mudança nas views e atualiza só o que mudou
# ---------------------------------------------------------------------------

def calcular_assinatura(df: pd.DataFrame) -> str:
    """Impressão digital do conteúdo da view.

    Ignora a ORDEM das linhas (linhas com o mesmo nome podem vir em ordem
    diferente entre duas leituras e isso não é uma mudança de verdade).
    """
    valores = montar_valores(df)
    cabecalho = json.dumps(valores[0], ensure_ascii=False)
    linhas = sorted(json.dumps(l, ensure_ascii=False, default=str) for l in valores[1:])
    return hashlib.sha256("\n".join([cabecalho] + linhas).encode("utf-8")).hexdigest()


def carregar_estado() -> dict:
    try:
        return json.loads(ESTADO_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def salvar_estado(estado: dict):
    try:
        tmp = ESTADO_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(estado, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(ESTADO_PATH)
    except Exception as e:
        log.warning("Não consegui salvar %s: %s", ESTADO_PATH.name, e)


def travar_instancia():
    """Impede dois monitores ao mesmo tempo (usa uma porta local como trava)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", MONITOR_PORTA_TRAVA))
    except OSError:
        sock.close()
        return None
    return sock  # precisa continuar referenciado enquanto o monitor roda


def _loop_dedicado(nome: str, intervalo: int, acao) -> int:
    """Laço leve: não abre navegador, Google Sheets nem views de cadastro."""
    trava = travar_instancia()
    if trava is None:
        log.error("Já existe um monitor de %s rodando (porta %d). Encerrando este.", nome, MONITOR_PORTA_TRAVA)
        return 3
    _desligar_modo_selecao()
    log.info("=== MONITOR DE %s iniciado (a cada %ds). Para parar: feche a janela. ===", nome.upper(), intervalo)
    proxima = 0.0
    ultimo_batimento = time.time()
    try:
        while True:
            if time.time() >= proxima:
                inicio = time.time()
                try:
                    ok = acao()
                except Exception as e:
                    log.error("[%s] Falha inesperada: %s", nome, e)
                    ok = False
                espera = intervalo if ok else max(intervalo, 60)
                proxima = time.time() + espera
                log.info("[%s] Ciclo concluído em %.1fs (%s). Próximo às %s.", nome,
                         time.time() - inicio, "ok" if ok else "com erro",
                         datetime.fromtimestamp(proxima).strftime("%H:%M:%S"))
                ultimo_batimento = time.time()
            elif time.time() - ultimo_batimento >= 300:
                log.info("[%s] Ativo.", nome)
                ultimo_batimento = time.time()
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("=== Monitor de %s encerrado pelo usuário ===", nome)
        return 0
    finally:
        try:
            trava.close()
        except Exception:
            pass


def monitorar(chaves: list, usar_painel: bool, ver_navegador: bool = False) -> int:
    """Roda até ser interrompido. Retorna o código de saída."""
    trava = travar_instancia()
    if trava is None:
        log.error("Já existe um monitor rodando neste computador (porta %d). Encerrando este.", MONITOR_PORTA_TRAVA)
        return 3

    engine = criar_engine()
    client = conectar_google()
    estado = carregar_estado()
    ultimo_envio = {c: 0.0 for c in chaves}
    proxima_checagem = {c: 0.0 for c in chaves}
    falhas_seguidas = {c: 0 for c in chaves}
    sheets_gravado = {}  # chave -> assinatura já gravada no Sheets (evita regravar se só o painel falhou)

    def _espera_apos_falha(chave: str) -> int:
        falhas_seguidas[chave] += 1
        return min(120 * 2 ** (falhas_seguidas[chave] - 1), 1800)  # 2, 4, 8, 16, 30 min

    _desligar_modo_selecao()
    log.info("=== MONITOR iniciado: %s ===", ", ".join(chaves))
    for c in chaves:
        log.info("  %s: checa a cada %ds; no mínimo %ds entre atualizações", c, MONITOR_INTERVALO[c], MONITOR_MIN_ENTRE[c])
    so_cadastros = TAREFA == "cadastros"
    if so_cadastros:
        log.info("  (modo cadastros: pedidos e OF/NF ficam nos outros monitores)")
    if MONITOR_TRANSMITIR_PEDIDOS and not so_cadastros:
        log.info("  pedidos-erp: transmite pedidos liberados a cada %ds", MONITOR_INTERVALO_TRANSMISSAO)
    proxima_transmissao = 0.0
    proximo_status = time.time() + 30
    log.info("  status-pedidos: OF/NF do ERP a cada %ds", MONITOR_INTERVALO_STATUS_PEDIDOS)
    log.info("Para parar: feche a janela ou use Ctrl+C.")

    ultimo_batimento = time.time()
    try:
        while True:
            agora = time.time()
            alteradas = []

            for chave in chaves:
                if agora < proxima_checagem[chave]:
                    continue
                proxima_checagem[chave] = agora + MONITOR_INTERVALO[chave]
                ent = ENTIDADES[chave]
                try:
                    df = ler_view(engine, ent, silencioso=True)
                    assinatura = calcular_assinatura(df)
                except Exception as e:
                    log.error("[%s] Falha ao ler a view (tenta de novo no próximo ciclo): %s", chave, e)
                    continue

                anterior = estado.get(chave, {}).get("assinatura")
                if anterior is None and not MONITOR_SYNC_INICIAL:
                    # Primeira vez e sem sincronização inicial: só guarda a "foto" atual.
                    estado[chave] = {"assinatura": assinatura, "atualizado_em": datetime.now().isoformat(timespec="seconds")}
                    salvar_estado(estado)
                    log.info("[%s] Referência inicial registrada (%d linhas).", chave, len(df))
                    continue
                if assinatura == anterior:
                    continue
                if agora - ultimo_envio[chave] < MONITOR_MIN_ENTRE[chave]:
                    continue  # mudou, mas ainda dentro do intervalo mínimo; a próxima checagem tenta de novo

                motivo = "primeira sincronização" if anterior is None else "a view mudou"
                log.info("[%s] Alteração detectada (%s; %d linhas). Atualizando...", chave, motivo, len(df))
                alteradas.append((ent, df, assinatura))

            if alteradas:
                gravadas = []
                for ent, df, assinatura in alteradas:
                    try:
                        if sheets_gravado.get(ent.chave) != assinatura:
                            atualizar_google_sheets(client, ent, df)
                            sheets_gravado[ent.chave] = assinatura
                        else:
                            log.info("[%s] Planilha já está atualizada; só falta o painel.", ent.chave)
                        gravadas.append((ent, assinatura))
                    except Exception as e:
                        espera = _espera_apos_falha(ent.chave)
                        log.error("[%s] Falha ao gravar no Google Sheets: %s. Nova tentativa em %d min.", ent.chave, e, espera // 60)
                        proxima_checagem[ent.chave] = time.time() + espera

                falhas_painel = []
                if usar_painel and gravadas:
                    falhas_painel = atualizar_painel([e for e, _ in gravadas], ver_navegador)

                for ent, assinatura in gravadas:
                    if ent.chave in falhas_painel:
                        espera = _espera_apos_falha(ent.chave)
                        log.error("[%s] O painel falhou; nova tentativa em %d min.", ent.chave, espera // 60)
                        proxima_checagem[ent.chave] = time.time() + espera
                        continue
                    falhas_seguidas[ent.chave] = 0
                    estado[ent.chave] = {
                        "assinatura": assinatura,
                        "atualizado_em": datetime.now().isoformat(timespec="seconds"),
                    }
                    ultimo_envio[ent.chave] = time.time()
                    log.info("[%s] Atualização concluída.", ent.chave)
                salvar_estado(estado)

            if MONITOR_TRANSMITIR_PEDIDOS and not so_cadastros and time.time() >= proxima_transmissao:
                ok_tx = transmitir_pedidos(silencioso=True)
                proxima_transmissao = time.time() + (MONITOR_INTERVALO_TRANSMISSAO if ok_tx else max(MONITOR_INTERVALO_TRANSMISSAO, 300))

            if not so_cadastros and time.time() >= proximo_status:
                iniciar_status_pedidos_em_segundo_plano()
                proximo_status = time.time() + MONITOR_INTERVALO_STATUS_PEDIDOS

            if not so_cadastros and time.time() - ultimo_batimento >= 60:
                log.info("[monitor] Ativo. Próxima checagem de pedidos %s; OF/NF %s.",
                         datetime.fromtimestamp(proxima_transmissao).strftime("%H:%M"),
                         datetime.fromtimestamp(proximo_status).strftime("%H:%M"))
                ultimo_batimento = time.time()

            time.sleep(2)
    except KeyboardInterrupt:
        log.info("=== Monitor encerrado pelo usuário ===")
        return 0
    finally:
        try:
            trava.close()
        except Exception:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Atualização Dicolore: Postgres -> Sheets -> painel")
    parser.add_argument("--once", action="store_true", help="Roda uma vez (use no Agendador de Tarefas).")
    parser.add_argument("--monitorar", action="store_true", help="Fica rodando 24h: atualiza só o que mudar nas views.")
    parser.add_argument("--dry-run", action="store_true", help="Só lê as views e mostra linhas/colunas. Não grava nada.")
    parser.add_argument("--sem-painel", action="store_true", help="Atualiza o Sheets, mas não aciona o painel admin.")
    parser.add_argument("--ver-navegador", action="store_true", help="Mostra o navegador na tela (para testar o painel).")
    parser.add_argument("--only", nargs="+", choices=list(ENTIDADES), help="Limita a alguns itens (padrão: todos).")
    parser.add_argument("--transmitir-pedidos", action="store_true", help="Só transmite os pedidos liberados ao ERP e sai.")
    parser.add_argument("--dry-pedidos", action="store_true", help="Só gera o XML dos pedidos liberados, sem enviar.")
    parser.add_argument("--tarefa", choices=["todos", "pedidos", "cadastros", "status", "titulos", "boletos"], default="todos",
                        help="v12: monitor separado. pedidos=só transmissão; cadastros=estoque/preços/clientes; status=OF/NF.")
    args = parser.parse_args()

    if args.monitorar and args.tarefa == "pedidos":
        sys.exit(_loop_dedicado("pedidos-erp", MONITOR_INTERVALO_PEDIDOS_DEDICADO, lambda: transmitir_pedidos()))
    if args.monitorar and args.tarefa == "status":
        sys.exit(_loop_dedicado("status-pedidos", MONITOR_INTERVALO_STATUS_PEDIDOS, _status_e_boletos))

    if args.monitorar and args.tarefa == "titulos":
        sys.exit(_loop_dedicado("titulos", MONITOR_INTERVALO_TITULOS, _titulos_ciclo))
    if args.monitorar and args.tarefa == "boletos":
        sys.exit(_loop_dedicado("boletos", MONITOR_INTERVALO_BOLETOS_DEDICADO,
                                lambda: sincronizar_status_pedidos(["--boletos-abertos"], "boletos")))

    if args.transmitir_pedidos or args.dry_pedidos:
        sys.exit(0 if transmitir_pedidos(dry=args.dry_pedidos) else 1)

    if not (args.once or args.dry_run or args.monitorar):
        parser.error("Use --monitorar (24h), --once (execução única) ou --dry-run (teste sem gravar).")

    chaves = args.only or list(ENTIDADES)
    if args.dry_run:
        os.environ["DRY_RUN_ONLY"] = "1"
    check_config(usar_painel=not args.sem_painel, chaves=chaves)

    if args.monitorar:
        sys.exit(monitorar(chaves, usar_painel=not args.sem_painel, ver_navegador=args.ver_navegador))

    ok = rodar(chaves, usar_painel=not args.sem_painel, dry_run=args.dry_run, ver_navegador=args.ver_navegador)
    sys.exit(0 if ok else 1)
