"""
Itens das Notas Fiscais DiColore: ERP (view public.dw_nota_fiscal_item) -> MPZ.

Alimenta a análise de Clientes (mix de linhas, produtos por vendedor/cidade).
Somente leitura no ERP. Envia uma nota inteira por vez (nunca divide itens de uma
nota entre lotes) e lê um dia por consulta, do mais recente para o mais antigo.

Pré-requisito: as notas (cabeçalhos) já sincronizadas pelo sync_dicolore_financeiro_v5.py.

Uso:
    python sync_itens_nf_erp.py                 # últimos 3 dias
    python sync_itens_nf_erp.py --dias 730      # carga inicial (2 anos)
    python sync_itens_nf_erp.py --monitorar     # a cada 30 min, últimos 3 dias
    python sync_itens_nf_erp.py --dry-run --dias 1
"""
import argparse
import ast
import os
import sys
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

_BASE = Path(__file__).resolve().parent
for _arq in (_BASE / "dicolore.env", _BASE / ".env", _BASE / "importacao" / "importacao.env", _BASE / "importacao.env"):
    try:
        with open(_arq, encoding="utf-8-sig") as f:
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


def _env(*nomes, padrao=None):
    for n in nomes:
        if os.environ.get(n):
            return os.environ[n]
    return padrao


DB = dict(
    host=_env("ERP_DB_HOST", "PG_HOST", padrao="localhost"),
    port=int(_env("ERP_DB_PORT", "PG_PORT", padrao="5432")),
    dbname=_env("ERP_DB_NAME", "PG_DB"),
    user=_env("ERP_DB_USER", "PG_USER"),
    password=_env("ERP_DB_PASS", "PG_PASS"),
    connect_timeout=15,
    options="-c default_transaction_read_only=on -c statement_timeout=180000 -c lock_timeout=5000",
)


def _url_api():
    """Usa o mesmo destino do monitor financeiro instalado (sem executar seu código)."""
    if _env("MPZ_TITLES_API_URL"):
        return _env("MPZ_TITLES_API_URL")
    try:
        arvore = ast.parse((_BASE / "sync_dicolore_financeiro_v5.py").read_text(encoding="utf-8-sig"))
        for node in arvore.body:
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "API_URL" for t in node.targets) \
                    and isinstance(node.value, ast.Constant):
                return node.value.value
    except (OSError, SyntaxError):
        pass
    return None


API_URL = _url_api()
SYNC_TOKEN = _env("TITLES_SYNC_TOKEN", "MPZ_SYNC_TOKEN")
STORE_SLUG = _env("STORE_SLUG", padrao="dicolore")
LOTE_ITENS = 2000
INTERVALO = int(_env("MONITOR_INTERVALO_ITENS_NF", padrao="1800"))

SQL_DIA = """
SELECT i.nota_fiscal_numero, i.nota_fiscal_serie, i.filial_codigo, i.produto_codigo,
       i.valor_total_faturamento, i.quantidade_total_faturamento, i.valor_unitario_faturamento,
       i.comissao_valor, i.cfop
  FROM public.dw_nota_fiscal_item i
 WHERE (i.filial_codigo, i.nota_fiscal_numero, i.nota_fiscal_serie) IN (
       SELECT n.filial_codigo::varchar, n.numero::varchar, n.serie::varchar
         FROM public.dw_nota_fiscal n WHERE n.data_emissao = %s)
"""


def log(msg):
    print(f"[{datetime.now():%d/%m %H:%M:%S}] [itens-nf] {msg}", flush=True)


def _v(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()[:10]
    return str(v).strip() if isinstance(v, str) else v


def post(itens):
    ultimo = None
    for tentativa in range(3):
        try:
            r = requests.post(API_URL, json={"store_slug": STORE_SLUG, "invoice_items": itens},
                              headers={"x-sync-token": SYNC_TOKEN, "Content-Type": "application/json"}, timeout=120)
            if r.status_code == 200:
                return r.json()
            ultimo = f"HTTP {r.status_code}: {r.text[:300]}"
            if r.status_code < 500:
                break
        except requests.RequestException as e:
            ultimo = str(e)
        time.sleep(3 * (tentativa + 1))
    raise RuntimeError(f"MPZ não confirmou o lote: {ultimo}")


def lotes_por_nota(itens):
    """Agrupa por nota e monta lotes sem dividir uma nota."""
    notas = {}
    for it in itens:
        k = (it["filial_codigo"], it["nota_fiscal_numero"], it["nota_fiscal_serie"])
        notas.setdefault(k, []).append(it)
    lote = []
    for grupo in notas.values():
        if lote and len(lote) + len(grupo) > LOTE_ITENS:
            yield lote
            lote = []
        lote.extend(grupo)
    if lote:
        yield lote


def sincronizar(dias, dry_run=False):
    hoje = date.today()
    total = 0
    faltando = set()
    with psycopg2.connect(**DB) as con, con.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        for d in range(dias):
            dia = hoje - timedelta(days=d)
            t0 = time.monotonic()
            cur.execute(SQL_DIA, (dia,))
            itens = [{k: _v(v) for k, v in r.items()} for r in cur.fetchall()]
            if not itens:
                continue
            log(f"{dia:%d/%m/%Y}: {len(itens)} itens lidos em {time.monotonic() - t0:.1f}s")
            if dry_run:
                total += len(itens)
                continue
            for lote in lotes_por_nota(itens):
                res = post(lote)
                total += int(res.get("invoiceItemsSaved") or 0)
                faltando.update(res.get("invoiceItemsMissing") or [])
            log(f"  {dia:%d/%m/%Y}: gravados e confirmados")
    if faltando:
        log(f"Aviso: {len(faltando)} notas ainda sem cabeçalho no MPZ (rode o financeiro). Ex.: {sorted(faltando)[:5]}")
    log(f"Concluído: {total} itens {'lidos (dry-run)' if dry_run else 'gravados'}.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=3)
    ap.add_argument("--monitorar", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not API_URL or not SYNC_TOKEN or not DB["dbname"] or not DB["user"]:
        log("Configuração incompleta (dicolore.env: ERP_DB_*, TITLES_SYNC_TOKEN).")
        sys.exit(1)
    while True:
        try:
            sincronizar(max(1, min(args.dias, 800)), args.dry_run)
        except Exception as e:
            log(f"ERRO: {e}")
            if not args.monitorar:
                sys.exit(1)
        if not args.monitorar:
            break
        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
