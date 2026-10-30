import ast
import importlib.util
import logging
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('financeiro', HERE / 'sync_dicolore_financeiro_v5.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncTests(unittest.TestCase):
    def test_pending_mode_queries_by_code_and_skips_timeouts(self):
        args = sync.parse_args(['--somente-pedidos', '--pendentes'])
        class Canceled(Exception): pass
        calls = []
        class Cursor:
            def execute(self, sql, params):
                calls.append((sql, params))
                if params == ('111',): raise sync.psycopg2.errors.QueryCanceled()
            def fetchall(self): return [dict(codigo_importacao='722199', cliente_codigo='1', status='F',
                                             ordem_faturamento=1, nota_fiscal_numero='2')]
        with patch.object(sync, 'fetch_pending_codes', return_value=['111', '722199']), \
             patch.object(sync, 'post', return_value={'ordersUpserted': 1}) as post:
            sync.sync_pedidos(None, Cursor(), args)
        self.assertTrue(all('data_emissao' not in c[0] for c in calls))
        self.assertEqual(post.call_count, 1)

    def test_explicit_order_ignores_window(self):
        args = sync.parse_args(['--pedido', '722199', '--pedido', '98850', '--dias', '1'])
        queries = list(sync.query_windows(args, date(2026, 10, 19)))
        self.assertEqual([q[2] for q in queries], [('722199',), ('98850',)])
        self.assertNotIn('data_emissao', queries[0][1])

    def test_daily_queries_newest_first(self):
        queries = list(sync.query_windows(sync.parse_args(['--dias', '2', '--por-dia']), date(2026, 10, 19)))
        self.assertEqual(queries[0][2], (date(2026, 10, 19), date(2026, 10, 20)))
        self.assertEqual(queries[1][2], (date(2026, 10, 18), date(2026, 10, 19)))

    def test_consulta_unica_is_one_single_query(self):
        queries = list(sync.query_windows(sync.parse_args(['--dias', '90', '--consulta-unica']), date(2026, 10, 23)))
        self.assertEqual(len(queries), 1)
        self.assertEqual(queries[0][2], (date(2026, 7, 26), date(2026, 10, 24)))

    def _batch_cursor(self, codes, slow=()):
        class Cursor:
            batches = []
            def execute(self, sql, params):
                self.sql = sql
                self.params = params
                if sql == sync.BATCH_SQL:
                    lote = list(params[0])
                    if any(c in slow for c in lote):
                        raise sync.psycopg2.errors.QueryCanceled()
                    self.batches.append(lote)
            def fetchall(self):
                if self.sql == sync.CODES_SQL:
                    return [{'pedcod': c} for c in codes]
                if self.sql == sync.BATCH_SQL:
                    return [dict(codigo_importacao=c, cliente_codigo='1', status='N',
                                 ordem_faturamento=None, nota_fiscal_numero=None) for c in self.params[0]
                            if c not in slow]
                return []
        return Cursor()

    def test_120_codes_in_batches_of_50(self):
        codes = [str(i) for i in range(1, 121)]
        cur = self._batch_cursor(codes)
        posted = lambda p: {'ok': True, 'ordersUpserted': len(p['orders'])}
        with patch.object(sync, 'post', side_effect=posted) as post:
            total = sync.sync_por_lotes(cur, sync.parse_args(['--dias', '90']), date(2026, 10, 23))
        self.assertEqual([len(b) for b in cur.batches], [50, 50, 20])
        self.assertEqual(post.call_count, 3)
        self.assertEqual(total, 120)

    def test_slow_batch_is_split_and_others_continue(self):
        codes = [str(i) for i in range(1, 11)]
        cur = self._batch_cursor(codes, slow={'3'})
        posted = lambda p: {'ok': True, 'ordersUpserted': len(p['orders'])}
        with patch.object(sync, 'post', side_effect=posted):
            total = sync.sync_por_lotes(cur, sync.parse_args(['--dias', '90', '--lote', '5']), date(2026, 10, 23))
        self.assertEqual(total, 9)
        gravados = sorted(c for b in cur.batches for c in b)
        self.assertEqual(gravados, sorted(c for c in codes if c != '3'))

    def test_dias_default_uses_batches_not_single_query(self):
        args = sync.parse_args(['--somente-pedidos', '--dias', '90'])
        with patch.object(sync, 'sync_por_lotes', return_value=0) as lotes:
            sync.sync_pedidos(None, object(), args)
        lotes.assert_called_once()

    def test_nf_and_of_from_erp_preserved_and_no_item_reads(self):
        row = dict(codigo_importacao='722199', cliente_codigo='89141', status='F',
                   ordem_faturamento=236784, nota_fiscal_numero='209490/55',
                   valor_total_com_impostos=Decimal('79.90'))
        class Cursor:
            queries = []
            def execute(self, sql, params):
                self.queries.append((sql, params))
            def fetchall(self):
                return [row]
        cur = Cursor()
        with patch.object(sync, 'post', return_value={'ok': True, 'ordersUpserted': 1}) as post:
            sync.sync_pedidos(None, cur, sync.parse_args(['--pedido', '722199']))
        payload = post.call_args.args[0]
        self.assertNotIn('order_items', payload)
        self.assertEqual(len(cur.queries), 2)
        self.assertFalse(any('vw_mpz_pedido_item' in q[0] for q in cur.queries))
        order = payload['orders'][0]
        self.assertEqual((order['ordem_faturamento'], order['nota_fiscal_numero'], order['status']),
                         ('236784', '209490/55', 'F'))
        self.assertEqual(order['valor_total_com_impostos'], 79.90)

    def test_televendas_flag_and_operator_from_pe001(self):
        class Cursor:
            def execute(self, sql, params): pass
            def fetchall(self):
                return [{'pedcod': '98721', 'pedtelven': 'S', 'pedotvcod': 9}]
        orders = sync.enrich_televendas(Cursor(), [{'codigo_importacao': '98721'}, {'codigo_importacao': '1'}])
        self.assertEqual((orders[0]['pedido_televendas'], orders[0]['televendas_codigo']), ('S', '9'))
        self.assertNotIn('pedido_televendas', orders[1])

    def test_http_200_without_confirmation_is_failure(self):
        response = SimpleNamespace(status_code=200, raise_for_status=lambda: None,
                                   json=lambda: {'ok': True, 'ordersUpserted': 0})
        with patch.object(sync.requests, 'post', return_value=response):
            with self.assertRaises(RuntimeError):
                sync.post({'orders': [{}]})

    def test_timeout_stops_without_sending(self):
        class Cursor:
            def execute(self, *args):
                raise sync.psycopg2.errors.QueryCanceled()
        with patch.object(sync, 'post') as post:
            with self.assertRaisesRegex(RuntimeError, '722199'):
                sync.sync_pedidos(None, Cursor(), sync.parse_args(['--pedido', '722199']))
            post.assert_not_called()

    def test_missing_order_is_marked_but_timeout_is_not(self):
        args = sync.parse_args(['--somente-pedidos', '--pendentes'])
        class Cursor:
            def execute(self, sql, params):
                self.p = params
                if params == ('111',): raise sync.psycopg2.errors.QueryCanceled()
            def fetchall(self): return []
        with patch.object(sync, 'fetch_pending_codes', return_value=['111', '720160']), \
             patch.object(sync, 'post', return_value={'ok': True, 'marked': 1}) as post:
            sync.sync_pedidos(None, Cursor(), args)
        self.assertEqual(post.call_args.args[0]['action'], 'mark_missing_orders')
        self.assertEqual(post.call_args.args[0]['codes'], ['720160'])

    def test_monitor_reports_output_before_child_exits(self):
        tree = ast.parse((HERE / 'atualizar_dicolore.py').read_text())
        node = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == 'sincronizar_status_pedidos')
        with tempfile.TemporaryDirectory() as tmp:
            child = Path(tmp) / 'child.py'
            child.write_text('import time\nprint("PROGRESSO", flush=True)\ntime.sleep(1)\n')
            records = []
            class Logger:
                def info(self, *args):
                    records.append(time.monotonic())
                def error(self, *args):
                    pass
            ns = dict(SYNC_PEDIDOS_ERP=child, sys=sys, _BASE=Path(tmp),
                      threading=threading, time=time, log=Logger(), _env_int=lambda n, d: d)
            exec(compile(ast.Module(body=[node], type_ignores=[]), 'monitor', 'exec'), ns)
            self.assertTrue(ns['sincronizar_status_pedidos']())
            self.assertGreater(time.monotonic() - records[0], 0.7)


if __name__ == '__main__':
    unittest.main()

def test_to_json_time_field():
    import datetime as _dt
    import sync_dicolore_financeiro_v5 as m
    assert m.to_json(_dt.time(14, 30, 5)) == "14:30:05"


def test_horario_historico_1730():
    from datetime import datetime as dt
    assert sync.historico_liberado(dt(2026, 10, 20, 17, 29)) is False
    assert sync.historico_liberado(dt(2026, 10, 20, 17, 30)) is True


def test_pedidos_do_dia_sempre_primeiro():
    codes = ["98875", "98869", "1", "2", "3"]
    assert sync.select_codes(codes, 2, 40, False) == ["98875", "98869"]
    assert sync.select_codes(codes, 2, 40, True)[:2] == ["98875", "98869"]
