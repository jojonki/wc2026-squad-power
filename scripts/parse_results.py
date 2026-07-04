#!/usr/bin/env python3
"""Bootstrap data/results.json from Wikipedia wikitext.

Inputs (a directory passed as argv[1]) must contain:
  grouptables.wikitext  -- Template:2026 FIFA World Cup group tables
  groupA.wikitext .. groupL.wikitext -- 2026 FIFA World Cup Group A..L
  knockout.wikitext     -- 2026 FIFA World Cup knockout stage

Output: data/results.json. After the bootstrap, the file is meant to be
updated BY HAND as knockout results come in: fill s1/s2 (and p1/p2 for
penalty shootouts) of the next unplayed match. Team slots from the
quarterfinals onward stay null -- the site derives them from winners.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# FIFA trigram -> squad team name (as used in data/squads.json)
CODE_TO_NAME = {
    "MEX": "Mexico", "RSA": "South Africa", "KOR": "South Korea", "CZE": "Czech Republic",
    "SUI": "Switzerland", "CAN": "Canada", "BIH": "Bosnia and Herzegovina", "QAT": "Qatar",
    "BRA": "Brazil", "MAR": "Morocco", "SCO": "Scotland", "HAI": "Haiti",
    "USA": "United States", "AUS": "Australia", "PAR": "Paraguay", "TUR": "Turkey",
    "GER": "Germany", "CIV": "Ivory Coast", "ECU": "Ecuador", "CUW": "Curaçao",
    "NED": "Netherlands", "JPN": "Japan", "SWE": "Sweden", "TUN": "Tunisia",
    "BEL": "Belgium", "EGY": "Egypt", "IRN": "Iran", "NZL": "New Zealand",
    "ESP": "Spain", "CPV": "Cape Verde", "KSA": "Saudi Arabia", "URU": "Uruguay",
    "FRA": "France", "NOR": "Norway", "SEN": "Senegal", "IRQ": "Iraq",
    "ARG": "Argentina", "AUT": "Austria", "ALG": "Algeria", "JOR": "Jordan",
    "COL": "Colombia", "POR": "Portugal", "COD": "DR Congo", "UZB": "Uzbekistan",
    "ENG": "England", "CRO": "Croatia", "GHA": "Ghana", "PAN": "Panama",
}

MONTHS = {"June": 6, "July": 7}


def split_pipes(s: str) -> list[str]:
    """Split on '|' at top level (outside [[..]] and {{..}})."""
    parts, depth, cur = [], 0, []
    i = 0
    while i < len(s):
        two = s[i:i + 2]
        if two in ("[[", "{{"):
            depth += 1
            cur.append(two)
            i += 2
        elif two in ("]]", "}}"):
            depth -= 1
            cur.append(two)
            i += 2
        elif s[i] == "|" and depth == 0:
            parts.append("".join(cur))
            cur = []
            i += 1
        else:
            cur.append(s[i])
            i += 1
    parts.append("".join(cur))
    return parts


def parse_group_tables(text: str) -> dict:
    groups = {}
    blocks = re.split(r"\|Group ([A-L])=", text)
    for i in range(1, len(blocks) - 1, 2):
        letter, block = blocks[i], blocks[i + 1]
        block = block.split("|3rd place=")[0]  # trailing third-place ranking table
        order = re.search(r"\|team_order=([A-Z,\s]+)", block).group(1)
        order = [c.strip() for c in order.split(",")]
        stats = {}
        for key, code, val in re.findall(r"\|(win|draw|loss|gf|ga)_([A-Z]{3})=(\d+)", block):
            stats.setdefault(code, {})[key] = int(val)
        adv_slots = {int(n) for n in re.findall(r"\|result(\d)=KO", block)}
        standings = []
        for pos, code in enumerate(order, 1):
            st = stats[code]
            standings.append({
                "team": CODE_TO_NAME[code],
                "w": st["win"], "d": st["draw"], "l": st["loss"],
                "gf": st["gf"], "ga": st["ga"],
                "pts": 3 * st["win"] + st["draw"],
                "adv": pos in adv_slots,
            })
        groups[letter] = standings
    return groups


def parse_group_matches(text: str) -> list[dict]:
    matches = []
    for chunk in text.split("{{#invoke:football box|main")[1:]:
        chunk = chunk[:3000]
        d = re.search(r"\|date=\{\{Start date\|2026\|(\d+)\|(\d+)\}\}", chunk)
        t1 = re.search(r"\|team1=\{\{#invoke:flag\|fb-rt\|([A-Z]{3})\}\}", chunk)
        t2 = re.search(r"\|team2=\{\{#invoke:flag\|fb\|([A-Z]{3})\}\}", chunk)
        sc = re.search(r"\|score=\{\{score link\|[^|]*\|(\d+)[–-](\d+)(?:\|[^}]*)?\}\}", chunk)
        if not (d and t1 and t2 and sc):
            continue
        matches.append({
            "date": f"{int(d.group(1))}/{int(d.group(2))}",
            "t1": CODE_TO_NAME[t1.group(1)], "s1": int(sc.group(1)),
            "t2": CODE_TO_NAME[t2.group(1)], "s2": int(sc.group(2)),
        })
    return matches


def parse_bracket(text: str) -> dict:
    section = re.search(r'<section begin="Bracket" />(.*?)<section end="Bracket" />',
                        text, re.S).group(1)
    round_markers = [
        ("r32", "<!--Round of 32-->"), ("r16", "<!--Round of 16-->"),
        ("qf", "<!--Quarterfinals-->"), ("sf", "<!--Semifinals-->"),
        ("final", "<!--Final-->"), ("third", "<!--Match for third place-->"),
    ]
    rounds = {}
    for idx, (rid, marker) in enumerate(round_markers):
        start = section.index(marker) + len(marker)
        end = section.index(round_markers[idx + 1][1]) if idx + 1 < len(round_markers) else section.rindex("}}")
        body = section[start:end]
        matches = []
        for line in body.splitlines():
            line = line.strip()
            if not line.startswith("|"):
                continue
            fields = split_pipes(line[1:])
            if len(fields) < 5:
                continue
            date_place, tf1, sf1, tf2, sf2 = fields[:5]

            dm = re.match(r"(June|July) (\d+)", date_place.strip())
            date = f"{MONTHS[dm.group(1)]}/{dm.group(2)}" if dm else None
            city = re.search(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", date_place)

            def team(f):
                m = re.search(r"\{\{#invoke:flag\|fb\|([A-Z]{3})\}\}", f)
                return CODE_TO_NAME[m.group(1)] if m else None

            def score(f):
                m = re.match(r"(\d+)(?:\s*\((\d+)\))?", f.strip())
                if not m:
                    return None, None
                return int(m.group(1)), int(m.group(2)) if m.group(2) else None

            s1, p1 = score(sf1)
            s2, p2 = score(sf2)
            match = {
                "date": date, "city": city.group(1) if city else None,
                "t1": team(tf1), "s1": s1, "t2": team(tf2), "s2": s2,
            }
            if p1 is not None or p2 is not None:
                match["p1"], match["p2"] = p1, p2
            if "{{aet}}" in tf1 + tf2:
                match["aet"] = True
            matches.append(match)
        rounds[rid] = matches
    return rounds


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "wikitext"
    group_tables = parse_group_tables((src / "grouptables.wikitext").read_text())

    groups = {}
    for letter in "ABCDEFGHIJKL":
        matches = parse_group_matches((src / f"group{letter}.wikitext").read_text())
        assert len(matches) == 6, f"group {letter}: {len(matches)} matches"
        groups[letter] = {"standings": group_tables[letter], "matches": matches}

    knockout = parse_bracket((src / "knockout.wikitext").read_text())
    expected = {"r32": 16, "r16": 8, "qf": 4, "sf": 2, "final": 1, "third": 1}
    for rid, n in expected.items():
        assert len(knockout[rid]) == n, f"{rid}: {len(knockout[rid])} matches (want {n})"

    # sanity: every R32 team advanced from its group
    adv = {s["team"] for g in groups.values() for s in g["standings"] if s["adv"]}
    r32_teams = {m[k] for m in knockout["r32"] for k in ("t1", "t2")}
    assert r32_teams <= adv, f"R32 teams not in advancers: {r32_teams - adv}"
    assert len(adv) == 32 and len(r32_teams) == 32

    out = {
        "updated": "2026-07-04",
        "_howto": "決勝Tの結果が出たら knockout の該当試合に s1/s2(PK戦なら p1/p2 も)を記入して scripts/build_data.py を再実行。qf 以降の t1/t2 は null のままでよい(勝者から自動決定)。",
        "groups": groups,
        "knockout": knockout,
    }
    dest = ROOT / "data" / "results.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {dest}")
    for rid in ("r32", "r16"):
        for m in knockout[rid]:
            pk = f" PK {m.get('p1')}-{m.get('p2')}" if "p1" in m else ""
            print(f"  {rid} {m['date']}: {m['t1']} {m['s1']}-{m['s2']} {m['t2']}{pk}")


if __name__ == "__main__":
    main()
