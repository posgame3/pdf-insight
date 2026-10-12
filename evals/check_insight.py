#!/usr/bin/env python3
"""Checks a PDF Insight result (the downloaded .insight.json) against the brief and a document's expectations.

    python3 evals/check_insight.py result.insight.json --expect evals/expectations/umowa-14-2026.json

Standard library only. Hard checks fail the run (exit code 1); soft checks report quality signals that a good
model usually meets but that are not strictly required.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

DOCUMENT_TYPES = {"faktura", "umowa", "oferta", "raport", "inne"}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CURRENCY = re.compile(r"^[A-Z]{3}$")


@dataclass
class Check:
    name: str
    passed: bool
    hard: bool
    detail: str = ""


def sentences(text: str) -> int:
    """Rough sentence count, good enough to flag a summary that is far outside 3-5 sentences."""
    return len([part for part in re.split(r"(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9])", text.strip()) if part])


def brief_checks(result: dict[str, Any]) -> list[Check]:
    document = result.get("document", {})
    amounts = result.get("amounts", [])
    dates = result.get("dates", [])
    entities = result.get("entities", {})
    checks = [
        Check("document.fileName is a non-empty string", bool(document.get("fileName")), True),
        Check("document.pages is a positive integer", isinstance(document.get("pages"), int) and document["pages"] > 0, True),
        Check("document.type is allowed", document.get("type") in DOCUMENT_TYPES, True, str(document.get("type"))),
        Check("document.language is ISO 639-1", bool(re.fullmatch(r"[a-z]{2}", str(document.get("language")))), True),
        Check(
            "document.date is ISO 8601 or null",
            document.get("date") is None or bool(ISO_DATE.match(str(document.get("date")))),
            True,
        ),
        Check("summary has 3-5 sentences", 3 <= sentences(str(result.get("summary", ""))) <= 5, True),
        Check("keyPoints has 3-7 items", 3 <= len(result.get("keyPoints", [])) <= 7, True),
        Check(
            "entities has organizations and people lists",
            isinstance(entities.get("organizations"), list) and isinstance(entities.get("people"), list),
            True,
        ),
        Check(
            "amounts have numeric value and ISO 4217 currency",
            all(isinstance(a.get("value"), (int, float)) and CURRENCY.match(str(a.get("currency"))) for a in amounts),
            True,
        ),
        Check("dates are ISO 8601", all(ISO_DATE.match(str(d.get("date"))) for d in dates), True),
        Check("keywords is a list", isinstance(result.get("keywords"), list), True),
    ]
    return checks


def has_amount(amounts: list[dict[str, Any]], value: float, currency: str) -> bool:
    return any(abs(float(a["value"]) - value) < 0.005 and a["currency"] == currency for a in amounts)


def expectation_checks(result: dict[str, Any], expected: dict[str, Any]) -> list[Check]:
    checks: list[Check] = []
    document = result["document"]
    amounts = result["amounts"]
    analysis = result.get("analysis", {})
    warning_codes = {w["code"] for w in analysis.get("warnings", [])}
    text_fields = " ".join([result["summary"], *result["keyPoints"]])

    for key, value in expected.get("document", {}).items():
        checks.append(Check(f"document.{key} == {value!r}", document.get(key) == value, True, repr(document.get(key))))
    for item in expected.get("amounts_present", []):
        checks.append(
            Check(f"amount {item['value']} {item['currency']} present", has_amount(amounts, item["value"], item["currency"]), True)
        )
    for item in expected.get("amounts_absent", []):
        checks.append(
            Check(
                f"amount {item['value']} {item['currency']} absent ({item.get('why', '')})",
                not has_amount(amounts, item["value"], item["currency"]),
                True,
            )
        )
    for value in expected.get("not_amounts", []):
        checks.append(Check(f"{value} is not reported as an amount", not any(a["value"] == value for a in amounts), True))
    for pattern in expected.get("forbidden_in_summary", []):
        found = re.search(pattern, text_fields, re.IGNORECASE)
        checks.append(Check(f"summary/keyPoints free of /{pattern}/", found is None, True, found.group(0) if found else ""))
    for key in ("scannedPages", "unreadPages"):
        if key in expected.get("analysis", {}):
            checks.append(Check(f"analysis.{key} == {expected['analysis'][key]}", analysis.get(key) == expected["analysis"][key], True))
    if "hiddenTextPages" in expected.get("analysis", {}):
        pages = [item["page"] for item in analysis.get("hiddenText", [])]
        checks.append(Check(f"hidden text found on {expected['analysis']['hiddenTextPages']}", pages == expected["analysis"]["hiddenTextPages"], True, str(pages)))
    for code in expected.get("warnings_present", []):
        checks.append(Check(f"warning '{code}' present", code in warning_codes, True))
    for name in expected.get("people_present", []):
        checks.append(Check(f"person '{name}' (nominative) present", name in result["entities"]["people"], False))

    soft = expected.get("soft", {})
    for code in soft.get("warnings_present", []):
        checks.append(Check(f"warning '{code}' present", code in warning_codes, False))
    for item in soft.get("amounts_present", []):
        checks.append(Check(f"amount {item['value']} {item['currency']} present", has_amount(amounts, item["value"], item["currency"]), False))
    for pattern in soft.get("summary_mentions", []):
        checks.append(Check(f"summary/keyPoints mention /{pattern}/", re.search(pattern, text_fields, re.IGNORECASE) is not None, False))
    unconfirmed = [a for a in amounts if a.get("verification") == "unconfirmed"]
    checks.append(Check("no unconfirmed amounts", not unconfirmed, False, ", ".join(str(a["value"]) for a in unconfirmed)))
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("result", type=Path, help="downloaded .insight.json")
    parser.add_argument("--expect", type=Path, help="expectations JSON for this document")
    args = parser.parse_args()

    result = json.loads(args.result.read_text(encoding="utf-8"))
    checks = brief_checks(result)
    if args.expect:
        checks += expectation_checks(result, json.loads(args.expect.read_text(encoding="utf-8")))

    symbol: Callable[[Check], str] = lambda c: "PASS" if c.passed else ("FAIL" if c.hard else "SOFT")
    for check in checks:
        detail = f"  ({check.detail})" if check.detail and not check.passed else ""
        print(f"{symbol(check):4}  {check.name}{detail}")
    hard_failures = sum(1 for c in checks if c.hard and not c.passed)
    soft_failures = sum(1 for c in checks if not c.hard and not c.passed)
    print(f"\n{len(checks)} checks: {hard_failures} failed, {soft_failures} soft warnings")
    return 1 if hard_failures else 0


if __name__ == "__main__":
    sys.exit(main())
