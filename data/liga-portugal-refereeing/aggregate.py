#!/usr/bin/env python3
import json
from collections import defaultdict
from pathlib import Path

TRACKED = ["FC Porto", "SL Benfica", "Sporting CP"]


def load_decisions(base):
    rows = json.loads((base / "decisions.json").read_text(encoding="utf-8"))
    for path in sorted(base.glob("decisions-round*.json")):
        rows.extend(json.loads(path.read_text(encoding="utf-8")))
    return rows


def load(base):
    decisions = load_decisions(base)
    matches = json.loads((base / "match_reviews.json").read_text(encoding="utf-8"))
    return decisions, matches


def counts(rows):
    favor = sum(1 for r in rows if r.get("error_direction") == "favor")
    against = sum(1 for r in rows if r.get("error_direction") == "against")
    return {"favor": favor, "against": against, "balance": favor - against}


def aggregate(decisions, matches):
    out = {}
    for club in TRACKED:
        club_matches = [m for m in matches if m.get("tracked_club") == club]
        played = [m for m in club_matches if m.get("score")]
        reviewed = [m for m in played if m.get("review_status") == "reviewed"]
        pending = [m for m in played if m.get("review_status", "").startswith("awaiting")]
        confirmed = [r for r in decisions if r.get("tracked_club") == club and r.get("status") == "confirmed"]
        major = [r for r in confirmed if r.get("impact_class") == "major"]
        secondary = [r for r in confirmed if r.get("impact_class") == "disciplinary_secondary"]
        disputed = [r for r in decisions if r.get("tracked_club") == club and r.get("status") == "disputed"]
        candidates = [r for r in decisions if r.get("tracked_club") == club and r.get("status") == "candidate"]
        by_category = defaultdict(lambda: {"favor": 0, "against": 0})
        for r in confirmed:
            direction = r.get("error_direction")
            if direction in {"favor", "against"}:
                by_category[r["category"]][direction] += 1
        out[club] = {
            "games_played": len(played),
            "games_fully_reviewed": len(reviewed),
            "games_pending_full_review": len(pending),
            "confirmed_errors_all": counts(confirmed),
            "confirmed_major_errors": counts(major),
            "confirmed_secondary_discipline_errors": counts(secondary),
            "by_category": dict(by_category),
            "disputed_not_counted": len(disputed),
            "candidates_not_counted": len(candidates),
            "pending_matches": [f'{m["home_team"]}–{m["away_team"]}' for m in pending],
        }
    return out


def main():
    base = Path(__file__).resolve().parent
    decisions, matches = load(base)
    result = aggregate(decisions, matches)
    result["publishable"] = all(row["games_pending_full_review"] == 0 for row in result.values() if isinstance(row, dict) and "games_pending_full_review" in row)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
