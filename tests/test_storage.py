import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from evaluator import InvalidCase
from storage import Store, NotFound


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix="evallab-test-")
        self.path = Path(self.folder.name) / "test.sqlite3"
        self.store = Store(self.path)

    def tearDown(self):
        self.folder.cleanup()

    def run_sample(self, variant="a"):
        result = self.store.command({"type": "run", "name": "Prueba", "variant": variant})
        return self.store.run_detail(result["id"])

    def test_seed_is_once_and_deleted_cases_stay_deleted(self):
        state = self.store.snapshot()
        self.assertEqual(len(state["cases"]), 4)
        self.store.command({"type": "delete_case", "id": state["cases"][0]["id"]})
        self.assertEqual(len(Store(self.path).snapshot()["cases"]), 3)

    def test_sample_variants_tie_globally_but_fail_different_cases(self):
        a, b = self.run_sample("a"), self.run_sample("b")
        self.assertEqual(a["signature"], b["signature"])
        self.assertEqual(a["summary"]["rate"], 50.0)
        self.assertEqual(b["summary"]["rate"], 50.0)
        self.assertNotEqual([r["evaluation"]["status"] for r in a["results"]], [r["evaluation"]["status"] for r in b["results"]])

    def test_run_survives_edit_delete_and_database_reopen(self):
        run = self.run_sample()
        case = self.store.snapshot()["cases"][0]
        self.store.command({"type": "save_case", "id": case["id"], "data": {**case, "title": "Cambio", "answer_a": "Otro texto"}})
        self.store.command({"type": "delete_case", "id": case["id"]})
        self.assertEqual(Store(self.path).run_detail(run["id"]), run)

    def test_manual_review_does_not_change_automatic_evaluation(self):
        before = self.run_sample()
        self.store.command({"type": "review", "id": before["results"][0]["id"], "decision": "disagree", "note": "La condición no refleja el contexto."})
        after = Store(self.path).run_detail(before["id"])
        self.assertEqual(before["summary"], after["summary"])
        self.assertEqual(before["results"][0]["evaluation"], after["results"][0]["evaluation"])
        self.assertEqual(after["results"][0]["review"]["decision"], "disagree")

    def test_empty_suite_and_invalid_input_leave_no_partial_records(self):
        for case in self.store.snapshot()["cases"]:
            self.store.command({"type": "save_case", "id": case["id"], "data": {**case, "active": False}})
        before = self.store.snapshot()
        with self.assertRaises(InvalidCase):
            self.run_sample()
        self.assertEqual(self.store.snapshot(), before)
        case = before["cases"][0]
        for change in ({"rules": []}, {"title": ""}, {"active": "true"}, {"answer_a": "x" * 10001}):
            with self.assertRaises(InvalidCase):
                self.store.command({"type": "save_case", "id": case["id"], "data": {**case, **change}})
        self.assertEqual(self.store.snapshot(), before)

    def test_partial_run_is_rolled_back_on_storage_failure(self):
        original = self.store.snapshot()
        with patch("storage.json.dumps", side_effect=RuntimeError("disk preparation failure")):
            with self.assertRaises(RuntimeError):
                self.run_sample()
        self.assertEqual(self.store.snapshot(), original)

    def test_invalid_legacy_configuration_is_visible_as_error(self):
        case = self.store.snapshot()["cases"][0]
        with self.store.connection() as db:
            db.execute("UPDATE cases SET rules='[]' WHERE id=?", (case["id"],))
        result = self.run_sample()
        self.assertEqual(result["summary"]["error"], 1)
        self.assertEqual(result["summary"]["evaluated"], 3)

    def test_unknown_identifiers_do_not_create_records(self):
        with self.assertRaises(NotFound):
            self.store.run_detail("not-found")
        with self.assertRaises(NotFound):
            self.store.command({"type": "delete_case", "id": "not-found"})
        with self.assertRaises(NotFound):
            self.store.command({"type": "review", "id": "missing", "decision": "agree", "note": "Nota"})


if __name__ == "__main__":
    unittest.main()
