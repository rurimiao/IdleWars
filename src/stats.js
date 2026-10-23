
  // ---------- statistics screen: scores, tables and curves per nation (modelled on the old end-of-game score screen) ----------
  let statTab = 'score', statMetric = 'inc', curveInfo = null;
  const ST_IDX = Object.fromEntries(ST_FIELDS.map((k, i) => [k, i]));
  // the per-round rows added up for each nation, up to and including round `upto` (default: all)
  function statSum(p, upto) {
    const A = G.stats || [], out = new Array(ST_FIELDS.length).fill(0), last = upto == null ? A.length : Math.min(A.length, upto);
    for (let r = 0; r < last; r++) { const row = A[r] && A[r][p]; if (row) for (let k = 0; k < out.length; k++) out[k] += row[k] || 0; }
    return out;
  }
  // score: units = (what was built + the value of what was killed) / 10, cities = (cities taken + defense repaired + enemy defense shot away) / 10, resources = income / 50
  const statScore = s => { const u = (s[ST_IDX.buildC] + s[ST_IDX.killV]) / 10, c = (s[ST_IDX.capV] + s[ST_IDX.rep] + s[ST_IDX.razed]) / 10, r = s[ST_IDX.inc] / 50; return { u, c, r, t: u + c + r }; };
  const statSpend = s => s[ST_IDX.cityC] + s[ST_IDX.shipC] + s[ST_IDX.buildC];
  // the number a curve shows for one nation in one round
  const STAT_METRICS = [
    ['inc', 'mInc', s => s[0]], ['spend', 'mSpend', s => s[1] + s[2] + s[4]], ['net', 'mNet', s => s[0] - s[1] - s[2] - s[4]],
    ['cityC', 'mCityC', s => s[1]], ['shipC', 'mShipC', s => s[2]], ['buildC', 'mBuildC', s => s[4]], ['meals', 'mMeals', s => s[5]],
    ['built', 'mBuilt', s => s[7] + s[8]], ['lost', 'mLost', s => s[12] + s[13] + s[14]], ['kill', 'mKill', s => s[9] + s[10]], ['score', 'mScore', null],
  ];
  const fmt = v => Math.round(v).toLocaleString('en-US');
  const natCell = p => `<span class="sdot" style="background:${hue(p)}"></span>${pname(p)}${G.players[p].alive ? '' : ' ✝'}`;
  function buildStats() {
    const d = document.createElement('div'); d.className = 'stats';
    if (!G) return d;
    const P = G.players.map(x => x.id), tabs = [['score', 'stScore'], ['units', 'stUnits'], ['city', 'stCity'], ['res', 'stRes'], ['curve', 'stCurve']];
    const sums = P.map(p => statSum(p)), sc = sums.map(statScore);
    let h = `<div class="atabs">${tabs.map(([k, l]) => `<button data-st="${k}" aria-pressed="${statTab === k}">${tr(l)}</button>`).join('')}<span class="sround">${tr('stRound', G.round)}</span></div>`;
    const head = cols => `<tr class="hd"><th>${tr('stNation')}</th>${cols.map(c => `<th>${tr(c)}</th>`).join('')}</tr>`;
    const row = (p, cells) => `<tr><th>${natCell(p)}</th>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    if (statTab === 'score') {
      const order = [...P].sort((a, b) => sc[b].t - sc[a].t), max = Math.max(1, ...sc.map(x => x.t));
      h += `<table class="ut st"><tr class="hd"><th>#</th><th>${tr('stNation')}</th><th>${tr('stScUnits')}</th><th>${tr('stScCity')}</th><th>${tr('stScRes')}</th><th class="wide">${tr('stScTotal')}</th></tr>`
        + order.map((p, i) => `<tr><td>${i + 1}</td><th>${natCell(p)}</th><td>${fmt(sc[p].u)}</td><td>${fmt(sc[p].c)}</td><td>${fmt(sc[p].r)}</td><td class="bar"><i style="width:${Math.round(100 * sc[p].t / max)}%;background:${hue(p)}"></i><b>${fmt(sc[p].t)}</b></td></tr>`).join('') + `</table>`
        + `<p class="note">${tr('stScoreNote')}</p>`;
    } else if (statTab === 'units') {
      h += `<table class="ut st">${head(['stBuilt', 'stKilled', 'stLostB', 'stLostS', 'stKillV', 'stWipe', 'stRout', 'stWiped', 'stRouted'])}`
        + P.map(p => { const s = sums[p]; return row(p, [`${fmt(s[7])} / ${fmt(s[8])}`, `${fmt(s[9])} / ${fmt(s[10])}`, `${fmt(s[12])} / ${fmt(s[13])}`, fmt(s[14]), fmt(s[11]), fmt(s[20]), fmt(s[21]), fmt(s[22]), fmt(s[23])]); }).join('') + `</table><p class="note">${tr('stUnitsNote')}</p>`;
    } else if (statTab === 'city') {
      h += `<table class="ut st">${head(['stNow', 'stCaptured', 'stCityLost', 'stRazed', 'stRepaired'])}`
        + P.map(p => { const s = sums[p]; return row(p, [fmt(cities(p).length), fmt(s[15]), fmt(s[17]), fmt(s[18]), fmt(s[19])]); }).join('') + `</table>`;
    } else if (statTab === 'res') {
      h += `<table class="ut st">${head(['stIncome', 'stSpend', 'stCityC', 'stShipC', 'stShipL', 'stBuildC', 'stMeals', 'stRepairC'])}`
        + P.map(p => { const s = sums[p]; return row(p, [fmt(s[0]), fmt(statSpend(s)), fmt(s[1]), fmt(s[2]), fmt(s[3]), fmt(s[4]), fmt(s[5]), fmt(s[6])]); }).join('') + `</table><p class="note">${tr('stResNote')}</p>`;
    } else {
      h += `<div class="curvegrid"><nav class="mlist">${STAT_METRICS.map(([k, l]) => `<button data-sm="${k}" aria-current="${statMetric === k}">${tr(l)}</button>`).join('')}</nav>`
        + `<div><div class="curvewrap"><canvas id="stCv" height="300"></canvas><div class="curvetip" id="stTip" hidden></div></div><div class="legend">${P.map(p => `<span><i class="sdot" style="background:${hue(p)}"></i>${pname(p)}</span>`).join('')}</div></div></div>`;
    }
    d.innerHTML = h; return d;
  }
  // the curve, drawn after the tab is in the page (needs its width)
  function drawCurve() {
    const cv = $('stCv'); if (!cv || !G) return;
    const A = G.stats || [], n = A.length, P = G.players.map(x => x.id), def = STAT_METRICS.find(m => m[0] === statMetric);
    const W = Math.max(280, cv.parentElement.clientWidth), H = 300, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const series = P.map(p => { const out = []; let cum = new Array(ST_FIELDS.length).fill(0); for (let r = 0; r < n; r++) { const row = A[r] && A[r][p]; if (row) for (let k = 0; k < cum.length; k++) cum[k] += row[k] || 0; out.push(def[2] ? (row ? def[2](row) : 0) : statScore(cum).t); } return out; });
    let max = 1, min = 0; for (const s of series) for (const v of s) { if (v > max) max = v; if (v < min) min = v; }
    const L = 46, R = 10, T = 10, B = 24, w = W - L - R, h = H - T - B;
    const X = r => L + (n <= 1 ? w / 2 : w * r / (n - 1)), Y = v => T + h * (1 - (v - min) / (max - min || 1));
    const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--ink-2').trim() || '#667', line = css.getPropertyValue('--line').trim() || '#ccd';
    ctx.font = `11px ${MONO}`; ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) { const v = min + (max - min) * g / 4, y = Y(v); ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(fmt(v), L - 6, y); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const stepR = Math.max(1, Math.ceil(n / 8)); for (let r = 0; r < n; r += stepR) ctx.fillText(String(r + 1), X(r), H - B + 6);
    P.forEach((p, i) => {
      ctx.strokeStyle = hue(p); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
      series[i].forEach((v, r) => { if (r === 0) ctx.moveTo(X(r), Y(v)); else ctx.lineTo(X(r), Y(v)); }); ctx.stroke();
    });
    curveInfo = { series, P, n, L, w, W, H, X, T, B, name: tr(def[1]) };
  }
  function curveHover(e) {
    const c = curveInfo, cv = $('stCv'), tip = $('stTip'); if (!c || !cv || !tip) return;
    const rect = cv.getBoundingClientRect(), x = e.clientX - rect.left;
    if (c.n < 1 || x < c.L - 4 || x > c.L + c.w + 4) { tip.hidden = true; return; }
    const r = c.n <= 1 ? 0 : Math.max(0, Math.min(c.n - 1, Math.round((x - c.L) / c.w * (c.n - 1))));
    const rows = c.P.map((p, i) => [p, c.series[i][r]]).sort((a, b) => b[1] - a[1]);
    tip.innerHTML = `<b>${tr('stRound', r + 1)}</b> · ${c.name}` + rows.map(([p, v]) => `<div><i class="sdot" style="background:${hue(p)}"></i>${pname(p)} <b>${fmt(v)}</b></div>`).join('');
    tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = Math.min(c.X(r) + 12, rect.width - tw - 4) + 'px'; tip.style.top = '6px';
  }
