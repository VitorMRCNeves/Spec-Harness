from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ENGINE_DIR / "tools"))

from crap_calculator import (  # noqa: E402 - tool is loaded from its non-package directory.
    CoverageInputError,
    calculate_crap,
    get_crap_for_codebase,
)


class CrapCalculatorGateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "head"
        self.baseline = self.root / "baseline"
        self.source.mkdir()
        self.baseline.mkdir()

    def write_coverage(
        self,
        *,
        functions: dict[str, object],
        filepath: str = "app/rules.py",
        timestamp: str | None = None,
    ) -> Path:
        report = {
            "meta": {
                "timestamp": timestamp
                or (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()
            },
            "files": {
                filepath: {
                    "executed_lines": [1, 2, 3, 4, 5, 6, 7],
                    "missing_lines": [],
                    "excluded_lines": [],
                    "functions": functions,
                }
            },
        }
        path = self.root / "coverage.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        return path

    def test_formula_has_complexity_as_floor_at_full_coverage(self) -> None:
        self.assertEqual(calculate_crap(12, 100), 12)

    def test_composite_gate_reports_cause_and_required_phase(self) -> None:
        rel = Path("app/rules.py")
        (self.source / rel).parent.mkdir(parents=True)
        (self.baseline / rel).parent.mkdir(parents=True)
        (self.source / rel).write_text(
            "def choose(a, b, c):\n"
            "    if a:\n        return 1\n"
            "    if b:\n        return 2\n"
            "    if c:\n        return 3\n"
            "    return 0\n",
            encoding="utf-8",
        )
        (self.baseline / rel).write_text(
            "def choose(a, b, c):\n    return 1 if a else 0\n",
            encoding="utf-8",
        )
        coverage = self.write_coverage(
            functions={
                "choose": {
                    "start_line": 1,
                    "summary": {
                        "percent_covered": 100.0,
                        "num_branches": 6,
                        "covered_branches": 2,
                    },
                }
            }
        )

        result = get_crap_for_codebase(
            self.source,
            coverage,
            only_paths=(str(rel),),
            baseline_source_dir=self.baseline,
            max_complexity=3,
            min_branch_coverage=90,
            max_crap_delta=0,
            require_function_summaries=True,
            require_timestamp=True,
        )

        violations = {item["kind"]: item for item in result["violations"]}
        self.assertEqual(violations["complexity_limit"]["required_action"], "green")
        self.assertEqual(violations["branch_coverage_limit"]["required_action"], "red")
        self.assertEqual(violations["crap_regression"]["required_action"], "green")

    def test_new_function_uses_stricter_crap_limit(self) -> None:
        rel = Path("app/new_rule.py")
        (self.source / rel).parent.mkdir(parents=True)
        (self.source / rel).write_text(
            "def decide(a, b, c):\n"
            "    if a:\n        return 1\n"
            "    if b:\n        return 2\n"
            "    if c:\n        return 3\n"
            "    return 0\n",
            encoding="utf-8",
        )
        coverage = self.write_coverage(
            filepath=str(rel),
            functions={
                "decide": {
                    "start_line": 1,
                    "summary": {
                        "percent_covered": 100.0,
                        "num_branches": 6,
                        "covered_branches": 6,
                    },
                }
            },
        )

        result = get_crap_for_codebase(
            self.source,
            coverage,
            only_paths=(str(rel),),
            baseline_source_dir=self.baseline,
            max_new_crap=3,
        )

        self.assertIn(
            "new_function_crap_limit", {v["kind"] for v in result["violations"]}
        )

    def test_simple_uncovered_function_cannot_hide_behind_low_crap(self) -> None:
        rel = Path("app/simple.py")
        (self.source / rel).parent.mkdir(parents=True)
        (self.source / rel).write_text("def value():\n    return 1\n", encoding="utf-8")
        coverage = self.write_coverage(
            filepath=str(rel),
            functions={
                "value": {
                    "start_line": 1,
                    "summary": {
                        "percent_covered": 0.0,
                        "num_branches": 0,
                        "covered_branches": 0,
                    },
                }
            },
        )

        result = get_crap_for_codebase(
            self.source,
            coverage,
            only_paths=(str(rel),),
            min_line_coverage=90,
            min_branch_coverage=90,
        )

        self.assertLess(result["functions"][0]["crap"], 30)
        violations = {v["kind"] for v in result["violations"]}
        self.assertIn("line_coverage_limit", violations)
        self.assertNotIn("branch_coverage_limit", violations)

    def test_untouched_legacy_function_in_changed_file_is_not_gated(self) -> None:
        rel = Path("app/mixed.py")
        (self.source / rel).parent.mkdir(parents=True)
        (self.source / rel).write_text(
            "def changed():\n    return 1\n\n"
            "def untouched(a, b, c):\n"
            "    if a:\n        return 1\n"
            "    if b:\n        return 2\n"
            "    if c:\n        return 3\n"
            "    return 0\n",
            encoding="utf-8",
        )
        coverage = self.write_coverage(
            filepath=str(rel),
            functions={
                "changed": {
                    "start_line": 1,
                    "summary": {
                        "percent_covered": 100.0,
                        "num_branches": 0,
                        "covered_branches": 0,
                    },
                },
                "untouched": {
                    "start_line": 4,
                    "summary": {
                        "percent_covered": 0.0,
                        "num_branches": 6,
                        "covered_branches": 0,
                    },
                },
            },
        )

        result = get_crap_for_codebase(
            self.source,
            coverage,
            only_paths=(str(rel),),
            changed_line_ranges={str(rel): [[1, 2]]},
            min_line_coverage=90,
            min_branch_coverage=90,
        )

        self.assertEqual(
            [function["name"] for function in result["functions"]], ["changed"]
        )
        self.assertEqual(result["violations"], [])

    def test_missing_scored_file_fails_closed(self) -> None:
        coverage = self.write_coverage(functions={})
        with self.assertRaisesRegex(CoverageInputError, "ausentes do relatório"):
            get_crap_for_codebase(
                self.source,
                coverage,
                only_paths=("app/missing.py",),
            )

    def test_exact_function_summary_is_required_when_configured(self) -> None:
        rel = Path("app/rules.py")
        (self.source / rel).parent.mkdir(parents=True)
        (self.source / rel).write_text(
            "def rule():\n    return True\n", encoding="utf-8"
        )
        coverage = self.write_coverage(functions={})
        with self.assertRaisesRegex(
            CoverageInputError, "Cobertura exata por função ausente"
        ):
            get_crap_for_codebase(
                self.source,
                coverage,
                only_paths=(str(rel),),
                require_function_summaries=True,
            )

    def test_timestamp_is_required_in_fail_closed_mode(self) -> None:
        rel = Path("app/rules.py")
        (self.source / rel).parent.mkdir(parents=True)
        (self.source / rel).write_text(
            "def rule():\n    return True\n", encoding="utf-8"
        )
        coverage = self.write_coverage(functions={})
        report = json.loads(coverage.read_text(encoding="utf-8"))
        del report["meta"]["timestamp"]
        coverage.write_text(json.dumps(report), encoding="utf-8")

        with self.assertRaisesRegex(CoverageInputError, "meta.timestamp"):
            get_crap_for_codebase(
                self.source,
                coverage,
                only_paths=(str(rel),),
                require_timestamp=True,
            )

    def test_skipped_source_file_fails_closed(self) -> None:
        coverage = self.write_coverage(
            filepath="app/deleted_after_coverage.py",
            functions={},
        )
        with self.assertRaisesRegex(CoverageInputError, "não analisados"):
            get_crap_for_codebase(
                self.source,
                coverage,
                only_paths=("app/deleted_after_coverage.py",),
                fail_on_skipped_files=True,
            )


if __name__ == "__main__":
    unittest.main()
