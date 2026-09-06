#!/usr/bin/env python3
import json
from pathlib import Path

QUERIES = [
    '"{home}-{away}" arbitragem Pedro Henriques',
    '"{home}-{away}" arbitragem Jorge Faustino Marco Ferreira',
    '"{home}-{away}" arbitragem O Jogo Coroado Leirós Azevedo',
    '"{home}-{away}" Verdade Desportiva',
]

def main():
    base = Path(__file__).resolve().parent
    matches = json.loads((base / "match_reviews.json").read_text(encoding="utf-8"))
    pending = [m for m in matches if m.get("score") and m.get("review_status") != "reviewed"]
    out = []
    for m in pending:
        out.append({
            "round": m["round"],
            "match": f'{m["home_team"]}–{m["away_team"]}',
            "status": m["review_status"],
            "queries": [q.format(home=m["home_team"], away=m["away_team"]) for q in QUERIES]
        })
    print(json.dumps(out, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
