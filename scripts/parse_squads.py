#!/usr/bin/env python3
"""Parse Wikipedia '2026 FIFA World Cup squads' wikitext into structured JSON.

Input:  scratch wikitext file (fetched from the MediaWiki API)
Output: data/squads.json  — list of teams, each with group + 26 players
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def strip_link(text: str) -> str:
    """'[[SK Slavia Prague|Slavia Prague]]' -> 'Slavia Prague'"""
    text = text.strip()
    m = re.match(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", text)
    if m:
        return (m.group(2) or m.group(1)).strip()
    return text


def parse_template_params(body: str) -> dict:
    """Split a template body on top-level pipes (ignoring pipes inside [[..]] and {{..}})."""
    params = {}
    depth_sq = depth_br = 0
    parts, cur = [], []
    for i, ch in enumerate(body):
        if body[i : i + 2] == "[[":
            depth_sq += 1
        elif body[i : i + 2] == "]]":
            depth_sq -= 1 if depth_sq else 0
        elif body[i : i + 2] == "{{":
            depth_br += 1
        elif body[i : i + 2] == "}}":
            depth_br -= 1 if depth_br else 0
        if ch == "|" and depth_sq == 0 and depth_br == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    for part in parts:
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip()] = v.strip()
    return params


def main():
    wikitext = Path(sys.argv[1]).read_text()

    teams = []
    group = None
    team = None
    for line in wikitext.splitlines():
        if re.match(r"^==[^=]", line):
            m = re.match(r"^==\s*Group ([A-L])\s*==$", line)
            group = m.group(1) if m else None
            team = None
            continue
        m = re.match(r"^===\s*(.+?)\s*===$", line)
        if m and group:
            team = {"name": m.group(1), "group": group, "players": []}
            teams.append(team)
            continue
        if team is not None and line.startswith("Coach:"):
            team["coach"] = strip_link(line[len("Coach:") :].strip())
            continue
        m = re.match(r"^\{\{nat fs g player\|(.*)\}\}\s*$", line)
        if m and team is not None:
            p = parse_template_params(m.group(1))
            birth = re.search(
                r"birth date and age2\|df=y\|\d+\|\d+\|\d+\|(\d+)\|(\d+)\|(\d+)",
                p.get("age", ""),
            )
            age = None
            if birth:
                by, bm, bd = map(int, birth.groups())
                # age as of tournament start 2026-06-11
                age = 2026 - by - ((6, 11) < (bm, bd))
            team["players"].append(
                {
                    "no": int(p["no"]) if p.get("no", "").isdigit() else None,
                    "pos": p.get("pos", ""),
                    "name": strip_link(p.get("name", "")),
                    "age": age,
                    "caps": int(p["caps"]) if p.get("caps", "").isdigit() else 0,
                    "goals": int(p["goals"]) if p.get("goals", "").isdigit() else 0,
                    "club": strip_link(p.get("club", "")),
                    "clubCountry": p.get("clubnat", ""),
                    "captain": "captain" in p.get("other", ""),
                }
            )

    out = ROOT / "data" / "squads.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(teams, ensure_ascii=False, indent=1))
    n_players = sum(len(t["players"]) for t in teams)
    print(f"{len(teams)} teams, {n_players} players -> {out}")
    sizes = {t["name"]: len(t["players"]) for t in teams if len(t["players"]) != 26}
    if sizes:
        print("non-26 squads:", sizes)


if __name__ == "__main__":
    main()
