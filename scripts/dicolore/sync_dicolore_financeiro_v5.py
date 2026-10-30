"""DiColore v17 (títulos e boletos com monitores próprios) / v16 (financeiro por período em lotes): pedidos por período lidos em lotes de códigos (cada lote gravado na hora);
--pedido para busca individual. Não altera configurações nem escreve no ERP. --com-itens é opcional."""
import argparse
from decimal import Decimal
from datetime import timedelta
import base64
import json
import os
import sys
import time
from datetime import date, datetime

import psycopg2
import psycopg2.extras
from psycopg2.extensions import new_type, register_type
import requests

# ---------------- CONFIGURAÇÃO ----------------
# Lê automaticamente os MESMOS dados já usados pelo monitor (dicolore.env / .env)
# e o token do integrador (importacao/importacao.env). Não precisa editar nada aqui.
from pathlib import Path
_BASE = Path(__file__).parent
def _carregar_env(arq):
    try:
        for linha in arq.read_text(encoding="utf-8-sig").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, v = linha.split("=", 1)
            k = k.strip(); v = v.strip().strip('"').strip("'")
            if k and not os.environ.get(k):
                os.environ[k] = v
    except FileNotFoundError:
        pass
for _arq in (_BASE / "dicolore.env", _BASE / ".env", _BASE / "importacao" / "importacao.env", _BASE / "importacao.env"):
    _carregar_env(_arq)

def _env(*nomes, padrao=""):
    for n in nomes:
        v = os.environ.get(n)
        if v:
            return v
    return padrao

DB = dict(
    host=_env("ERP_DB_HOST", "PG_HOST", padrao="localhost"),
    port=int(_env("ERP_DB_PORT", "PG_PORT", padrao="5432")),
    dbname=_env("ERP_DB_NAME", "PG_DB"),
    user=_env("ERP_DB_USER", "PG_USER"),
    password=_env("ERP_DB_PASS", "PG_PASS"),
    connect_timeout=15,
    options="-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000",
)
API_URL = "https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/sync-titles"
SYNC_TOKEN = _env("TITLES_SYNC_TOKEN", "MPZ_SYNC_TOKEN")
STORE_SLUG = _env("STORE_SLUG", padrao="dicolore")
# Boletos: envia apenas de títulos NÃO pagos com vencimento a partir de N dias atrás
BOLETO_DIAS_ATRAS = int(os.getenv("BOLETO_DIAS_ATRAS", "365"))
TITLES_BATCH = 1000
INVOICES_BATCH = 1000
BOLETOS_BATCH = 20
ORDERS_BATCH = 1000
ORDER_ITEMS_BATCH = 5000
# ----------------------------------------------


def log(msg):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


INVALID_DATES = {"infinity", "-infinity", "infinite", "-infinite"}

def parse_erp_temporal(value, _cursor):
    # Recebe datas como texto para impedir que o driver falhe em datas BC/-infinity.
    if value is None:
        return None
    raw = str(value).strip()
    lowered = raw.lower()
    if lowered in INVALID_DATES or " bc" in lowered:
        return None
    try:
        year_text = raw[:4]
        if not year_text.isdigit() or int(year_text) < 1 or int(year_text) > 9999:
            return None
    except (TypeError, ValueError):
        return None
    return raw

def register_safe_temporals(conn):
    # PostgreSQL: date=1082, timestamp=1114, timestamptz=1184.
    safe_temporal = new_type((1082, 1114, 1184), "SAFE_ERP_TEMPORAL", parse_erp_temporal)
    register_type(safe_temporal, conn)

def to_json(v):
    if isinstance(v, Decimal):
        return float(v)
    if hasattr(v, "isoformat"):  # date, datetime e time
        try:
            return v.isoformat()
        except (ValueError, OverflowError):
            return None
    return v


def post(payload, tries=2):
    expected = {"orders": "ordersUpserted", "order_items": "orderItemsSaved"}
    for attempt in range(tries):
        try:
            response = requests.post(API_URL, data=json.dumps(payload, default=str),
                headers={"x-sync-token": SYNC_TOKEN, "Content-Type": "application/json"},
                timeout=(10, 45))
            if 400 <= response.status_code < 500:
                raise RuntimeError(f"Envio recusado (HTTP {response.status_code}); confira token/configuração.")
            response.raise_for_status()
            result = response.json()
            if result.get("ok") is not True:
                raise RuntimeError("O sistema não confirmou a gravação.")
            for field, counter in expected.items():
                if field in payload and result.get(counter) != len(payload[field]):
                    raise RuntimeError(f"Gravação incompleta de {field}; etapa não confirmada.")
            return result
        except (requests.RequestException, ValueError):
            log(f"Envio sem confirmação: tentativa {attempt + 1}/{tries}.")
            if attempt + 1 < tries:
                time.sleep(2)
    raise RuntimeError("Envio sem confirmação após duas tentativas.")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--somente-pedidos", action="store_true")
    parser.add_argument("--somente-boletos", action="store_true",
                        help="Envia só os PDFs de boletos dos títulos em aberto.")
    parser.add_argument("--nota", action="append", help="NF do boleto; pode repetir. Ignora datas.")
    parser.add_argument("--boletos-dias", type=int, default=None,
                        help="Só boletos de títulos emitidos nos últimos N dias (monitor usa 30).")
    parser.add_argument("--de", help="Data inicial dos títulos/notas/boletos (ex.: 01/09/2026).")
    parser.add_argument("--ate", help="Data final (ex.: 26/10/2026); padrão hoje.")
    parser.add_argument("--titulos", choices=["rapido", "completo"],
                        help="v17: rapido=em aberto + quitados/emitidos nos últimos dias; completo=todos desde a data do admin.")
    parser.add_argument("--boletos-abertos", action="store_true",
                        help="v17: boletos de todos os títulos em aberto desde a data do admin.")
    parser.add_argument("--dias-recentes", type=int, default=int(os.getenv("TITULOS_DIAS_RECENTES", "5")))
    parser.add_argument("--dias", type=int, default=int(os.getenv("PEDIDOS_DIAS", "15")))
    parser.add_argument("--pedido", action="append", help="Código ERP; pode repetir. Ignora --dias.")
    parser.add_argument("--pendentes", action="store_true",
                        help="Busca na nuvem os códigos sem OF/NF e consulta cada um (rápido).")
    parser.add_argument("--max-pendentes", type=int, default=int(os.getenv("PEDIDOS_MAX_PENDENTES", "40")))
    parser.add_argument("--com-itens", action="store_true", help="Atualiza itens após cada cabeçalho (mais lento).")
    parser.add_argument("--por-dia", action="store_true", help="Modo antigo: uma consulta por dia.")
    parser.add_argument("--consulta-unica", action="store_true",
                        help="Modo v13: uma única consulta para o período inteiro (pode estourar o tempo).")
    parser.add_argument("--lote", type=int, default=int(os.getenv("PEDIDOS_LOTE", "20")),
                        help="Pedidos por consulta no modo em lotes (padrão 20).")
    parser.add_argument("--timeout-lote", type=int, default=int(os.getenv("PEDIDOS_TIMEOUT_LOTE", "180")),
                        help="Limite por lote, em segundos (padrão 180).")
    parser.add_argument("--timeout-sql", type=int, default=int(os.getenv("PEDIDOS_TIMEOUT_SQL", "300")),
                        help="Limite por consulta, em segundos (padrão 300).")
    args = parser.parse_args(argv)
    if args.dias < 1 or args.timeout_sql < 1 or args.lote < 1 or args.timeout_lote < 1:
        parser.error("Dias, lote e tempos limite precisam ser positivos.")
    if args.pedido and any(not code.strip().isdigit() for code in args.pedido):
        parser.error("Use o código numérico ERP em --pedido.")
    return args


def main():
    args = parse_args()
    if not SYNC_TOKEN or not DB["dbname"] or not DB["user"]:
        raise RuntimeError("Configuração incompleta: confira banco e token nos arquivos .env existentes.")
    log("v16: conectando ao ERP (limite de conexão: 15s)...")
    config = dict(DB)
    config["options"] = ("-c default_transaction_read_only=on "
                         f"-c statement_timeout={args.timeout_sql * 1000} -c lock_timeout=5000")
    if os.getenv("PG_SSLMODE"):
        config["sslmode"] = os.environ["PG_SSLMODE"]
    conn = psycopg2.connect(**config)
    conn.autocommit = True
    try:
        run_connected(conn, args)
    finally:
        conn.close()


def run_connected(conn, args):
    register_safe_temporals(conn)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if args.nota:
        return sync_boletos(cur, notas=args.nota)
    if args.titulos:
        return sync_titulos(cur, args.titulos, args)
    if args.boletos_abertos:
        return sync_boletos_abertos(cur, args)
    if args.somente_boletos:
        de, ate = periodo_boletos(args)
        return sync_financeiro_periodo(cur, de, ate)
    if args.somente_pedidos or args.pedido:
        return sync_pedidos(conn, cur, args)

    # 1) Títulos
    cur.execute("SELECT * FROM dw_titulo")
    titles = [{k: to_json(v) for k, v in row.items()} for row in cur.fetchall()]
    log(f"{len(titles)} títulos lidos da view dw_titulo")
    for i in range(0, len(titles), TITLES_BATCH):
        res = post({"store_slug": STORE_SLUG, "titles": titles[i:i + TITLES_BATCH]})
        log(f"Títulos {i + 1}-{i + len(titles[i:i + TITLES_BATCH])}: {res.get('titlesUpserted')} gravados")

    # 2) Notas fiscais (a própria view limita os registros aos últimos 730 dias)
    cur.execute("SELECT * FROM dw_nota_fiscal")
    invoices = [{k: to_json(v) for k, v in row.items()} for row in cur.fetchall()]
    log(f"{len(invoices)} notas fiscais lidas da view dw_nota_fiscal")
    for i in range(0, len(invoices), INVOICES_BATCH):
        chunk = invoices[i:i + INVOICES_BATCH]
        res = post({"store_slug": STORE_SLUG, "invoices": chunk})
        log(f"Notas {i + 1}-{i + len(chunk)}: {res.get('invoicesUpserted')} gravadas")

    # 3) Boletos dos títulos em aberto/vencidos
    sync_boletos(cur, notas=args.nota, dias_emissao=args.boletos_dias)

    sync_pedidos(conn, cur, args)


BOLETOS_NOTAS_LOTE = int(os.getenv("BOLETOS_NOTAS_LOTE", "30"))


def parse_data(texto):
    texto = texto.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Data inválida: {texto} (use 01/09/2026)")


def periodo_boletos(args):
    hoje = date.today()
    if args.de:
        de = parse_data(args.de)
        ate = parse_data(args.ate) if args.ate else hoje
    else:
        de = hoje - timedelta(days=args.boletos_dias or 30)
        ate = hoje
    return de, ate


def sync_financeiro_periodo(cur, de, ate):
    """v16: títulos + notas fiscais + boletos de um período, em etapas leves."""
    log(f"Financeiro de {de:%d/%m/%Y} até {ate:%d/%m/%Y}")
    # 1) Títulos emitidos no período
    t0 = time.monotonic()
    cur.execute("SELECT * FROM dw_titulo WHERE data_emissao BETWEEN %s AND %s", (de, ate))
    titles = [{k: to_json(v) for k, v in row.items()} for row in cur.fetchall()]
    log(f"Títulos: {len(titles)} lidos em {time.monotonic() - t0:.1f}s")
    for i in range(0, len(titles), TITLES_BATCH):
        res = post({"store_slug": STORE_SLUG, "titles": titles[i:i + TITLES_BATCH]})
        log(f"  Títulos {i + 1}-{i + len(titles[i:i + TITLES_BATCH])}: {res.get('titlesUpserted')} gravados")
    # 2) Notas fiscais emitidas no período
    t0 = time.monotonic()
    try:
        cur.execute("SELECT * FROM dw_nota_fiscal WHERE data_emissao BETWEEN %s AND %s", (de, ate))
        invoices = [{k: to_json(v) for k, v in row.items()} for row in cur.fetchall()]
        log(f"Notas fiscais: {len(invoices)} lidas em {time.monotonic() - t0:.1f}s")
        for i in range(0, len(invoices), INVOICES_BATCH):
            chunk = invoices[i:i + INVOICES_BATCH]
            res = post({"store_slug": STORE_SLUG, "invoices": chunk})
            log(f"  Notas {i + 1}-{i + len(chunk)}: {res.get('invoicesUpserted')} gravadas")
    except psycopg2.Error as e:
        log(f"Notas fiscais: falha na leitura ({e.__class__.__name__}); seguindo para os boletos.")
    # 3) Boletos: só as NFs com título em aberto no período, em lotes pequenos
    notas = sorted({str(t.get("codigo")) for t in titles
                    if t.get("codigo") and str(t.get("status") or "").upper() != "PAGO"})
    log(f"Boletos: {len(notas)} NFs com título em aberto no período")
    total = 0
    lotes = [notas[i:i + BOLETOS_NOTAS_LOTE] for i in range(0, len(notas), BOLETOS_NOTAS_LOTE)]
    for n, lote in enumerate(lotes, 1):
        t0 = time.monotonic()
        try:
            total += sync_boletos(cur, notas=lote, silencioso=True)
            log(f"  Lote {n}/{len(lotes)}: {len(lote)} NFs em {time.monotonic() - t0:.1f}s (total {total} boletos)")
        except psycopg2.errors.QueryCanceled:
            log(f"  Lote {n}/{len(lotes)}: excedeu o tempo; pulado, tenta no próximo ciclo.")
    log(f"CONCLUÍDO: {len(titles)} títulos, {total} boletos gravados na plataforma.")
    return total


SUPABASE_URL = "https://buvhdqpbpbwpzidzmdqh.supabase.co"
ANON_KEY = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmhkcXBicGJ3cHppZHptZHFoIiwi"
            "cm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjkxNjAsImV4cCI6MjA4NjMwNTE2MH0.-9GJg347r5JKvbRwNTd2RnOmIgi99KTN1xMl46WJ6mg")


def data_inicio_admin(args):
    """Data mínima definida pelo admin (Títulos > data mínima). --de ou TITULOS_DE têm prioridade."""
    if args.de:
        return parse_data(args.de)
    if os.getenv("TITULOS_DE"):
        return parse_data(os.environ["TITULOS_DE"])
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/stores", timeout=20,
                         params={"slug": f"eq.{STORE_SLUG}", "select": "settings"},
                         headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"})
        r.raise_for_status()
        rows = r.json()
        d = (rows[0].get("settings") or {}).get("titlesStartDate") if rows else None
        if d:
            return parse_data(str(d)[:10])
    except Exception as e:
        log(f"Aviso: não li a data do admin ({e.__class__.__name__}); usando 365 dias.")
    return date.today() - timedelta(days=365)


def enviar_titulos(rows):
    total = 0
    for i in range(0, len(rows), TITLES_BATCH):
        res = post({"store_slug": STORE_SLUG, "titles": rows[i:i + TITLES_BATCH]})
        total += res.get("titlesUpserted") or 0
        log(f"  Títulos {i + 1}-{i + len(rows[i:i + TITLES_BATCH])}: {res.get('titlesUpserted')} gravados")
    return total


def sync_titulos(cur, modo, args):
    """v17: atualiza status/baixas de TODOS os clientes.
    rapido: títulos em aberto + quitados ou emitidos nos últimos N dias (a cada poucos minutos).
    completo: todos os títulos desde a data definida pelo admin (1x por dia), mês a mês."""
    de = data_inicio_admin(args)
    hoje = date.today()
    t0 = time.monotonic()
    if modo == "rapido":
        rec = hoje - timedelta(days=args.dias_recentes)
        cur.execute("""SELECT * FROM dw_titulo
                        WHERE data_emissao >= %s
                          AND (status <> 'PAGO' OR data_quitacao >= %s OR data_emissao >= %s)""",
                    (de, rec, rec))
        rows = [{k: to_json(v) for k, v in r.items()} for r in cur.fetchall()]
        log(f"Títulos (rápido, desde {de:%d/%m/%Y}): {len(rows)} lidos em {time.monotonic() - t0:.1f}s")
        n = enviar_titulos(rows)
        log(f"CONCLUÍDO: {n} títulos atualizados.")
        return n
    total, ini = 0, de
    while ini <= hoje:
        fim = min((ini.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1), hoje)
        t0 = time.monotonic()
        try:
            cur.execute("SELECT * FROM dw_titulo WHERE data_emissao BETWEEN %s AND %s", (ini, fim))
            rows = [{k: to_json(v) for k, v in r.items()} for r in cur.fetchall()]
            log(f"Títulos {ini:%d/%m/%Y}-{fim:%d/%m/%Y}: {len(rows)} lidos em {time.monotonic() - t0:.1f}s")
            total += enviar_titulos(rows)
        except psycopg2.errors.QueryCanceled:
            log(f"  {ini:%m/%Y}: excedeu o tempo; tenta no próximo ciclo.")
        ini = fim + timedelta(days=1)
    log(f"CONCLUÍDO (completo desde {de:%d/%m/%Y}): {total} títulos atualizados.")
    return total


def sync_boletos_abertos(cur, args):
    """v17: boletos de todos os títulos em aberto desde a data do admin, em lotes de NFs."""
    de = data_inicio_admin(args)
    cur.execute("SELECT DISTINCT codigo FROM dw_titulo WHERE status <> 'PAGO' AND data_emissao >= %s", (de,))
    notas = sorted({str(r["codigo"]) for r in cur.fetchall() if r.get("codigo")})
    log(f"Boletos: {len(notas)} NFs com título em aberto desde {de:%d/%m/%Y}")
    total = 0
    lotes = [notas[i:i + BOLETOS_NOTAS_LOTE] for i in range(0, len(notas), BOLETOS_NOTAS_LOTE)]
    for n, lote in enumerate(lotes, 1):
        t0 = time.monotonic()
        try:
            total += sync_boletos(cur, notas=lote, silencioso=True)
            log(f"  Lote {n}/{len(lotes)}: {len(lote)} NFs em {time.monotonic() - t0:.1f}s (total {total})")
        except psycopg2.errors.QueryCanceled:
            log(f"  Lote {n}/{len(lotes)}: excedeu o tempo; pulado.")
    log(f"CONCLUÍDO: {total} boletos gravados.")
    return total


def sync_boletos(cur, notas=None, dias_emissao=None, silencioso=False):
    """Envia os PDFs da dw_arquivo_boleto dos títulos não pagos.
    notas: lista de NFs (ignora datas). dias_emissao: só títulos emitidos nos últimos N dias."""
    sql = """
        SELECT b.empresa::text AS filial_codigo, b.nota::text AS nota,
               b.serie::text AS serie, b.parcela::text AS parcela, b.arquivo
          FROM dw_arquivo_boleto b
          JOIN dw_titulo t
            ON t.codigo = b.nota::text
           AND t.parcela = b.serie::text || b.parcela::text
           AND t.filial_codigo = b.empresa::text
         WHERE t.status <> 'PAGO'
    """
    params = []
    if notas:
        sql += " AND b.nota::text = ANY(%s)"
        params.append([n.strip() for n in notas])
        if not silencioso:
            log(f"Boletos: buscando NF {', '.join(params[0])}...")
    else:
        sql += " AND t.data_vencimento >= current_date - %s"
        params.append(BOLETO_DIAS_ATRAS)
        if dias_emissao:
            sql += " AND t.data_emissao >= current_date - %s"
            params.append(dias_emissao)
            log(f"Boletos: títulos em aberto emitidos nos últimos {dias_emissao} dias...")
        else:
            log("Boletos: todos os títulos em aberto...")
    cur.execute(sql, params)
    batch, total, lidos = [], 0, 0

    def flush():
        nonlocal total, batch
        if not batch:
            return
        res = post({"store_slug": STORE_SLUG, "boletos": batch})
        total += res.get("boletosSaved", 0)
        for err in res.get("boletoErrors", []):
            log(f"  aviso: {err}")
        batch = []

    for row in cur.fetchall():
        lidos += 1
        batch.append({
            "filial_codigo": row["filial_codigo"], "nota": row["nota"],
            "serie": row["serie"], "parcela": row["parcela"],
            "arquivo_base64": base64.b64encode(bytes(row["arquivo"])).decode(),
        })
        if len(batch) >= BOLETOS_BATCH:
            flush()
    flush()
    if not silencioso:
        log(f"Boletos: {lidos} lidos no ERP, {total} gravados na plataforma")
    return total


def normalize_order(row):
    order = {k: to_json(v) for k, v in row.items()}
    required = ("codigo_importacao", "cliente_codigo", "status", "ordem_faturamento", "nota_fiscal_numero")
    if any(field not in order for field in required):
        raise RuntimeError("A vw_mpz_pedido não retornou todos os campos necessários; nada enviado deste lote.")
    for field in ("ordem_faturamento", "nota_fiscal_numero"):
        value = order[field]
        order[field] = None if value in (None, "", 0, "0") else str(value).strip()
    order["status"] = str(order["status"] or "").strip().upper()
    order["codigo_importacao"] = str(order["codigo_importacao"] or "").strip()
    if order["status"] not in ("N", "S", "F") or not order["codigo_importacao"]:
        raise RuntimeError("Pedido com código/status inválido; lote não enviado.")
    order["observacao_comercial"] = str(order.get("observacao_comercial") or "")[:2000]
    return order


def enrich_televendas(cur, orders):
    """v15: marca pedidos do televendas (pe001.pedtelven = S) e a operadora (pe001.pedotvcod)."""
    codes = [o["codigo_importacao"] for o in orders if o.get("codigo_importacao")]
    if not codes:
        return orders
    try:
        cur.execute("SELECT pedcod::text AS pedcod, pedtelven, pedotvcod FROM pe001 "
                    "WHERE pedempcod::text = '1' AND pedcod::text = ANY(%s)", (codes,))
        tv = {str(r["pedcod"]).strip(): r for r in cur.fetchall()}
    except Exception as e:
        conn = getattr(cur, "connection", None)
        if conn is not None:
            conn.rollback()
        log(f"AVISO: não foi possível ler pedtelven/pedotvcod ({e}); pedidos enviados sem marca de televendas.")
        return orders
    for o in orders:
        r = tv.get(o["codigo_importacao"])
        if r is None:
            continue
        o["pedido_televendas"] = str(r.get("pedtelven") or "").strip().upper()
        cod = r.get("pedotvcod")
        o["televendas_codigo"] = "" if cod in (None, "", 0, "0") else str(cod).strip()
    return orders


def query_windows(args, today=None):
    if args.pedido:
        for code in dict.fromkeys(c.strip() for c in args.pedido):
            yield f"pedido ERP {code}", "SELECT * FROM vw_mpz_pedido WHERE codigo_importacao = %s", (code,)
        return
    today = today or date.today()
    sql = "SELECT * FROM vw_mpz_pedido WHERE data_emissao >= %s AND data_emissao < %s"
    if getattr(args, "por_dia", False):
        # Modo antigo: um dia por vez, mais recentes primeiro.
        for offset in range(args.dias):
            day = today - timedelta(days=offset)
            yield str(day), sql, (day, day + timedelta(days=1))
        return
    # v13: UMA consulta só para o período inteiro (a view custa o mesmo para 1 ou 90 dias).
    start = today - timedelta(days=args.dias - 1)
    yield f"{start} a {today}", sql, (start, today + timedelta(days=1))


def historico_liberado(agora=None):
    """Pedidos antigos só depois das 17:30 (ou antes das 7:00)."""
    agora = agora or datetime.now()
    hm = agora.hour * 60 + agora.minute
    return hm >= 17 * 60 + 30 or hm < 7 * 60


def select_codes(codes, priority, limit, historico):
    """Pedidos do dia (transmitidos pelo site) sempre primeiro e todos; antigos só no horário liberado."""
    head = codes[:priority]
    if not historico:
        return head
    rest = codes[priority:]
    import random
    room = max(limit - len(head), 0)
    return head + random.sample(rest, min(len(rest), room))


NOITE_DIAS = int(os.getenv("PEDIDOS_DIAS_NOITE", "120"))
NOITE_MAX_PENDENTES = int(os.getenv("PEDIDOS_MAX_PENDENTES_NOITE", "150"))


def fetch_pending_codes(limit, days=30):
    """Dia: só recentes (3 dias). Noite (após 17:30/antes 7:00): varre até 120 dias e limpa cancelados."""
    historico = historico_liberado()
    if historico:
        days = max(days, NOITE_DIAS)
        limit = max(limit, NOITE_MAX_PENDENTES)
    response = requests.post(API_URL, data=json.dumps({"store_slug": STORE_SLUG, "action": "pending_order_codes",
                             "days": days if historico else 3}), headers={"x-sync-token": SYNC_TOKEN,
                             "Content-Type": "application/json"}, timeout=(10, 45))
    response.raise_for_status()
    result = response.json()
    if result.get("ok") is not True:
        raise RuntimeError("A nuvem não retornou a lista de pedidos pendentes.")
    codes = [str(c) for c in result.get("codes", []) if str(c).isdigit()]
    priority = int(result.get("priority", 0))
    if historico:
        log(f"Rotina noturna: conferindo pedidos sem OF/NF de até {days} dias ({len(codes)} na fila, até {limit} por ciclo).")
    else:
        log("Horário comercial: só pedidos recentes transmitidos pelo site; antigos após 17:30.")
    return select_codes(codes, priority, limit, historico)


def mark_missing(codes):
    """Pedidos que a view não retorna mais (excluídos/cancelados no ERP) são removidos da plataforma."""
    if not codes:
        return
    result = post({"store_slug": STORE_SLUG, "action": "mark_missing_orders", "codes": codes})
    log(f"{result.get('marked', 0)} pedidos não existem mais no ERP; removidos da plataforma: {', '.join(codes)}")


# v14: lista leve de códigos direto na tabela de pedidos (mesmos filtros da view).
CODES_SQL = ("SELECT pedcod::text AS pedcod FROM pe001 "
             "WHERE peddatemi >= %s AND peddatemi < %s AND pedmcpcod <= 0 AND pedempcod::text = '1' "
             "ORDER BY peddatemi DESC")
BATCH_SQL = "SELECT * FROM vw_mpz_pedido WHERE codigo_importacao = ANY(%s)"


def chunked(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]


def list_period_codes(cur, args, today=None):
    today = today or date.today()
    start = today - timedelta(days=args.dias - 1)
    log(f"Etapa A: listando códigos de pedidos de {start} a {today} (tabela pe001)...")
    started = time.monotonic()
    cur.execute(CODES_SQL, (start, today + timedelta(days=1)))
    codes = list(dict.fromkeys(str(r["pedcod"]).strip() for r in cur.fetchall() if r.get("pedcod")))
    log(f"Etapa A: {len(codes)} códigos em {time.monotonic() - started:.1f}s.")
    return codes


def sync_por_lotes(cur, args, today=None):
    """Lê a view em lotes pequenos de códigos e grava cada lote antes de seguir."""
    codes = list_period_codes(cur, args, today)
    if not codes:
        log("CONCLUÍDO: nenhum pedido no período.")
        return 0
    cur.execute("SELECT set_config('statement_timeout', %s, false)", (str(args.timeout_lote * 1000),))
    fila = chunked(codes, args.lote)
    n_lotes = len(fila)
    total, lidos, skipped, numero = 0, 0, [], 0
    while fila:
        lote = fila.pop(0)
        numero += 1
        started = time.monotonic()
        try:
            cur.execute(BATCH_SQL, (lote,))
            orders = [normalize_order(row) for row in cur.fetchall()]
            orders = enrich_televendas(cur, orders)
        except psycopg2.errors.QueryCanceled:
            if len(lote) > 1:
                meio = len(lote) // 2
                log(f"Lote {numero}: {len(lote)} pedidos excederam {args.timeout_lote}s; dividindo em 2.")
                fila[0:0] = [lote[:meio], lote[meio:]]
            else:
                log(f"Pedido {lote[0]}: excedeu {args.timeout_lote}s sozinho; pulado.")
                skipped.append(lote[0])
            continue
        lidos += len(lote)
        if orders:
            result = post({"store_slug": STORE_SLUG, "orders": orders})
            total += result["ordersUpserted"]
            if args.com_itens:
                sync_items(cur, orders)
        log(f"Lote {numero} ({lidos}/{len(codes)} códigos, ~{n_lotes} lotes): {len(orders)} pedidos em "
            f"{time.monotonic() - started:.1f}s, gravados.")
    if skipped:
        log(f"AVISO: {len(skipped)} pedidos pulados por tempo: {', '.join(skipped)} "
            "(tente depois com --pedido CODIGO).")
    log(f"CONCLUÍDO: {total} pedidos confirmados em lotes. "
        + ("Itens atualizados." if args.com_itens else "Itens existentes preservados; não consultados."))
    return total


def sync_pedidos(conn, cur, args):
    total = 0
    missing = []
    if args.pendentes and not args.pedido:
        codes = fetch_pending_codes(args.max_pendentes)
        log(f"v14: {len(codes)} pedidos sem OF/NF a consultar por código.")
        if not codes:
            log("CONCLUÍDO: nenhum pedido pendente de OF/NF.")
            return
        args.pedido = codes
        args.pular_falhas = True
    if not args.pedido and not args.consulta_unica and not args.por_dia:
        return sync_por_lotes(cur, args)
    for label, sql, params in query_windows(args):
        log(f"Lendo {label}: vw_mpz_pedido (limite {args.timeout_sql}s)...")
        started = time.monotonic()
        try:
            cur.execute(sql, params)
            orders = [normalize_order(row) for row in cur.fetchall()]
            orders = enrich_televendas(cur, orders)
        except psycopg2.errors.QueryCanceled:
            if getattr(args, "pular_falhas", False):
                log(f"{label}: excedeu {args.timeout_sql}s; pulado, tenta no próximo ciclo.")
                continue
            raise RuntimeError(f"Consulta de {label} excedeu {args.timeout_sql}s. "
                               "Dias já confirmados foram preservados. Teste --pedido 722199; "
                               "se também expirar, a consulta/view precisa de ajuste no servidor ERP.") from None
        log(f"{label}: {len(orders)} pedidos lidos em {time.monotonic() - started:.1f}s.")
        if not orders:
            if args.pedido:
                log(f"{label}: não existe mais na view do ERP.")
                missing.append(label.replace("pedido ERP ", "").strip())
            continue
        for i in range(0, len(orders), ORDERS_BATCH):
            chunk = orders[i:i + ORDERS_BATCH]
            log(f"{label}: enviando {len(chunk)} cabeçalhos com OF/NF; sem alterar itens...")
            result = post({"store_slug": STORE_SLUG, "orders": chunk})
            total += result["ordersUpserted"]
            log(f"{label}: {result['ordersUpserted']} pedidos gravados e confirmados pelo sistema.")
            if args.pedido:
                for order in chunk:
                    log(f"ERP {order['codigo_importacao']}: OF {order['ordem_faturamento'] or '—'} | "
                        f"NF {order['nota_fiscal_numero'] or '—'} | status {order['status']}")
        if args.com_itens:
            sync_items(cur, orders)
    mark_missing(missing)
    log(f"CONCLUÍDO: {total} pedidos confirmados. "
        + ("Itens atualizados." if args.com_itens else "Itens existentes preservados; não consultados."))


def sync_items(cur, orders):
    clientes = {(str(o.get("filial_codigo") or "1").strip(), o["codigo_importacao"]):
                o.get("cliente_codigo") for o in orders}
    log("Lendo itens dos pedidos deste dia (opcional)...")
    cur.execute("SELECT * FROM vw_mpz_pedido_item WHERE pedido_codigo_importacao::text = ANY(%s)",
                ([key[1] for key in clientes],))
    items = []
    for row in cur.fetchall():
        item = {k: to_json(v) for k, v in row.items()}
        key = (str(item.get("filial_codigo") or "1").strip(),
               str(item.get("pedido_codigo_importacao") or "").strip())
        if key not in clientes:
            continue
        item["cliente_codigo"] = clientes[key]
        items.append(item)
    # agrupa por pedido para nunca dividir os itens de um mesmo pedido em lotes diferentes
    items.sort(key=lambda x: (x["filial_codigo"] or "", x["pedido_codigo_importacao"] or ""))
    batch, last = [], None
    for it in items:
        k = (it["filial_codigo"], it["pedido_codigo_importacao"])
        if len(batch) >= ORDER_ITEMS_BATCH and k != last:
            res = post({"store_slug": STORE_SLUG, "order_items": batch})
            log(f"Itens: {res.get('orderItemsSaved')} gravados")
            batch = []
        batch.append(it)
        last = k
    if batch:
        res = post({"store_slug": STORE_SLUG, "order_items": batch})
        log(f"Itens: {res.get('orderItemsSaved')} gravados")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrompido pelo usuário; etapas já confirmadas permanecem gravadas.")
        sys.exit(130)
    except Exception as e:
        log(f"ERRO: {e}")
        sys.exit(1)
