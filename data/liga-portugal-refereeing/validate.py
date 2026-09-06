#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

TRACKED = {"FC Porto", "SL Benfica", "Sporting CP"}
MAJOR = {"penalty", "goal", "offside_goal", "direct_red", "second_yellow_dismissal", "var_intervention"}

def has_publishable_evidence(row):
    sources = row.get("sources", [])
    official_error = any(s.get("tier") == "A_OFFICIAL" and s.get("conclusion") == "error" for s in sources)
    ex_ref_errors = {s.get("source_id") for s in sources if s.get("tier") == "B_EX_REFEREE" and s.get("conclusion") == "error"}
    ex_ref_correct = {s.get("source_id") for s in sources if s.get("tier") == "B_EX_REFEREE" and s.get("conclusion") == "correct"}
    match_evidence = any(s.get("tier") == "C_MATCH_EVIDENCE" for s in sources)
    one_ex_ref_plus_evidence = len(ex_ref_errors) >= 1 and match_evidence and not ex_ref_correct
    return official_error or len(ex_ref_errors) >= 2 or one_ex_ref_plus_evidence

def match_key(row):
    return (row.get("season"), row.get("round"), row.get("home_team"), row.get("away_team"))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--publish", action="store_true", help="Apply publication gate: all played tracked matches must be fully reviewed.")
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    rows = json.loads((base / "decisions.json").read_text(encoding="utf-8"))
    matches = json.loads((base / "match_reviews.json").read_text(encoding="utf-8"))
    errors = []
    ids = set()
    match_keys = set()
    for m in matches:
        key = match_key(m)
        if key in match_keys:
            errors.append(f"duplicate match manifest row: {key}")
        match_keys.add(key)
        if m.get("season") != "2026/27" or m.get("competition") != "Liga Portugal":
            errors.append(f"match outside scope: {key}")
        if m.get("tracked_club") not in TRACKED:
            errors.append(f"invalid tracked club in match: {key}")
        if m.get("review_status") not in {"reviewed", "awaiting_full_expert_review", "not_played"}:
            errors.append(f"invalid review_status in match: {key}")
        if args.publish and m.get("score") and m.get("review_status") != "reviewed":
            errors.append(f"publication blocked: played match not fully reviewed: {key}")
    for i, row in enumerate(rows):
        rid = row.get("id", f"row-{i}")
        if rid in ids:
            errors.append(f"{rid}: duplicate id")
        ids.add(rid)
        if row.get("season") != "2026/27" or row.get("competition") != "Liga Portugal":
            errors.append(f"{rid}: outside Liga Portugal 2026/27 scope")
        if row.get("tracked_club") not in TRACKED | {"none"}:
            errors.append(f"{rid}: invalid tracked_club")
        if match_key(row) not in match_keys:
            errors.append(f"{rid}: decision has no match manifest row")
        status = row.get("status")
        if status == "confirmed" and not has_publishable_evidence(row):
            errors.append(f"{rid}: confirmed without sufficient evidence/consensus")
        if status == "disputed" and row.get("error_direction") != "disputed":
            errors.append(f"{rid}: disputed row must use error_direction=disputed")
        if status == "no_error" and row.get("error_direction") not in {"not_applicable", "neutral"}:
            errors.append(f"{rid}: no_error cannot be favor/against")
        if row.get("impact_class") == "disciplinary_secondary" and row.get("category") in MAJOR:
            errors.append(f"{rid}: major category cannot be secondary")
        if row.get("impact_class") == "major" and row.get("category") not in MAJOR:
            errors.append(f"{rid}: secondary category cannot be major")
    expected_r4 = {
        "FC Porto": {"favor": 3, "against": 4},
        "SL Benfica": {"favor": 3, "against": 2},
        "Sporting CP": {"favor": 5, "against": 5},
    }
    for club, exp in expected_r4.items():
        subset = [r for r in rows if r.get("tracked_club") == club and r.get("status") == "confirmed" and r.get("round", 99) <= 4]
        favor = sum(r.get("error_direction") == "favor" for r in subset)
        against = sum(r.get("error_direction") == "against" for r in subset)
        if {"favor": favor, "against": against} != exp:
            errors.append(f"{club}: round-4 sanity mismatch; got favor={favor}, against={against}, expected {exp}")
    if errors:
        print("NOT PUBLISHABLE" if args.publish else "VALIDATION FAILED")
        for e in errors:
            print(f"- {e}")
        sys.exit(1)
    print("VALIDATION PASSED")
    print(f"{len(rows)} decision rows checked")
    print(f"{len(matches)} tracked match rows checked")
    if args.publish:
        print("PUBLICATION GATE PASSED")

if __name__ == "__main__":
    main()
