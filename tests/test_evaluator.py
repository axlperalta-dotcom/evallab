import unittest
from unittest.mock import patch
from evaluator import InvalidCase, evaluate, signature, summarize, validate_rules


class EvaluatorTests(unittest.TestCase):
    def run_rule(self, kind, value, answer):
        return evaluate({"rules": [{"type": kind, "value": value}]}, answer)

    def test_required_fragments_ignore_case_and_unicode_width(self):
        self.assertEqual(self.run_rule("contains", ["datos"], "DATOS y ＤＡＴＯＳ")["status"], "passed")
        self.assertEqual(self.run_rule("contains", ["datos", "API"], "datos")["status"], "failed")

    def test_negated_phrase_demonstrates_limits_of_literal_checks(self):
        result = self.run_rule("excludes", ["garantiza cero errores"], "No garantiza cero errores.")
        self.assertEqual(result["status"], "failed")
        self.assertIn("garantiza", result["checks"][0]["detail"])

    def test_unicode_length_and_boundary(self):
        self.assertEqual(self.run_rule("max_length", 2, "a🚀")["status"], "passed")
        self.assertEqual(self.run_rule("max_length", 1, "a🚀")["status"], "failed")

    def test_blank_answer_is_evaluated_not_an_infrastructure_error(self):
        self.assertEqual(self.run_rule("contains", ["datos"], "")["status"], "failed")

    def test_json_shape_fields_and_non_json(self):
        for response in ("hello", '```json\n{"titulo":1}\n```', "[]", '"titulo"', '{"other":1}', '{"titulo":NaN}'):
            with self.subTest(response=response):
                self.assertEqual(self.run_rule("json_fields", ["titulo"], response)["status"], "failed")
        self.assertEqual(self.run_rule("json_fields", ["titulo"], '{"titulo":null}')["status"], "passed")

    def test_rule_configuration_is_not_an_answer_failure(self):
        for rules in ([], None, [{"type": "unknown", "value": "a"}], [{"type": "max_length", "value": True}], [{"type": "contains", "value": []}], [{"type": "contains", "value": [""]}]):
            with self.subTest(rules=rules):
                result = evaluate({"rules": rules}, "answer")
                self.assertEqual(result["status"], "error")
                self.assertEqual(result["error_kind"], "configuration")

    def test_duplicate_rules_rejected(self):
        rule = {"type": "contains", "value": ["one"]}
        with self.assertRaises(InvalidCase):
            validate_rules([rule, rule])

    def test_evaluator_bug_is_reported_separately(self):
        with patch("evaluator.check_rule", side_effect=RuntimeError("fault injected")), self.assertLogs(level="ERROR"):
            result = self.run_rule("contains", ["data"], "data")
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error_kind"], "evaluator")
        self.assertEqual(result["checks"], [])

    def test_errors_excluded_from_rate_without_being_hidden(self):
        result = summarize([{"status": "passed"}, {"status": "failed"}, {"status": "error"}])
        self.assertEqual(result, {"passed": 1, "failed": 1, "error": 1, "total": 3, "evaluated": 2, "rate": 50.0})
        self.assertIsNone(summarize([{"status": "error"}])["rate"])
        self.assertIsNone(summarize([])["rate"])

    def test_signature_ignores_answers_but_tracks_cases_prompts_and_rules(self):
        case = {"id": "1", "prompt": "Ask", "rules": [{"type": "max_length", "value": 5}], "answer_a": "a"}
        self.assertEqual(signature([case]), signature([{**case, "answer_a": "different"}]))
        self.assertNotEqual(signature([case]), signature([{**case, "prompt": "Other"}]))
        self.assertNotEqual(signature([case]), signature([{**case, "rules": [{"type": "max_length", "value": 6}]}]))
        self.assertNotEqual(signature([case]), signature([]))
        second = {**case, "id": "2"}
        self.assertEqual(signature([case, second]), signature([second, case]))


if __name__ == "__main__":
    unittest.main()
