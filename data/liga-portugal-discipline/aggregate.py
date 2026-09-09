#!/usr/bin/env python3
import json
from pathlib import Path

TRACKED = ["FC Porto", "SL Benfica", "Sporting CP"]


def load_matches(base):
    matches = []
    for path in sorted(base.glob("matches*.json")):
        matches.extend(json.loads(path.read_text(encoding="utf-8")))
    return matches


def card_totals(side):
    yellow_shown = side["yellow_first"] + side["second_yellow"]
    red_total = side["second_yellow"] + side["direct_red"]
    return yellow_shown, red_total


def aggregate(matches, team):
    team_rows = []
    for m in matches:
        if m["home_team"] == team:
            own, opp = m["home"], m["away"]
        elif m["away_team"] == team:
            own, opp = m["away"], m["home"]
        else:
            continue
        team_rows.append((m, own, opp))

    games = len(team_rows)
    own_fouls = sum(r[1]["fouls"] for r in team_rows)
    opp_fouls = sum(r[2]["fouls"] for r in team_rows)
    own_yellows = sum(card_totals(r[1])[0] for r in team_rows)
    own_reds = sum(card_totals(r[1])[1] for r in team_rows)
    opp_yellows = sum(card_totals(r[2])[0] for r in team_rows)
    opp_reds = sum(card_totals(r[2])[1] for r in team_rows)

    return {
        "games": games,
        "team": {
            "fouls": own_fouls,
            "fouls_per_game": round(own_fouls / games, 2) if games else 0,
            "yellow_cards_shown": own_yellows,
            "red_cards": own_reds,
            "fouls_per_yellow": round(own_fouls / own_yellows, 2) if own_yellows else None,
        },
        "opponents": {
            "fouls": opp_fouls,
            "fouls_per_game": round(opp_fouls / games, 2) if games else 0,
            "yellow_cards_shown": opp_yellows,
            "red_cards": opp_reds,
            "fouls_per_yellow": round(opp_fouls / opp_yellows, 2) if opp_yellows else None,
        },
        "foul_balance_team_minus_opponents": own_fouls - opp_fouls,
    }


def main():
    base = Path(__file__).resolve().parent
    matches = load_matches(base)
    result = {team: aggregate(matches, team) for team in TRACKED}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
