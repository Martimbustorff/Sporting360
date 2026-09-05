#!/usr/bin/env python3
import json
import sys
from pathlib import Path

SEASON = "2026/27"
TRACKED = {"FC Porto", "SL Benfica", "Sporting CP"}
PUBLISHABLE_STATUSES = {"verified_two_sources", "resolved_dispute"}


def fail(message, errors):
    errors.append(message)


def validate_side(side, label, errors):
    for field in ("fouls", "yellow_first", "second_yellow", "direct_red", "staff_yellow", "staff_red"):
        value = side.get(field, 0)
        if not isinstance(value, int) or value < 0:
            fail(f"{label}: invalid {field}={value!r}", errors)


def main():
    base = Path(__file__).resolve().parent
    matches = json.loads((base / "matches.json").read_text(encoding="utf-8"))
    errors = []
    seen = set()

    for m in matches:
        key = (m["season"], m["date"], m["home_team"], m["away_team"])
        if key in seen:
            fail(f"duplicate match: {key}", errors)
        seen.add(key)

        if m["season"] != SEASON:
            fail(f"out-of-scope season: {key}", errors)

        if not ({m["home_team"], m["away_team"]} & TRACKED):
            fail(f"match does not involve tracked club: {key}", errors)

        validate_side(m["home"], f"{key} home", errors)
        validate_side(m["away"], f"{key} away", errors)

        status = m.get("verification_status")
        if status not in PUBLISHABLE_STATUSES:
            fail(f"not publishable: {key} status={status}", errors)

        sources = m.get("sources", [])
        if len(sources) < 2:
            fail(f"needs at least 2 provenance records: {key}", errors)

        # Staff cards must never leak into the player-card fields used by the infographic.
        for side_name in ("home", "away"):
            side = m[side_name]
            if side.get("staff_yellow", 0) and side.get("yellow_first", 0) < 0:
                fail(f"staff/player card separation invalid: {key} {side_name}", errors)

        # A second yellow always counts as both a shown yellow and a dismissal.
        # This assertion documents the public S360 convention used by aggregate.py.
        for side_name in ("home", "away"):
            side = m[side_name]
            yellow_shown = side["yellow_first"] + side["second_yellow"]
            red_total = side["direct_red"] + side["second_yellow"]
            if yellow_shown < side["second_yellow"] or red_total < side["second_yellow"]:
                fail(f"second-yellow convention broken: {key} {side_name}", errors)

    if errors:
        print("S360 discipline validation FAILED")
        for e in errors:
            print(f"- {e}")
        sys.exit(1)

    print(f"S360 discipline validation OK: {len(matches)} matches, season {SEASON}")


if __name__ == "__main__":
    main()
