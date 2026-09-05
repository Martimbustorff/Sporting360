#!/usr/bin/env python3
import json
import sys
from pathlib import Path

TRACKED = {"FC Porto", "SL Benfica", "Sporting CP"}


def has_publishable_evidence(row):
    sources = row.get("sources", [])
    official_error = any(s.get("tier") == "A_OFFICIAL" and s.get("conclusion") == "error" for s in sources)
    ex_ref_errors = {
        s.get("source_id") for s in sources
        if s.get("tier") == "B_EX_REFEREE" and s.get("conclusion") == "error"
    }
    ex_ref_plus_match = (
        len(ex_ref_errors) >= 1
        and any(s.get("tier") == "C_MATCH_EVIDENCE" for s in sources)
        and not any(s.get("tier") == "B_EX_REFEREE" and s.get("conclusion") == "correct" for s in sources)
    )
    return official_error or len(ex_ref_errors) >= 2 or ex_ref_plus_match


def main():
    base = Path(__file__).resolve().parent
    rows = json.loads((base / "decisions.json").read_text(encoding="utf-8"))
    errors = []
    ids = set()

    for i, row in enumerate(rows):
        rid = row.get("id", f"row-{i}")
        if rid in ids:
            errors.append(f"{rid}: duplicate id")
        ids.add(rid)

        if row.get("season") != "2026/27" or row.get("competition") != "Liga Portugal":
            errors.append(f"{rid}: outside Liga Portugal 2026/27 scope")

        if row.get("tracked_club") not in TRACKED | {"none"}:
            errors.append(f"{rid}: invalid tracked_club")

        status = row.get("status")
        if status == "confirmed" and not has_publishable_evidence(row):
            errors.append(f"{rid}: confirmed without sufficient evidence/consensus")

        if status == "disputed" and row.get("error_direction") != "disputed":
            errors.append(f"{rid}: disputed row must use error_direction=disputed")

        if row.get("impact_class") == "disciplinary_secondary" and row.get("category") in {
            "penalty", "goal", "offside_goal", "direct_red", "second_yellow_dismissal", "var_intervention"
        }:
            errors.append(f"{rid}: major category cannot be secondary discipline")

    if errors:
        print("NOT PUBLISHABLE")
        for e in errors:
            print(f"- {e}")
        sys.exit(1)

    print("VALIDATION PASSED")
    print(f"{len(rows)} decision rows checked")


if __name__ == "__main__":
    main()
