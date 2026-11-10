"""
Produtos + estoque DiColore direto do ERP -> MPZ (sem Google Sheets e sem navegador).

1) Lê a view vw_mpz_produtos (mesma que alimentava a planilha) e envia ao MPZ:
   produtos novos, nomes, preços (tabelas 1/3/4/8/9), grupos (cria categoria nova
   e move o produto) e inativa o que saiu da view.
2) Lê a view mpz_produto_estoque (estoque DISPONÍVEL) e atualiza o saldo.
   Produtos da loja que não estão na view ficam com estoque 0.

Uso:
    python sync_estoque_erp.py              # uma vez
    python sync_estoque_erp.py --monitorar  # a cada 5 min (MONITOR_INTERVALO_ESTOQUE_ERP)
    python sync_estoque_erp.py --dry-run    # só mostra, não envia
    python sync_estoque_erp.py --sem-produtos  # só estoque
"""
import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import requests

_BASE = Path(__file__).resolve().parent
# Mesmos arquivos lidos pelo monitor de títulos (sync_dicolore_financeiro_v5.py).
ARQUIVOS_ENV = (_BASE / "dicolore.env", _BASE / ".env",
                _BASE / "importacao" / "importacao.env", _BASE / "importacao.env")


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
API_URL = "https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/sync-stock-erp"
SYNC_TOKEN = _env("TITLES_SYNC_TOKEN", "MPZ_SYNC_TOKEN")
STORE_SLUG = _env("STORE_SLUG", padrao="dicolore")
VIEW = _env("VIEW_ESTOQUE_ERP", padrao="mpz_produto_estoque")
INTERVALO = int(_env("MONITOR_INTERVALO_ESTOQUE_ERP", padrao="300"))
API_PRODUTOS = "https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/sync-prices"
VIEW_PRODUTOS = _env("VIEW_PRODUTOS_ERP", padrao="vw_mpz_produtos")
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


def ler_produtos():
    with psycopg2.connect(**DB) as conn, conn.cursor() as cur:
        cur.execute(f"SELECT * FROM {VIEW_PRODUTOS}")
        cab = [d[0] for d in cur.description]
        linhas = [["" if v is None else str(v).strip() for v in r] for r in cur.fetchall()]
    return [cab] + linhas


def enviar_produtos(rows):
    r = requests.post(API_PRODUTOS, data=json.dumps({"store_slug": STORE_SLUG, "rows": rows}),
                      headers={"x-sync-token": SYNC_TOKEN, "Content-Type": "application/json"},
                      timeout=(10, 300))
    if r.status_code >= 400:
        raise RuntimeError(f"Produtos HTTP {r.status_code}: {r.text[:300]}")
    res = r.json()
    if res.get("success") is not True:
        raise RuntimeError("O MPZ não confirmou a gravação dos produtos.")
    return res


def ciclo_produtos(dry_run=False, ultima=None):
    rows = ler_produtos()
    log(f"View {VIEW_PRODUTOS}: {len(rows) - 1} produtos lidos. Colunas: {', '.join(rows[0])}")
    if len(rows) < 2:
        log("View de produtos vazia; nada enviado (proteção para não inativar a loja).")
        return ultima
    assinatura = hashlib.md5(json.dumps(rows).encode()).hexdigest()
    if assinatura == ultima:
        log("Produtos sem alteração desde o último envio.")
        return ultima
    if dry_run:
        for r in rows[1:6]:
            log("  " + " | ".join(r))
        return assinatura
    res = enviar_produtos(rows)
    log(f"MPZ produtos: {res['created_products']} novos, {res['updated_prices']} preços, "
        f"{res['updated_names']} nomes, {res['updated_categories']} trocas de grupo "
        f"({res['created_categories']} categorias novas), {res['deactivated_products']} inativados.")
    if not res.get("has_category_column"):
        log("ATENÇÃO: a view não tem coluna de grupo (Des GRP); categorias não foram atualizadas.")
    return assinatura


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
    p.add_argument("--sem-produtos", action="store_true")
    a = p.parse_args()
    if not SYNC_TOKEN:
        log("TITLES_SYNC_TOKEN não encontrado. Procurado em: " + ", ".join(str(a) for a in ARQUIVOS_ENV))
        sys.exit(1)
    if not a.monitorar:
        if not a.sem_produtos:
            ciclo_produtos(a.dry_run)
        ciclo(a.dry_run)
        return
    ultimo = None
    ultima_prod = None
    while True:
        inicio = time.time()
        try:
            if not a.sem_produtos:
                ultima_prod = ciclo_produtos(a.dry_run, ultima_prod)
        except Exception as e:
            log(f"ERRO produtos: {e}")
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
