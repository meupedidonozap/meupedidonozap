"""
Clientes DiColore direto do ERP -> MPZ (sem Google Sheets e sem navegador).

Lê a view public.mpz_cliente (mesmo layout da dw_cliente, inclui frete_codigo
0 = CIF / 1 = FOB) e envia ao MPZ só os clientes novos ou alterados.
Clientes novos ganham login automático (usuário e senha = código do cliente).

Uso:
    python sync_clientes_erp.py              # uma vez
    python sync_clientes_erp.py --monitorar  # a cada 3 min (MONITOR_INTERVALO_CLIENTES_ERP)
    python sync_clientes_erp.py --dry-run    # só mostra, não envia
    python sync_clientes_erp.py --tudo       # reenvia todos os clientes
"""
import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

_BASE = Path(__file__).resolve().parent
ARQUIVOS_ENV = (_BASE / "dicolore.env", _BASE / ".env",
                _BASE / "importacao" / "importacao.env", _BASE / "importacao.env")
ESTADO = _BASE / "estado_clientes_erp.json"


def _carregar_env(arq):
    try:
        with open(arq, encoding="utf-8-sig") as f:
            for linha in f:
                linha = linha.strip()
                if not linha or linha.startswith("#") or "=" not in linha:
                    continue
                k, v = linha.split("=", 1)
                k = k.strip(); v = v.strip().strip('"').strip("'")
                if k and not os.environ.get(k):
                    os.environ[k] = v
    except (FileNotFoundError, UnicodeDecodeError):
        pass


for _arq in ARQUIVOS_ENV:
    _carregar_env(_arq)


def _env(*nomes, padrao=None):
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
    options="-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000",
)
API_URL = "https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/sync-customers"
SYNC_TOKEN = _env("TITLES_SYNC_TOKEN", "MPZ_SYNC_TOKEN")
STORE_SLUG = _env("STORE_SLUG", padrao="dicolore")
VIEW = _env("VIEW_CLIENTES_ERP", padrao="public.mpz_cliente")
INTERVALO = int(_env("MONITOR_INTERVALO_CLIENTES_ERP", padrao="180"))
LOTE = 1000


def log(msg):
    print(f"[{datetime.now():%d/%m %H:%M:%S}] [clientes-erp] {msg}", flush=True)


def _txt(v):
    if v is None:
        return ""
    if isinstance(v, (date, datetime)):
        return v.isoformat()[:10]
    if isinstance(v, Decimal):
        return format(v, "f")
    return str(v).strip()


def ler_clientes():
    with psycopg2.connect(**DB) as con, con.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"SELECT * FROM {VIEW}")
        return [{k: _txt(v) for k, v in r.items()} for r in cur.fetchall()]


def _hash(r):
    return hashlib.md5(json.dumps(r, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def carregar_estado():
    try:
        return json.loads(ESTADO.read_text(encoding="utf-8"))
    except Exception:
        return {}


def salvar_estado(e):
    tmp = ESTADO.with_suffix(".tmp")
    tmp.write_text(json.dumps(e), encoding="utf-8")
    tmp.replace(ESTADO)


def enviar(rows):
    r = requests.post(API_URL, data=json.dumps({"store_slug": STORE_SLUG, "rows": rows}),
                      headers={"x-sync-token": SYNC_TOKEN, "Content-Type": "application/json"},
                      timeout=300)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()


def ciclo(dry_run=False, tudo=False):
    clientes = ler_clientes()
    estado = {} if tudo else carregar_estado()
    novos = {}
    mudados = []
    for c in clientes:
        cod = c.get("codigo", "")
        if not cod:
            continue
        h = _hash(c)
        novos[cod] = h
        if estado.get(cod) != h:
            mudados.append(c)
    log(f"ERP: {len(clientes)} clientes na view; {len(mudados)} novos/alterados.")
    if not mudados:
        return
    if dry_run:
        for c in mudados[:20]:
            log(f"  {c.get('codigo')} {c.get('razao_social')} frete={c.get('frete_codigo')} vend={c.get('vendedor_codigo')}")
        return
    for i in range(0, len(mudados), LOTE):
        lote = mudados[i:i + LOTE]
        res = enviar(lote)
        log(f"MPZ lote {i // LOTE + 1}: {res.get('created', 0)} criados, {res.get('updated', 0)} atualizados, "
            f"{res.get('skipped', 0)} sem mudança, {res.get('access_created', 0)} logins criados, "
            f"{res.get('errors', 0)} erros.")
        for e in res.get("error_samples") or []:
            log(f"  erro {e.get('codigo')}: {e.get('erro')}")
        erros = {str(e.get("codigo")) for e in (res.get("error_samples") or [])}
        # Confirma o lote no estado (clientes com erro serão reenviados no próximo ciclo)
        for c in lote:
            if c["codigo"] not in erros:
                estado[c["codigo"]] = novos[c["codigo"]]
        salvar_estado(estado)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--monitorar", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--tudo", action="store_true")
    a = p.parse_args()
    if not SYNC_TOKEN:
        log("TITLES_SYNC_TOKEN não encontrado. Procurado em: " + ", ".join(str(x) for x in ARQUIVOS_ENV))
        sys.exit(1)
    if not a.monitorar:
        ciclo(a.dry_run, a.tudo)
        return
    log(f"Monitorando {VIEW} a cada {INTERVALO}s.")
    primeiro = True
    while True:
        inicio = time.time()
        try:
            ciclo(a.dry_run, a.tudo and primeiro)
        except Exception as e:
            log(f"ERRO: {e}")
        primeiro = False
        log(f"Próximo ciclo em {INTERVALO}s.")
        time.sleep(max(30, INTERVALO - (time.time() - inicio)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
