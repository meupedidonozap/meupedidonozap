"""DiColore v9: pedidos por dia, OF/NF sem itens por padrão; --pedido para busca individual.
Não altera configurações nem escreve no ERP. --com-itens é opcional."""
import argparse
from decimal import Decimal
from datetime import timedelta
import base64
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
    if isinstance(v, (date, datetime)):
        try:
            return v.isoformat()
        except (ValueError, OverflowError):
            return None
    return v


def post(payload, tries=2):
    expected = {"orders": "ordersUpserted", "order_items": "orderItemsSaved"}
    for attempt in range(tries):
        try:
            response = requests.post(API_URL, json=payload,
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
    parser.add_argument("--dias", type=int, default=int(os.getenv("PEDIDOS_DIAS", "15")))
    parser.add_argument("--pedido", action="append", help="Código ERP; pode repetir. Ignora --dias.")
    parser.add_argument("--com-itens", action="store_true", help="Atualiza itens após cada cabeçalho (mais lento).")
    parser.add_argument("--timeout-sql", type=int, default=30, help="Limite por consulta, em segundos.")
    args = parser.parse_args(argv)
    if args.dias < 1 or args.timeout_sql < 1:
        parser.error("Dias e tempo limite precisam ser positivos.")
    if args.pedido and any(not code.strip().isdigit() for code in args.pedido):
        parser.error("Use o código numérico ERP em --pedido.")
    return args


def main():
    args = parse_args()
    if not SYNC_TOKEN or not DB["dbname"] or not DB["user"]:
        raise RuntimeError("Configuração incompleta: confira banco e token nos arquivos .env existentes.")
    log("v9: conectando ao ERP (limite de conexão: 15s)...")
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
    cur.execute(
        """
        SELECT b.empresa::text AS filial_codigo, b.nota::text AS nota,
               b.serie::text AS serie, b.parcela::text AS parcela, b.arquivo
          FROM dw_arquivo_boleto b
          JOIN dw_titulo t
            ON t.codigo = b.nota::text
           AND t.parcela = b.serie::text || b.parcela::text
           AND t.filial_codigo = b.empresa::text
         WHERE t.status <> 'PAGO'
           AND t.data_vencimento >= current_date - %s
        """,
        (BOLETO_DIAS_ATRAS,),
    )
    batch, total = [], 0
    for row in cur:
        batch.append({
            "filial_codigo": row["filial_codigo"], "nota": row["nota"],
            "serie": row["serie"], "parcela": row["parcela"],
            "arquivo_base64": base64.b64encode(bytes(row["arquivo"])).decode(),
        })
        if len(batch) >= BOLETOS_BATCH:
            res = post({"store_slug": STORE_SLUG, "boletos": batch})
            total += res.get("boletosSaved", 0)
            for err in res.get("boletoErrors", []):
                log(f"  aviso: {err}")
            batch = []
    if batch:
        res = post({"store_slug": STORE_SLUG, "boletos": batch})
        total += res.get("boletosSaved", 0)
        for err in res.get("boletoErrors", []):
            log(f"  aviso: {err}")
    log(f"{total} boletos enviados")

    sync_pedidos(conn, cur, args)


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


def query_windows(args, today=None):
    if args.pedido:
        for code in dict.fromkeys(c.strip() for c in args.pedido):
            yield f"pedido ERP {code}", "SELECT * FROM vw_mpz_pedido WHERE codigo_importacao = %s", (code,)
        return
    today = today or date.today()
    # Mais recentes primeiro: confirma cada dia antes de ler o seguinte.
    for offset in range(args.dias):
        day = today - timedelta(days=offset)
        yield str(day), ("SELECT * FROM vw_mpz_pedido WHERE data_emissao >= %s "
                        "AND data_emissao < %s"), (day, day + timedelta(days=1))


def sync_pedidos(conn, cur, args):
    total = 0
    for label, sql, params in query_windows(args):
        log(f"Lendo {label}: vw_mpz_pedido (limite {args.timeout_sql}s)...")
        started = time.monotonic()
        try:
            cur.execute(sql, params)
            orders = [normalize_order(row) for row in cur.fetchall()]
        except psycopg2.errors.QueryCanceled:
            raise RuntimeError(f"Consulta de {label} excedeu {args.timeout_sql}s. "
                               "Dias já confirmados foram preservados. Teste --pedido 722199; "
                               "se também expirar, a consulta/view precisa de ajuste no servidor ERP.") from None
        log(f"{label}: {len(orders)} pedidos lidos em {time.monotonic() - started:.1f}s.")
        if not orders:
            if args.pedido:
                raise RuntimeError(f"{label} não encontrado na view; nenhuma confirmação para este pedido.")
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
