# ⚽ W杯2026 スカッドスカウター

2026 FIFAワールドカップ全48カ国・1,248選手の「所属クラブ/リーグの強さ」から、
各国の**個のレベル**を数値化してビジュアルに比較できる静的Webアプリ。

- **総合ランキング** — 大陸連盟の色分きバーで48カ国を一望
- **質 × 層の厚さ** — ベストXIスコア × 控え層スコアの散布図(国旗がマーカー)
- **グループ別** — A〜Lの12グループ、「死の組」判定つき
- **リーグ分析** — W杯選手の供給源リーグとリーグ強度
- **チーム詳細** — 各国26人全員のクラブ・リーグ・スコア内訳

## スコアの考え方

```
選手スコア (0-100) = クラブ個別レーティング(約230クラブ) or 所属リーグ基準値
ベストXI   = 最高スコアGK 1人 + フィールド上位10人の平均
控え層     = 残り15人の平均
総合スコア = ベストXI × 0.65 + 控え層 × 0.35
```

レーティングは UEFA係数・Opta Power Rankings・移籍市場価値などの一般的な
コンセンサスを参考にした独自の推定値です(2025-26シーズン基準)。
詳細はアプリ内「算出方法」タブへ。

## 構成

```
data/
  squads.json    # パース済みスカッドデータ(48チーム×26人)
  ratings.json   # リーグ基準値・2部補正・クラブ個別レーティング(手動キュレーション)
scripts/
  parse_squads.py  # Wikipedia のwikitextから squads.json を生成
  build_data.py    # squads + ratings を結合して docs/data.js を生成
docs/            # GitHub Pages 公開ディレクトリ(静的サイト本体)
```

## データの更新

```sh
# 1. Wikipedia から最新のスカッドwikitextを取得
curl -s "https://en.wikipedia.org/w/api.php?action=query&titles=2026%20FIFA%20World%20Cup%20squads&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['query']['pages'][0]['revisions'][0]['slots']['main']['content'])" > /tmp/squads.wikitext

# 2. パース → ビルド
python3 scripts/parse_squads.py /tmp/squads.wikitext
python3 scripts/build_data.py   # 未マッチのクラブ/国があれば警告が出ます

# 3. ローカル確認
python3 -m http.server -d docs 8000
```

## 公開 (GitHub Pages)

リポジトリ名は `wc2026-squad-power`(ローカルのフォルダ名と一致していなくてOK)。

```sh
# github.com で wc2026-squad-power リポジトリ(Public)を作成してから:
git remote add origin git@github.com:jojonki/wc2026-squad-power.git
git push -u origin main
```

その後、リポジトリの Settings → Pages → Source を `main` ブランチの `/docs` に設定。
公開URLは `https://jojonki.github.io/wc2026-squad-power/` になります。

## データ出典

[Wikipedia — 2026 FIFA World Cup squads](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads)(CC BY-SA)。
スコアは公式レーティングではなく、エンタメ目的の推定値です。
