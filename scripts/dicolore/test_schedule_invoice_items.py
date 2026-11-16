"""Validate the daily Windows Task Scheduler triggers without needing Windows."""
import re
import unittest
from pathlib import Path


class InvoiceItemsScheduleTests(unittest.TestCase):
    def test_runs_at_noon_and_nineteen_daily(self):
        source = Path(__file__).with_name("7_AGENDAR_ITENS_NF.bat").read_text()
        times = re.findall(r"New-ScheduledTaskTrigger -Daily -At '([^']+)'", source)
        self.assertEqual(times, ["12:00", "19:00"])


if __name__ == "__main__":
    unittest.main()