"""Calculate CRAP scores from a coverage.py JSON report.

Run pytest and write its JSON report first, then invoke this module with that
exact report.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

from radon.complexity import cc_visit
from radon.visitors import Function

DEFAULT_EXCLUDE_PATTERNS = ("**/tests/**", "**/evals/**")
DEFAULT_COVERAGE_JSON = "coverage.json"
DEFAULT_HIGH_RISK_THRESHOLD = 30.0


class CoverageInputError(ValueError):
    """Raised when a coverage report cannot be safely used."""


def calculate_crap(complexity: float, coverage_pct: float) -> float:
    """Apply the official CRAP score formula."""
    return (complexity**2) * ((1 - coverage_pct / 100.0) ** 3) + complexity


def _normalise_path(path: str | Path) -> str:
    return str(path).replace("\\", "/").lstrip("./")


def _is_excluded(filepath: str, patterns: tuple[str, ...]) -> bool:
    """Return whether a report path belongs to a test/eval tree or pattern."""
    normalised = _normalise_path(filepath)
    parts = PurePosixPath(normalised).parts
    if any(part in {"tests", "evals"} for part in parts):
        return True
    return any(
        fnmatch.fnmatch(normalised, pattern) or PurePosixPath(normalised).match(pattern)
        for pattern in patterns
    )


def _load_coverage_report(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise CoverageInputError(
            f"Arquivo de cobertura não encontrado: {path}. "
            "Execute pytest com --cov-report=json:<arquivo> primeiro."
        )
    try:
        with path.open(encoding="utf-8") as report_file:
            data = json.load(report_file)
    except json.JSONDecodeError as exc:
        raise CoverageInputError(
            f"JSON de cobertura inválido em {path}: linha {exc.lineno}, coluna {exc.colno}."
        ) from exc
    except OSError as exc:
        raise CoverageInputError(
            f"Não foi possível ler o JSON de cobertura {path}: {exc}"
        ) from exc

    if not isinstance(data, dict) or not isinstance(data.get("files"), dict):
        raise CoverageInputError(
            f"JSON de cobertura inválido em {path}: esperado um objeto com a chave 'files'."
        )
    if "meta" in data and not isinstance(data["meta"], dict):
        raise CoverageInputError(
            f"JSON de cobertura inválido em {path}: 'meta' deve ser um objeto."
        )
    for filepath, info in data["files"].items():
        if not isinstance(filepath, str) or not isinstance(info, dict):
            raise CoverageInputError(
                f"JSON de cobertura inválido em {path}: entrada de arquivo malformada."
            )
        for line_key in ("executed_lines", "missing_lines", "excluded_lines"):
            lines = info.get(line_key, [])
            if not isinstance(lines, list) or not all(
                isinstance(line, int) for line in lines
            ):
                raise CoverageInputError(
                    f"JSON de cobertura inválido em {path}: '{line_key}' de {filepath} "
                    "deve ser uma lista de números."
                )
        functions = info.get("functions", {})
        if not isinstance(functions, dict):
            raise CoverageInputError(
                f"JSON de cobertura inválido em {path}: 'functions' de {filepath} deve ser um objeto."
            )
        if not all(
            isinstance(function_info, dict) for function_info in functions.values()
        ):
            raise CoverageInputError(
                f"JSON de cobertura inválido em {path}: entradas de 'functions' de {filepath} "
                "devem ser objetos."
            )
    return data


def _report_timestamp(data: dict[str, Any]) -> datetime | None:
    value = data.get("meta", {}).get("timestamp")
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _resolve_source_path(source_root: Path, filepath: str) -> Path:
    report_path = Path(filepath)
    return report_path if report_path.is_absolute() else source_root / report_path


def _check_report_freshness(
    report_path: Path,
    report: dict[str, Any],
    source_root: Path,
    filepaths: list[str],
    *,
    require_timestamp: bool = False,
) -> None:
    """Reject a report generated before an analysed source file was changed."""
    timestamp = _report_timestamp(report)
    if timestamp is None:
        if require_timestamp:
            raise CoverageInputError(
                f"Relatório de cobertura sem meta.timestamp válido: {report_path}."
            )
        return
    report_epoch = timestamp.timestamp()
    changed_after_report = []
    for filepath in filepaths:
        source_path = _resolve_source_path(source_root, filepath)
        if source_path.is_file() and source_path.stat().st_mtime > report_epoch + 2:
            changed_after_report.append(filepath)
    if changed_after_report:
        preview = ", ".join(changed_after_report[:3])
        suffix = "..." if len(changed_after_report) > 3 else ""
        raise CoverageInputError(
            f"Relatório de cobertura desatualizado ({report_path}): "
            f"fonte alterada depois da execução ({preview}{suffix}). "
            "Rode pytest novamente e gere um novo JSON."
        )


def _function_coverage(
    block: Function, cov_info: dict[str, Any]
) -> tuple[float, float | None, str]:
    """Get exact function coverage, falling back to line-range coverage.

    coverage.py 7 emits a ``files[*].functions`` map with statement summaries.
    Older reports do not, so the fallback uses executed/missing lines intersected
    with radon's function range.  The latter is less precise for nested blocks.
    """
    functions = cov_info.get("functions")
    if isinstance(functions, dict):
        qualified_name = getattr(block, "fullname", block.name)
        candidates = [qualified_name, block.name]
        matches = []
        for candidate in candidates:
            function_info = functions.get(candidate)
            if isinstance(function_info, dict):
                matches.append(function_info)
        if matches:
            function_info = min(
                matches,
                key=lambda item: abs(
                    int(item.get("start_line", block.lineno)) - block.lineno
                ),
            )
            summary = function_info.get("summary")
            if isinstance(summary, dict):
                percent = summary.get("percent_covered")
                if isinstance(percent, (int, float)):
                    num_branches = summary.get("num_branches")
                    covered_branches = summary.get("covered_branches")
                    branch_pct: float | None = None
                    if isinstance(num_branches, int) and isinstance(
                        covered_branches, int
                    ):
                        branch_pct = (
                            100.0
                            if num_branches == 0
                            else covered_branches / num_branches * 100.0
                        )
                    return float(percent), branch_pct, "coverage.py function summary"

    executed_lines = set(cov_info.get("executed_lines", []))
    missing_lines = set(cov_info.get("missing_lines", []))
    executed = sum(
        1 for line in executed_lines if block.lineno <= line <= block.endline
    )
    missing = sum(1 for line in missing_lines if block.lineno <= line <= block.endline)
    total = executed + missing
    return (
        (0.0 if total == 0 else executed / total * 100.0),
        None,
        "line-range fallback",
    )


def _baseline_complexities(
    baseline_source_dir: Path | None,
    filepaths: list[str],
) -> dict[tuple[str, str], int]:
    """Index function complexity in the pre-change source tree."""
    if baseline_source_dir is None:
        return {}
    indexed: dict[tuple[str, str], int] = {}
    for filepath in filepaths:
        full_path = _resolve_source_path(baseline_source_dir, filepath)
        if not full_path.is_file():
            continue
        try:
            blocks = cc_visit(full_path.read_text(encoding="utf-8"))
        except (OSError, SyntaxError, UnicodeError) as exc:
            raise CoverageInputError(
                f"Não foi possível analisar o baseline de {filepath}: {type(exc).__name__}."
            ) from exc
        for block in blocks:
            if isinstance(block, Function):
                indexed[
                    (_normalise_path(filepath), getattr(block, "fullname", block.name))
                ] = block.complexity
    return indexed


def _normalise_changed_ranges(
    ranges: dict[str, list[list[int]]] | None,
) -> dict[str, tuple[tuple[int, int], ...]] | None:
    if ranges is None:
        return None
    normalised: dict[str, tuple[tuple[int, int], ...]] = {}
    for filepath, entries in ranges.items():
        if not isinstance(filepath, str) or not isinstance(entries, list):
            raise CoverageInputError("Mapa de linhas alteradas inválido.")
        parsed = []
        for entry in entries:
            if (
                not isinstance(entry, list)
                or len(entry) != 2
                or not all(isinstance(value, int) for value in entry)
                or entry[0] < 1
                or entry[1] < entry[0]
            ):
                raise CoverageInputError(
                    f"Intervalo de linhas alteradas inválido em {filepath}: {entry!r}."
                )
            parsed.append((entry[0], entry[1]))
        normalised[_normalise_path(filepath)] = tuple(parsed)
    return normalised


def get_crap_for_codebase(
    source_dir: str | Path = ".",
    coverage_json_path: str | Path = DEFAULT_COVERAGE_JSON,
    *,
    exclude_patterns: tuple[str, ...] = DEFAULT_EXCLUDE_PATTERNS,
    only_paths: tuple[str, ...] = (),
    threshold: float = DEFAULT_HIGH_RISK_THRESHOLD,
    baseline_source_dir: str | Path | None = None,
    max_new_crap: float | None = None,
    max_complexity: int | None = None,
    min_line_coverage: float | None = None,
    min_branch_coverage: float | None = None,
    max_crap_delta: float | None = None,
    require_function_summaries: bool = False,
    require_timestamp: bool = False,
    fail_on_skipped_files: bool = False,
    changed_line_ranges: dict[str, list[list[int]]] | None = None,
) -> dict[str, Any]:
    """Print and return a CRAP report for production source files.

    ``only_paths`` restringe a análise a arquivos específicos do relatório — é o
    que permite pontuar apenas o diff de uma spec em vez da codebase inteira.
    """
    source_root = Path(source_dir).resolve()
    report_path = Path(coverage_json_path).resolve()
    coverage_data = _load_coverage_report(report_path)
    files_cov = coverage_data["files"]
    wanted = {_normalise_path(p) for p in only_paths}
    available = {_normalise_path(filepath) for filepath in files_cov}
    missing_from_report = sorted(wanted - available)
    if missing_from_report:
        raise CoverageInputError(
            "Arquivos solicitados ausentes do relatório de cobertura: "
            + ", ".join(missing_from_report[:5])
        )
    included_paths = [
        filepath
        for filepath in files_cov
        if not _is_excluded(filepath, exclude_patterns)
        and (not wanted or _normalise_path(filepath) in wanted)
    ]
    _check_report_freshness(
        report_path,
        coverage_data,
        source_root,
        included_paths,
        require_timestamp=require_timestamp,
    )
    baseline_root = Path(baseline_source_dir).resolve() if baseline_source_dir else None
    baseline = _baseline_complexities(baseline_root, included_paths)
    changed_ranges = _normalise_changed_ranges(changed_line_ranges)

    total_crap = 0.0
    high_risk_functions = []
    analyzed_functions = []
    total_functions = 0
    fallback_count = 0
    skipped_files = []
    violations = []

    for filepath in included_paths:
        cov_info = files_cov[filepath]
        full_path = _resolve_source_path(source_root, filepath)
        if not full_path.is_file():
            skipped_files.append(f"{filepath} (arquivo não encontrado)")
            continue
        try:
            code = full_path.read_text(encoding="utf-8")
            blocks = cc_visit(code)
        except (OSError, SyntaxError, UnicodeError) as exc:
            skipped_files.append(f"{filepath} ({type(exc).__name__})")
            continue

        for block in blocks:
            if not isinstance(block, Function):
                continue
            if changed_ranges is not None:
                ranges = changed_ranges.get(_normalise_path(filepath), ())
                if not any(
                    block.lineno <= end and block.endline >= start
                    for start, end in ranges
                ):
                    continue
            coverage_pct, branch_coverage_pct, coverage_source = _function_coverage(
                block, cov_info
            )
            if coverage_source == "line-range fallback":
                fallback_count += 1
                if require_function_summaries:
                    raise CoverageInputError(
                        f"Cobertura exata por função ausente para {filepath} -> {block.name}()."
                    )
            crap_score = calculate_crap(block.complexity, coverage_pct)
            name = getattr(block, "fullname", block.name)
            baseline_comp = baseline.get((_normalise_path(filepath), name))
            is_new = baseline_root is not None and baseline_comp is None
            baseline_crap = (
                None
                if baseline_comp is None
                else calculate_crap(baseline_comp, coverage_pct)
            )
            crap_delta = None if baseline_crap is None else crap_score - baseline_crap
            total_crap += crap_score
            total_functions += 1
            function = {
                "file": filepath,
                "name": name,
                "crap": crap_score,
                "comp": block.complexity,
                "cov": coverage_pct,
                "branch_cov": branch_coverage_pct,
                "coverage_source": coverage_source,
                "new": is_new,
                "baseline_comp": baseline_comp,
                "baseline_crap_at_current_coverage": baseline_crap,
                "crap_delta": crap_delta,
            }
            analyzed_functions.append(function)
            if crap_score > threshold:
                high_risk_functions.append(function)
                violations.append(
                    {
                        "kind": "crap_limit",
                        "required_action": "green",
                        "file": filepath,
                        "name": name,
                        "actual": crap_score,
                        "limit": threshold,
                    }
                )
            if is_new and max_new_crap is not None and crap_score > max_new_crap:
                violations.append(
                    {
                        "kind": "new_function_crap_limit",
                        "required_action": "green",
                        "file": filepath,
                        "name": name,
                        "actual": crap_score,
                        "limit": max_new_crap,
                    }
                )
            complexity_limit = (
                max_complexity
                if baseline_comp is None or max_complexity is None
                else max(max_complexity, baseline_comp)
            )
            if complexity_limit is not None and block.complexity > complexity_limit:
                violations.append(
                    {
                        "kind": "complexity_limit",
                        "required_action": "green",
                        "file": filepath,
                        "name": name,
                        "actual": block.complexity,
                        "limit": complexity_limit,
                    }
                )
            if min_branch_coverage is not None:
                if branch_coverage_pct is None:
                    raise CoverageInputError(
                        f"Branch coverage ausente para {filepath} -> {name}(); gere cobertura com --cov-branch."
                    )
                if branch_coverage_pct < min_branch_coverage:
                    violations.append(
                        {
                            "kind": "branch_coverage_limit",
                            "required_action": "red",
                            "file": filepath,
                            "name": name,
                            "actual": branch_coverage_pct,
                            "limit": min_branch_coverage,
                        }
                    )
            if min_line_coverage is not None and coverage_pct < min_line_coverage:
                violations.append(
                    {
                        "kind": "line_coverage_limit",
                        "required_action": "red",
                        "file": filepath,
                        "name": name,
                        "actual": coverage_pct,
                        "limit": min_line_coverage,
                    }
                )
            if (
                max_crap_delta is not None
                and crap_delta is not None
                and crap_delta > max_crap_delta
            ):
                violations.append(
                    {
                        "kind": "crap_regression",
                        "required_action": "green",
                        "file": filepath,
                        "name": name,
                        "actual": crap_delta,
                        "limit": max_crap_delta,
                    }
                )

    if fail_on_skipped_files and skipped_files:
        raise CoverageInputError(
            "Arquivos de produção não analisados: " + ", ".join(skipped_files[:5])
        )

    if total_functions == 0:
        if not wanted:
            raise CoverageInputError(
                "Nenhuma função de produção foi analisada no relatório informado."
            )
        # Com filtro explícito, "nenhuma função" é um resultado legítimo (arquivo só com
        # constantes, ou alterado fora do relatório) — quem chama decide o que fazer.
        print("--- Relatório CRAP ---")
        print(f"Fonte de cobertura: {report_path}")
        print("Nenhuma função encontrada nos arquivos filtrados — sem sinal de CRAP.")
        return {
            "total_functions": 0,
            "average_crap": 0.0,
            "functions": [],
            "high_risk_functions": [],
            "fallback_functions": fallback_count,
            "skipped_files": skipped_files,
            "coverage_json": str(report_path),
            "threshold": threshold,
            "only_paths": sorted(wanted),
            "violations": [],
        }

    high_risk_functions.sort(key=lambda item: item["crap"], reverse=True)
    avg_crap = total_crap / total_functions
    result = {
        "total_functions": total_functions,
        "average_crap": avg_crap,
        "functions": analyzed_functions,
        "high_risk_functions": high_risk_functions,
        "fallback_functions": fallback_count,
        "skipped_files": skipped_files,
        "coverage_json": str(report_path),
        "threshold": threshold,
        "only_paths": sorted(wanted),
        "violations": violations,
        "policy": {
            "max_crap": threshold,
            "max_new_crap": max_new_crap,
            "max_complexity": max_complexity,
            "min_line_coverage": min_line_coverage,
            "min_branch_coverage": min_branch_coverage,
            "max_crap_delta": max_crap_delta,
            "require_function_summaries": require_function_summaries,
            "require_timestamp": require_timestamp,
            "fail_on_skipped_files": fail_on_skipped_files,
        },
        "changed_line_ranges": changed_line_ranges,
    }

    print("--- Relatório CRAP ---")
    print(f"Fonte de cobertura: {report_path}")
    print(f"Total de funções analisadas: {total_functions}")
    print(f"CRAP Médio da Codebase: {avg_crap:.2f}")
    if fallback_count:
        print(
            f"Aviso: {fallback_count} função(ões) usaram fallback por linhas; "
            "gere o JSON com uma versão atual do coverage.py para maior precisão."
        )
    if skipped_files:
        print(
            f"Aviso: {len(skipped_files)} arquivo(s) ignorado(s): {', '.join(skipped_files[:3])}"
        )
    if high_risk_functions:
        print(f"\n⚠️ Funções de Alto Risco (CRAP > {threshold:g}):")
        for function in high_risk_functions:
            print(f"- {function['file']} -> {function['name']}()")
            print(
                f"  CRAP: {function['crap']:.2f} | Complexidade: {function['comp']} | "
                f"Cobertura: {function['cov']:.1f}%"
            )
    return result


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "coverage_json",
        nargs="?",
        help=f"caminho do JSON do coverage.py (padrão: {DEFAULT_COVERAGE_JSON})",
    )
    parser.add_argument(
        "--coverage-json",
        dest="coverage_json_option",
        help="caminho explícito do JSON do coverage.py",
    )
    parser.add_argument(
        "--source-dir", default=".", help="raiz dos caminhos no relatório (padrão: .)"
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="ARQUIVO",
        help="restringe a análise a este arquivo do relatório (repetível)",
    )
    parser.add_argument(
        "--only-from",
        metavar="LISTA",
        help="arquivo com um caminho por linha para restringir a análise",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_HIGH_RISK_THRESHOLD,
        help=f"CRAP acima do qual a função é de alto risco (padrão: {DEFAULT_HIGH_RISK_THRESHOLD:g})",
    )
    parser.add_argument(
        "--json-out", metavar="ARQUIVO", help="grava o relatório como JSON"
    )
    parser.add_argument("--baseline-source-dir", metavar="DIR")
    parser.add_argument("--max-new-crap", type=float)
    parser.add_argument("--max-complexity", type=int)
    parser.add_argument("--min-line-coverage", type=float)
    parser.add_argument("--min-branch-coverage", type=float)
    parser.add_argument("--max-crap-delta", type=float)
    parser.add_argument("--require-function-summaries", action="store_true")
    parser.add_argument("--require-timestamp", action="store_true")
    parser.add_argument("--fail-on-skipped-files", action="store_true")
    parser.add_argument("--changed-lines-json", metavar="ARQUIVO")
    return parser.parse_args(argv)


def _read_only_list(path: Path) -> list[str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise CoverageInputError(
            f"Não foi possível ler a lista de arquivos {path}: {exc}"
        ) from exc
    return [line.strip() for line in lines if line.strip()]


def _write_json_report(path: Path, result: dict[str, Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except OSError as exc:
        raise CoverageInputError(
            f"Não foi possível gravar o relatório JSON {path}: {exc}"
        ) from exc


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.coverage_json and args.coverage_json_option:
        print(
            "Erro: informe o caminho do coverage JSON uma única vez.", file=sys.stderr
        )
        return 2
    coverage_path = (
        args.coverage_json_option or args.coverage_json or DEFAULT_COVERAGE_JSON
    )
    try:
        only_paths = list(args.only)
        if args.only_from:
            only_paths.extend(_read_only_list(Path(args.only_from)))
        changed_ranges = None
        if args.changed_lines_json:
            try:
                changed_ranges = json.loads(
                    Path(args.changed_lines_json).read_text(encoding="utf-8")
                )
            except (OSError, json.JSONDecodeError) as exc:
                raise CoverageInputError(
                    f"Não foi possível ler o mapa de linhas alteradas: {exc}"
                ) from exc
            if not isinstance(changed_ranges, dict):
                raise CoverageInputError(
                    "Mapa de linhas alteradas deve ser um objeto JSON."
                )
        result = get_crap_for_codebase(
            args.source_dir,
            coverage_path,
            only_paths=tuple(only_paths),
            threshold=args.threshold,
            baseline_source_dir=args.baseline_source_dir,
            max_new_crap=args.max_new_crap,
            max_complexity=args.max_complexity,
            min_line_coverage=args.min_line_coverage,
            min_branch_coverage=args.min_branch_coverage,
            max_crap_delta=args.max_crap_delta,
            require_function_summaries=args.require_function_summaries,
            require_timestamp=args.require_timestamp,
            fail_on_skipped_files=args.fail_on_skipped_files,
            changed_line_ranges=changed_ranges,
        )
        if args.json_out:
            _write_json_report(Path(args.json_out), result)
    except CoverageInputError as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
