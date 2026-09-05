#!/usr/bin/env python3
import json
from collections import Counter, defaultdict
from pathlib import Path

TRACKED = ["FC Porto", "SL Benfica", "Sporting CP"]
MAJOR = {"penalty", "goal", "offside_goal", "direct_red", "second_yellow_dismissal", "var_intervention"}


def main():
    base = Path(__file__).resolve().parent
    rows = json.loads((base / "decisions.json").read_text(encoding="utf-8"))
    out = {}

    for club in TRACKED:
        confirmed = [
            r for r in rows
            if r.get("tracked_club") == club and r.get("status") == "confirmed"
        ]
        major = [r for r in confirmed if r.get("impact_class") == "major" or r.get("category") in MAJOR]
        secondary = [r for r in confirmed if r not in major]

        favor = sum(1 for r in major if r.get("error_direction") == "favor")
        against = sum(1 for r in major if r.get("error_direction") == "against")
        disputed = sum(1 for r in rows if r.get("tracked_club") == club and r.get("status") == "disputed")

        categories = defaultdict(lambda: {"favor": 0, "against": 0})
        for r in major:
            direction = r.get("error_direction")
            if direction in {"favor", "against"}:
                categories[r["category"]][direction] += 1

        out[club] = {
            "major_errors_favor": favor,
            "major_errors_against": against,
            "balance": favor - against,
            "major_by_category": dict(categories),
            "secondary_discipline_errors": {
                "favor": sum(1 for r in secondary if r.get("error_direction") == "favor"),
                "against": sum(1 for r in secondary if r.get("error_direction") == "against")
            },
            "disputed_not_counted": disputed
        }

    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
