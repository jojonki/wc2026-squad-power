#!/usr/bin/env python3
"""Join data/squads.json with data/ratings.json into site/data.js.

Player score = curated club rating if present, else the baseline score of the
club's league (2025-26 season membership). Team aggregates:
  best11   = best GK + top 10 outfield scores, averaged
  squadAvg = mean of all squad players
  bench    = mean of players outside the best XI
  overall  = 0.65 * best11 + 0.35 * bench
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# National team name -> (ISO code for flag, Japanese name, confederation)
NATIONS = {
    "Czech Republic": ("CZ", "チェコ", "UEFA"),
    "Mexico": ("MX", "メキシコ", "CONCACAF"),
    "South Africa": ("ZA", "南アフリカ", "CAF"),
    "South Korea": ("KR", "韓国", "AFC"),
    "Bosnia and Herzegovina": ("BA", "ボスニア・ヘルツェゴビナ", "UEFA"),
    "Canada": ("CA", "カナダ", "CONCACAF"),
    "Qatar": ("QA", "カタール", "AFC"),
    "Switzerland": ("CH", "スイス", "UEFA"),
    "Brazil": ("BR", "ブラジル", "CONMEBOL"),
    "Haiti": ("HT", "ハイチ", "CONCACAF"),
    "Morocco": ("MA", "モロッコ", "CAF"),
    "Scotland": ("GB-SCT", "スコットランド", "UEFA"),
    "Australia": ("AU", "オーストラリア", "AFC"),
    "Paraguay": ("PY", "パラグアイ", "CONMEBOL"),
    "Turkey": ("TR", "トルコ", "UEFA"),
    "United States": ("US", "アメリカ", "CONCACAF"),
    "Curaçao": ("CW", "キュラソー", "CONCACAF"),
    "Ecuador": ("EC", "エクアドル", "CONMEBOL"),
    "Germany": ("DE", "ドイツ", "UEFA"),
    "Ivory Coast": ("CI", "コートジボワール", "CAF"),
    "Japan": ("JP", "日本", "AFC"),
    "Netherlands": ("NL", "オランダ", "UEFA"),
    "Sweden": ("SE", "スウェーデン", "UEFA"),
    "Tunisia": ("TN", "チュニジア", "CAF"),
    "Belgium": ("BE", "ベルギー", "UEFA"),
    "Egypt": ("EG", "エジプト", "CAF"),
    "Iran": ("IR", "イラン", "AFC"),
    "New Zealand": ("NZ", "ニュージーランド", "OFC"),
    "Cape Verde": ("CV", "カーボベルデ", "CAF"),
    "Saudi Arabia": ("SA", "サウジアラビア", "AFC"),
    "Spain": ("ES", "スペイン", "UEFA"),
    "Uruguay": ("UY", "ウルグアイ", "CONMEBOL"),
    "France": ("FR", "フランス", "UEFA"),
    "Iraq": ("IQ", "イラク", "AFC"),
    "Norway": ("NO", "ノルウェー", "UEFA"),
    "Senegal": ("SN", "セネガル", "CAF"),
    "Algeria": ("DZ", "アルジェリア", "CAF"),
    "Argentina": ("AR", "アルゼンチン", "CONMEBOL"),
    "Austria": ("AT", "オーストリア", "UEFA"),
    "Jordan": ("JO", "ヨルダン", "AFC"),
    "Colombia": ("CO", "コロンビア", "CONMEBOL"),
    "DR Congo": ("CD", "コンゴ民主共和国", "CAF"),
    "Portugal": ("PT", "ポルトガル", "UEFA"),
    "Uzbekistan": ("UZ", "ウズベキスタン", "AFC"),
    "Croatia": ("HR", "クロアチア", "UEFA"),
    "England": ("GB-ENG", "イングランド", "UEFA"),
    "Ghana": ("GH", "ガーナ", "CAF"),
    "Panama": ("PA", "パナマ", "CONCACAF"),
}

# FIFA trigram (club country) -> ISO code for flag emoji
FIFA_TO_ISO = {
    "ALG": "DZ", "ARG": "AR", "ARM": "AM", "AUS": "AU", "AUT": "AT", "AZE": "AZ",
    "BEL": "BE", "BIH": "BA", "BRA": "BR", "BUL": "BG", "CAN": "CA", "CHI": "CL",
    "CHN": "CN", "COL": "CO", "CRC": "CR", "CRO": "HR", "CYP": "CY", "CZE": "CZ",
    "DEN": "DK", "ECU": "EC", "EGY": "EG", "ENG": "GB-ENG", "ESP": "ES",
    "FIN": "FI", "FRA": "FR", "GER": "DE", "GHA": "GH", "GRE": "GR", "HAI": "HT",
    "HON": "HN", "HUN": "HU", "IDN": "ID", "IRL": "IE", "IRN": "IR", "IRQ": "IQ",
    "ISR": "IL", "ITA": "IT", "JOR": "JO", "JPN": "JP", "KAZ": "KZ", "KOR": "KR",
    "KSA": "SA", "MAR": "MA", "MAS": "MY", "MEX": "MX", "NED": "NL", "NOR": "NO",
    "NZL": "NZ", "PAN": "PA", "PAR": "PY", "POL": "PL", "POR": "PT", "QAT": "QA",
    "ROU": "RO", "RSA": "ZA", "RUS": "RU", "SCO": "GB-SCT", "SRB": "RS",
    "SUI": "CH", "SVK": "SK", "SVN": "SI", "SWE": "SE", "THA": "TH", "TUN": "TN",
    "TUR": "TR", "UAE": "AE", "URU": "UY", "USA": "US", "UZB": "UZ", "VEN": "VE",
    "WAL": "GB-WLS",
}

SPECIAL_FLAGS = {
    "GB-ENG": "\U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006E\U000E0067\U000E007F",
    "GB-SCT": "\U0001F3F4\U000E0067\U000E0062\U000E0073\U000E0063\U000E0074\U000E007F",
    "GB-WLS": "\U0001F3F4\U000E0067\U000E0062\U000E0077\U000E006C\U000E0073\U000E007F",
}


def flag(iso: str) -> str:
    if iso in SPECIAL_FLAGS:
        return SPECIAL_FLAGS[iso]
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso)


def main():
    squads = json.loads((ROOT / "data" / "squads.json").read_text())
    ratings = json.loads((ROOT / "data" / "ratings.json").read_text())
    leagues = ratings["leagues"]
    defaults = ratings["countryDefaultLeague"]
    overrides = ratings["clubLeagueOverrides"]
    club_ratings = ratings["clubRatings"]

    unmatched_countries = set()
    used_keys = set()

    out_teams = []
    for t in squads:
        iso, ja, conf = NATIONS[t["name"]]
        players = []
        for p in t["players"]:
            key = f"{p['club']}|{p['clubCountry']}"
            cc = p["clubCountry"]
            if cc not in defaults:
                unmatched_countries.add(cc)
                continue
            league_id = overrides.get(key, defaults[cc])
            league = leagues[league_id]
            if key in club_ratings:
                score = club_ratings[key]
                used_keys.add(key)
            else:
                score = league["score"]
            players.append({
                **p,
                "league": league_id,
                "score": score,
                "clubFlag": flag(FIFA_TO_ISO[cc]),
            })
        players.sort(key=lambda x: -x["score"])

        gks = [p for p in players if p["pos"] == "GK"]
        outfield = [p for p in players if p["pos"] != "GK"]
        xi = ([max(gks, key=lambda x: x["score"])] if gks else []) + outfield[:10]
        xi_names = {p["name"] for p in xi}
        bench = [p for p in players if p["name"] not in xi_names]
        best11 = sum(p["score"] for p in xi) / len(xi)
        squad_avg = sum(p["score"] for p in players) / len(players)
        bench_avg = sum(p["score"] for p in bench) / len(bench)
        overall = 0.65 * best11 + 0.35 * bench_avg
        for p in xi:
            p["xi"] = True

        out_teams.append({
            "name": t["name"],
            "ja": ja,
            "group": t["group"],
            "conf": conf,
            "coach": t.get("coach", ""),
            "flag": flag(iso),
            "overall": round(overall, 1),
            "best11": round(best11, 1),
            "squadAvg": round(squad_avg, 1),
            "bench": round(bench_avg, 1),
            "avgAge": round(
                sum(p["age"] for p in players if p["age"]) /
                max(1, sum(1 for p in players if p["age"])), 1),
            "totalCaps": sum(p["caps"] for p in players),
            "players": players,
        })

    out_teams.sort(key=lambda x: -x["overall"])
    for i, t in enumerate(out_teams):
        t["rank"] = i + 1

    league_meta = {
        lid: {"name": v["name"], "ja": v["ja"], "score": v["score"],
              "flag": flag(FIFA_TO_ISO[v["country"]])}
        for lid, v in leagues.items()
    }

    payload = {"teams": out_teams, "leagues": league_meta}
    out = ROOT / "docs" / "data.js"
    out.parent.mkdir(exist_ok=True)
    out.write_text("const DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")

    if unmatched_countries:
        print("!! unmatched club countries:", sorted(unmatched_countries))
    dead_keys = (set(club_ratings) - used_keys) | (
        set(overrides) - {f"{p['club']}|{p['clubCountry']}" for t in squads for p in t["players"]}
    )
    if dead_keys:
        print("!! curated keys that matched no player (check spelling):")
        for k in sorted(dead_keys):
            print("   ", k)

    print("\n=== Top 15 ===")
    for t in out_teams[:15]:
        print(f"{t['rank']:2d}. {t['name']:<22} overall={t['overall']:5.1f} XI={t['best11']:5.1f} bench={t['bench']:5.1f}")
    print("=== Bottom 5 ===")
    for t in out_teams[-5:]:
        print(f"{t['rank']:2d}. {t['name']:<22} overall={t['overall']:5.1f} XI={t['best11']:5.1f} bench={t['bench']:5.1f}")


if __name__ == "__main__":
    main()
