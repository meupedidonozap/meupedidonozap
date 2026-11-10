import importlib.util
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import MagicMock, patch


class CustomerSyncTests(unittest.TestCase):
    def setUp(self):
        pg = types.ModuleType("psycopg2")
        pg.extras = types.ModuleType("psycopg2.extras")
        pg.extras.RealDictCursor = object
        pg.connect = MagicMock()
        requests = types.ModuleType("requests")
        requests.post = MagicMock()
        requests.Timeout = type("Timeout", (Exception,), {})
        requests.ConnectionError = type("ConnectionError", (Exception,), {})
        self.modules = patch.dict(sys.modules, {
            "psycopg2": pg, "psycopg2.extras": pg.extras, "requests": requests,
        })
        self.modules.start()
        spec = importlib.util.spec_from_file_location(
            "customer_sync", Path(__file__).with_name("sync_clientes_erp.py")
        )
        self.sync = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {
            "VIEW_CLIENTES_ERP": "public.mpz_cliente",
            "MONITOR_INTERVALO_CLIENTES_ERP": "180",
            "MPZ_CLIENTES_API_URL": "https://example.invalid/functions/v1/sync-customers",
        }):
            spec.loader.exec_module(self.sync)

    def tearDown(self):
        self.modules.stop()

    def test_reads_existing_dw_view_despite_old_local_override(self):
        cursor = self.sync.psycopg2.connect.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = [{"codigo": "9195", "frete_codigo": "1"}]
        self.assertEqual(self.sync.ler_clientes(), [{"codigo": "9195", "frete_codigo": "1"}])
        cursor.execute.assert_called_once_with("SELECT * FROM public.dw_cliente")
        self.assertIn("default_transaction_read_only=on", self.sync.DB["options"])

    def test_freight_codes_are_transmitted_unchanged(self):
        rows = [{"codigo": "9195", "frete_codigo": "1"}, {"codigo": "9196", "frete_codigo": "0"}]
        with patch.object(self.sync, "ler_clientes", return_value=rows), \
             patch.object(self.sync, "carregar_estado", return_value={}), \
             patch.object(self.sync, "salvar_estado"), \
             patch.object(self.sync, "enviar", return_value={"success": True}) as send:
            self.sync.ciclo()
        self.assertEqual(send.call_args.args[0], rows)

    def test_monitor_interval_remains_three_minutes(self):
        self.assertEqual(self.sync.INTERVALO, 180)

    def test_splits_into_250_customer_batches(self):
        rows = [{"codigo": str(i)} for i in range(501)]
        with patch.object(self.sync, "ler_clientes", return_value=rows), \
             patch.object(self.sync, "carregar_estado", return_value={}), \
             patch.object(self.sync, "salvar_estado"), \
             patch.object(self.sync, "enviar", return_value={"success": True}) as send:
            self.sync.ciclo()
        self.assertEqual([len(c.args[0]) for c in send.call_args_list], [250, 250, 1])

    def test_retries_504_then_confirms(self):
        self.sync.requests.post.side_effect = [
            MagicMock(status_code=504), MagicMock(status_code=200, json=lambda: {"success": True})]
        with patch.object(self.sync.time, "sleep") as wait:
            self.assertEqual(self.sync.enviar([]), {"success": True})
        self.assertEqual(self.sync.requests.post.call_count, 2)
        wait.assert_called_once_with(2)

    def test_timeout_retries_stop_after_three_attempts(self):
        self.sync.requests.post.side_effect = self.sync.requests.Timeout
        with patch.object(self.sync.time, "sleep"), self.assertRaises(RuntimeError):
            self.sync.enviar([])
        self.assertEqual(self.sync.requests.post.call_count, 3)

    def test_unauthorized_is_not_retried(self):
        self.sync.requests.post.return_value = MagicMock(status_code=401)
        with self.assertRaises(RuntimeError):
            self.sync.enviar([])
        self.assertEqual(self.sync.requests.post.call_count, 1)

    def test_all_failed_codes_remain_pending_beyond_ten_samples(self):
        rows = [{"codigo": str(i)} for i in range(12)]
        initial = {r["codigo"]: "old" for r in rows}
        result = {"success": True, "errors": 11, "error_codes": [str(i) for i in range(11)],
                  "error_samples": [{"codigo": str(i)} for i in range(10)]}
        with patch.object(self.sync, "ler_clientes", return_value=rows), \
             patch.object(self.sync, "carregar_estado", return_value=initial), \
             patch.object(self.sync, "salvar_estado") as save, \
             patch.object(self.sync, "enviar", return_value=result):
            self.sync.ciclo()
        self.assertEqual(save.call_args.args[0], {"11": self.sync._hash(rows[11])})

    def test_unconfirmed_http_response_does_not_succeed(self):
        self.sync.requests.post.return_value = MagicMock(status_code=200, json=lambda: {})
        with self.assertRaises(RuntimeError):
            self.sync.enviar([])

    def test_api_destination_reused_without_executing_other_monitor(self):
        with patch.dict(os.environ, {"MPZ_CLIENTES_API_URL": ""}), \
             patch.object(Path, "read_text", return_value='API_URL = "https://example.invalid/functions/v1/sync-stock-erp"\nraise RuntimeError("must not execute")'):
            self.assertEqual(self.sync._url_api(), "https://example.invalid/functions/v1/sync-customers")


if __name__ == "__main__":
    unittest.main()