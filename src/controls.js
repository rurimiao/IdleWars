
  // ---------- guides ----------
  // small drawings of what the map draws, in the map's own style (a dark outline under a bright line); `kind` picks the drawing
  const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 3 * k + Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  function artSvg(kind) {
    const under = 'rgba(10,16,22,0.6)', c0 = DEMO_COLOR, chev = (x, y, d) => d > 0 ? `M${x - 5},${y - 5} L${x + 1},${y} L${x - 5},${y + 5}` : '';
    const line = (d, col, w, extra = '') => `<path d="${d}" fill="none" stroke="${under}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
    const chevs = (xs, col, op = 1) => xs.map(x => `<path d="${chev(x, 35, 1)}" fill="none" stroke="${under}" stroke-width="4.2" stroke-linejoin="round"/>`).join('') + xs.map(x => `<path d="${chev(x, 35, 1)}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="2.2" stroke-linejoin="round"/>`).join('');
    const hexRing = (r, col, w, extra) => `<polygon points="${hexPts(60, 35, r)}" fill="none" stroke="${under}" stroke-width="${w + 3}" stroke-linejoin="round" stroke-linecap="round" ${extra}/><polygon points="${hexPts(60, 35, r)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
    // an arrow head with its tip at (x, y), pointing along angle `a` (radians)
    const head = (x, y, a, col) => { const k = 13, p = [[x, y], [x - k * Math.cos(a - 0.45), y - k * Math.sin(a - 0.45)], [x - k * Math.cos(a + 0.45), y - k * Math.sin(a + 0.45)]].map(q => q.map(v => v.toFixed(1)).join(',')).join(' '); return `<polygon points="${p}" fill="${col}" stroke="rgba(10,16,22,.85)" stroke-width="2.4" stroke-linejoin="round"/>`; };
    const hexRingAt = (cx, cy, r, col) => `<polygon points="${hexPts(cx, cy, r)}" fill="none" stroke="rgba(10,16,22,.8)" stroke-width="6"/><polygon points="${hexPts(cx, cy, r)}" fill="none" stroke="${col}" stroke-width="3"/>`;
    // a marker pin (circle + pointer) with a hammer or the character 兵 in it, as the map draws above a city
    const pin = (col, ch) => `<g transform="translate(60,17)"><rect x="-21" y="-15" width="42" height="24" rx="8" fill="${col}" stroke="rgba(10,16,22,.85)" stroke-width="3.2"/><polygon points="-7.5,7 0,21 7.5,7" fill="${col}" stroke="rgba(10,16,22,.85)" stroke-width="3.2" stroke-linejoin="round"/><rect x="-19.5" y="-13.5" width="39" height="21" rx="7" fill="${col}"/><polygon points="-6.5,6 0,19 6.5,6" fill="${col}"/><text x="0" y="2" text-anchor="middle" font-size="14" font-weight="800" fill="#3a2b00">${ch}</text></g>`;
    // a flowing outline: the outer one turns clockwise (the points go clockwise), the inner one counter-clockwise (the points are reversed); the dashes really move
    const flowRing = (r, col, inner, dash, period) => { const pts = hexPts(60, 35, r).split(' '); const p = (inner ? pts.reverse() : pts).join(' '); const anim = `<animate attributeName="stroke-dashoffset" from="0" to="-${period}" dur="0.9s" repeatCount="indefinite"/>`; return `<polygon points="${p}" fill="none" stroke="${under}" stroke-width="6" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round">${anim}</polygon><polygon points="${p}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round">${anim}</polygon>`; };
    const dot = `<circle cx="60" cy="35" r="3.4" fill="${c0}" stroke="rgba(10,16,22,.8)"/>`;
    const art = {
      none: `<polygon points="${hexPts(60, 35, 27)}" fill="${ZONE_NONE}" stroke="rgba(14,30,22,.6)" stroke-width="1.6"/>`,
      fight: `<polygon points="${hexPts(60, 35, 27)}" fill="${ZONE_FIGHT}" stroke="rgba(14,30,22,.6)" stroke-width="1.6"/>`,
      hot: chevs([28, 56, 84], '#ff9f2e'),
      cut: line('M46,21 L74,49 M74,21 L46,49', '#ff3b30', 3.4),
      march: line('M14,50 L50,20 L88,46 L93.5,42.2', 'rgba(125,255,176,.95)', 2.6, 'stroke-dasharray="6 5"') + head(100, 38, -0.59, 'rgba(125,255,176,.95)'),
      focus: `<polygon points="${hexPts(60, 35, 27)}" fill="none" stroke="#ffd23f" stroke-width="3" stroke-dasharray="5 4"/>`,
      sel: `<polygon points="${hexPts(60, 35, 27)}" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="3.2"/>`,
      reach: [[0, 0], ...Array.from({ length: 6 }, (_, k) => [19.05 * Math.cos(Math.PI / 3 * k), 19.05 * Math.sin(Math.PI / 3 * k)])].map(([dx, dy], i) => i ? `<polygon points="${hexPts(60 + dx, 35 + dy, 11)}" fill="#fff" fill-opacity=".3" stroke="rgba(10,16,22,.35)" stroke-width="1"><animate attributeName="fill-opacity" values=".12;.55;.12" dur="1.3s" repeatCount="indefinite"/></polygon>` : `<polygon points="${hexPts(60, 35, 11)}" fill="none" stroke="rgba(10,16,22,.45)" stroke-width="1.2"/>`).join('') + dot,
      range: flowRing(30, 'rgba(255,90,70,.95)', false, '7 6', 13) + flowRing(11, 'rgba(255,90,70,.95)', true, '7 6', 13) + dot,
      foe: `<polygon points="${hexPts(60, 35, 22)}" fill="${ZONE_NONE}" stroke="rgba(255,90,70,.95)" stroke-width="2.6"/><circle cx="60" cy="35" r="4" fill="#555"/>`,
      atk: line('M16,52 L98,22', 'rgba(255,90,70,.95)', 2.6, 'stroke-dasharray="4 4"') + head(106, 19, -0.35, 'rgba(255,90,70,.95)'),
      flow: chevs([22, 46, 70, 94], c0),
      cMarch: hexRingAt(26, 52, 11, c0) + line('M30,52 L92,26', 'rgba(125,255,176,.95)', 3, 'stroke-dasharray="8 6"') + head(104, 21, -0.4, 'rgba(125,255,176,.95)'),
      cAtk: hexRingAt(26, 52, 11, c0) + line('M30,52 L92,26', 'rgba(255,90,70,.95)', 3, 'stroke-dasharray="8 6"') + head(104, 21, -0.4, 'rgba(255,90,70,.95)'),
      cRep: `<polygon points="${hexPts(60, 50, 16)}" fill="none" stroke="${c0}" stroke-width="3"/>` + pin('#ffd23f', '修城'),
      cBuild: `<polygon points="${hexPts(60, 50, 16)}" fill="none" stroke="${c0}" stroke-width="3"/>` + pin('#ffd23f', '造兵'),
    };
    return `<svg viewBox="0 0 120 70" width="120" height="70"><rect width="120" height="70" rx="8" fill="${kind === 'sel' || kind === 'focus' || kind === 'reach' ? '#7a9a80' : '#e6ece3'}"/>${art[kind]}</svg>`;
  }
  const artCards = items => `<div class="spg">${items.map(([k, a, b]) => `<div class="spc">${artSvg(k)}<div><b>${tr(a)}</b>${b ? `<span>${tr(b)}</span>` : ''}</div></div>`).join('')}</div>`;
  function buildLineDemos() {
    const w = document.createElement('div'); w.className = 'spw lnw';
    const grp = (t, items, note) => `<h4>${tr(t)}</h4>` + (note ? `<p class="note">${tr(note)}</p>` : '') + artCards(items);
    w.innerHTML = grp('lnG1', [['reach', 'lnReach', 'lnReachNote'], ['range', 'lnRange', 'lnRangeNote'], ['foe', 'lnFoe', 'lnFoeNote']])
      + grp('lnG2', [['cMarch', 'lnCMarch', 'lnCMarchNote'], ['cAtk', 'lnCAtk', 'lnCAtkNote'], ['cRep', 'lnCRep', 'lnCRepNote'], ['cBuild', 'lnCBuild', 'lnCBuildNote']], 'lnG2n')
      + grp('lnG4', [['flow', 'lnSupply', ''], ['hot', 'lnSupHot', '']], 'lnG4n')
      + grp('lnG5', [['sel', 'lnSel', 'lnSelNote'], ['focus', 'lnFocus', 'lnFocusNote']], 'lnG5n');
    return w;
  }
  // the "map colors" page: the nation colors, the fainter zone tints made from them, the fixed zone colors, and the colors that carry a meaning on the map
  function buildColorsPage() {
    const w = document.createElement('div'); w.className = 'ncw';
    const sw = (c, i) => `<div class="ncs"><i style="background:${c}"></i>${i == null ? '' : `<b>${i + 1}</b>`}</div>`;
    const idx = [...Array(NATION_COLORS.length).keys()], row = f => `<div class="ncg">${idx.map(i => sw(f(NATION_COLORS[i]), i)).join('')}</div>`;
    const one = (c, name, note) => `<div class="g"><div class="sw" style="background:${c}"></div><div><div class="nm">${tr(name)}</div><div class="ds">${tr(note)}</div></div></div>`;
    w.innerHTML = `<p class="note">${tr('guideNote')}</p>`
      + `<h4>${tr('ncHue')}</h4><p class="note">${tr('ncNote')}</p>${row(c => c)}`
      + `<h4>${tr('ncHeld')}</h4><p class="note">${tr('gHeldNote')}</p>${row(c => blendHex('#f3f4f1', c, TINT_HELD))}`
      + `<div class="guide" style="margin-top:14px">${one(ZONE_NONE, 'gNone', 'gNoneNote')}${one(ZONE_FIGHT, 'gFight', 'gFightNote')}</div>`;
    return w;
  }
  const HG = { open: new Set(), init: false };       // which help groups are unfolded
  let howSel = 0, modalTab = null;         // modalTab: 'help' | 'log' | 'menu' | 'nations'; howSel: 0..n-1 rule sections, then 'units', 'colors'
  function howSections() {
    const out = [];
    for (const s of tr('howList')) { if (s.startsWith('#')) out.push({ h: s.slice(1), items: [] }); else (out[out.length - 1] || out[out.push({ h: '', items: [] }) - 1]).items.push(s); }
    return out;
  }
  // a list of help lines: a line starting with ">" is an indented sub-point of the line before it
  function fillList(ul, arr) {
    ul.innerHTML = ''; let last = null, sub = null;
    for (const s of arr) {
      if (s.startsWith('>') && last) { if (!sub) { sub = document.createElement('ul'); last.appendChild(sub); } const li = document.createElement('li'); li.innerHTML = s.slice(1); sub.appendChild(li); }
      else { last = document.createElement('li'); sub = null; last.innerHTML = s.startsWith('>') ? s.slice(1) : s; ul.appendChild(last); }
    }
  }
  function buildHow(i) {
    const ul = $('how'), secs = howSections();
    fillList(ul, secs[Math.min(i, secs.length - 1)].items);
  }
  // the "cell symbols" page: small pictures drawn with the same code as the map, in groups (legion state, supplies, ground and cities) and then a few of them piled up
  function drawCell(o, col) {
    const cell = document.createElement('figure'), cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1), W0 = 150, H0 = 92;
    cv.width = W0 * dpr; cv.height = H0 * dpr; cv.style.width = W0 + 'px'; cv.style.height = H0 + 'px';
    const ctx = cv.getContext('2d'); ctx.scale(dpr * 1.45, dpr * 1.45); const x = W0 / 2 / 1.45, y = H0 / 2 / 1.45 + (o.cut ? 9 : 0);       // the red cross floats high above the cell: leave room for it
    const hp = new Path2D(); hexPath(hp, x, y); ctx.fillStyle = blendHex('#f3f4f1', col, TINT_HELD); ctx.fill(hp); ctx.strokeStyle = 'rgba(14,30,22,0.6)'; ctx.lineWidth = 1.2; ctx.stroke(hp);
    if (o.def > 0) cityMark(ctx, x, y, o.def, o.def >= CITY_MIN ? mix(col, 0.25) : '#cfd5da', true);
    if (o.type != null) legionMark(ctx, x, y, { color: col, type: o.type, n: o.n, fs: 14, badge: o.badge || null });
    if (o.cut) { ctx.lineCap = 'round'; const cx = x, cy = y - 31, X = () => { ctx.beginPath(); ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke(); }; ctx.strokeStyle = 'rgba(10,16,22,0.7)'; ctx.lineWidth = 5; X(); ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.6; X(); }
    cell.appendChild(cv); return cell;
  }
  const DEMO_COLOR = '#3cb44b';       // the example nation in the help pictures: a calm green
  function buildSymbolsPage() {
    const w = document.createElement('div'), col = DEMO_COLOR;
    const inf = { type: 0, n: 20, st: 'alert' }, art = { type: 1, n: 10, st: 'alert' };
    const groups = [
      ['sgG1', 'sgG1n', [['sgInf', { def: 0, ...inf }], ['sgArt', { def: 0, ...art }]]],
      ['sgG2', 'sgG2n', [['sgSup', { def: 0, ...inf, badge: { k: 'sup', t: '120' } }], ['sgLow', { def: 0, ...inf, badge: { k: 'sup', t: '35', low: true } }], ['sgStarve', { def: 0, ...inf, badge: { k: 'starve', t: '−2' } }], ['sgCut', { def: 0, ...inf, cut: true }], ['sgBld', { def: 120, ...inf, badge: { k: 'bld' } }]]],
      ['sgG3', 'sgG3n', [['sgPlain', { def: 0 }], ['sgSite', { def: 60 }], ['sgCity', { def: 200 }], ['sgCityFull', { def: CITY_MAX }]]],
      ['sgG4', 'sgG4n', [['sgCmb1', { def: 120, ...inf, badge: { k: 'bld' } }], ['sgCmb2', { def: 600, ...art, badge: { k: 'sup', t: '35', low: true } }], ['sgCmb3', { def: 0, ...inf, badge: { k: 'sup', t: '80' } }], ['sgCmb4', { def: 340, ...inf, badge: { k: 'starve', t: '−2' } }], ['sgCmb5', { def: 0, ...art, badge: { k: 'starve', t: '−1' } }]]],
    ];
    for (const [h, n, items] of groups) {
      const hd = document.createElement('h4'); hd.className = 'sgh'; hd.textContent = tr(h);
      const nt = document.createElement('p'); nt.className = 'note'; nt.innerHTML = tr(n);
      const wrap = document.createElement('div'); wrap.className = 'lgrid';
      for (const [key, o] of items) { const cell = drawCell(o, col), cap = document.createElement('figcaption'); cap.innerHTML = tr(key); cell.appendChild(cap); wrap.appendChild(cell); }
      w.append(hd, nt, wrap);
    }
    return w;
  }
  // ---------- dialogs: help (rules, legion types, map colors), battle log, menu, nations ----------
  // what the current numbers mean in a fight: a full legion's volley, what it costs, and how long a marching legion stays under the guns
  let anaTab = 'flee';
  function buildAnalysis() {
    const d = document.createElement('div'); d.className = 'ana';
    const hit = [S.hitInf, S.hitArt], r1 = x => Math.round(x * 10) / 10;
    const exp = TYPES.map((t, i) => t.cap * hit[i] / 100 * t.dmg);
    const row = (lab, f) => `<tr><th>${lab}</th>${TYPES.map((t, i) => `<td class="${i ? 'ca' : 'ci'}">${f(t, i)}</td>`).join('')}</tr>`;
    const heat = n => `hv${Math.min(4, n)}`;
    let h = `<table class="ut"><tr class="hd"><th></th>${TYPES.map((t, i) => `<th>${tr('ty_' + t.k)}</th>`).join('')}</tr>`
      + row(tr('anaMen'), t => t.cap)
      + row(tr('anaExp'), (t, i) => `<b>${r1(exp[i])}</b> ${tr('anaAbout')}`)
      + row(tr('anaCost'), t => t.cap * t.cost) + row(tr('anaEat'), t => t.cap * t.eat) + `</table>`;
    // movement on an open line (no walls, nothing in the way); a legion that marches cannot fire and covers nothing
    const nm = i => tr('ty_' + TYPES[i].k), gap = S.anaGap || 6, maxR = Math.max(...TYPES.map(t => t.rmax + t.cb));
    const tabs = [['flee', 'anaTabFlee'], ['rush', 'anaTabRush'], ['chase', 'anaTabChase']];
    h += `<div class="atabs">${tabs.map(([k, l]) => `<button data-at="${k}" aria-pressed="${anaTab === k}">${tr(l)}</button>`).join('')}</div>`;
    if (anaTab === 'flee') {
      let ex = `<tr class="hd"><th colspan="2"></th><th colspan="${maxR}">${tr('anaDistFlee')}</th></tr><tr class="hd"><th>${tr('anaFlee')}</th><th>${tr('anaStill')}</th>${Array.from({ length: maxR }, (_, k) => `<th>${k + 1}</th>`).join('')}</tr>`;
      for (let f = 0; f < 2; f++) for (let s = 0; s < 2; s++) for (const city of [0, 1]) {
        const T = TYPES[s], R = T.rmax + (city ? T.cb : 0), v = TYPES[f].budget;
        ex += `<tr class="${f ? 'ga' : 'gi'}"><th>${nm(f)}</th><td>${city ? '【' + nm(s) + '】' : nm(s)}</td>${Array.from({ length: maxR }, (_, k) => { const dd = k + 1, ok = dd >= T.rmin && dd <= R, n = ok ? Math.floor((R - dd) / v) + 1 : 0; return `<td class="${heat(n)}">${ok ? `<b>${n}</b>` : '·'}</td>`; }).join('')}</tr>`;
      }
      h += `<p class="note" style="margin:0">${tr('anaEscape')}</p><table class="ut ex">${ex}</table>`;
    } else if (anaTab === 'rush') {
      const cols = [3, 4, 5, 6, 7, 8];
      // the target stands on alert and fires at every round end; the attacker walks straight in, stops at its own range (or where enemy infantry range halts it),
      // becomes alert the round after it arrives, and fires at the end of that round
      const sim = (c, t, city, d0) => {
        const Ta = TYPES[c], Tt = TYPES[t], Ra = Ta.rmax, Rt = Tt.rmax + (city ? Tt.cb : 0);
        let dist = d0, vol = 0, arrived = -1;
        for (let r = 1; r <= 12; r++) {
          if (arrived < 0) {
            for (let k = 0; k < Ta.budget && dist > Ra; k++) { dist--; if (t === 0 && dist <= Rt) break; }
            if (dist <= Ra) arrived = r;
          }
          if (dist >= Tt.rmin && dist <= Rt) vol++;
          if (arrived >= 0 && r > arrived) return [r, vol];
        }
        return null;
      };
      let ex = `<tr class="hd"><th colspan="2"></th><th colspan="${cols.length}">${tr('anaDistRush')}</th></tr><tr class="hd"><th>${tr('anaAtk')}</th><th>${tr('anaStill')}</th>${cols.map(x => `<th>${x}</th>`).join('')}</tr>`;
      for (let c = 0; c < 2; c++) for (let t = 0; t < 2; t++) for (const city of [0, 1]) {
        ex += `<tr class="${c ? 'ga' : 'gi'}"><th>${nm(c)}</th><td>${city ? '【' + nm(t) + '】' : nm(t)}</td>${cols.map(x => { const r = sim(c, t, city, x); return `<td class="${heat(r ? r[1] : 0)}">${r ? `<b>${r[0]}</b>·${r[1]}` : '·'}</td>`; }).join('')}</tr>`;
      }
      h += `<p class="note" style="margin:0">${tr('anaRush')}</p><table class="ut ex">${ex}</table>`;
    } else {
      let pu = `<tr class="hd"><th>${tr('anaChase')}</th><th>${tr('anaTarget')}</th><th>${tr('anaClose')}</th><th>${tr('anaRounds')}</th></tr>`;
      for (let c = 0; c < 2; c++) for (let f = 0; f < 2; f++) {
        const vc = TYPES[c].budget, vf = TYPES[f].budget, R = TYPES[c].rmax, cl = vc - vf;
        const need = gap <= R ? 0 : cl > 0 ? Math.ceil((gap - R) / cl) : -1;
        pu += `<tr class="${c ? 'ga' : 'gi'}"><th>${nm(c)}</th><td>${nm(f)}</td><td>${cl > 0 ? '+' + cl : cl}</td><td><b>${need < 0 ? tr('anaNever') : need === 0 ? tr('anaNow') : tr('anaIn', need, need + 1)}</b></td></tr>`;
      }
      h += `<p class="note" style="margin:0">${tr('anaPursuit')} <input type="number" data-pg="1" value="${gap}" min="2" max="20" style="width:56px"></p><table class="ut ex">${pu}</table>`;
    }
    h += `<ul class="how">${tr('anaNotes').map(s => `<li>${s}</li>`).join('')}</ul>`;
    d.innerHTML = h; return d;
  }
  let rulesTab = 'units';
  $('aiList').addEventListener('click', e => { const b = e.target.closest('button[data-intent]'); if (!b || !G) return; ITS.p = +b.dataset.intent; ITS.target = null; autoPause(); openModal('intent'); });
  $('mbody').addEventListener('click', e => { const b = e.target.closest('button[data-rt]'); if (b) { rulesTab = b.dataset.rt; renderModal(); } });
  const PK = [['cpBase', 'cpBaseL', 'cpBaseTip', 0, 99, 1], ['cpDiv', 'cpDivL', 'cpDivTip', 10, 5000, 10], ['buildCost', 'bcL', 'bcTip', 1, 100, 1], ['supCap', 'scL', 'scTip', 0, 20, 0.5], ['upkeep', 'upL', 'upTip', 0, 100, 1], ['cityStart', 'csL', 'csTip', 50, 5000, 50], ['cityMin', 'cmnL', 'cmnTip', 50, 5000, 50], ['cityMax', 'cmL', 'cmTip', 200, 5000, 100], ['tax', 'taxL', 'taxTip', 0, 200, 5], ['capBonus', 'capL', 'capTip', 0, 10000, 50], ['plunder', 'plunderL', 'plunderTip', 0, 100, 5], ['breakBonus', 'brkL', 'brkTip', 0, 10000, 50], ['buildBonus', 'bldL', 'bldTip', 0, 10000, 50]];       // rewards for cities, see the params page
  const DLG_TITLE = { help: 'helpTitle', menu: 'tabMenu', nations: 'tabNations', sound: 'sndTest', rules: 'rulesTitle', naming: 'namingTitle',  intent: 'intentTitle', stats: 'statsTitle' };
  function openModal(kind) { modalTab = kind || modalTab || 'help'; $('modal').hidden = false; renderModal(); }
  let cpReturn = false;       // the statistics were opened from the check-in window: it comes back when they are closed
  function closeModal() { stashBack(); $('modal').hidden = true; if (cpReturn) { cpReturn = false; if (G && G.pause && !G.over) $('cpModal').hidden = false; } }
  function stashBack() { const st = $('stash'); for (const n of [...document.querySelectorAll('#mbody [data-keep]')]) st.appendChild(n); $('mbody').innerHTML = ''; }
  // ---------- the "ideas" window: every nation's ideas on the left, the picked nation's ideas and a form to plant a new one on the right ----------
  const ITS = { p: null, kind: 'city', target: null, q: '', open: new Set(), fold: new Set() };
  const IT_ICON = { city: '🏰', zone: '⚔', nation: '🔥' };
  function buildIntent() {
    const ai = G.players.filter(x => !x.human && x.alive);
    if (!ai.length) { const d = document.createElement('div'); d.className = 'note'; d.textContent = tr('itNoAi'); return d; }
    if (ITS.p == null || !ai.some(x => x.id === ITS.p)) ITS.p = ai[0].id;
    const w = document.createElement('div'); w.className = 'itw';
    const cnt = p => { const I = G.intent[p] || []; return [I.filter(x => x.by === 'you').length, I.filter(x => x.by !== 'you').length]; };
    const left = () => `<aside class="itl"><h5>${tr('itAll')}</h5>` + ai.map(x => { const [y, m] = cnt(x.id); return `<button class="itn" data-itn="${x.id}" aria-current="${x.id === ITS.p}"><i style="background:${hue(x.id)}"></i><span>${esc(pname(x.id))}</span><em>${y ? `<b class="you">${tr('itYouN', y)}</b>` : ''}<b>${tr('itOwnN', m)}</b></em></button>`; }).join('') + `</aside>`;
    const itemHTML = it => {
      const rem = Math.max(0, it.until - G.round), open = ITS.open.has(it.id);
      return `<div class="iti" data-iti="${it.id}"><button class="ith" data-itt="${it.id}" aria-expanded="${open}"><span class="ico">${IT_ICON[it.k]}</span><span class="tx">${esc(intentText(it))}</span><b class="${it.by === 'you' ? 'you' : ''}">${tr(it.by === 'you' ? 'itByYou' : 'itByAi')}</b><em>${tr('itRemain', rem)}</em></button>`
        + (open ? `<div class="itd"><div class="itm">${tr('itStr', Math.round(it.str))} · ${tr('itSince', it.r0)}</div><ol class="itlog">${it.hist.map(([r, t]) => `<li><span>${tr('ecoR', r)}</span>${esc(t)}</li>`).join('')}</ol><button class="btn alt sm" data-itx="${it.id}">${tr('itDrop')}</button></div>` : '') + `</div>`;
    };
    const targets = () => {
      const p = ITS.p, q = ITS.q.trim(), fv = fogVis(), H = (G.hate && G.hate[p]) || [];
      if (ITS.kind === 'city') {
        const by = new Map(); for (const c of G.land) if (G.def[c] >= CITY_MIN && G.co[c] >= 0 && G.co[c] !== p) { const n = `${cityName(c)}${zoneName(G.zone[c])}`; if (q && !n.includes(q)) continue; (by.get(G.co[c]) || by.set(G.co[c], []).get(G.co[c])).push(c); }
        return [...by].sort((a, b) => (H[b[0]] || 0) - (H[a[0]] || 0)).map(([o, cs]) => `<div class="itg"><h6><i style="background:${hue(o)}"></i>${esc(pname(o))}<small>${tr('itHateN', Math.round(H[o] || 0))}</small></h6>` + cs.sort((a, b) => G.def[b] - G.def[a]).map(c => `<button class="itr1" data-itv="${c}" aria-pressed="${ITS.target === c}"><span>${esc(cityName(c))}</span><small>${esc(zoneName(G.zone[c]))}</small><em>${tr('defShort')} ${String(G.def[c]).padStart(4, ' ')} · ${fv && !fv[c] ? '??' : String(G.lg[c] ? G.lg[c].n : 0).padStart(2, '0')}${tr('menUnit')}</em></button>`).join('') + `</div>`).join('') || `<p class="note">${tr('itNone')}</p>`;
      }
      if (ITS.kind === 'zone') {
        const cnt = new Map(); for (const L of G.L) if (!L.dead && L.owner !== p && G.zone[L.cell] >= 0 && (!fv || fv[L.cell])) { const m = cnt.get(G.zone[L.cell]) || new Map(); m.set(L.owner, (m.get(L.owner) || 0) + L.n); cnt.set(G.zone[L.cell], m); }
        const sh = zoneShares(), rows = [];
        G.Z.forEach((z, zi) => {
          if (!z.cells.length || (q && !zoneName(zi).includes(q))) return;
          const m = sh[zi], men = cnt.get(zi), n = men ? [...men.values()].reduce((a, b) => a + b, 0) : 0;
          const fight = !!(m && m.size > 1), others = (m && [...m.keys()].some(o => o !== p)) || (z.holder >= 0 && z.holder !== p) || n > 0;
          rows.push({ z: zi, men, n, grp: fight ? 'f' : others ? 'e' : 'n' });
        });
        const grp = (g, title) => { const list = rows.filter(r => r.grp === g).sort((a, b) => b.n - a.n); if (!list.length) return ''; const shut = ITS.fold.has(g);
          return `<div class="itg"><button class="itfold" data-itf="${g}" aria-expanded="${!shut}"><span>${shut ? '▸' : '▾'}</span>${tr(title)}<small>${list.length}</small></button>` + (shut ? '' : list.map(r => `<button class="itr1" data-itv="${r.z}" aria-pressed="${ITS.target === r.z}"><span>${esc(zoneName(r.z))}</span><small>${r.men ? [...r.men].map(([o, k]) => `<i class="dot" style="background:${hue(o)}"></i>${k}`).join(' ') : ''}</small><em>${r.n ? tr('itEnemyMen', r.n) : tr('itNoOne')}</em></button>`).join('')) + `</div>`; };
        return (grp('f', 'itGrpFight') + grp('e', 'itGrpEnemy') + grp('n', 'itGrpNone')) || `<p class="note">${tr('itNone')}</p>`;
      }
      const mx = Math.max(100, ...G.players.map(x => H[x.id] || 0));
      return G.players.filter(x => x.id !== p && x.alive && (!q || nameOf(x.id).includes(q))).sort((a, b) => (H[b.id] || 0) - (H[a.id] || 0)).map(x => `<button class="itr1 nat" data-itv="${x.id}" aria-pressed="${ITS.target === x.id}"><i class="dot" style="background:${hue(x.id)}"></i><span>${esc(pname(x.id))}</span><span class="hbar"><i style="width:${Math.round(100 * (H[x.id] || 0) / mx)}%"></i></span><em>${tr('itHateN', Math.round(H[x.id] || 0))}</em></button>`).join('') || `<p class="note">${tr('itNone')}</p>`;
    };
    const right = () => {
      const p = ITS.p, I = (G.intent[p] || []).slice().sort((a, b) => b.str - a.str), done = (G.ihist || []).filter(x => x.p === p).slice(0, 6);
      const kinds = [['city', 'itKindCity', 'itKindCityD'], ['zone', 'itKindZone', 'itKindZoneD'], ['nation', 'itKindNation', 'itKindNationD']];
      return `<section class="itr"><div class="ithd"><i style="background:${hue(p)}"></i><b>${esc(pname(p))}</b><small>${tr('itNow', I.length)}</small></div>`
        + `<h5>${tr('itCurrent')}</h5>` + (I.length ? I.map(itemHTML).join('') : `<p class="note">${tr('itEmpty')}</p>`)
        + (done.length ? `<details class="itdone"><summary>${tr('itHistory', done.length)}</summary>${done.map(x => `<div class="itd2"><span class="ico">${IT_ICON[x.it.k]}</span>${esc(intentText(x.it))}<em>${tr('ecoR', x.r)} · ${esc(tr(x.why, '').replace(/[：:]\s*$/, ''))}</em></div>`).join('')}</details>` : '')
        + `<h5>${tr('itPlant')}</h5><div class="itk">${kinds.map(([k, t, d]) => `<button data-itk="${k}" aria-pressed="${ITS.kind === k}"><span class="ico">${IT_ICON[k]}</span><b>${tr(t)}</b><small>${tr(d)}</small></button>`).join('')}</div>`
        + `<div class="itsrch"><input type="search" id="itQ" placeholder="${tr('fSearch')}" value="${esc(ITS.q)}"></div><div class="ittg" id="itTg">${targets()}</div>`
        + `<div class="menurow" style="margin-top:8px"><button class="btn sm" id="itGo" ${ITS.target == null ? 'disabled' : ''}>${tr('itSet')}</button></div></section>`;
    };
    const paint = () => { w.innerHTML = left() + right(); };
    paint();
    w.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.itn != null) { ITS.p = +t.dataset.itn; ITS.target = null; paint(); }
      else if (t.dataset.itt != null) { const id = +t.dataset.itt; ITS.open.has(id) ? ITS.open.delete(id) : ITS.open.add(id); paint(); }
      else if (t.dataset.itx != null) { const I = G.intent[ITS.p], it = I.find(x => x.id === +t.dataset.itx); if (it) { endIntent(ITS.p, it, 'aiIntentDropped'); G.aiGo[ITS.p] = null; G.ver++; autosave(); renderAi(); } paint(); }
      else if (t.dataset.itk) { ITS.kind = t.dataset.itk; ITS.target = null; paint(); }
      else if (t.dataset.itf) { ITS.fold.has(t.dataset.itf) ? ITS.fold.delete(t.dataset.itf) : ITS.fold.add(t.dataset.itf); paint(); }
      else if (t.dataset.itv != null) { ITS.target = +t.dataset.itv; paint(); }
      else if (t.id === 'itGo' && ITS.target != null) { const it = addIntent(ITS.p, ITS.kind, ITS.target, 'you', tr('itHistPlanted')); aiNote(ITS.p, tr('aiPlanted', intentText(it))); ITS.open.add(it.id); ITS.target = null; G.aiGo[ITS.p] = null; G.ver++; autosave(); ui(true); renderAi(); paint(); }
    });
    w.addEventListener('input', e => { if (e.target.id === 'itQ') { ITS.q = e.target.value; const tg = $('itTg'); if (tg) tg.innerHTML = targets(); } });
    return w;
  }
  function renderModal() {
    if ($('modal').hidden) return;
    stashBack();
    $('mTitle').textContent = tr(DLG_TITLE[modalTab] || 'helpTitle');
    $('mbox').dataset.kind = modalTab;
    const body = $('mbody');
    if (modalTab === 'help') {
      const secs = howSections(), nav = document.createElement('nav'), main = document.createElement('div');
      nav.className = 'hnav'; main.className = 'hmain';
      const item = (k, label) => `<button data-hs="${k}" aria-current="${String(howSel) === String(k)}">${label}</button>`;
      // the contents tree: four groups that fold; the computer's three pages sit in one group
      const isAi = s => s.h === '电脑国家', isTurn = s => ['通用', '轮流制', '清算制', '指挥点', '经济怎么结算'].includes(s.h), rulesAll = secs.map((s, i) => [i, s.h, isAi(s), isTurn(s)]);
      const groups = [
        ['rules', tr('tabRules'), rulesAll.filter(x => !x[2] && !x[3]).map(x => [x[0], x[1]])],
        ['turn', tr('grpTurn'), rulesAll.filter(x => x[3]).map(x => [x[0], x[1]])],
        ['ai', tr('grpAi'), [...rulesAll.filter(x => x[2]).map(x => [x[0], x[1]]), ['styles', tr('tabStyles')], ['aiwhy', tr('tabAiWhy')]]],
        ['sym', tr('helpSym'), [['symbols', tr('tabSymbols')], ['lines', tr('tabLines')], ['colors', tr('tabColors')]]],
        ['more', tr('helpMore'), [['ui', tr('tabUi')], ['map', tr('tabMap')], ['tips', tr('tabTips')]]],
      ];
      { const gg = groups.find(g => g[2].some(x => String(x[0]) === String(howSel))), it = gg && gg[2].find(x => String(x[0]) === String(howSel)); if (gg) $('mTitle').textContent = `${tr('helpTitle')} > ${gg[1]} > ${it[1]}`; }       // the title is a breadcrumb
      const grpOf = k => (groups.find(g => g[2].some(x => String(x[0]) === String(k))) || [])[0];
      if (!HG.init) { HG.init = true; HG.open.add(grpOf(howSel) || 'rules'); }
      if (HG.last !== howSel) { HG.last = howSel; HG.open.add(grpOf(howSel)); }       // a page you just picked opens its group; folding the group you are reading is allowed
      nav.innerHTML = groups.map(([gk, gl, its]) => `<button class="hg" data-hg="${gk}" aria-expanded="${HG.open.has(gk)}"><span>${HG.open.has(gk) ? '▾' : '▸'}</span> ${gl} <small>${its.length}</small></button>` + (HG.open.has(gk) ? its.map(([k, l]) => item(k, l)).join('') : '')).join('');
      const keep = el => { el.dataset.keep = '1'; main.appendChild(el); };
      if (howSel === 'ui') { const ul = $('how'); fillList(ul, tr('uiList')); keep(ul); }
      else if (howSel === 'tips') { const ul = $('how'); fillList(ul, tr('tipsList')); keep(ul); }
      else if (howSel === 'map') { const ul = $('how'); fillList(ul, tr('mapList')); keep(ul); }
      else if (howSel === 'symbols') { main.appendChild(buildSymbolsPage()); }
      else if (howSel === 'lines') { main.appendChild(buildLineDemos()); }
      else if (howSel === 'aiwhy') { const ul = $('how'); fillList(ul, tr('aiWhyList')); keep(ul); }
      else if (howSel === 'styles') { const ul = $('how'); fillList(ul, tr('stylesList')); keep(ul); }
      else if (howSel === 'colors') { main.appendChild(buildColorsPage()); }
      else { buildHow(+howSel || 0); keep($('how')); }
      const diff = [], D = DEFAULTS;
      TYPES.forEach((t, i) => { for (const [k, lab] of [['budget', 'march'], ['rmin', 'rangeMin'], ['rmax', 'rangeMax'], ['cost', 'buildCost'], ['min', 'routLine'], ['build', 'buildTime'], ['eat', 'eats'], ['bsp', 'bspL'], ['sg', 'sgL']]) if (t[k] !== D.u[i][k]) diff.push(`${tr('ty_' + t.k)}${tr(lab)} ${t[k]}（${tr('dfl')} ${D.u[i][k]}）`); });
      if (S.hitInf !== D.hitInf) diff.push(`${tr('ty_inf')}${tr('hitBase')} ${S.hitInf}%（${tr('dfl')} ${D.hitInf}%）`);
      if (S.hitArt !== D.hitArt) diff.push(`${tr('ty_art')}${tr('hitBase')} ${S.hitArt}%（${tr('dfl')} ${D.hitArt}%）`);
      for (const [k, l] of PK) if (S[k] !== D[k]) diff.push(`${tr(l)} ${S[k]}（${tr('dfl')} ${D[k]}）`);
      if (S.share !== D.share) diff.push(`${tr('shareL')} ${S.share}%（${tr('dfl')} ${D.share}%）`);
      if (S.zone !== D.zone) diff.push(`${tr('zoneOutL')} ${S.zone}（${tr('dfl')} ${D.zone}）`);
      if (diff.length) { const w = document.createElement('div'); w.className = 'prmwarn'; w.innerHTML = `<b>${tr('nonDefault')}</b> ${diff.join('；')}`; body.appendChild(w); }
      const wrap = document.createElement('div'); wrap.className = 'helpgrid'; wrap.append(nav, main); body.appendChild(wrap);
    } else if (modalTab === 'nations') { const d = document.createElement('div'); d.id = 'natAll'; d.className = 'nat'; d.innerHTML = G ? natRows(0, true) : ''; body.appendChild(d); }
    else if (modalTab === 'sound') {
      const w = document.createElement('div'); w.className = 'snd';
      w.innerHTML = `<div class="sndvol"><span>${tr('sndVol')}</span><input type="range" id="sndVol" min="0" max="100" value="${Math.round(getVolume() * 100)}"><b id="sndVolO">${Math.round(getVolume() * 100)}</b></div><div class="sndgrid">${SND_LIST.map(([k], i) => `<button class="btn alt" data-snd="${i}">▶ ${tr(k)}</button>`).join('')}</div><p class="note" style="margin:0">${tr('sndNote')}</p>`;
      body.appendChild(w);
    }
    else if (modalTab === 'stats') { body.appendChild(buildStats()); drawCurve(); }
    else if (modalTab === 'rules') {
      const w = document.createElement('div'), col1 = document.createElement('div'); w.className = 'prm';
      col1.className = 'pcol';
      const dif = (v, d) => +v !== d ? ` class="dif ${+v > d ? 'up' : 'dn'}" title="${tr('dfl')} ${d}（${+v > d ? '+' : ''}${Math.round((+v - d) * 100) / 100}）"` : '', mark = (v, d) => +v !== d ? `<i class="dm ${+v > d ? 'up' : 'dn'}">${+v > d ? '▲' : '▼'}</i>` : '<i class="dm"></i>';
      const inp = (k, i, v, lo, hi, st) => `<input type="number" data-pu="${k}" data-i="${i}" value="${v}" min="${lo}" max="${hi}" step="${st || 1}"${dif(v, DEFAULTS.u[i][k])}>${mark(v, DEFAULTS.u[i][k])}`;
      const unitRow = (k, lab, lo, hi, suf) => `<tr><th>${tr(lab)}${suf || ''}</th>${TYPES.map((t, i) => `<td><span class="pc">${inp(k, i, t[k], lo, hi)}</span></td>`).join('')}</tr>`;
      const hitRow = `<tr><th>${tr('hitBase')} %</th>${['hitInf', 'hitArt'].map(k => `<td><span class="pc"><input type="number" data-ph="${k}" value="${S[k]}" min="10" max="100" step="5"${dif(S[k], DEFAULTS[k])}>${mark(S[k], DEFAULTS[k])}</span></td>`).join('')}</tr>`;
      const roRow = (lab, f) => `<tr><th>${tr(lab)}</th>${TYPES.map(t => `<td><span class="pc ro">${f(t)}</span></td>`).join('')}</tr>`;
      const grp = (cls, title, rows) => `<tr class="gh ${cls}"><th colspan="3">${tr(title)}</th></tr>${rows}`;
      col1.innerHTML = `<table class="ut pt"><tr class="hd"><th></th>${TYPES.map((t, i) => `<th class="${i ? 'ca' : 'ci'}">${tr('ty_' + t.k)}</th>`).join('')}</tr>`
        + grp('g1', 'grpMove', unitRow('budget', 'march', 1, 8, ' ' + tr('unitCell')) + unitRow('rmin', 'rangeMin', 1, 10) + unitRow('rmax', 'rangeMax', 1, 14) + unitRow('cb', 'rangeCity', 0, 6))
        + grp('g2', 'grpEco', unitRow('cost', 'buildCost', 1, 1000, ' / ' + tr('perMan')) + unitRow('build', 'buildTurns', 1, 10) + unitRow('eat', 'eats', 0, 100, ' / ' + tr('perMan')))
        + grp('g3', 'grpFight', hitRow + unitRow('dmg', 'anaDmg', 1, 20) + unitRow('per', 'perLoss', 1, 20) + unitRow('min', 'routLine', 1, 30)) + `</table><p class="note">${tr('unitNote')}</p>`
      ;const cRow = (lab, tip, attr, key, lo, hi, st) => `<tr title="${tr(tip)}"><th>${tr(lab)}</th><td><span class="pc"><input type="number" ${attr} value="${S[key]}" min="${lo}" max="${hi}" step="${st}"${dif(S[key], DEFAULTS[key])}>${mark(S[key], DEFAULTS[key])}</span></td></tr>`;
      const cGrp = (cls, title, rows) => `<tr class="gh ${cls}"><th colspan="2">${tr(title)}</th></tr>${rows}`;
      const reset = `</table>`;
      const head2 = `<table class="ut pt"><tr class="hd"><th></th><th>${tr('valueCol')}</th></tr>`;
      const zoneHTML = head2 + cGrp('g1', 'grpZone', cRow('zoneOutL', 'zoneOutTip', 'data-pz="1"', 'zone', 0, 2000, 10)) + reset;
      const costHTML = () => {
        const inf = TYPES[0], art = TYPES[1], b = BUILD_COST, sp = T => T.cap * T.bsp, per = T => T.cap * T.eat + sp(T) * b, turns = (T, goal) => Math.ceil(goal / sp(T));
        const cost = (T, goal) => goal * b + turns(T, goal) * T.cap * T.eat, full = (T, goal) => `${goal}×${b} + ${turns(T, goal)}×${T.cap}×${T.eat} = ${cost(T, goal)}`;
        const line = T => `${tr('ty_' + T.k)} ${tr('bcFullMan')} ${T.cap}${tr('menUnit')}：${T.cap} × ${T.eat} + ${T.cap} × ${T.bsp} × ${b} = <b>${per(T)}</b> ${tr('bcPerTurn')}，${tr('bcGainTurn', sp(T))}`;
        return head2 + cGrp('g2', 'grpBuild', cRow('bcL', 'bcTip', 'data-pk="buildCost"', 'buildCost', 1, 100, 1) + TYPES.map((T, i) => `<tr title="${tr('bspTip')}"><th>${tr('ty_' + T.k)} ${tr('bspL')}</th><td><span class="pc">${inp('bsp', i, T.bsp, 1, 50)}</span></td></tr>`).join('')) + `</table>`
          + `<div class="fml"><h6>${tr('bcTitle')}</h6><p>${tr('bcMean')}</p><p class="ex"><b>${tr('bcExprL')}</b><br>${tr('bcExpr')}</p>`
          + `<p class="ex"><b>${tr('bcNowL')}</b><br>${line(inf)}<br>${line(art)}</p>`
          + `<p class="ex"><b>${tr('bcGrowL')}</b><br>${tr('bcGrow')}<br>${tr('ty_inf')} ${tr('bcFullMan')}：${turns(inf, CITY_MIN)} ${tr('bcTurns')}，${full(inf, CITY_MIN)}<br>${tr('bcToMax', CITY_MAX, turns(inf, CITY_MAX))}：${full(inf, CITY_MAX)}<br>${tr('ty_art')} ${tr('bcFullMan')}：${turns(art, CITY_MIN)} ${tr('bcTurns')}，${full(art, CITY_MIN)}<br>${tr('bcToMax', CITY_MAX, turns(art, CITY_MAX))}：${full(art, CITY_MAX)}</p>`
          + `</div>`;
      };
      const cpHTML = head2 + cGrp('g1', 'grpCp', cRow('cpBaseL', 'cpBaseTip', 'data-pk="cpBase"', 'cpBase', 0, 99, 1) + cRow('cpDivL', 'cpDivTip', 'data-pk="cpDiv"', 'cpDiv', 10, 5000, 10)) + reset;
      const cityHTML = head2
        + cGrp('g1', 'grpSize', cRow('csL', 'csTip', 'data-pk="cityStart"', 'cityStart', 50, 5000, 50) + cRow('cmnL', 'cmnTip', 'data-pk="cityMin"', 'cityMin', 50, 5000, 50) + cRow('cmL', 'cmTip', 'data-pk="cityMax"', 'cityMax', 200, 5000, 100) + cRow('upL', 'upTip', 'data-pk="upkeep"', 'upkeep', 0, 100, 1) + cRow('scL', 'scTip', 'data-pk="supCap"', 'supCap', 0, 20, 0.5))
        + cGrp('g1', 'grpIncome', cRow('taxL', 'taxTip', 'data-pk="tax"', 'tax', 0, 200, 5))
        + cGrp('g3', 'grpCityFight', cRow('shareL', 'shareTip', 'data-pc="1"', 'share', 0, 100, 5) + TYPES.map((T, i) => `<tr title="${tr('sgTip')}"><th>${tr('ty_' + T.k)} ${tr('sgL')}</th><td><span class="pc">${inp('sg', i, T.sg, 1, 50)}</span></td></tr>`).join(''))
        + cGrp('g2', 'grpRewards', cRow('capL', 'capTip', 'data-pk="capBonus"', 'capBonus', 0, 10000, 50) + cRow('plunderL', 'plunderTip', 'data-pk="plunder"', 'plunder', 0, 100, 5) + cRow('brkL', 'brkTip', 'data-pk="breakBonus"', 'breakBonus', 0, 10000, 50) + cRow('bldL', 'bldTip', 'data-pk="buildBonus"', 'buildBonus', 0, 10000, 50))
        + reset;
      w.appendChild(col1);
      w.appendChild(buildAnalysis());
      const tabs = document.createElement('div'); tabs.className = 'atabs'; tabs.style.margin = '0 0 10px';
      tabs.innerHTML = [['units', 'rtUnits'], ['city', 'rtCity'], ['zone', 'rtZone'], ['cp', 'rtCp']].map(([k, l]) => `<button data-rt="${k}" aria-pressed="${rulesTab === k}">${tr(l)}</button>`).join('');
      tabs.style.alignItems = 'center'; tabs.insertAdjacentHTML('beforeend', `<span class="note" style="margin:0 0 0 auto">${tr('rulesNote')}</span><button class="btn alt sm" data-pr="1">${tr('resetParams')}</button>`);
      body.appendChild(tabs);
      if (rulesTab === 'city' || rulesTab === 'zone' || rulesTab === 'cp') {
        const cw = document.createElement('div'); cw.className = 'prm';
        if (rulesTab === 'zone') { cw.style.gridTemplateColumns = 'minmax(0, 520px)'; cw.innerHTML = `<div class="pcol">${zoneHTML}</div>`; }
        else if (rulesTab === 'cp') { cw.style.gridTemplateColumns = 'minmax(0, 520px)'; cw.innerHTML = `<div class="pcol"><p class="note" style="margin:0 0 8px"><b>${tr('cpNote')}</b></p>${cpHTML}</div>`; }
        else cw.innerHTML = `<div class="pcol"><p class="note" style="margin:0 0 8px"><b>${tr('citySizeNote')}</b></p>${cityHTML}</div><div class="pcol">${costHTML()}</div>`;
        body.appendChild(cw);
      }
      else body.appendChild(w);
    }
    else if (modalTab === 'intent' && G) { body.appendChild(buildIntent()); }
    else if (modalTab === 'naming' && (NMT.tab === 'names' || NMT.tab === 'avatars')) {
      body.appendChild(namingBar());
      const w = document.createElement('div'), L = S.names || {}, kinds = [['nation', 'namesNation'], ['city', 'namesCity'], ['zone', 'namesZone']];
      let part = '';
      if (NMT.tab === 'names') part = `<p class="note" style="margin:0 0 10px">${tr('namesNote')}</p><div class="nmbox">${kinds.map(([k, l]) => `<label><b>${tr(l)}</b><textarea data-nm="${k}" spellcheck="false">${esc((L[k] || []).join('\n'))}</textarea><span class="nmchk" data-nmchk="${k}"></span></label>`).join('')}</div><div class="menurow" style="margin-top:10px"><button class="btn sm" id="nmSave">${tr('namesSave')}</button><span class="note" id="nmMsg" style="margin:0"></span></div>`;
      else part = `<p class="note" style="margin:0 0 8px">${tr('avLibNote', AV_MAX)}</p><div class="menurow" style="margin:0 0 10px"><button class="btn sm" id="avUp" ${AVLIB.list.length >= AV_MAX ? 'disabled' : ''}>${tr('avUpload')}</button><input type="file" id="avFile" accept="image/*" multiple hidden><span class="note" style="margin:0">${AVLIB.list.length} / ${AV_MAX}</span></div><div class="avgrid">${AVLIB.list.map((u, i) => `<div class="avo"><img src="${u}" alt=""><button class="btn sm alt" data-avdel="${i}">${tr('avDel')}</button></div>`).join('')}</div>`;
      w.innerHTML = part;
      body.appendChild(w);
      for (const t of w.querySelectorAll('textarea[data-nm]')) nmCheck(t);
    }
    else if (modalTab === 'naming' && NMT.tab === 'game' && G) {
      body.appendChild(namingBar());
      const p = AVP.p, w = document.createElement('div'), on = G.avImg && G.avImg[p] ? 'u:' + G.avImg[p] : 'b:' + faceIdx(p);
      const btn = (attr, src, label, sel, key) => { const u = faceUser(key, p); return `<button class="avo${sel ? ' on' : ''}${u >= 0 ? ' used' : ''}" ${u >= 0 ? 'disabled' : attr} ${u >= 0 ? `title="${esc(tr('avUsed', nameOf(u)))}"` : ''}><img src="${src}" alt=""><span>${u >= 0 ? esc(tr('avUsed', nameOf(u))) : esc(label || '')}</span></button>`; };
      const who = q => G.players[q].human ? tr('avHuman') : tr('ai_' + ((G.aiLevel && G.aiLevel[q]) || 'normal')) + '·' + styleText(q);
      w.className = 'avwin';
      w.innerHTML = `<div><div class="note" id="avMsg" style="margin:0 0 6px">${tr('avNameNote')}</div><div class="avlist">${G.players.map((x, q) => `<div class="avrow${q === p ? ' on' : ''}" data-avrow="${q}"><img src="${avatarURL(q)}" alt=""><input data-avn="${q}" maxlength="2" value="${esc(nameOf(q))}" spellcheck="false"><span>${esc(who(q))}${x.alive ? '' : ' · ' + tr('avDead')}</span></div>`).join('')}</div></div>`
        + `<div><h4 class="avh" style="margin-top:0">${tr('avFor', esc(nameOf(p)))}</h4><p class="note" style="margin:0 0 8px">${tr('avUniq')}</p><div class="avgrid">${SPECIES.map((sp, i) => btn(`data-avb="${i}"`, faceSprite(i).toDataURL(), spName(i), on === 'b:' + i, 'b:' + i)).join('')}${AVLIB.list.map((u, i) => btn(`data-avu="${i}"`, u, '', on === 'u:' + u, 'u:' + u)).join('')}</div>${AVLIB.list.length ? '' : `<p class="note">${tr('avNoUp')}</p>`}</div>`;
      body.appendChild(w);
    }
    else if (modalTab === 'naming' && NMT.tab === 'builtin') {
      body.appendChild(namingBar());
      const w = document.createElement('div'), ul = document.createElement('ul'); ul.className = 'how';
      const chips = a => a.map(x => `<span class="nmchip">${x}</span>`).join(''), pick = a => a[rnd(a.length)];
      const nat = SPECIES.map((s, i) => `<img class="nmface" src="${faceSprite(i).toDataURL()}" alt="">${tr('s_' + s.k)}`), sfx = ['城', '堡', '镇', '寨', '关', '塞', '营', '港'];
      const demo = []; for (const pre of shuffle([...ZPRE]).slice(0, 4)) demo.push(`${pre}${pick(ZSUF)}（大区）→ ${pre}${sfx[0]}、${pre}${sfx[1]}、${pre}${pick(sfx.slice(2))}`);
      fillList(ul, [
        '<b>国家名</b>：',
        '>内置 ' + nat.length + ' 个动物头像，每个配一个两个字的名字，按席位顺序分给各国：' + chips(nat),
        '>名字库里填了的先用，用完才轮到内置的。',
        '<b>大区名</b>：',
        '>“2 个字的前缀 + 1 个字的后缀”，共 ' + ZPRE.length + '×' + ZSUF.length + ' = ' + ZPRE.length * ZSUF.length + ' 种组合，每局随机抽，不重复。',
        '>前缀：' + chips(ZPRE),
        '>后缀：' + chips(ZSUF),
        '>名字库里的大区名先用；组合用完后，在名字后面加序号。',
        '<b>城市名</b>：',
        '>用所在大区的前缀，加上“' + sfx.join('、') + '”，依次找一个没被用过的。',
        '>都用过了，就写成“前缀城2”“前缀城3”……',
        '>名字库里的城市名先用。',
        '<b>样例</b>（每次打开随机）：',
        ...demo.map(x => '>' + x)]);
      w.appendChild(ul); body.appendChild(w);
    }
    else if (modalTab === 'menu') { body.appendChild($('menuBody')); $('menuBody').dataset.keep = '1'; }
  }
  $('mbody').addEventListener('click', e => { const hg = e.target.closest('button[data-hg]'); if (hg) { HG.open.has(hg.dataset.hg) ? HG.open.delete(hg.dataset.hg) : HG.open.add(hg.dataset.hg); renderModal(); return; } const b = e.target.closest('button[data-hs]'); if (b) { howSel = ['colors', 'symbols', 'styles', 'lines', 'ui', 'map', 'tips', 'aiwhy'].includes(b.dataset.hs) ? b.dataset.hs : +b.dataset.hs; renderModal(); } });
  $('mbody').addEventListener('click', e => { const b = e.target.closest('button[data-snd]'); if (b) SND_LIST[+b.dataset.snd][1](); });
  $('mbody').addEventListener('input', e => { if (e.target.id === 'sndVol') { setVolume(+e.target.value / 100); $('sndVolO').textContent = e.target.value; } });
  $('mbody').addEventListener('change', e => { if (e.target.id === 'sndVol') snd.select(); });
  $('mSnd').addEventListener('click', () => openModal('sound'));
  $('aiList').addEventListener('change', e => { const d = e.target.closest('input[data-dyn]'); if (d && G) { const q = +d.dataset.aip; if (!G.aiDyn[q]) G.aiDyn[q] = {}; G.aiDyn[q][d.dataset.dyn] = d.checked; if (d.dataset.dyn === 'a' && d.checked) G.aiDyn[q].next = G.round + DYN_EVERY; G.ver++; autosave(); ui(true); renderAi(); return; }
    const t = e.target.closest('select[data-aip]'); if (!t || !G) return; const p = +t.dataset.aip; if (t.dataset.k === 'lv') G.aiLevel[p] = t.value; else G.aiStyle[p] = t.value; G.ver++; autosave(); ui(true); renderAi(); });
  $('levelSel').addEventListener('change', () => { if (G) { G.aiLevel[G.cur] = $('levelSel').value; autosave(); ui(); } });
  $('styleSel').addEventListener('change', () => { if (G) { G.aiStyle[G.cur] = pickStyle($('styleSel').value); autosave(); ui(); } });
  const showWinSize = () => { const el = $('winSize'); if (!el) return; const w = window.innerWidth, h = window.innerHeight; el.textContent = `${w} × ${h}`; el.classList.toggle('small', w < 1300 || h < 800); el.title = (w < 1300 || h < 800) ? tr('winSizeSmall') : ''; };
  window.addEventListener('resize', showWinSize); showWinSize();
  $('mRules').addEventListener('click', () => openModal('rules'));
  $('mNames').addEventListener('click', () => { NMT.tab = 'names'; openModal('naming'); });
  $('mbody').addEventListener('click', e => { if (e.target.id !== 'nmSave') return; let bad = 0; const nm = {}; for (const t of document.querySelectorAll('#mbody textarea[data-nm]')) { const r = cleanNames(t.dataset.nm, t.value); nm[t.dataset.nm] = r.ok; bad += r.bad; t.value = r.ok.join('\n'); } S.names = nm; saveSet(); $('nmMsg').textContent = tr('namesSaved', bad); });
  $('sCp').addEventListener('change', () => { S.chk = Math.max(10, Math.min(1000, Math.round(+$('sCp').value) || 50)); $('sCp').value = S.chk; if (G) { G.cpEvery = S.chk; autosave(); } try { localStorage.setItem('idlewars-command-1', JSON.stringify(S)); } catch (e) {} });
  const saveSet = () => { try { localStorage.setItem('idlewars-command-1', JSON.stringify(S)); } catch (e) {} };
  $('sClr').addEventListener('change', () => { S.clr = $('sClr').checked; saveSet(); if (G) ui(); });
  $('zFog').addEventListener('click', () => { $('sFog').checked = !$('sFog').checked; $('sFog').dispatchEvent(new Event('change')); });
  $('zClr').addEventListener('click', () => { $('sClr').checked = !$('sClr').checked; $('sClr').dispatchEvent(new Event('change')); });
  $('sFog').addEventListener('change', () => { S.fog = $('sFog').checked; saveSet(); if (G) { G.ver++; ui(true); requestDraw(); autosave(); } });
  // ---------- avatars and names: the library in the name window, and the picker that changes one nation at any time ----------
  const AVP = { p: 0 }, NMT = { tab: 'names' };
  const namingBar = () => { const d = document.createElement('div'); d.className = 'atabs'; d.style.margin = '0 0 10px'; d.innerHTML = [['builtin', 'nmTabBuiltin'], ['names', 'nmTabNames'], ['avatars', 'nmTabAv'], ...(G ? [['game', 'nmTabGame']] : [])].map(([k, l]) => `<button data-nt="${k}" aria-pressed="${NMT.tab === k}">${tr(l)}</button>`).join(''); return d; };
  function nmCheck(t) {
    const r = checkNames(t.dataset.nm, t.value), box = document.querySelector(`[data-nmchk="${t.dataset.nm}"]`); if (!box) return;
    t.classList.toggle('bad', r.bad.length > 0);
    box.innerHTML = `<b>${tr('nmOkN', r.ok)}</b>` + r.bad.slice(0, 8).map(b => `<span class="nmbad">${tr('nmLine', b.line, esc(b.text), b.why)}</span>`).join('') + (r.bad.length > 8 ? `<span class="nmbad">${tr('nmMore', r.bad.length - 8)}</span>` : '');
  }
  $('mbody').addEventListener('input', e => { if (e.target.dataset && e.target.dataset.nm) nmCheck(e.target); });
  $('mbody').addEventListener('click', e => { const b = e.target.closest('button[data-nt]'); if (b) { NMT.tab = b.dataset.nt; renderModal(); } });
  function fileToFace(f) {
    return new Promise((ok, no) => {
      const fr = new FileReader(); fr.onerror = no;
      fr.onload = () => { const im = new Image(); im.onerror = no; im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const s = Math.min(im.width, im.height); c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 96, 96); let u = c.toDataURL('image/webp', 0.85); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/png'); ok(u); }; im.src = fr.result; };
      fr.readAsDataURL(f);
    });
  }
  // a face may only be worn once per game: the key of what each nation wears, and who else has a given one
  const faceKey = q => (G.avImg && G.avImg[q]) ? 'u:' + G.avImg[q] : 'b:' + faceIdx(q);
  const faceUser = (key, p) => G.players.findIndex((x, q) => q !== p && faceKey(q) === key);
  function setNation(p, o) {
    if (!G || faceUser(o.b != null ? 'b:' + o.b : 'u:' + o.u, p) >= 0) return;
    const oldDefault = G.nnames && G.nnames[p] === spName(faceIdx(p));
    if (o.b != null) { G.av[p] = o.b; G.avImg[p] = null; if (oldDefault) G.nnames[p] = spName(o.b); } else { G.avImg[p] = o.u; G.av[p] = -1; }
    avReset(); G.ver++; ui(true); requestDraw(); autosave(); renderModal();
  }
  document.addEventListener('click', e => { const a = e.target.closest('[data-avp]'); if (!a || !G) return; AVP.p = +a.dataset.avp; NMT.tab = 'game'; autoPause(); openModal('naming'); });
  $('mbody').addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#avUp')) $('avFile').click();
    else if (t.closest('[data-avdel]')) { const i = +t.closest('[data-avdel]').dataset.avdel; AVLIB.list.splice(i, 1); avSave(); renderModal(); }
    else if (t.closest('[data-avb]')) setNation(AVP.p, { b: +t.closest('[data-avb]').dataset.avb });
    else if (t.closest('[data-avu]')) { const u = AVLIB.list[+t.closest('[data-avu]').dataset.avu]; if (u) setNation(AVP.p, { u }); }
    else if (t.closest('[data-avrow]') && t.tagName !== 'INPUT') { AVP.p = +t.closest('[data-avrow]').dataset.avrow; renderModal(); }
  });
  $('mbody').addEventListener('change', async e => {
    if (e.target.id === 'avFile') { for (const f of [...e.target.files]) { if (AVLIB.list.length >= AV_MAX) break; try { const u = await fileToFace(f); if (!AVLIB.list.includes(u)) AVLIB.list.push(u); } catch (err) { /* not a picture */ } } avSave(); renderModal(); }
    else if (e.target.dataset && e.target.dataset.avn != null) {
      const q = +e.target.dataset.avn, v = [...e.target.value.trim()], nm = v.join('');
      if (v.length !== 2) { $('avMsg').textContent = tr('avNameBad'); e.target.value = nameOf(q); return; }
      if (G.players.some((x, o) => o !== q && nameOf(o) === nm)) { $('avMsg').textContent = tr('avNameDup'); e.target.value = nameOf(q); return; }
      G.nnames[q] = nm; G.ver++; ui(true); autosave(); AVP.p = q; renderModal(); $('avMsg').textContent = tr('avNameOk');
    }
  });
  $('mBuiltin').addEventListener('click', () => { NMT.tab = 'builtin'; openModal('naming'); });
  const autoPause = () => { if (G && !G.paused && !G.over) { G.paused = true; ui(true); } };       // stats, menu and help all stop the game while they are open; the resume button blinks
  $('bStats').addEventListener('click', () => { autoPause(); openModal('stats'); });
  $('cpStats').addEventListener('click', () => { $('cpModal').hidden = true; cpReturn = true; openModal('stats'); });
  $('overStats').addEventListener('click', () => openModal('stats'));
  $('mbody').addEventListener('click', e => { const b = e.target.closest('button[data-st],button[data-sm]'); if (!b) return; if (b.dataset.st) statTab = b.dataset.st; else statMetric = b.dataset.sm; renderModal(); });
  $('mbody').addEventListener('mousemove', e => { if (e.target.id === 'stCv') curveHover(e); });
  $('mbody').addEventListener('mouseleave', () => { const t = $('stTip'); if (t) t.hidden = true; });
  const saveS = () => { try { localStorage.setItem('idlewars-command-1', JSON.stringify(S)); } catch (e) {} };
  $('mbody').addEventListener('change', e => {
    const t = e.target; if (modalTab !== 'rules') return;
    if (t.dataset.pu) { S.u = TYPES.map(x => ({ budget: x.budget, rmin: x.rmin, rmax: x.rmax, cost: x.cost, min: x.min, build: x.build, eat: x.eat, dmg: x.dmg, per: x.per, cb: x.cb, bsp: x.bsp, sg: x.sg })); S.u[+t.dataset.i][t.dataset.pu] = t.value; }
    else if (t.dataset.ph) S[t.dataset.ph] = clampHit(t.value, t.dataset.ph === 'hitInf' ? 50 : 30);
    else if (t.dataset.pz) S.zone = t.value;
    else if (t.dataset.pc) S.share = t.value;
    else if (t.dataset.pk) S[t.dataset.pk] = t.value;
    else if (t.dataset.pg) S.anaGap = Math.max(2, Math.min(20, Math.round(+t.value) || 6));
    else return;
    applyParams(); saveS(); if (G) { G.ver++; autosave(); ui(); } renderModal();
  });
  $('mbody').addEventListener('click', e => {
    if (e.target.dataset.at) { anaTab = e.target.dataset.at; renderModal(); return; }
    if (!e.target.dataset.pr) return;
    S.u = JSON.parse(JSON.stringify(DEFAULTS.u)); S.zone = DEFAULTS.zone; S.share = DEFAULTS.share; for (const [k] of PK) S[k] = DEFAULTS[k]; S.hitInf = DEFAULTS.hitInf; S.hitArt = DEFAULTS.hitArt;
    applyParams(); saveS(); if (G) { G.ver++; autosave(); ui(); } renderModal();
  });
  $('mClose').addEventListener('click', closeModal);
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
  $('bHelp').addEventListener('click', () => { autoPause(); openModal('help'); });
  $('bSet').addEventListener('click', () => { autoPause(); openModal('menu'); });
  // new game dialog: opens by itself when there is nothing to resume
  // ---------- new game: one row per nation (face, name, player or computer, level, style and its two switches, starting stock) ----------
  let NGR = [];
  const ngStyles = Object.keys(AI_STYLES);       // the styles a row can have; the buttons below the rows set them all at once or draw one for each
  const ngFaces = () => [...AVLIB.list.map(u => ({ img: u, av: -1 })), ...SPECIES.map((_, i) => ({ img: null, av: i }))];
  const ngKey = r => r.img || 'sp' + r.av;
  function ngRow(i) {
    const used = new Set(NGR.map(ngKey)), f = ngFaces().find(x => !used.has(ngKey(x))) || { img: null, av: i % SPECIES.length }, lib = nameLib().nation.filter(n => !NGR.some(r => r.name === n));
    return { ...f, name: lib.length ? lib[rnd(lib.length)] : spName(f.av >= 0 ? f.av : i % SPECIES.length), human: false, level: 'normal', style: ngStyles[rnd(ngStyles.length)], a: true, b: true, stock: 0 };
  }
  // the rows follow the number of players; the hidden "how many humans" control (also used by the tests) decides who plays when it disagrees with the rows
  function rosterSync() {
    const n = Math.max(2, Math.min(8, +$('sPlayers').value || 4)), h = Math.min(n, +$('sHumans').value || 0);
    while (NGR.length < n) NGR.push(ngRow(NGR.length));
    NGR.length = n;
    if (NGR.filter(r => r.human).length !== h) NGR.forEach((r, i) => { r.human = i < h; });
  }
  const ngFaceURL = r => r.img || faceSprite(r.av).toDataURL();
  function renderRoster() {
    rosterSync();
    const opt = (list, cur, pre) => list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${tr(pre + v)}</option>`).join('');
    $('ngRoster').innerHTML = NGR.map((r, i) => `<div class="ngr ${r.human ? 'hum' : ''}" data-r="${i}"><button class="ngav" data-ngav="${i}" title="${tr('ngFaceTip')}"><img src="${ngFaceURL(r)}" alt=""></button>`
      + `<input class="ngnm" data-ngk="name" maxlength="2" value="${esc(r.name)}" title="${tr('ngNameTip')}">`
      + `<select data-ngk="human"><option value="1" ${r.human ? 'selected' : ''}>${tr('ngHuman')}</option><option value="0" ${r.human ? '' : 'selected'}>${tr('ngCpu')}</option></select>`
      + `<span class="ngai"><select data-ngk="level">${opt(['easy', 'normal', 'hard'], r.level, 'ai_')}</select><select data-ngk="style">${opt(ngStyles, r.style, 'st_')}</select>`
      + `<label title="${tr('dynATip')}"><input type="checkbox" data-ngk="a" ${r.a ? 'checked' : ''}>${tr('dynA')}</label><label title="${tr('dynBTip')}"><input type="checkbox" data-ngk="b" ${r.b ? 'checked' : ''}>${tr('dynB')}</label></span>`
      + `<label class="ngst">${tr('ngStock')}<input type="number" data-ngk="stock" min="0" max="99999" step="100" value="${r.stock}"></label>` + `</div>`).join('');
    $('ngStyleBtns').innerHTML = ngStyles.map(k => `<button class="btn alt sm" data-ngall="${k}">${tr('ngAll', tr('st_' + k))}</button>`).join('') + `<button class="btn alt sm" data-ngall="random">${tr('ngRandStyle')}</button>`;
    renderMaps();
  }
  // the map: random (made at the start) or one of the fixed maps for this many nations, each shown as a small picture (nation land in its colour, cities as dots)
  let NGmap = -1;
  function mapThumb(m, cv) {
    const W = 240, H = 160, ctx = cv.getContext('2d'); cv.width = W; cv.height = H; ctx.clearRect(0, 0, W, H);
    const zone = []; for (const r of m.zones.split(',')) { const [a, b] = r.split('.'), z = parseInt(a, 36) - 1, n = parseInt(b, 36); for (let k = 0; k < n; k++) zone.push(z); }
    const s = Math.min(W / (m.cols + 0.5), H / (m.rows * 0.866 + 0.2)), ox = (W - s * (m.cols + 0.5)) / 2, oy = (H - s * m.rows * 0.866) / 2;
    const xy = i => { const c = i % m.cols, r = (i / m.cols) | 0; return [ox + s * (c + 0.5 + 0.5 * (r & 1)), oy + s * (r * 0.866 + 0.5)]; };
    const sum = new Map();
    zone.forEach((z, i) => { if (z < 0) return; const [x, y] = xy(i), h = m.home[z]; ctx.fillStyle = h >= 0 ? NATION_COLORS[h % NATION_COLORS.length] : '#5d6b62'; ctx.globalAlpha = h >= 0 ? 0.85 : 0.6; ctx.fillRect(x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1); const t = sum.get(z) || [0, 0, 0, []]; t[0] += x; t[1] += y; t[2]++; t[3].push([x, y]); sum.set(z, t); });
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
    for (const [z, t] of sum) { if (m.home[z] < 0) continue; const cx = t[0] / t[2], cy = t[1] / t[2]; let b = t[3][0], bd = 1e9; for (const q of t[3]) { const d = (q[0] - cx) ** 2 + (q[1] - cy) ** 2; if (d < bd) { bd = d; b = q; } } ctx.beginPath(); ctx.arc(b[0], b[1], Math.max(2, s * 0.9), 0, 6.283); ctx.fill(); }
  }
  function renderMaps() {
    const n = Math.max(2, Math.min(8, +$('sPlayers').value || 4)), ms = MAPS[n] || [];
    if (NGmap >= ms.length) NGmap = -1;
    $('ngMaps').innerHTML = `<button class="btn alt sm ${NGmap < 0 ? 'on' : ''}" data-ngmap="-1" title="${tr('ngMapTip')}"><span class="rnd">?</span>${tr('ngMapRand')}</button>`
      + ms.map((_, i) => `<button class="btn alt sm ${NGmap === i ? 'on' : ''}" data-ngmap="${i}" title="${tr('ngMapTip')}"><canvas></canvas>${tr('ngMapN', i + 1)}</button>`).join('');
    $('ngMaps').querySelectorAll('canvas').forEach((c, i) => mapThumb(ms[i], c));
    $('sObs').disabled = NGmap >= 0;
  }
  $('ngMaps').addEventListener('click', e => { const b = e.target.closest('[data-ngmap]'); if (!b) return; NGmap = +b.dataset.ngmap; renderMaps(); });
  $('ngRoster').addEventListener('click', e => {
    const b = e.target.closest('button[data-ngav]'); if (!b) return;
    const r = NGR[+b.dataset.ngav], all = ngFaces(), used = new Set(NGR.filter(x => x !== r).map(ngKey)), at = all.findIndex(x => ngKey(x) === ngKey(r));
    for (let k = 1; k <= all.length; k++) { const f = all[(at + k) % all.length]; if (!used.has(ngKey(f))) { const wasDefault = !r.img && r.name === spName(r.av); r.img = f.img; r.av = f.av; if (wasDefault && f.av >= 0) r.name = spName(f.av); break; } }
    renderRoster();
  });
  $('ngRoster').addEventListener('change', e => {
    const t = e.target.closest('[data-ngk]'), row = e.target.closest('[data-r]'); if (!t || !row) return;
    const r = NGR[+row.dataset.r], k = t.dataset.ngk;
    if (k === 'name') { const v = t.value.trim(); if ([...v].length === NAME_LEN.nation && !NGR.some(x => x !== r && x.name === v)) r.name = v; }
    else if (k === 'human') { r.human = t.value === '1'; $('sHumans').value = NGR.filter(x => x.human).length; }
    else if (k === 'a' || k === 'b') r[k] = t.checked;
    else if (k === 'stock') r.stock = Math.max(0, Math.min(99999, Math.round(+t.value) || 0));
    else r[k] = t.value;
    renderRoster();
  });
  $('ngReroll').addEventListener('click', () => { NGR = []; renderRoster(); });
  $('ngStyleBtns').addEventListener('click', e => { const b = e.target.closest('[data-ngall]'); if (!b) return; const k = b.dataset.ngall; NGR.forEach(r => { r.style = k === 'random' ? ngStyles[rnd(ngStyles.length)] : k; }); renderRoster(); });
  function openNG() { closeModal(); writeForm(); renderRoster(); $('ngClose').hidden = !G; $('ngModal').hidden = false; }
  function closeNG() { $('ngModal').hidden = true; }
  $('ngClose').addEventListener('click', closeNG);
  $('mNew').addEventListener('click', openNG);
  $('mSave').addEventListener('click', async () => {
    if (!G) return;
    const name = 'idlewars-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json', text = JSON.stringify(packGame());
    let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) { try { await dl.save({ filename: name, data: text }); } catch (e) { if (e && e.code !== 'declined') $('saveNote').textContent = tr('saveBad'); } return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  $('mLoad').addEventListener('click', () => $('loadIn').click());
  $('loadIn').addEventListener('change', async () => {
    const f = $('loadIn').files[0]; $('loadIn').value = ''; if (!f) return;
    try { const prev = G; unpackGame(JSON.parse(await f.text())); if (prev && prev.aiRunning) prev.aiRunning = false; closeModal(); autosave(); } catch (e) { console.error(e); $('saveNote').textContent = tr('loadBad'); }
  });
  const pickNation = e => {
    const cb = e.target.closest('button[data-ctl]'); if (cb) { if (!cb.disabled && G) { setControl(+cb.dataset.ctl, !G.players[+cb.dataset.ctl].human); if (!$('modal').hidden) renderModal(); } return; }
    if (e.target.id === 'natMore') { e.preventDefault(); openModal('nations'); return; }
    const r = e.target.closest('.r[data-p]'); if (!r || !G) return;
    const p = +r.dataset.p; G.blink = G.blink === p ? -1 : p; if (!$('modal').hidden) closeModal(); ui(false); requestDraw();
  };
  $('nat').addEventListener('click', pickNation);
  { const lp = document.querySelector('.dp-log'), tb = $('logTop'); lp.addEventListener('scroll', () => { tb.hidden = lp.scrollTop < 120; }); tb.addEventListener('click', () => { lp.scrollTo({ top: 0, behavior: 'smooth' }); }); }
  $('camBtn').addEventListener('click', () => { if (G && G._camOff) { G._camOff = false; G.paused = false; cast(''); ui(true); } });
  $('pauseBtn').addEventListener('click', () => { if (!G || G.over) return; G.paused = !G.paused; if (!G.paused) { cast(''); G._camOff = false; } ui(true); });
  $('ctlBtn').addEventListener('click', () => { if (G && !G.over && !G.players[G.cur].human) setControl(G.cur, true); });
  $('autoBtn').addEventListener('click', () => {
    if (!G || G.over || !G.players[G.cur].human) return;
    confirmBox(tr('autoTitle'), tr('autoBody'), tr('autoClear'), tr('ffNo'), () => { dropOrdersNow(); setControl(G.cur, false); }, [tr('autoOk'), () => setControl(G.cur, false)], ['green', 'orange', 'red']);
  });
  $('mbody').addEventListener('click', e => { if (e.target.closest('#natAll')) pickNation(e); });

  // ---------- language wiring ----------
  const syncMute = () => { const b = $('muteBtn'); b.textContent = muted ? tr('soundOff') : tr('soundOn'); b.setAttribute('aria-pressed', String(!muted)); };
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i]').forEach(el => { el.textContent = tr(el.dataset.i); });
    document.querySelectorAll('[data-it]').forEach(el => { el.title = tr(el.dataset.it); });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('board').setAttribute('aria-label', tr('boardLabel'));
    document.querySelectorAll('[data-ph]').forEach(el => { el.placeholder = tr(el.dataset.ph); });
    syncMute(); syncView(); renderModal();
    if (G) { ui(true); renderLog(); if (G.over) showOver(); }
    requestDraw();
  }

  // ---------- card buttons ----------
  function afterOrder() { ui(true); requestDraw(); }
  function handleAct(b) {
    if (!humanTurn()) return;
    const act = b.dataset.act, L = selLegion();
    if (act === 'march' && L) { G.mode = G.mode === 'march' ? null : 'march'; flash(); afterOrder(); }
    else if (act === 'attack' && L) { G.mode = G.mode === 'attack' ? null : 'attack'; flash(); afterOrder(); }
    else if (act === 'attackThis' && L) {
      const T = G.L.find(x => x.id === +b.dataset.v);
      if (attackNow(L, T)) { snd.select(); flash(); requestDraw(); } else deny(tr('xBadAttack'), tr('dnAttackThis'));
      afterOrder();
    }
    else if (act === 'repair' && L) { if (orderRepair(L)) snd.select(); else deny(...whyRepair(L)); afterOrder(); }
    else if (act === 'split' && L) { G.mode = G.mode === 'split' ? null : 'split'; flash(); afterOrder(); }
    else if (act === 'cancelMode') { G.mode = null; flash(); afterOrder(); }
    else if (act === 'buyOpen') { G._buyOpen = !G._buyOpen; afterOrder(); }
    else if (act === 'buyType') { buyState().type = +b.dataset.v; afterOrder(); }
    else if (act === 'buy') {
      const bs = buyState();
      if (G.sel >= 0 && orderBuildUnits(G.cur, G.sel, bs.type, bs.n)) { snd.reinforce(); flash(); G._buyOpen = false; } else deny(...whyBuy(G.sel, bs.type, bs.n));
      afterOrder();
    }
  }
  const sideEl = document.querySelector('.side');
  sideEl.addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (b && !b.disabled) handleAct(b); });
  sideEl.addEventListener('input', e => {
    if (!G) return;
    if (e.target.id === 'splitR') { G.splitN = +e.target.value; $('splitO').textContent = G.splitN; }
    else if (e.target.id === 'buyR') { const bs = buyState(); bs.n = +e.target.value; $('buyO').textContent = bs.n; $('buyC').textContent = bs.n * TYPES[bs.type].cost; }
  });
  sideEl.addEventListener('change', e => {
    if (!G) return;
    if (e.target.id === 'hoardS') { const L = selLegion(); if (L && orderHoard(L, +e.target.value)) afterOrder(); }
  });

  // ---------- wiring ----------
  const cvEl = $('board');
  cvEl.addEventListener('pointerdown', onDown); cvEl.addEventListener('pointermove', onMove);
  cvEl.addEventListener('pointerup', onUp); cvEl.addEventListener('pointercancel', onUp);
  cvEl.addEventListener('pointerleave', () => { if (G && !drag) { G.hover = -1; G.hoverPx = null; hintUI(); requestDraw(); } });
  cvEl.addEventListener('contextmenu', e => { e.preventDefault(); if (G && G.mode) { G.mode = null; flash(); ui(true); requestDraw(); } });
  cvEl.addEventListener('wheel', e => { e.preventDefault(); camPause(); const r = cvEl.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  $('zFront').addEventListener('click', () => { frontOn = !frontOn; $('zFront').setAttribute('aria-pressed', frontOn); $('zFront').classList.toggle('on', frontOn); requestDraw(); });
  $('zFit').addEventListener('click', () => { fitCam(false); requestDraw(); });
  $('zMine').addEventListener('click', () => myLand(1.1));
  let ffAsk = false;
  // give up everything ordered this turn
  const dropOrdersNow = () => {
    for (const L of G.L.filter(x => x.owner === G.cur && x.undo)) cancelOrder(L);
    for (const o of [...G.players[G.cur].pending].filter(o => o.at === G.round)) cancelBuild(G.cur, o);
  };
  const ffGo = async keep => {
    if (!keep) dropOrdersNow();
    G._ff = G.round; G._ffPause = G.round; G.sel = -1; G.focus = -1; G.mode = null; ui(true); await endTurn();
  };
  $('ffBtn').addEventListener('click', async () => {
    if (!G || G.over || G.busy || G.pause) return;
    if (humanTurn()) {
      confirmBox(tr('ffTitle'), tr('ffBody'), tr('ffOk'), tr('ffNo'), () => ffGo(false), [tr('ffKeep'), () => ffGo(true)], ['green', 'orange', 'red']);
      return;
    }
    G.paused = false; G._camOff = false;       // fast-forwarding from a pause: the pause ends and this round runs through
    G._ff = G.round; G._ffPause = G.round; G.aiShow = null; cast(''); ui(true); requestDraw();
  });
  // ending a turn always asks for a second press (any order given in between starts the check over)
  function tryEnd() {
    if (!humanTurn()) return;
    const key = G.ver + ':' + G.round + ':' + G.cur;
    if (G._endWarn !== key) { G._endWarn = key; G._endWarnAt = performance.now(); ui(true); return; }
    if (G._endWarn === key && performance.now() - (G._endWarnAt || 0) < 700) return;       // a fast double click must not confirm by itself
    G._endWarn = null; endTurn();
  }
  $('endBtn').addEventListener('click', tryEnd);
  $('endBack').addEventListener('click', () => { G._endWarn = null; ui(true); });
  $('denyOk').addEventListener('click', denyYes); $('denyNo').addEventListener('click', denyClose); $('denyAlt').addEventListener('click', denyOther); $('denyModal').addEventListener('click', e => { if (e.target.id === 'denyModal') denyClose(); });
  document.addEventListener('keydown', e => { if (!$('denyModal').hidden && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); denyClose(); } }, true);
  $('muteBtn').addEventListener('click', () => { muted = !muted; try { localStorage.setItem('idlewars-mute', muted ? '1' : '0'); } catch (e) {} syncMute(); if (!muted) snd.select(); });
  $('sSupplyLine').addEventListener('change', () => { V.supply = $('sSupplyLine').checked; saveV(); syncView(); requestDraw(); });

  $('sSpeed').addEventListener('change', () => { S.speed = $('sSpeed').value; });       // test hook only, the control is hidden
  // ---------- directory sidebar ----------
  // the dock on the right: panel / index / battle log, one of them is always showing
  const dockSync = () => {
    $('dock').dataset.tab = DIR.tab;
    const inList = DIR.tab === 'zones' || DIR.tab === 'cities' || DIR.tab === 'legions';
    document.querySelectorAll('.dtabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dt === (inList ? 'list' : DIR.tab))));
    document.querySelectorAll('#listTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sub === DIR.tab)));
    if (inList) DIR.sub = DIR.tab;
  };
  function setTab(tab) {
    if (tab === 'list') tab = DIR.sub || 'zones';
    if (G && tab !== 'panel' && tab !== 'eco') G.blink = -1;       // the nation picked in the nations table stops flashing once you leave (the economy tab still shows the picked one)
    DIR.tab = tab; DIR.key = ''; const lp = document.querySelector('.dp-log'); if (tab === 'log' && lp) lp.dataset.init = '';
    dockSync(); if (G) { $('todoList').dataset.key = ''; $('aiList').dataset.key = ''; $('ecoBody').dataset.key = ''; renderEco(); renderDir(); renderTodo(); renderAi(); renderLog(); }
  }
  document.querySelectorAll('.dtabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.dt)));
  document.querySelectorAll('#listTabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.sub)));
  $('todoList').addEventListener('click', e => { const tb = e.target.closest('[data-tdtab]'); if (tb) { const [k, v] = tb.dataset.tdtab.split(':'); TD[k] = v; renderTodo(); return; } const c = e.target.closest('[data-cancel]'); if (c) { e.stopPropagation(); todoCancel(c.dataset.cancel); return; } const go = e.target.closest('[data-go]'); if (go) dirGo(go.dataset.go); });
  $('aiList').addEventListener('click', e => { const go = e.target.closest('[data-go]'); if (go) dirGo(go.dataset.go); });
  $('listBody').addEventListener('click', e => { const go = e.target.closest('[data-go]'); if (go) dirGo(go.dataset.go); });
  $('listFlt').addEventListener('input', e => { if (e.target.id === 'lQ') { LST.q = e.target.value; LST.key = ''; renderDir(); } });
  $('listFlt').addEventListener('change', e => {
    if (e.target.id === 'lMine') LST.mine = e.target.checked; else if (e.target.id === 'lFight') LST.fight = e.target.checked; else if (e.target.id === 'lState') LST.state = e.target.value; else return;
    LST.key = ''; renderDir();
  });
  dockSync();
  $('cpGo').addEventListener('click', () => checkpointGo(false));
  $('cpEnd').addEventListener('click', () => checkpointGo(true));
  $('newBtn').addEventListener('click', () => { closeNG(); closeModal(); newGame(); });
  $('overBtn').addEventListener('click', newGame);
  $('sTb').addEventListener('change', () => { S.tbs = Math.max(1, Math.min(9, Math.round(+$('sTb').value) || 1)); try { localStorage.setItem('idlewars-command-1', JSON.stringify(S)); } catch (e) {} });
  $('sStep').addEventListener('change', () => { S.step = +$('sStep').value || 1.5; try { localStorage.setItem('idlewars-command-1', JSON.stringify(S)); } catch (e) {} });
  $('sPlayers').addEventListener('input', () => { $('sPlayersOut').textContent = $('sPlayers').value; renderRoster(); });
  document.addEventListener('keydown', e => {
    if (!G || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape' && !$('ngModal').hidden && G) { closeNG(); return; }
    if (e.key === 'Escape' && !$('modal').hidden) { closeModal(); return; }
    if (e.key === 'Escape') { if (G.mode || G._buyOpen) { G.mode = null; G._buyOpen = false; flash(); ui(true); requestDraw(); return; } G.sel = -1; G.focus = -1; G.mode = null; flash(); ui(true); requestDraw(); return; }
    if (!humanTurn()) return;
    const L = selLegion();
    if (L && e.key === 'm') { G.mode = G.mode === 'march' ? null : 'march'; afterOrder(); }
    else if (L && e.key === 'a') { G.mode = G.mode === 'attack' ? null : 'attack'; afterOrder(); }
    else if (L && e.key === 'r') { if (orderRepair(L)) { snd.select(); afterOrder(); } }
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); tryEnd(); }
  });
  new ResizeObserver(resize).observe($('boardWrap'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestDraw());
  new MutationObserver(() => requestDraw()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.__game = { genWorld, makeZones, packMap, loadMap, attackNow, cpMax, cpUsed, cpLeft, cover, isCity, cutReason, reachOf, zoneLines, todoData, cancelOrder, cancelBuild, get G() { return G; }, hexDist, supplyHTML, supplyOf, S: () => S, ui, orderMarch, orderAttack, orderStrike, vertexCells, supplyViz, deny, whyMarch, whySplit, orderRepair, capture, visMask, logText, SAMPLES, marchLegion, checkpointGo, showCheckpoint, setControl, cityRoom, packGame, unpackGame, autosave, resumeGame, cities, V, supplyViz, aiProduce, AIK, citySupplied, validTarget, typ, supCost, spawn, fireRound, stepMarch, buyOK, cityRoomParts, view, TYPES, endTurn, doEndTurn, aiTurn, orderBuildUnits, orderSplit, reachOf, cover, planRoute, hitRate, targetsIn, hexDist, within, newGame, stats, economy, cityRoom,
    setLang: l => { lang = l; applyLang(); }, setSpeed: v => { S.speed = String(v); }, screen: i => { const r = cvEl.getBoundingClientRect(); return [r.left + view.cw / 2 + (G.X[i] - view.cx) * view.s, r.top + view.ch / 2 + (G.Y[i] - view.cy) * view.s]; } };

  applyParams(); writeForm(); resize(); applyLang();
  try { if (resumeGame()) applyLang(); else { applyLang(); openNG(); } } catch (e) { console.error(e); }
})();
</script>
