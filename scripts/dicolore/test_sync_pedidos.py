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
        queries = list(sync.query_windows(sync.parse_args(['--dias', '2']), date(2026, 10, 19)))
        self.assertEqual(queries[0][2], (date(2026, 10, 19), date(2026, 10, 20)))
        self.assertEqual(queries[1][2], (date(2026, 10, 18), date(2026, 10, 19)))

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
        self.assertEqual(len(cur.queries), 1)
        order = payload['orders'][0]
        self.assertEqual((order['ordem_faturamento'], order['nota_fiscal_numero'], order['status']),
                         ('236784', '209490/55', 'F'))
        self.assertEqual(order['valor_total_com_impostos'], 79.90)

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
