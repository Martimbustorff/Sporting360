#!/usr/bin/env python3
"""Print a JSON skeleton for one future tracked match.
Usage:
  python new_match_template.py 6 "FC Porto" "Estoril" "FC Porto" 2026-09-13
"""
import json
import sys

if len(sys.argv) != 6:
    raise SystemExit("usage: new_match_template.py ROUND HOME AWAY TRACKED_CLUB DATE")

round_no = int(sys.argv[1])
home, away, club, date = sys.argv[2:6]
row = {
    "season": "2026/27",
    "competition": "Liga Portugal",
    "round": round_no,
    "date": date,
    "home_team": home,
    "away_team": away,
    "score": None,
    "referee": None,
    "var": None,
    "tracked_club": club,
    "review_status": "not_played",
    "match_key": f"R{round_no}-{home}-{away}".replace(" ", "_"),
}
print(json.dumps(row, ensure_ascii=False, indent=2))
