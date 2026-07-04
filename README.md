# ⚽ WC2026 Squad Power

2026 FIFAワールドカップ全48カ国・1,248選手の「所属クラブ/リーグの強さ」から、
各国の**個のレベル**を数値化してビジュアルに比較できる静的Webアプリ。

- **総合ランキング** — 大陸連盟の色分きバーで48カ国を一望
- **質 × 層の厚さ** — ベストXIスコア × 控え層スコアの散布図(国旗がマーカー)
- **グループリーグ** — A〜Lの順位表と全72試合の結果、「死の組」判定・戦力予想とのギャップ表示つき
- **決勝トーナメント** — ラウンド32〜決勝のブラケット。番狂わせ 💥 マークつき。結果が出しだい手動更新
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
  results.json   # 試合結果(グループ順位表・全試合・決勝Tブラケット)← 手動更新するのはここ
scripts/
  parse_squads.py   # Wikipedia のwikitextから squads.json を生成
  parse_results.py  # Wikipedia のwikitextから results.json を初期生成(ブートストラップ用)
  build_data.py     # squads + ratings + results を結合して docs/data.js を生成
docs/            # GitHub Pages 公開ディレクトリ(静的サイト本体)
```

## 試合結果の更新(決勝トーナメント進行中の手動運用)

決勝Tの結果が出たら `data/results.json` の `knockout` にある該当試合に
**`s1` / `s2`(90分+延長後のスコア)を記入するだけ**。PK戦にもつれた場合は
`p1` / `p2` にPKスコアも記入する(`aet: true` は延長の表示用、任意)。

- 準々決勝以降の `t1` / `t2` は `null` のままでOK — サイト側が前ラウンドの勝者から自動で埋めます
- 3位決定戦の `t1` / `t2` も同様に準決勝の敗者から自動決定
- `updated` の日付を更新しておくとブラケット画面の注記に反映されます

```sh
python3 scripts/build_data.py   # docs/data.js を再生成
git add -A && git commit -m "update results" && git push
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

`results.json` をWikipediaから作り直したい場合は、`2026 FIFA World Cup Group A`〜`L`・
`Template:2026 FIFA World Cup group tables`・`2026 FIFA World Cup knockout stage` の
wikitextを同様に取得して1つのディレクトリに置き、`python3 scripts/parse_results.py <dir>` を実行
(手動編集分は上書きされるので注意)。

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
