"""
Estoque DiColore direto do ERP -> MPZ (sem Google Sheets e sem navegador).

Lê a view mpz_produto_estoque (estoque DISPONÍVEL, só produtos com proenvpalm = 1)
e envia ao MPZ. Produtos da loja que não estão na view ficam com estoque 0.

Uso:
    python sync_estoque_erp.py              # uma vez
    python sync_estoque_erp.py --monitorar  # a cada 5 min (MONITOR_INTERVALO_ESTOQUE_ERP)
    python sync_estoque_erp.py --dry-run    # só mostra, não envia
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import requests

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass


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
API_URL = "https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/sync-stock-erp"
SYNC_TOKEN = _env("TITLES_SYNC_TOKEN", "MPZ_SYNC_TOKEN")
STORE_SLUG = _env("STORE_SLUG", padrao="dicolore")
VIEW = _env("VIEW_ESTOQUE_ERP", padrao="mpz_produto_estoque")
INTERVALO = int(_env("MONITOR_INTERVALO_ESTOQUE_ERP", padrao="300"))
SQL = f"SELECT produto_codigo, quantidade_disponivel FROM {VIEW}"


def log(msg):
    print(f"{datetime.now():%d/%m/%Y %H:%M:%S} {msg}", flush=True)


def ler_estoque():
    with psycopg2.connect(**DB) as conn, conn.cursor() as cur:
        cur.execute(SQL)
        dados = {}
        for codigo, qtd in cur.fetchall():
            codigo = str(codigo or "").strip()
            if codigo:
                dados[codigo] = max(0, int(float(qtd or 0)))
        return dados


def enviar(dados):
    payload = {"store_slug": STORE_SLUG, "full": True,
               "stock": [{"codigo": c, "quantidade": q} for c, q in dados.items()]}
    r = requests.post(API_URL, data=json.dumps(payload),
                      headers={"x-sync-token": SYNC_TOKEN, "Content-Type": "application/json"},
                      timeout=(10, 120))
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    res = r.json()
    if res.get("ok") is not True:
        raise RuntimeError("O MPZ não confirmou a gravação.")
    return res


def ciclo(dry_run=False, ultimo=None):
    dados = ler_estoque()
    log(f"View {VIEW}: {len(dados)} produtos lidos.")
    if not dados:
        log("View vazia; nada enviado (proteção para não zerar a loja).")
        return ultimo
    if dados == ultimo:
        log("Sem alteração desde o último envio.")
        return ultimo
    if dry_run:
        for c, q in list(dados.items())[:20]:
            log(f"  {c}: {q}")
        return dados
    res = enviar(dados)
    log(f"MPZ: {res['updated_stock']} produtos e {res['variants_updated']} variações atualizados; "
        f"{res['zeroed_products']} zerados; {res['not_found']} códigos do ERP sem produto no MPZ.")
    return dados


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--monitorar", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    if not SYNC_TOKEN:
        log("Defina TITLES_SYNC_TOKEN no .env.")
        sys.exit(1)
    if not a.monitorar:
        ciclo(a.dry_run)
        return
    ultimo = None
    while True:
        inicio = time.time()
        try:
            ultimo = ciclo(a.dry_run, ultimo)
        except Exception as e:
            log(f"ERRO: {e}")
        log(f"Próximo ciclo em {INTERVALO}s.")
        time.sleep(max(30, INTERVALO - (time.time() - inicio)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
