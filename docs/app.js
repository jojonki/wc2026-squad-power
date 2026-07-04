/* W杯2026 スカッドスカウター */
"use strict";

const CONFS = [
  { id: "UEFA", ja: "欧州 (UEFA)", color: "var(--c-uefa)" },
  { id: "CONMEBOL", ja: "南米 (CONMEBOL)", color: "var(--c-conmebol)" },
  { id: "CONCACAF", ja: "北中米 (CONCACAF)", color: "var(--c-concacaf)" },
  { id: "CAF", ja: "アフリカ (CAF)", color: "var(--c-caf)" },
  { id: "AFC", ja: "アジア (AFC)", color: "var(--c-afc)" },
  { id: "OFC", ja: "オセアニア (OFC)", color: "var(--c-ofc)" },
];
const confColor = (id) => CONFS.find((c) => c.id === id).color;
const confJa = (id) => CONFS.find((c) => c.id === id).ja;

const state = { view: "ranking", conf: "all", sort: "overall" };

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const teamsSorted = () => {
  const t = [...DATA.teams];
  if (state.sort === "avgAge") t.sort((a, b) => a.avgAge - b.avgAge);
  else t.sort((a, b) => b[state.sort] - a[state.sort]);
  return t;
};
const dimmed = (t) => state.conf !== "all" && t.conf !== state.conf;

/* ---------- tooltip ---------- */
const tip = $("#tooltip");
function showTip(html, ev) {
  tip.innerHTML = html;
  tip.style.display = "block";
  moveTip(ev);
}
function moveTip(ev) {
  const pad = 14;
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
function hideTip() { tip.style.display = "none"; }

function teamTipHtml(t) {
  return `<div class="t-title"><span>${t.flag}</span>${esc(t.ja)}<span style="color:var(--ink-muted);font-weight:400">グループ${t.group}</span></div>
  <div class="t-rows">
    <div><span>総合スコア</span><b>${t.overall}</b></div>
    <div><span>ベストXI</span><b>${t.best11}</b></div>
    <div><span>控え層 (12人目以降)</span><b>${t.bench}</b></div>
    <div><span>平均年齢</span><b>${t.avgAge}歳</b></div>
    <div><span>合計キャップ数</span><b>${t.totalCaps.toLocaleString()}</b></div>
  </div>
  <div style="color:var(--ink-muted);margin-top:4px">クリックで26人の内訳を表示</div>`;
}

/* ---------- ranking ---------- */
function renderRanking() {
  const el = $("#view-ranking");
  const teams = teamsSorted();
  const max = 100;
  const sortLabel = { overall: "総合スコア", best11: "ベストXIスコア", bench: "控え層スコア", avgAge: "平均年齢" }[state.sort];
  const rows = teams.map((t, i) => {
    const v = t[state.sort];
    const w = state.sort === "avgAge" ? (v / 35) * 100 : (v / max) * 100;
    return `<div class="rank-row" tabindex="0" role="button" data-team="${esc(t.name)}" style="${dimmed(t) ? "opacity:.25" : ""}">
      <span class="rk">${i + 1}</span>
      <span class="nm"><span class="fl">${t.flag}</span>${esc(t.ja)}</span>
      <span class="bar-track"><span class="bar" style="width:${w}%;background:${confColor(t.conf)}"></span></span>
      <span class="val">${v}</span>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="card">
    <h2>個の総合力ランキング</h2>
    <p class="sub">${sortLabel}順。所属クラブ・リーグの強さ(0–100)から算出。行をクリックすると26人の内訳が見られます。</p>
    <div class="rank-head"><span></span><span>チーム</span><span></span><span style="text-align:right">${state.sort === "avgAge" ? "歳" : "点"}</span></div>
    ${rows}
    <div class="legend">${CONFS.map((c) => `<span><span class="swatch" style="background:${c.color}"></span>${c.ja}</span>`).join("")}</div>
  </div>`;
  el.querySelectorAll(".rank-row").forEach((row) => {
    const t = DATA.teams.find((x) => x.name === row.dataset.team);
    row.addEventListener("click", () => openTeam(t));
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTeam(t); } });
    row.addEventListener("mouseenter", (e) => showTip(teamTipHtml(t), e));
    row.addEventListener("mousemove", moveTip);
    row.addEventListener("mouseleave", hideTip);
  });
}

/* ---------- scatter ---------- */
function renderScatter() {
  const el = $("#view-scatter");
  const W = 920, H = 600, m = { top: 34, right: 30, bottom: 52, left: 58 };
  const xs = DATA.teams.map((t) => t.best11), ys = DATA.teams.map((t) => t.bench);
  const xmin = Math.floor(Math.min(...xs) / 5) * 5 - 2, xmax = Math.ceil(Math.max(...xs) / 5) * 5 + 1;
  const ymin = Math.floor(Math.min(...ys) / 5) * 5 - 2, ymax = Math.ceil(Math.max(...ys) / 5) * 5 + 2;
  const X = (v) => m.left + ((v - xmin) / (xmax - xmin)) * (W - m.left - m.right);
  const Y = (v) => H - m.bottom - ((v - ymin) / (ymax - ymin)) * (H - m.top - m.bottom);

  let grid = "", ticks = "";
  for (let v = Math.ceil(xmin / 10) * 10; v <= xmax; v += 10) {
    grid += `<line class="gridline" x1="${X(v)}" y1="${m.top}" x2="${X(v)}" y2="${H - m.bottom}"/>`;
    ticks += `<text class="tick" x="${X(v)}" y="${H - m.bottom + 18}" text-anchor="middle">${v}</text>`;
  }
  for (let v = Math.ceil(ymin / 10) * 10; v <= ymax; v += 10) {
    grid += `<line class="gridline" x1="${m.left}" y1="${Y(v)}" x2="${W - m.right}" y2="${Y(v)}"/>`;
    ticks += `<text class="tick" x="${m.left - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  const marks = DATA.teams.map((t) => `
    <g class="flagmark" data-team="${esc(t.name)}" tabindex="0" style="${dimmed(t) ? "opacity:.18" : ""}">
      <circle class="hit" cx="${X(t.best11)}" cy="${Y(t.bench)}" r="14"/>
      <text x="${X(t.best11)}" y="${Y(t.bench) + 6}" text-anchor="middle">${t.flag}</text>
    </g>`).join("");

  el.innerHTML = `<div class="card">
    <h2>ベストXIの質 × 控え層の厚さ</h2>
    <p class="sub">右にいるほど主力が強く、上にいるほど交代・ローテーション要員まで層が厚い。右上が「総合力の怪物」ゾーン。</p>
    <div class="scatter-box">
    <svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="ベストXIスコアと控え層スコアの散布図">
      ${grid}
      <line class="axis" x1="${m.left}" y1="${H - m.bottom}" x2="${W - m.right}" y2="${H - m.bottom}"/>
      <line class="axis" x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${H - m.bottom}"/>
      ${ticks}
      <text class="axis-label" x="${(m.left + W - m.right) / 2}" y="${H - 10}" text-anchor="middle">ベストXIスコア(主力の質)→</text>
      <text class="axis-label" transform="rotate(-90 16 ${(m.top + H - m.bottom) / 2}) " x="16" y="${(m.top + H - m.bottom) / 2}" text-anchor="middle">控え層スコア(層の厚さ)→</text>
      <text class="quad" x="${W - m.right - 6}" y="${m.top + 14}" text-anchor="end">質も層も◎ 優勝候補ゾーン</text>
      <text class="quad" x="${W - m.right - 6}" y="${H - m.bottom - 10}" text-anchor="end">主力頼み(ケガが怖い)</text>
      ${marks}
    </svg></div>
    <details class="data-table"><summary>データを表で見る</summary>
      <div class="table-scroll"><table class="squad-table"><thead><tr><th>チーム</th><th>ベストXI</th><th>控え層</th><th>総合</th></tr></thead>
      <tbody>${teamsSorted().map((t) => `<tr><td>${t.flag} ${esc(t.ja)}</td><td class="num">${t.best11}</td><td class="num">${t.bench}</td><td class="num">${t.overall}</td></tr>`).join("")}</tbody>
      </table></div>
    </details>
  </div>`;
  el.querySelectorAll(".flagmark").forEach((g) => {
    const t = DATA.teams.find((x) => x.name === g.dataset.team);
    g.addEventListener("click", () => openTeam(t));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter") openTeam(t); });
    g.addEventListener("mouseenter", (e) => showTip(teamTipHtml(t), e));
    g.addEventListener("mousemove", moveTip);
    g.addEventListener("mouseleave", hideTip);
  });
}

/* ---------- match results helpers ---------- */
const RES = typeof DATA !== "undefined" ? DATA.results : null;
const teamBy = (name) => DATA.teams.find((x) => x.name === name);
const SHORT_JA = { "ボスニア・ヘルツェゴビナ": "ボスニア", "コンゴ民主共和国": "コンゴ民主" };
const shortJa = (t) => SHORT_JA[t.ja] || t.ja;
// 90分+延長のスコア、同点ならPK戦(p1/p2)で勝者を決める
function koWinner(m) {
  if (m.s1 == null || m.s2 == null || !m.t1 || !m.t2) return null;
  if (m.s1 !== m.s2) return m.s1 > m.s2 ? m.t1 : m.t2;
  if (m.p1 != null && m.p2 != null && m.p1 !== m.p2) return m.p1 > m.p2 ? m.t1 : m.t2;
  return null;
}
function koLoser(m) {
  const w = koWinner(m);
  if (!w) return null;
  return w === m.t1 ? m.t2 : m.t1;
}
function attachTeamHandlers(root) {
  root.querySelectorAll("[data-team]").forEach((elm) => {
    const t = teamBy(elm.dataset.team);
    if (!t) return;
    elm.addEventListener("click", () => openTeam(t));
    elm.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTeam(t); } });
    elm.addEventListener("mouseenter", (e) => showTip(teamTipHtml(t), e));
    elm.addEventListener("mousemove", moveTip);
    elm.addEventListener("mouseleave", hideTip);
  });
}

/* ---------- groups ---------- */
function renderGroups() {
  const el = $("#view-groups");
  const groups = {};
  DATA.teams.forEach((t) => (groups[t.group] ||= []).push(t));
  const avg = (ts) => ts.reduce((s, t) => s + t.overall, 0) / ts.length;
  const deathGroup = Object.keys(groups).reduce((a, b) => (avg(groups[a]) > avg(groups[b]) ? a : b));

  const cards = Object.keys(groups).sort().map((g) => {
    const ts = groups[g];
    const power = [...ts].sort((a, b) => b.overall - a.overall);
    const gr = RES && RES.groups[g];
    let body;
    if (gr) {
      const rows = gr.standings.map((s, i) => {
        const t = teamBy(s.team);
        const powerPos = power.indexOf(t) + 1;
        const perf = i + 1 < powerPos ? `<span class="perf-up" title="個の力${powerPos}位より上の順位">▲</span>`
          : i + 1 > powerPos ? `<span class="perf-dn" title="個の力${powerPos}位より下の順位">▼</span>` : "";
        const gd = s.gf - s.ga;
        return `<tr class="${s.adv ? "adv" : "out"}" data-team="${esc(t.name)}" tabindex="0" role="button">
          <td>${i + 1}</td>
          <td class="tm"><span class="fl">${t.flag}</span> ${esc(shortJa(t))}</td>
          <td>${s.w}-${s.d}-${s.l}</td>
          <td>${gd > 0 ? "+" : ""}${gd}</td>
          <td class="pts">${s.pts}</td>
          <td>${t.overall}${perf}</td>
        </tr>`;
      }).join("");
      const ms = gr.matches.map((m) => {
        const a = teamBy(m.t1), b = teamBy(m.t2);
        return `<div class="gm-row">
          <span class="d">${esc(m.date)}</span>
          <span class="h">${esc(shortJa(a))} ${a.flag}</span>
          <span class="sc">${m.s1}–${m.s2}</span>
          <span>${b.flag} ${esc(shortJa(b))}</span>
        </div>`;
      }).join("");
      body = `<table class="gs-table">
        <thead><tr><th>#</th><th class="tm">チーム</th><th>勝分敗</th><th>得失</th><th>Pts</th><th>個の力</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <details class="gm"><summary>試合結果(6試合)</summary>${ms}</details>`;
    } else {
      body = ts.map((t) => `
      <div class="rank-row" tabindex="0" role="button" data-team="${esc(t.name)}" style="grid-template-columns:2em 1fr 4.5em 2.6em">
        <span class="rk" style="text-align:left">${t.flag}</span>
        <span class="nm" style="font-size:.88rem">${esc(t.ja)}</span>
        <span class="bar-track"><span class="bar" style="width:${t.overall}%;background:${confColor(t.conf)}"></span></span>
        <span class="val">${t.overall}</span>
      </div>`).join("");
    }
    return `<div class="group-card"><h3>グループ ${g}<small>力平均 ${avg(ts).toFixed(1)}点${g === deathGroup ? " ・ 💀 死の組" : ""}</small></h3>${body}</div>`;
  }).join("");

  el.innerHTML = `<div class="card" style="background:none;border:none;padding:0">
    <div class="groups-grid">${cards}</div>
    <div class="card" style="margin-top:14px"><p class="sub" style="margin:0">
      左端の緑ライン = 決勝トーナメント進出(各組上位2 + 成績上位の3位8チーム)。
      「個の力」列の ▲▼ は本アプリの戦力予想と実際の順位のギャップ(▲=予想超え)。行クリックでチーム詳細。
    </p></div>
  </div>`;
  attachTeamHandlers(el);
}

/* ---------- knockout bracket ---------- */
function renderBracket() {
  const el = $("#view-bracket");
  if (!RES) {
    el.innerHTML = `<div class="card"><h2>決勝トーナメント</h2><p class="sub">試合結果データがまだありません。</p></div>`;
    return;
  }
  const ko = RES.knockout;
  const rounds = [
    { id: "r32", label: "ラウンド32" },
    { id: "r16", label: "ラウンド16" },
    { id: "qf", label: "準々決勝" },
    { id: "sf", label: "準決勝" },
    { id: "final", label: "決勝" },
  ];
  // 前ラウンドの勝者を次ラウンドの空きスロットに流し込む
  const resolved = {};
  let prev = null;
  rounds.forEach((r) => {
    const ms = ko[r.id].map((m) => ({ ...m }));
    if (prev) ms.forEach((m, i) => {
      if (!m.t1) m.t1 = koWinner(prev[2 * i]);
      if (!m.t2) m.t2 = koWinner(prev[2 * i + 1]);
    });
    resolved[r.id] = ms;
    prev = ms;
  });
  const third = { ...ko.third[0] };
  if (!third.t1) third.t1 = koLoser(resolved.sf[0]);
  if (!third.t2) third.t2 = koLoser(resolved.sf[1]);

  const card = (m) => {
    const done = m.s1 != null && m.s2 != null;
    const w = koWinner(m);
    const wt = w && teamBy(w);
    const lt = w && teamBy(w === m.t1 ? m.t2 : m.t1);
    const upset = wt && lt && wt.overall < lt.overall - 2;
    const row = (name, s, p) => {
      const t = name && teamBy(name);
      const label = t ? `<span class="fl">${t.flag}</span><span class="nm">${esc(shortJa(t))}</span>` : `<span class="nm tbd">未定</span>`;
      const sc = done ? `${s}${p != null ? `<small> (${p})</small>` : ""}` : "";
      const cls = done ? (w === name ? "win" : "lose") : "";
      return `<div class="ko-team ${cls}" ${t ? `data-team="${esc(t.name)}" tabindex="0" role="button"` : ""}>
        ${label}${upset && w === name ? "<span title='番狂わせ'>💥</span>" : ""}<span class="sc">${sc}</span>
      </div>`;
    };
    const badge = esc(m.date || "") + (m.p1 != null ? " PK戦" : m.aet ? " 延長" : "");
    return `<div class="ko-match">
      <span class="ko-date">${badge}</span>
      ${row(m.t1, m.s1, m.p1)}
      ${row(m.t2, m.s2, m.p2)}
    </div>`;
  };

  let cells = rounds.map((r, c) =>
    `<div class="ko-head" style="grid-column:${c + 1};grid-row:1">${r.label}</div>`).join("");
  cells += `<div class="ko-head" style="grid-column:6;grid-row:1">優勝</div>`;
  rounds.forEach((r, c) => {
    const span = 2 ** (c + 1);
    resolved[r.id].forEach((m, i) => {
      cells += `<div class="ko-slot c${c}" style="grid-column:${c + 1};grid-row:${2 + i * span} / span ${span}">${card(m)}</div>`;
    });
  });
  const champName = koWinner(resolved.final[0]);
  const champ = champName && teamBy(champName);
  cells += `<div class="ko-slot champ" style="grid-column:6;grid-row:2 / span 32">
    <div class="ko-champ">${champ
      ? `<span class="cup">🏆</span><span style="font-size:1.3rem">${champ.flag}</span><br><b>${esc(champ.ja)}</b>`
      : `<span class="cup">🏆</span><span class="tbd" style="color:var(--ink-muted)">7/19 決定</span>`}</div>
  </div>`;

  el.innerHTML = `<div class="card">
    <h2>決勝トーナメント</h2>
    <p class="sub">太字が勝者。同点は延長→PK戦(カッコ内がPKスコア)。💥 = 番狂わせ(「個の力」で下位のチームが勝利)。チーム名クリックで26人の内訳。結果が出しだい更新します(${esc(RES.updated)}時点)。</p>
    <div class="bracket-scroll"><div class="bracket">${cells}</div></div>
    <div class="ko-third-box">
      <h3>3位決定戦 <small>マイアミ</small></h3>
      <div style="max-width:230px">${card(third)}</div>
    </div>
  </div>`;
  attachTeamHandlers(el);
}

/* ---------- leagues ---------- */
function renderLeagues() {
  const el = $("#view-leagues");
  const counts = {};
  DATA.teams.forEach((t) => t.players.forEach((p) => (counts[p.league] = (counts[p.league] || 0) + 1)));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 22);
  const maxN = top[0][1];
  const rows = top.map(([lid, n]) => {
    const lg = DATA.leagues[lid];
    return `<div class="lg-row">
      <span class="nm">${lg.flag} ${esc(lg.ja)}</span>
      <span class="bar-track"><span class="bar" style="width:${(n / maxN) * 100}%"></span></span>
      <span class="val">${n}</span>
    </div>`;
  }).join("");

  const strength = Object.entries(DATA.leagues)
    .filter(([lid]) => counts[lid] >= 8)
    .sort((a, b) => b[1].score - a[1].score);
  const rows2 = strength.map(([lid, lg]) => `<div class="lg-row">
      <span class="nm">${lg.flag} ${esc(lg.ja)}</span>
      <span class="bar-track"><span class="bar" style="width:${lg.score}%"></span></span>
      <span class="val">${lg.score}</span>
    </div>`).join("");

  el.innerHTML = `
  <div class="card">
    <h2>W杯選手の供給源リーグ</h2>
    <p class="sub">1,248人の選手がどのリーグでプレーしているか(所属選手数、上位22リーグ)。</p>
    ${rows}
  </div>
  <div class="card">
    <h2>リーグ強度スコア</h2>
    <p class="sub">本アプリで使う各リーグの基準値(そのリーグの標準的なクラブの強さ、0–100)。W杯選手8人以上のリーグのみ表示。</p>
    ${rows2}
  </div>`;
}

/* ---------- methodology ---------- */
function renderMethod() {
  $("#view-method").innerHTML = `<div class="card method">
    <h2>算出方法</h2>
    <p class="sub">「個の力」を所属クラブの水準で代理評価する、シンプルで透明なモデルです。</p>
    <h3>1. データ</h3>
    <p>Wikipedia「2026 FIFA World Cup squads」から、全48カ国の最終登録メンバー(各26人、計1,248人)の氏名・ポジション・年齢・代表キャップ数・所属クラブを取得しています。所属クラブは大会直前(2025-26シーズン)のものです。</p>
    <h3>2. 選手スコア</h3>
    <p>各選手のスコア(0–100)は所属クラブの強さです:</p>
    <p><code>選手スコア = クラブ個別レーティング(約230クラブを収録) or 所属リーグの基準値</code></p>
    <p>クラブ個別レーティングは欧州主要クラブ〜各国の強豪クラブについて、UEFA係数・Opta Power Rankings・移籍市場価値などの一般的なコンセンサスを参考に0–100で設定。個別レーティングのないクラブは、所属リーグの「標準的なクラブの強さ」(リーグ基準値)を使います。2部リーグ所属のクラブは2部の基準値になるよう補正済みです。</p>
    <h3>3. チーム集計</h3>
    <table>
      <tr><th>ベストXI</th><td>最高スコアのGK1人+フィールドプレーヤー上位10人の平均</td></tr>
      <tr><th>控え層</th><td>ベストXI以外の15人の平均</td></tr>
      <tr><th>総合スコア</th><td>ベストXI × 0.65 + 控え層 × 0.35</td></tr>
    </table>
    <h3>4. 注意点(このモデルが見えないもの)</h3>
    <p>・「強いクラブに居る=強い選手」という近似なので、ビッグクラブの控え選手は過大評価、昇格前の逸材や国内リーグのエースは過小評価されがちです。<br>
    ・戦術・監督・チームケミストリー・大会での勢いは一切考慮していません。<br>
    ・レーティングは筆者の設定した推定値で、公式なものではありません。エンタメとしてお楽しみください。</p>
  </div>`;
}

/* ---------- team modal ---------- */
function openTeam(t) {
  hideTip();
  const posOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
  const players = [...t.players].sort((a, b) => (posOrder[a.pos] - posOrder[b.pos]) || b.score - a.score);
  const rows = players.map((p) => {
    const lg = DATA.leagues[p.league];
    return `<tr>
      <td class="xi-mark">${p.xi ? "◎" : ""}</td>
      <td class="num">${p.no ?? ""}</td>
      <td><span class="pos-badge">${p.pos}</span></td>
      <td>${esc(p.name)}${p.captain ? " Ⓒ" : ""}</td>
      <td class="num">${p.age ?? "–"}</td>
      <td class="num">${p.caps}</td>
      <td>${p.clubFlag} ${esc(p.club)}</td>
      <td style="color:var(--ink-2);font-size:.78rem">${esc(lg.ja)}</td>
      <td><span class="p-bar-track"><span class="p-bar" style="width:${p.score}%;background:${confColor(t.conf)}"></span></span></td>
      <td class="num">${p.score}</td>
    </tr>`;
  }).join("");

  const lgCounts = {};
  t.players.forEach((p) => (lgCounts[p.league] = (lgCounts[p.league] || 0) + 1));
  const topLg = Object.entries(lgCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const lgRows = topLg.map(([lid, n]) => {
    const lg = DATA.leagues[lid];
    return `<div class="lg-row" style="grid-template-columns:14em 1fr 2.6em">
      <span class="nm" style="font-size:.82rem">${lg.flag} ${esc(lg.ja)}</span>
      <span class="bar-track" style="height:11px"><span class="bar" style="width:${(n / 26) * 100}%"></span></span>
      <span class="val">${n}人</span>
    </div>`;
  }).join("");

  $("#modalInner").innerHTML = `
    <div class="modal-head">
      <span class="bigflag">${t.flag}</span>
      <div>
        <h2>${esc(t.ja)} <span style="color:var(--ink-muted);font-size:.9rem;font-weight:400">${esc(t.name)}</span></h2>
        <div class="meta">グループ${t.group} ・ ${confJa(t.conf)} ・ 監督: ${esc(t.coach || "—")}</div>
      </div>
      <button class="modal-close" id="modalClose">✕ 閉じる</button>
    </div>
    <div class="stat-tiles">
      <div class="stat-tile"><div class="k">総合スコア(48カ国中 ${t.rank} 位)</div><div class="v">${t.overall}</div></div>
      <div class="stat-tile"><div class="k">ベストXI</div><div class="v">${t.best11}</div></div>
      <div class="stat-tile"><div class="k">控え層</div><div class="v">${t.bench}</div></div>
      <div class="stat-tile"><div class="k">平均年齢</div><div class="v">${t.avgAge}<small>歳</small></div></div>
    </div>
    <div class="mini-league"><h4>所属リーグの内訳(上位)</h4>${lgRows}</div>
    <div class="mini-league"><h4>登録メンバー26人(◎=推定ベストXI)</h4></div>
    <div class="table-scroll">
      <table class="squad-table">
        <thead><tr><th>XI</th><th>#</th><th>Pos</th><th>選手</th><th>年齢</th><th>Caps</th><th>クラブ</th><th>リーグ</th><th colspan="2">スコア</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  const dlg = $("#teamModal");
  dlg.showModal();
  $("#modalClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }, { once: true });
}

/* ---------- shell ---------- */
function render() {
  ["ranking", "scatter", "groups", "bracket", "leagues", "method"].forEach((v) =>
    $("#view-" + v).classList.toggle("hidden", state.view !== v));
  $("#filterRow").classList.toggle("hidden", !["ranking", "scatter"].includes(state.view));
  $("#sorter").parentElement.querySelectorAll(".label")[1].classList.toggle("hidden", state.view !== "ranking");
  $("#sorter").classList.toggle("hidden", state.view !== "ranking");
  if (state.view === "ranking") renderRanking();
  if (state.view === "scatter") renderScatter();
  if (state.view === "groups") renderGroups();
  if (state.view === "bracket") renderBracket();
  if (state.view === "leagues") renderLeagues();
  if (state.view === "method") renderMethod();
}

function initChips() {
  const box = $("#confChips");
  box.innerHTML = `<button class="chip active" data-conf="all">すべて</button>` +
    CONFS.map((c) => `<button class="chip" data-conf="${c.id}"><span class="swatch" style="background:${c.color}"></span>${c.ja.split(" ")[0]}</button>`).join("");
  box.querySelectorAll(".chip").forEach((ch) =>
    ch.addEventListener("click", () => {
      state.conf = ch.dataset.conf;
      box.querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x === ch));
      render();
    }));
}

$("#tabs").querySelectorAll("button").forEach((b) =>
  b.addEventListener("click", () => {
    state.view = b.dataset.view;
    $("#tabs").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    render();
  }));

$("#sorter").addEventListener("change", (e) => { state.sort = e.target.value; render(); });

$("#themeToggle").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
});
try {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.dataset.theme = saved;
} catch (e) { /* private mode */ }

initChips();
render();
