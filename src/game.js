
  // ---------- route finding ----------
  let dBuf = null, pBuf = null;
  // Fewest steps over the link graph (A* with hex distance). costOf(cell) is the cost of entering a cell, or Infinity.
  function findPath(link, src, dst, costOf) {
    const n = COLS * ROWS;
    if (!dBuf || dBuf.length !== n) { dBuf = new Float32Array(n); pBuf = new Int32Array(n); }
    dBuf.fill(Infinity); pBuf.fill(-1);
    const h = new Heap(); dBuf[src] = 0; h.push(0, src);
    while (h.size) {
      const key = h.k[0], u = h.pop();
      if (key - hexDist(u, dst) > dBuf[u] + 1e-4) continue;
      if (u === dst) break;
      for (let e = 0; e < 6; e++) {
        const v = link[u * 6 + e]; if (v < 0) continue;
        const c = costOf(v); if (c === Infinity) continue;
        const nd = dBuf[u] + c;
        if (nd < dBuf[v]) { dBuf[v] = nd; pBuf[v] = u; h.push(nd + hexDist(v, dst), v); }
      }
    }
    if (dBuf[dst] === Infinity) return null;
    const path = []; for (let c = dst; c !== src; c = pBuf[c]) path.push(c);
    path.reverse(); return { path, cost: dBuf[dst] };
  }

  // ---------- game state ----------
  let G = null, gameSeq = 0;
  const view = { cx: 0, cy: 0, s: 1, cw: 800, ch: 600, dpr: 1, fit: 1, min: 0.1, max: 3.5 };

  const typ = L => TYPES[L.type];
  const humanCount = () => G.players.filter(p => p.human).length;
  const pname = id => (G.players[id].human ? (humanCount() === 1 ? tr('you') : tr('pN', id + 1)) : (G.aiStyle && G.aiStyle[id] ? tr('ai_' + ((G.aiLevel && G.aiLevel[id]) || 'normal')) + '·' + styleText(id) : tr('cpu'))) + '·' + nameOf(id);
  const pnameB = id => '【' + pname(id) + '】';       // in sentences a nation's name sits in brackets so it is easy to spot
  // ---------- names: each zone, city and legion has a fixed id; the name is a label on it ----------
  const ZPRE = ['落雁', '青石', '赤水', '寒鸦', '金沙', '斗鸡', '白马', '黑松', '铁门', '琥珀', '卧龙', '鹿鸣', '炽焰', '苍狼', '月牙', '铜鸾', '烟雨', '石窟', '米仓', '空城'], ZSUF = ['原', '岭', '川', '滩', '谷', '坡', '林', '坪', '渡', '关'], NAME_MAX = 12;
  // the name library: what the player typed in the menu; nation names must be 2 characters, city and zone names 3, no duplicates
  const NAME_LEN = { nation: 2, city: 3, zone: 3 };
  function cleanNames(kind, text) {
    const seen = new Set(), ok = [], n = (Array.isArray(text) ? text : String(text || '').split(/[\n,，、;；]+/)).map(x => String(x).trim()).filter(Boolean);
    let bad = 0; for (const x of n) { if ([...x].length !== NAME_LEN[kind] || seen.has(x)) { bad++; continue; } seen.add(x); ok.push(x); }
    return { ok, bad };
  }
  // who wears which face: the uploaded pictures in random order first, then the built-in animals; a nation without a name of its own takes its built-in animal's
  function assignAvatars(ids, nl) {
    const N = SPECIES.length; G.av = ids.map(() => -1); G.avImg = ids.map(() => null);
    const ups = shuffle(AVLIB.list.map((_, i) => i)), done = new Set();
    for (const p of ids) if (ups.length) { G.avImg[p] = AVLIB.list[ups.shift()]; done.add(p); }
    const free = [...Array(N).keys()];
    for (const p of ids) if (!done.has(p)) { const k = free.includes(p % N) ? p % N : (free.length ? free[0] : p % N); free.splice(free.indexOf(k), 1); G.av[p] = k; }
    const spare = [...Array(N).keys()].filter(i => !G.av.includes(i));
    G.nnames = ids.map(p => nl[p] || (G.av[p] >= 0 ? spName(G.av[p]) : spName(spare.length ? spare.shift() : p % N)));
    avReset();
  }
  // line by line check of what the player typed: which entries would be dropped, and why
  function checkNames(kind, text) {
    const seen = new Set(), bad = []; let ok = 0;
    String(text || '').split('\n').forEach((ln, i) => {
      for (const x of ln.split(/[,，、;；]+/).map(t => t.trim()).filter(Boolean)) {
        const n = [...x].length;
        if (n !== NAME_LEN[kind]) bad.push({ line: i + 1, text: x, why: tr('nmWrongLen', NAME_LEN[kind], n) });
        else if (seen.has(x)) bad.push({ line: i + 1, text: x, why: tr('nmDupe') });
        else { seen.add(x); ok++; }
      }
    });
    return { ok, bad };
  }
  const nameLib = () => { const L = S.names || {}; return { nation: cleanNames('nation', L.nation).ok, city: cleanNames('city', L.city).ok, zone: cleanNames('zone', L.zone).ok }; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const legionDefault = (t, no) => tr('legionNo', no, tr('ty_' + TYPES[t].k));
  const lname = L => L.name || legionDefault(L.type, L.no);
  const lnameById = id => { const i = G.lgInfo && G.lgInfo[id]; return i ? (i.name || legionDefault(i.t, i.no)) : '?'; };
  const zoneName = zi => (G.zname && G.zname[zi]) || '';
  function cityName(c) {
    if (!G.cname) G.cname = {};
    if (G.cname[c]) return G.cname[c];
    const zi = G.zone[c], pre = (G.zpre && G.zpre[zi]) || '', used = new Set();
    for (const k in G.cname) used.add(G.cname[k]);
    let nm = null;
    if (G.cpool) while (G.cpool.length && !nm) { const x = G.cpool.shift(); if (!used.has(x)) nm = x; }       // names the player put in the name library come first
    if (!nm) for (const sfx of ['城', '堡', '镇', '寨', '关', '塞', '营', '港']) if (!used.has(pre + sfx)) { nm = pre + sfx; break; }
    if (!nm) { let k = 2; while (used.has(pre + '城' + k)) k++; nm = pre + '城' + k; }
    G.cname[c] = nm; return nm;
  }
  // log arguments may point at a legion, city or zone by id; they are turned into the current name when the log is shown
  const cm = s => '\u0001' + s + '\u0002';      // city names are marked so they can be shown in red
  const rich = s => esc(s).replace(/\u0001/g, '<span class="cn">').replace(/\u0002/g, '</span>');
  const bk = s => '【' + s + '】';       // names of places and legions sit in brackets inside sentences
  const nameRef = a => (a.lg != null ? bk(lnameById(a.lg)) : a.ct != null ? cm(cityName(a.ct)) : a.zn != null ? zoneName(a.zn) : '?');      // only legions and nations get brackets; place names stay plain
  const logText = m => tr(m.key, ...m.args.map(a => (a && typeof a === 'object' ? nameRef(a) : a)));
  const isBlockedCell = i => G.zone[i] < 0;
  const isCity = i => G.def[i] >= CITY_MIN;
  const linked = (a, b) => { for (let e = 0; e < 6; e++) if (G.link[a * 6 + e] === b) return true; return false; };
  const rangeOf = L => { const T = typ(L); return [T.rmin, T.rmax + (isCity(L.cell) ? T.cb : 0)]; };
  const touch = () => { G.ver++; };
  let yieldN = 0;
  const wait = ms => (quick() ? (++yieldN % 6 === 0 ? sleep(0) : Promise.resolve()) : sleep(ms * parseFloat(S.speed) * G.speedMul));
  const quick = () => (G._ff === G.round) || !!G.ffUntil || parseFloat(S.speed) * G.speedMul < 0.1;       // the fast-forward button makes the rest of one round instant
  const cities = p => { const o = []; for (const i of G.land) if (G.def[i] >= CITY_MIN && G.co[i] === p) o.push(i); return o; };
  // fog of war: p sees enemy legions within 8 cells of its own legions and big cities
  function visMask(p) {
    const v = new Uint8Array(COLS * ROWS);
    for (const L of G.L) if (L.owner === p) for (const c of within(L.cell, 8)) v[c] = 1;
    for (const i of G.land) if (G.def[i] >= CITY_MIN && G.co[i] === p) for (const c of within(i, 8)) v[c] = 1;
    return v;
  }
  const alivePlayers = () => G.order.filter(p => G.players[p].alive);
  const setMul = () => { G.speedMul = 1; };       // no automatic speed-up: the animation speed setting alone decides
  const supCost = L => L.n * typ(L).eat;        // one portion per turn; a turn with fire costs a second portion
  // hatred: who has hurt whom, kept per nation (hate[victim][attacker]); it fades a little each round
  const citySupCap = def => Math.floor(def * S.supCap);       // the most supplies a city can send out per turn
  const cityUpkeep = def => Math.ceil(def * S.upkeep / 100);       // what a city or site of this size costs each turn
  const cityTax = p => { let s = 0; for (const c of cities(p)) s += Math.floor(G.def[c] * S.tax / 100); return s; };
  function addHate(victim, by, n) { if (victim === by || victim < 0 || by < 0 || !(n > 0)) return; if (!G.hate) G.hate = G.players.map(() => G.players.map(() => 0)); G.hate[victim][by] = Math.min(3000, G.hate[victim][by] + n); }
  // one-off income (capture, breaking a garrison, finishing a city) is noted for the economy panel
  function ecoEv(p, k, n, cell) { if (!G.eco) G.eco = []; G.eco.unshift({ r: G.round, p, k, n, c: cell }); if (G.eco.length > 120) G.eco.pop(); }
  const capSup = L => { const m = supCost(L) * SUP_MAX_TURNS; if (L.sup > m) L.sup = m; };
  const daysLeft = L => Math.floor(L.sup / Math.max(1, supCost(L)));

  // everything can go into the battle log; `noFeed` keeps a line off the strip at the top left of the map (the log tab still has it)
  function logMsg(key, args, p, noFeed) {
    const m = { key, args, p }; G.log.unshift(m);
    if (!noFeed) feedPush(m);
    if (G.log.length > 1500) G.log.pop();
    renderLog();
    return m;
  }
  // an event that is logged quietly and announced in the caption at the bottom of the map
  function ev(key, args, p) { const m = logMsg(key, args, p, true); castEvent(logText(m)); return m; }
  // the same events scroll over the map for a few seconds, so nobody has to watch two places
  const feed = [];
  function feedPush(m) { feed.push({ m, t: performance.now() }); while (feed.length > 5) feed.shift(); renderFeed(); }
  function renderFeed() {
    const el = $('feed'); if (!el) return;
    const now = performance.now();
    while (feed.length && now - feed[0].t > 8000) feed.shift();
    el.innerHTML = feed.map(f => `<div class="fi" style="border-left-color:${f.m.p >= 0 && G ? hue(f.m.p) : '#8a948f'};opacity:${now - f.t > 5000 ? 0.55 : 1}">${rich(logText(f.m))}</div>`).join('');
  }
  setInterval(renderFeed, 1000);
  let logTimer = 0;
  function renderLog() { if (logTimer) return; logTimer = setTimeout(() => { logTimer = 0; renderLogNow(); }, 120); }
  function renderLogNow() {
    const ul = $('log'); if (!ul) return;
    if (!G) { ul.innerHTML = ''; return; }
    if (DIR.tab !== 'log') return;
    const pane = ul.parentElement, stick = !pane.dataset.init || pane.scrollTop < 40, oldH = pane.scrollHeight;
    ul.innerHTML = '';
    for (const m of G.log) {      // newest first: the newest line is at the top; scrolled down, the view stays on what it was showing
      const li = document.createElement('li'); if (m.key === 'logRound') li.className = 'rnd'; else if (m.p < 0) li.className = 'sys';
      const sw = document.createElement('i'); sw.style.background = m.p >= 0 ? hue(m.p) : 'transparent';
      const sp = document.createElement('span'); sp.innerHTML = rich(logText(m));
      li.append(sw, sp); ul.appendChild(li);
    }
    if (stick) { pane.scrollTop = 0; pane.dataset.init = '1'; } else pane.scrollTop += pane.scrollHeight - oldH;
  }

  function mkLegion(owner, type, n, cell, o) {
    const L = { id: G.nid++, no: ++G.seq[owner][type], owner, type, n, cell, st: 'alert', tgt: null, sup: 0, hoard: HOARD_DEFAULT, starve: 0,
      acted: false, atk: 0, fired: false, eng: 0, bld: false, dead: false, mv: null, route: null, ordRound: 0, ...o };
    if (L.sup === 0 && !(o && o.sup === 0)) L.sup = n * TYPES[type].eat * HOARD_DEFAULT;
    G.lg[cell] = L; G.L.push(L); G.lgInfo[L.id] = { o: owner, t: type, no: L.no, name: null }; touch(); return L;
  }
  function kill(L) { if (L.dead) return; L.dead = true; if (G.lg[L.cell] === L) G.lg[L.cell] = null; touch(); }
  // per round, per nation: 20 running numbers for the statistics screen (see ST_FIELDS)
  const ST_FIELDS = ['inc', 'cityC', 'shipC', 'shipL', 'buildC', 'meals', 'repairC', 'built0', 'built1', 'kill0', 'kill1', 'killV', 'lost0', 'lost1', 'lostS', 'capN', 'capV', 'cityLost', 'razed', 'rep', 'wipe', 'rout', 'wiped', 'routed'];       // the last four count legions: wiped out / routed, by us and against us
  function st(p) {
    const A = G.stats || (G.stats = []), r = Math.max(0, G.round - 1);
    while (A.length <= r) A.push(null);
    return (A[r] || (A[r] = G.players.map(() => new Array(ST_FIELDS.length).fill(0))))[p];
  }
  // an infantry legion that steps onto a big city with no enemy legion in it takes the city
  function capture(cell, p) {
    const old = G.co[cell]; if (old === p) return;
    st(p)[15]++; st(p)[16] += G.def[cell]; if (old >= 0) st(old)[17]++;
    G.co[cell] = p; addHate(old, p, 250);
    if (old >= 0) {      // spoils: a fixed bonus plus a share of the old owner's stock
      const O = G.players[old], loot = Math.floor(O.stock * S.plunder / 100), gain = S.capBonus + loot;
      O.stock -= loot; G.players[p].stock += gain; st(p)[0] += gain;
      if (gain > 0) { logMsg('logLoot', [p, { ct: cell }, gain, old], p); ecoEv(p, 'cap', gain, cell); }
    }
    if (old >= 0) { dropOrders(old, cell, 'orderWhyCap'); logMsg('logCity', [p, old, { ct: cell }], p); }
    touch();
  }
  // the orders of a city that fell, was razed or shrank below a big city are void and not refunded: say so in the log
  function dropOrders(p, c, why) {
    const P = G.players[p], lost = P.pending.filter(o => o.city === c);
    P.pending = P.pending.filter(o => o.city !== c);
    for (const o of lost) logMsg('logOrderLost', [p, { ct: c }, o.n, tr('ty_' + TYPES[o.type].k), tr(why)], p);
  }
  // a city whose defense reaches 0 is gone
  function cityFalls(c) {
    const o = G.co[c];
    if (o >= 0) st(o)[17]++;
    if (o >= 0) { dropOrders(o, c, 'orderWhyGone'); logMsg('logCityGone', [o], o); }
    G.def[c] = 0; G.co[c] = -1; G.wasCity[c] = 0;
    for (const L of G.L) if (L.bld && L.cell === c) L.bld = false;
    touch();
  }
  function moveLegion(L, to) {
    const from = L.cell; G.lg[from] = null; G.lg[to] = L; L.cell = to; L.mv = { from, t0: performance.now() }; touch();
    if (typ(L).take && isCity(to) && G.co[to] !== L.owner) capture(to, L.owner);
  }

  // ---------- new game ----------
  const VOID_SHARE = { few: 0.2, mid: 0.3, many: 0.4 };

  // ---------- saving: one automatic save in the browser, plus save/load as a file ----------
  const SAVE_KEY = 'idlewars-command-save-1', SAVE_SKIP = new Set(['Z', 'phys', 'link', 'X', 'Y', 'lg', 'cv', 'cvVer', 'fx', 'pops', 'cp', 'reach', 'aiRunning', 'camLock', 'aiShow', 'paused', 'busy', 'sel', 'hover', 'mode', 'focus', 'flash', 'blink', 'gid']);
  const TA = { Int16Array, Uint16Array, Int32Array, Uint8Array, Float32Array };
  function packGame() {
    const o = {};
    for (const k of Object.keys(G)) {
      if (SAVE_SKIP.has(k) || k[0] === '_') continue;
      const v = G[k];
      o[k] = ArrayBuffer.isView(v) ? { __t: v.constructor.name, a: Array.from(v) } : v;
    }
    o.L = G.L.map(L => ({ ...L, mv: null }));
    return { v: 3, S, cols: COLS, rows: ROWS, nz: G.Z.length, zh: G.Z.map(z => [z.holder, z.home, z.out]), g: o };
  }
  function unpackGame(s) {
    if (!s || s.v !== 3 || !s.g || !s.g.zone) throw new Error('bad save');
    S = { ...DEFAULTS, ...s.S }; applyParams(); if (s.g && s.g.cpEvery) S.chk = s.g.cpEvery; writeForm();
    setGrid(s.cols, s.rows); buildCoords();
    const total = COLS * ROWS, g = {};
    for (const k of Object.keys(s.g)) { const v = s.g[k]; g[k] = v && v.__t ? TA[v.__t].from(v.a) : v; }
    const X = new Float32Array(total), Y = new Float32Array(total), isLand = new Uint8Array(total);
    for (let i = 0; i < total; i++) { const [x, y] = cellXY(i % COLS, (i / COLS) | 0); X[i] = x; Y[i] = y; }
    for (const i of g.land) isLand[i] = 1;
    const { Z, phys } = makeZones(s.nz, g.zone, isLand, X, Y, g.land);
    Z.forEach((z, i) => { [z.holder, z.home, z.out] = s.zh[i]; z.out = S.zone; });
    const lg = new Array(total).fill(null);
    for (const L of g.L) { L.dead = false; lg[L.cell] = L; }
    G = { ...g, Z, phys, link: Int32Array.from(phys), X, Y, lg, cv: null, cvVer: 0, fx: [], pops: [], cp: [], reach: [], aiRunning: false, busy: false, sel: -1, hover: -1, mode: null, focus: -1, flash: '', blink: -1, gid: ++gameSeq, ver: (g.ver || 0) + 1 };
    if (!G.wasCity) { G.wasCity = new Uint8Array(total); for (let c = 0; c < total; c++) if (G.def[c] >= CITY_MIN) G.wasCity[c] = 1; }       // saves from before the one-time new-city bonus
    if (!Array.isArray(G.aiStyle) || G.aiStyle.length !== G.players.length) G.aiStyle = G.players.map(() => pickStyle('random'));       // saves from before computer styles
    G.aiStyle = G.aiStyle.map(x => pickStyle(x));       // saves from before the styles were renamed
    if (!Array.isArray(G.aiDyn) || G.aiDyn.length !== G.players.length) G.aiDyn = G.players.map(() => ({ a: false, b: false }));       // saves from before the changing styles
    if (!Array.isArray(G.hate) || G.hate.length !== G.players.length) G.hate = G.players.map(() => G.players.map(() => 0));
    if (!Array.isArray(G.intent) || G.intent.length !== G.players.length) G.intent = G.players.map(() => []);
    G.intent = G.intent.map(x => Array.isArray(x) ? x : x ? [{ id: 0, hist: [[G.round, '']], until: G.round + 40, str: 0, last: 0, ...x }] : []);       // older saves held one idea per nation
    if (!Array.isArray(G.aiLevel) || G.aiLevel.length !== G.players.length) G.aiLevel = G.players.map(() => 'normal');       // saves from before per-nation levels
    if (!Array.isArray(G.av) || G.av.length !== G.players.length) { G.av = G.players.map((_, p) => p % SPECIES.length); G.avImg = G.players.map(() => null); }       // saves from before pickable avatars: everyone keeps the face they had
    if (!Array.isArray(G.avImg) || G.avImg.length !== G.players.length) G.avImg = G.players.map(() => null);
    if (!Array.isArray(G.nnames) || G.nnames.length !== G.players.length) G.nnames = G.players.map((_, p) => (G.nnames && G.nnames[p]) || spName(G.av[p]));
    $('over').hidden = true; feed.length = 0; avReset();
    fitCam(true); setMul();
    if (G.over) showOver();
    ui(true); requestDraw();
    if (G.pause && !G.over) showCheckpoint();
    else if (!G.over && !G.players[G.cur].human) runAI();
  }
  function autosave() {
    if (!G) return;
    try { if (G.over) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, JSON.stringify(packGame())); } catch (e) { /* storage full or blocked: the file save still works */ }
  }
  function resumeGame() {
    try { const t = localStorage.getItem(SAVE_KEY); if (!t) return false; unpackGame(JSON.parse(t)); return true; } catch (e) { console.error(e); try { localStorage.removeItem(SAVE_KEY); } catch (e2) {} G = null; return false; }
  }
  function newGame() {
    readForm();
    const P = S.players, cpp = 300;
    const g = genWorld(P, cpp, VOID_SHARE[S.obs] || 0.3, 6);
    const total = COLS * ROWS;
    G = { Z: g.Z, zone: g.zone, phys: g.phys, link: g.link, X: g.X, Y: g.Y, land: g.land, owner: g.owner, gap: g.gap,
      lg: new Array(total).fill(null), def: new Uint16Array(total), wasCity: new Uint8Array(total), co: new Int16Array(total).fill(-1), cpEvery: S.chk || 50, cpCount: 0, promptedAt: 0, zname: [], zpre: [], cname: {}, lgInfo: {}, nhist: {},
      L: [], ship: [], nid: 1, seq: Array.from({ length: P }, () => [0, 0]), cur: 0, round: 1, sel: -1, hover: -1, mode: null, busy: false, over: false, log: [], players: [], order: [],
      gid: ++gameSeq, clearing: !!S.clr, ver: 1, blink: -1, cv: null, cvVer: 0, reach: [], speedMul: 1, fx: [], pops: [], cp: [], nameAt: [], flash: '', splitN: 1, aiRunning: false, focus: -1 };
    const combos = []; for (const a of ZPRE) for (const b of ZSUF) combos.push([a, b]);
    shuffle(combos);
    const lib = nameLib(), zlib = shuffle([...lib.zone]);
    G.Z.forEach((z, i) => { if (zlib.length) { const nm = zlib.shift(); G.zpre[i] = [...nm].slice(0, 2).join(''); G.zname[i] = nm; return; } const [a, b] = combos[i % combos.length]; G.zpre[i] = a; G.zname[i] = a + b + (i >= combos.length ? i : ''); });
    G.cpool = shuffle([...lib.city]);
    feed.length = 0;
    const ids = [...Array(P).keys()];
    rosterSync();                                          // the new-game rows: who plays, face, name, level, style and switches, starting stock
    for (const id of ids) G.players.push({ id, human: NGR[id].human, everHuman: NGR[id].human, stock: NGR[id].stock, pending: [], income: 0, upkeep: 0, alive: true, men: 0, cityCost: 0 });
    G.order = shuffle([...ids]); G.stats = []; G.aiLog = []; applyParams();
    G.aiStyle = ids.map(i => pickStyle(NGR[i].style));     // each row's style, as set (or drawn by the button) in the panel
    G.aiDyn = ids.map(i => ({ a: NGR[i].a, b: NGR[i].b, next: DYN_EVERY + 1 }));
    G.hate = ids.map(() => ids.map(() => 0)); G.intent = ids.map(() => []); G.ihist = []; G.iseq = 0;
    G.aiLevel = ids.map(i => NGR[i].level);
    G.av = ids.map(i => NGR[i].img ? -1 : NGR[i].av); G.avImg = ids.map(i => NGR[i].img || null); G.nnames = ids.map(i => NGR[i].name); avReset();
    // one big city per owned zone
    for (const p of ids) {
      const all = G.land.filter(c => G.owner[c] === p);
      if (!all.length) { G.players[p].alive = false; continue; }
      let sx = 0, sy = 0; for (const c of all) { sx += G.X[c]; sy += G.Y[c]; } sx /= all.length; sy /= all.length;
      G.nameAt[p] = [sx, sy];
      const picks = G.Z.filter(z => z.home === p && z.cells.length).map(z => z.ai);          // one big city in the middle of each of the nation's zones
      for (const c of picks) { G.def[c] = CITY_START; G.wasCity[c] = 1; G.co[c] = p; cityName(c); }
    }
    // starting armies: a legion on every city and one beside it, plus a battery
    for (const p of ids) {
      if (!G.players[p].alive) continue;
      const cts = cities(p);
      const free = c => { const o = []; for (let e = 0; e < 6; e++) { const j = G.link[c * 6 + e]; if (j >= 0 && !G.lg[j] && !G.def[j]) o.push(j); } return shuffle(o); };
      cts.forEach(c => {
        mkLegion(p, 0, 20, c);
        const f = free(c);
        if (f.length) mkLegion(p, 0, 20, f[0]);
        if (f.length > 1) mkLegion(p, 1, 10, f[1]);
      });
    }
    // fast-forward at the start: every human nation is on autopilot for the first N rounds, each round runs instantly, then the humans get their nations back
    { const ffN = Math.max(0, Math.min(999, Math.round(+($('sFf') || {}).value) || 0)); G.ffUntil = ffN ? 1 + ffN : 0; if (G.ffUntil) { G._ff = 1; for (const q of G.players) q.human = false; } }
    G.cur = G.order[0]; setMul();
    logMsg('logNew', [P, G.land.filter(i => G.def[i] >= CITY_MIN).length], -1);
    logMsg('logRound', [1], -1, true);
    $('over').hidden = true;
    fitCam(true);
    startTurn(G.cur);
    ui(true); requestDraw();
    autosave();
    snd.turn();
    if (!G.players[G.cur].human) runAI();
  }

  // ---------- cover, reach and cut-off cells ----------
  function cover() {
    if (G.cv && G.cvVer === G.ver) return G.cv;
    const n = COLS * ROWS, inf = new Uint32Array(n), infAll = new Uint32Array(n), artTot = new Uint16Array(n), artOwn = new Map();
    for (const L of G.L) {
      if (L.dead) continue;
      const T = typ(L), R = T.rmax + (isCity(L.cell) ? T.cb : 0);
      // infAll: infantry that is marching counts too, but only to cancel an enemy's hold on a cell for supplies; marches and fire use `inf` (standing legions only)
      if (L.type === 0) { const bit = 1 << L.owner; for (const c of within(L.cell, R)) { infAll[c] |= bit; if (L.st !== 'march') inf[c] |= bit; } }
      if (L.st === 'march') continue;
      if (L.type === 0) { /* done above */ }
      else {
        let a = artOwn.get(L.owner); if (!a) { a = new Uint16Array(n); artOwn.set(L.owner, a); }
        for (const c of within(L.cell, R)) if (hexDist(L.cell, c) >= T.rmin) { a[c] += L.n; artTot[c] += L.n; }
      }
    }
    G.cv = { inf, infAll, artTot, artOwn }; G.cvVer = G.ver; return G.cv;
  }
  // A cell is cut for p when an enemy legion stands on it, or enemy infantry reaches it and p's own infantry does not (a standoff lets supplies through).
  function cutFor(p, c, cv) {
    const m = cv.inf[c], own = 1 << p;
    if ((m & ~own) !== 0 && (cv.infAll[c] & own) === 0) return true;
    const L = G.lg[c]; return !!(L && L.owner !== p);
  }
  function reachOf(p) {
    const r = G.reach[p]; if (r && r.ver === G.ver) return r;
    const cv = cover(), n = COLS * ROWS, dist = new Int16Array(n).fill(-1), par = new Int32Array(n).fill(-1), q = [];
    for (const i of G.land) if (G.def[i] >= CITY_MIN && G.co[i] === p && !cutFor(p, i, cv)) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      for (let e = 0; e < 6; e++) { const v = G.link[u * 6 + e]; if (v < 0 || dist[v] >= 0 || cutFor(p, v, cv)) continue; dist[v] = dist[u] + 1; par[v] = u; q.push(v); }
    }
    // a legion in a held cell is still supplied when the road reaches any free cell next to it
    for (const L of G.L) {
      if (L.owner !== p || L.dead || dist[L.cell] >= 0) continue;
      let bv = -1; for (let e = 0; e < 6; e++) { const v = G.link[L.cell * 6 + e]; if (v >= 0 && dist[v] >= 0 && (bv < 0 || dist[v] < dist[bv])) bv = v; }
      if (bv >= 0) { dist[L.cell] = dist[bv] + 1; par[L.cell] = bv; }
    }
    const out = { ver: G.ver, dist, par }; G.reach[p] = out; return out;
  }
  const citySupplied = (p, c) => G.def[c] >= CITY_MIN && G.co[c] === p && reachOf(p).dist[c] === 0;

  // ---------- orders ----------
  function planRoute(L, tgt) {
    return findPath(G.link, L.cell, tgt, v => { const o = G.lg[v]; return o && o.owner !== L.owner ? Infinity : 1; });
  }
  function validTarget(L, tgt) {
    if (tgt < 0 || tgt === L.cell || isBlockedCell(tgt)) return false;
    if (G.lg[tgt]) return false;       // a march cannot end on another legion: merging is only done with the split-and-merge order
    return !!planRoute(L, tgt);
  }
  function routeTurns(L, tgt) { const r = planRoute(L, tgt); return r ? Math.max(1, Math.ceil(r.cost / typ(L).budget)) : -1; }
  // command points: a base + for every city the nation owns, its defense ÷ a divisor (rounded down; both are on the params page). A legion's order costs 1;
  // receiving men in a merge and the new legion of a split cost nothing; cancelling an order gives the point back (it is counted from the legions, not stored)
  let _cpKey = '', _cpMax = [], _cpG = null;
  const cpMax = p => {
    const key = G.ver + ':' + G.round; if (key !== _cpKey || _cpG !== G) { _cpKey = key; _cpG = G; _cpMax = []; }
    if (_cpMax[p] == null) { let n = S.cpBase; for (const c of G.land) if (G.def[c] >= CITY_MIN && G.co[c] === p) n += Math.floor(G.def[c] / S.cpDiv); _cpMax[p] = n; }
    return _cpMax[p];
  };
  const cpUsed = p => { const gs = new Set(); let n = 0; for (const L of G.L) if (!L.dead && L.owner === p && L.acted && !L.cpFree) { if (L.grp) gs.add(L.grp); else n++; } return n + gs.size; };
  const cpLeft = p => cpMax(p) - cpUsed(p);
  // what the total is made of, one line each (the tooltip of the card): the base, every city that adds a point, and what has been spent
  const cpLines = p => {
    const out = [tr('cpLBase', S.cpBase)];
    for (const c of G.land) if (G.def[c] >= CITY_MIN && G.co[c] === p) { const k = Math.floor(G.def[c] / S.cpDiv); if (k > 0) out.push(tr('cpLCity', cityName(c), G.def[c], k)); }
    out.push(tr('cpLTotal', cpMax(p)), tr('cpLUsed', cpUsed(p), cpLeft(p)));
    return out;
  };
  const canAct = L => !L.dead && L.owner === G.cur && !L.acted && cpLeft(L.owner) > 0;
  let STEPS = null;       // while the computer plays a turn: the visible orders it gave, replayed one by one with the camera
  const rec = s => { if (STEPS) STEPS.push(s); };
  const snap = L => { L.undo = { st: L.st, tgt: L.tgt, route: L.route, bld: L.bld, atk: L.atk, atkCell: L.atkCell, atkV: L.atkV, ord: L.ordRound }; };
  function orderMarch(L, tgt) {
    if (!canAct(L) || !validTarget(L, tgt)) return false;
    snap(L);
    const rt = planRoute(L, tgt);
    L.st = 'march'; L.tgt = tgt; L.bld = false; L.atk = 0; L.acted = true; L.route = rt ? [L.cell, ...rt.path] : null; L.eta0 = rt ? routeTurns(L, tgt) : 0; L.ordRound = G.round; logMsg('logMarch', [L.owner, { lg: L.id }, { zn: G.zone[L.cell] }, { zn: G.zone[tgt] }], L.owner, true); rec({ k: 'march', id: L.id, p: L.owner, cell: L.cell, to: tgt }); touch(); return true;
  }
  const inRange = (L, T) => { const d = hexDist(L.cell, T.cell), [lo, hi] = rangeOf(L); return d >= lo && d <= hi; };
  // the three cells that meet at the corner of cell c nearest to the world point (wx, wy): what an infantry legion may be told to fire at
  function vertexCells(c, wx, wy) {
    let best = -1, bd = 1e9, bx = 0, by = 0;
    for (let k = 0; k < 6; k++) { const [px, py] = corner(G.X[c], G.Y[c], k), q = (px - wx) ** 2 + (py - wy) ** 2; if (q < bd) { bd = q; best = k; bx = px; by = py; } }
    return [c, ...nbrs(c).filter(n => n >= 0 && G.zone[n] >= 0 && Math.hypot(G.X[n] - bx, G.Y[n] - by) < SZ * 1.05)];
  }
  // clearing rules: fire at a cell, with or without an enemy on it now (infantry: the three cells round a corner, all in range; artillery: the cell and the ring round it)
  function orderStrike(L, cell, vc) {
    if (!G.clearing || !canAct(L) || L.st !== 'alert' || cell == null || cell < 0 || G.zone[cell] < 0) return false;
    const [lo, hi] = rangeOf(L), inR = c => { const k = hexDist(L.cell, c); return k >= lo && k <= hi; };
    if (!inR(cell)) return false;
    if (L.type === 0) { if (!vc || vc.length !== 3 || !vc.includes(cell) || !vc.every(inR)) return false; }
    else vc = null;
    snap(L); L.atk = -1; L.atkCell = cell; L.atkV = vc; L.acted = true; L.ordRound = G.round;
    logMsg('logAtkCell', [L.owner, { lg: L.id }, { zn: G.zone[cell] }], L.owner, true); touch(); return true;
  }
  function orderAttack(L, T, vc) {
    if (!canAct(L) || L.st !== 'alert' || !T || T.dead || T.owner === L.owner || !inRange(L, T)) return false;
    if (vc && L.type === 0) { const [lo, hi] = rangeOf(L); if (vc.length !== 3 || vc.some(c => hexDist(L.cell, c) < lo || hexDist(L.cell, c) > hi)) return false; }       // all three cells of the corner must be in range
    snap(L); L.atk = T.id; L.atkV = vc && vc.includes(T.cell) ? vc : null; L.acted = true; L.ordRound = G.round; logMsg('logAtkOrder', [L.owner, { lg: L.id }, T.owner, { lg: T.id }], L.owner, true); rec({ k: 'atk', id: L.id, p: L.owner, cell: L.cell, to: T.cell, tid: T.id }); touch(); return true;
  }
  function canRepair(L) {
    const c = L.cell;
    return canAct(L) && L.st === 'alert' && !L.bld && G.def[c] < CITY_MAX && (!isCity(c) || G.co[c] === L.owner);
  }
  function orderRepair(L) { if (!canRepair(L)) return false; snap(L); L.bld = true; L.acted = true; logMsg('logRepOrder', [L.owner, { lg: L.id }, { ct: L.cell }], L.owner, true); rec({ k: 'rep', id: L.id, p: L.owner, cell: L.cell, to: -1 }); touch(); return true; }
  function orderHoard(L, n) { if (L.owner === G.cur) { L.hoard = n; return true; } return false; }
  // split off amt men to an adjacent empty cell (a new legion, both halves need the minimum) or into an adjacent friendly legion of the same type (a merge: all the men may go, or what stays needs the minimum)
  // legions that split, take men or are split off do not fire this round
  function orderSplit(L, amt, cell) {
    const T = typ(L); let splitInfo = null;
    if (!canAct(L) || amt < 1 || amt > L.n || !linked(L.cell, cell) || isBlockedCell(cell)) return false;
    const O = G.lg[cell];
    if (O) {
      if (O.owner !== L.owner || O.type !== L.type || (O.acted && !O.recvN) || O.n >= T.cap) return false;       // a legion that already took men in this turn takes more without another action point
      const x = Math.min(amt, T.cap - O.n), share = x === L.n ? L.sup : Math.floor(L.sup * x / L.n);
      if (L.n - x > 0 && L.n - x < T.min) return false;
      O.n += x; O.sup += share; L.n -= x; L.sup -= share; O.recvN = (O.recvN || 0) + 1; if (!O.acted) O.cpFree = true; O.acted = true; O.splitRound = G.round; O.why = ['apMerge', L.id]; splitInfo = { amt: x, tid: O.id }; L.undo = { split: { tid: O.id, amt: x, share, merge: true } };
    } else {
      if (amt < T.min || L.n - amt < T.min) return false;
      const share = Math.floor(L.sup * amt / L.n);
      const N = mkLegion(L.owner, L.type, amt, cell, { sup: share, hoard: L.hoard, acted: true, cpFree: true, splitRound: G.round });
      N.why = ['apSplit', L.id]; splitInfo = { amt, tid: N.id };
      L.undo = { split: { tid: N.id, amt, share, merge: false } };
      N.mv = { from: L.cell, t0: performance.now() };
      L.n -= amt; L.sup -= share;
      if (T.take && isCity(cell) && G.co[cell] !== L.owner) { capture(cell, L.owner); L.undo = null; }       // a split that took a city cannot be taken back
    }
    L.acted = true; L.splitRound = G.round; const sp = { k: 'split', id: L.id, p: L.owner, cell: L.cell, to: cell, amt: splitInfo.amt, tid: splitInfo.tid, merge: !!O };
    const sm = logMsg(sp.merge ? 'evMerge' : 'evSplit', [L.owner, { lg: L.id }, splitInfo.amt, { lg: splitInfo.tid }], L.owner, true);
    if (L.n === 0) { L.undo = null; kill(L); G.L = G.L.filter(x => !x.dead); }       // merged in whole: the legion is gone and the order cannot be taken back
    if (STEPS) rec(sp); else castEvent(logText(sm));          // the computer's steps are announced by their own caption
    touch(); return true;
  }
  // what a city can take right now: room in same-type legions nearby (top-ups) plus empty cells (new legions), minus orders already waiting
  // new troops always come out as new legions (they are never merged into existing ones), so what a city can still take is the free cells in it and round it
  function cityRoomParts(c, p, type) {
    const T = TYPES[type]; let free = 0;
    const cells = [c]; for (let e = 0; e < 6; e++) { const j = G.phys[c * 6 + e]; if (j >= 0) cells.push(j); }
    for (const j of cells) if (!G.lg[j]) free++;
    let pendCells = 0;
    for (const o of G.players[p].pending) if (o.city === c) pendCells += Math.ceil(o.n / TYPES[o.type].cap);
    return { same: 0, total: Math.max(0, free - pendCells) * T.cap };
  }
  const cityRoom = (c, p, type) => cityRoomParts(c, p, type).total;
  // an order makes new legions: at least the minimum men, at most what the free cells hold
  function buyOK(c, p, type, n) {
    const T = TYPES[type], r = cityRoomParts(c, p, type);
    return n >= T.min && n <= r.total;
  }
  function orderBuildUnits(p, c, type, n) {
    const P = G.players[p], T = TYPES[type];
    if (G.def[c] < CITY_MIN || G.co[c] !== p || n < 1 || !citySupplied(p, c)) return false;
    if (P.pending.some(o => o.city === c && o.at === G.round)) return false;       // one order per city per turn
    if (!buyOK(c, p, type, n) || n * T.cost > P.stock) return false;
    P.stock -= n * T.cost; st(p)[4] += n * T.cost; P.pending.push({ city: c, type, n, t: T.build, at: G.round }); logMsg('logBuildOrder', [p, { ct: c }, n, tr('ty_' + T.k)], p, true); rec({ k: 'build', p, cell: c, to: -1, type, n }); return true;
  }

  // ---------- turn pipeline ----------
  // take back an order given earlier in this same turn (before the turn is ended)
  function cancelOrder(L) {
    const u = L && L.undo; if (!u || !L.acted || L.dead || L.owner !== G.cur) return false;
    if (u.split) {
      const N = G.L.find(x => x.id === u.split.tid); if (!N || N.dead) return false;
      if (u.split.merge) { if (N.n < u.split.amt) return false; N.n -= u.split.amt; N.sup = Math.max(0, N.sup - u.split.share); N.recvN = Math.max(0, (N.recvN || 1) - 1); if (!N.recvN) { N.acted = false; N.why = null; N.splitRound = 0; } L.n += u.split.amt; L.sup += u.split.share; }
      else { if (N.cell == null) return false; L.n += N.n; L.sup += N.sup; kill(N); G.L = G.L.filter(x => !x.dead); }
    } else { L.st = u.st; L.tgt = u.tgt; L.route = u.route; L.bld = u.bld; L.atk = u.atk; L.atkCell = u.atkCell; L.atkV = u.atkV; L.ordRound = u.ord; }
    L.acted = false; L.undo = null; L.splitRound = 0; touch(); return true;
  }
  function cancelBuild(p, o) {
    const P = G.players[p], i = P.pending.indexOf(o); if (i < 0 || o.at !== G.round || p !== G.cur) return false;
    P.pending.splice(i, 1); P.stock += o.n * TYPES[o.type].cost; st(p)[4] -= o.n * TYPES[o.type].cost; touch(); return true;
  }
  function startTurn(p) {
    for (const L of G.L) if (L.owner === p) { L.acted = false; L.undo = null; L.why = null; L.recvN = 0; L.cpFree = false; L.grp = 0; }
    const me = viewer(), S0 = G.sel;
    if (S0 >= 0 && !((G.lg[S0] && G.lg[S0].owner === me) || (G.def[S0] > 0 && G.co[S0] === me))) G.sel = -1;
    G.mode = null; G.flash = '';
  }
  function hitRate(S_, T_) {
    return (S_.type === 0 ? S.hitInf : S.hitArt) || TYPES[S_.type].hit;      // set when the game starts, the same for every nation
  }
  function targetsIn(L) {
    const [lo, hi] = rangeOf(L), out = [];
    for (const c of within(L.cell, hi)) { const T = G.lg[c]; if (T && T.owner !== L.owner && !T.dead && hexDist(L.cell, c) >= lo) out.push(T); }
    return out.sort((a, b) => hexDist(L.cell, a.cell) - hexDist(L.cell, b.cell) || b.n - a.n);
  }
  function rollHits(n, pct) { let h = 0; for (let k = 0; k < n; k++) if (Math.random() * 100 < pct) h++; return h; }

  // 1. a player's marching legions move as soon as the turn ends, one cell at a time; stepping into a hostile infantry's range ends the march
  // (the legion still counts as marching this round). Nobody fires yet.
  // one legion walks its march for this turn (as far as its budget allows, stopped by hostile infantry range); returns true when it moved
  // where a marching legion would end up this turn: the route, how far its budget takes it, where it would merge, and whether hostile infantry range stops it
  function planMarch(L, cv) {
    cv = cv || cover();
    if (L.dead || L.st !== 'march' || L.tgt == null) return null;
    const T = typ(L), route = planRoute(L, L.tgt);
    if (!route) return { cancel: true };
    let budget = T.budget, last = -1, merge = -1, hit = false, blocked = false;
    const path = route.path;
    for (let k = 0; k < path.length && budget >= 1; k++) {
      budget--;
      const c = path[k], occ = G.lg[c];
      if (occ && occ.owner === L.owner) { if (k === path.length - 1) blocked = true; }       // a friend on the last cell: the march ends before it
      else last = k;
      if ((cv.inf[c] & ~(1 << L.owner)) !== 0) { hit = true; break; }
      if (merge === k) break;
    }
    return { path, last, merge, hit, blocked, at: last };
  }
  // one legion walks its march for this turn (as far as its budget allows, stopped by hostile infantry range); returns true when it moved
  function marchLegion(L, cv) {
    const P = planMarch(L, cv);
    if (!P) return false;
    if (P.cancel) { L.tgt = null; ev('evCancelMarch', [L.owner, { lg: L.id }], L.owner); return false; }
    const T = typ(L), { path, last, hit } = P;
    const at = P.at, merge = P.merge;
    const z0 = G.zone[L.cell];
    let moved = false;
    if (at >= 0) {
      moved = true;
      if (T.take) for (let k = 0; k < at; k++) { const c = path[k]; if (isCity(c) && G.co[c] !== L.owner && !G.lg[c]) capture(c, L.owner); }
      if (merge >= 0) {
        const A = G.lg[path[at]], x = Math.min(L.n, T.cap - A.n), share = Math.floor(L.sup * x / L.n);
        A.n += x; A.sup += share; L.n -= x; L.sup -= share; capSup(A);
        if (L.n <= 0) { L.dead = true; G.lg[L.cell] = null; touch(); return true; }
        if (last >= 0) moveLegion(L, path[last]);          // what does not fit stays behind
        L.tgt = null; logMsg('logArrive', [L.owner, { lg: L.id }, { zn: G.zone[path[at]] }], L.owner, true); return true;
      }
      moveLegion(L, path[at]);
    }
    if (hit || P.blocked || at < 0 || at === path.length - 1) L.tgt = null;
    if (moved) {      // the log says how the march went: arrived, stopped, or still under way (with the zone it is in and the turns left)
      const z1 = G.zone[L.cell];
      if (L.tgt == null) logMsg(hit && at !== path.length - 1 ? 'logStopped' : 'logArrive', [L.owner, { lg: L.id }, { zn: z1 }], L.owner, true);
      else logMsg(z1 !== z0 ? 'logCross' : 'logOnway', [L.owner, { lg: L.id }, { zn: z1 }, routeTurns(L, L.tgt)], L.owner, true);
    }
    return moved;
  }
  // the end of a player's turn: the marches that have not been walked yet (the computer walks each one as its own step)
  function stepMarch(p) {
    const cv = cover(); let any = false;
    for (const L of G.L.filter(x => x.owner === p && x.st === 'march' && x.tgt != null && !x.dead && x.mvRound !== G.round)) if (marchLegion(L, cv)) any = true;
    G.L = G.L.filter(x => !x.dead);
    touch(); return any;
  }

  // ---------- the clearing rules (menu → rules): during the turns every order is only noted; at the end of the round it is cleared in layers ----------
  // layer 2: the legions that were not told to do anything fix the cell they will shoot at (the nearest enemy in range), and the attack orders fix theirs
  // the cells one shot covers: a battery hits the chosen cell and the ring of six round it; infantry covers the chosen cell and the two neighbours of it that touch each other
  // and lie nearest to the legion (all inside its range), and hits only the nearest enemy among them
  function strikeCells(L, c) {
    if (L.type === 1) return [c, ...nbrs(c).filter(x => x >= 0)];
    const [lo, hi] = rangeOf(L), ok = x => x >= 0 && hexDist(L.cell, x) >= lo && hexDist(L.cell, x) <= hi;
    const ns = nbrs(c).filter(ok), d = x => hexDist(L.cell, x);
    let best = null, bs = 1e9;
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (nbrs(ns[i]).includes(ns[j]) && d(ns[i]) + d(ns[j]) < bs) { bs = d(ns[i]) + d(ns[j]); best = [ns[i], ns[j]]; }
    return [c, ...(best || ns.slice(0, 2))];
  }
  function declareStrikes() {
    const out = [];
    if (G.round === 1) { for (const L of G.L) L.atk = 0; return out; }      // turn 1 is a ceasefire so every nation can set up
    for (const L of G.L) {
      if (L.dead) continue;
      if (L.atk) {
        const id = L.atk, T = id > 0 ? G.L.find(x => x.id === id) : null, av = L.atkV, ac = id > 0 ? (T ? T.cell : -1) : L.atkCell;
        L.atk = 0; L.atkV = null; L.atkCell = null;
        const [lo, hi] = rangeOf(L), inR = c => { const k = hexDist(L.cell, c); return k >= lo && k <= hi; };
        if (ac >= 0 && L.st === 'alert' && inR(ac) && L.firedRound !== G.round) out.push({ s: L, cell: ac, cells: L.type === 0 && av ? av.filter(inR) : strikeCells(L, ac), active: true });
        else ev('evCancelAtk', [L.owner, { lg: L.id }, id > 0 && (!T || T.dead) ? tr('evGone') : L.st !== 'alert' ? tr('evNotAlert') : tr('evOutRange')], L.owner);
        continue;
      }
      if (L.st !== 'alert' || L.firedRound === G.round) continue;
      const ts = targetsIn(L); if (ts.length) out.push({ s: L, cell: ts[0].cell, cells: strikeCells(L, ts[0].cell) });
    }
    return out;
  }
  // layer 3a: every marching legion walks at the same time; if the cell it was heading for is also wanted by another legion (or is taken) it stops on the cell before it
  // on its route, or does not move at all when there is none: the march order stays and is tried again next round
  // how long each unit's part of the clearing is shown (ms): the setting, shorter when there are many, none while fast-forwarding
  const clrStep = () => quick() ? 0 : Math.round(1000 * (S.step || 1.5));       // the same pause as every step of the turn-based play
  // the camera visits the units of the clearing one after the other (not while paused, in fast-forward, or for what the fog hides)
  // the order of play: region by region (each zone's items together, nearest next), so the view does not jump from one end of the map to the other
  function byRegion(items, cellOf) {
    const zs = new Map();
    for (const it of items) { const z = G.zone[cellOf(it)]; if (!zs.has(z)) zs.set(z, []); zs.get(z).push(it); }
    const dist = (a, b) => Math.hypot(G.X[a] - G.X[b], G.Y[a] - G.Y[b]);
    const chain = (list, from) => {       // nearest next, starting at the item closest to `from` (the top-left corner at first)
      const out = []; let cur = from; list = list.slice();
      while (list.length) { let bi = 0, bd = 1e18; list.forEach((it, i) => { const d = cur < 0 ? G.Y[cellOf(it)] * 4 + G.X[cellOf(it)] : dist(cur, cellOf(it)); if (d < bd) { bd = d; bi = i; } }); const it = list.splice(bi, 1)[0]; out.push(it); cur = cellOf(it); }
      return out;
    };
    const rest = [...zs.values()], out = []; let cur = -1;
    while (rest.length) {
      let bi = 0, bd = 1e18;
      rest.forEach((ls, i) => { const d = Math.min(...ls.map(it => cur < 0 ? G.Y[cellOf(it)] * 4 + G.X[cellOf(it)] : dist(cur, cellOf(it)))); if (d < bd) { bd = d; bi = i; } });
      const ordered = chain(rest.splice(bi, 1)[0], cur); out.push(...ordered); cur = cellOf(ordered[ordered.length - 1]);
    }
    return out;
  }
  const camStep = (cell, ms) => {       // the view follows every step (the camera button turns it off); one glide per step, always shorter than the step
    const g = G; if (g._camOff || quick()) return;
    if (S.fog) { const fv = visMask(viewer()); if (!fv || !fv[cell]) return; }
    camTo(g.X[cell], g.Y[cell], Math.max(150, Math.min(450, ms * 0.6)));
  };
  const clrCam = (cell, delay) => { const g = G, ms = clrStep(); setTimeout(() => { if (G === g) camStep(cell, ms); }, delay); };
  const clrPop = (cell, txt, c, delay) => G.pops.push({ cell, txt, c, t0: performance.now() + delay });
  function clearMoves() {
    const cv = cover(), ent = new Map(), rep = { moved: 0, arrived: 0, near: 0, stay: 0 };
    for (const L of G.L) {
      if (L.dead || L.st !== 'march' || L.tgt == null) continue;
      const P = planMarch(L, cv); if (!P) continue;
      if (P.cancel) { L.tgt = null; ev('evCancelMarch', [L.owner, { lg: L.id }], L.owner); continue; }
      if (P.at < 0) { L.tgt = null; continue; }
      ent.set(L, { P, at: P.at, at0: P.at, tz: G.zone[L.tgt] });
    }
    if (!ent.size) return null;
    const moves = e => e.at >= 0, endCell = (L, e) => moves(e) ? e.P.path[e.at] : L.cell;
    const takesIn = () => false;       // marching never merges
    for (let guard = 0; guard < 16; guard++) {
      const by = new Map();
      for (const L of G.L) { if (L.dead) continue; const e = ent.get(L), c = e ? endCell(L, e) : L.cell; if (!by.has(c)) by.set(c, []); by.get(c).push(L); }
      let clash = false;
      for (const ls of by.values()) {
        if (ls.length < 2) continue;
        const arr = ls.filter(L => ent.has(L) && moves(ent.get(L))), home = ls.filter(L => !(ent.has(L) && moves(ent.get(L))));
        if (!arr.length || (home.length === 1 && arr.every(L => takesIn(L, home[0])))) continue;
        for (const L of arr) ent.get(L).at--;
        clash = true;
      }
      if (!clash) break;
    }
    const movers = [...ent].filter(([, e]) => moves(e)), from = new Map(movers.map(([L]) => [L, L.cell])), merges = [];
    const stepMs = clrStep(ent.size), delay = new Map(byRegion([...ent.keys()], L => L.cell).map((L, i) => [L, i * stepMs]));       // one unit after the other
    rep.ms = stepMs ? ent.size * stepMs + stepMs : 0;
    if (stepMs) for (const [L, e] of ent) clrCam(L.cell, delay.get(L) || 0);
    for (const [L] of movers) G.lg[L.cell] = null;       // everybody leaves first, so that two legions can pass each other
    const stand = (L, c) => { const from0 = from.get(L); G.lg[c] = L; L.cell = c; L.mv = { from: from0, t0: performance.now() + (delay.get(L) || 0) }; if (typ(L).take && isCity(c) && G.co[c] !== L.owner) capture(c, L.owner); };
    for (const [L, e] of movers) {
      const c = e.P.path[e.at], A = G.lg[c];
      if (A && takesIn(L, A)) { merges.push([L, e, A]); continue; }
      if (A) { G.lg[L.cell] = L; e.at = -1; continue; }
      if (typ(L).take) for (let k = 0; k < e.at; k++) { const q = e.P.path[k]; if (isCity(q) && G.co[q] !== L.owner && !G.lg[q]) capture(q, L.owner); }
      stand(L, c);
    }
    for (const [L, e, A] of merges) {
      const T = typ(L), x = Math.min(L.n, T.cap - A.n), share = Math.floor(L.sup * x / L.n);
      A.n += x; A.sup += share; L.n -= x; L.sup -= share; capSup(A);
      if (L.n <= 0) { L.dead = true; continue; }
      const spot = [e.P.last >= 0 ? e.P.path[e.P.last] : -1, from.get(L)].find(c => c >= 0 && !G.lg[c]);
      if (spot === undefined) { L.dead = true; continue; }
      stand(L, spot);
    }
    for (const [L, e] of ent) {
      if (L.dead) continue;
      const { P } = e, arrivedAt = e.at === P.path.length - 1, tz = { zn: e.tz };
      { const dl = (delay.get(L) || 0) + (moves(e) ? 340 : 120), tag = !moves(e) ? ['被阻挡在原地', '#ffb020'] : arrivedAt ? ['抵达', '#7dffb0'] : (e.at < e.at0 || P.blocked) ? ['被阻挡在半路', '#ffb020'] : P.hit ? ['被敌军拦下', '#ffb020'] : null; if (tag && stepMs) clrPop(moves(e) ? L.cell : L.cell, tag[0], tag[1], dl); }
      if (moves(e) && merges.some(m => m[0] === L)) { L.tgt = null; rep.moved++; rep.arrived++; logMsg('logClrArrive', [L.owner, { lg: L.id }, tz], L.owner, true); continue; }
      if (!moves(e)) { rep.stay++; logMsg('logClrStay', [L.owner, { lg: L.id }, tz], L.owner, true); continue; }
      rep.moved++;
      if (arrivedAt) { L.tgt = null; rep.arrived++; logMsg('logClrArrive', [L.owner, { lg: L.id }, tz], L.owner, true); }
      else if (e.at < e.at0 || P.blocked) { if (P.blocked) L.tgt = null; rep.near++; logMsg('logClrNear', [L.owner, { lg: L.id }, tz, { zn: G.zone[L.cell] }], L.owner, true); }
      else if (P.hit) { L.tgt = null; logMsg('logStopped', [L.owner, { lg: L.id }, { zn: G.zone[L.cell] }], L.owner, true); }
      else logMsg(G.zone[L.cell] !== G.zone[from.get(L)] ? 'logCross' : 'logOnway', [L.owner, { lg: L.id }, { zn: G.zone[L.cell] }, routeTurns(L, L.tgt)], L.owner, true);
    }
    G.L = G.L.filter(x => !x.dead); touch();
    return rep;
  }
  // layer 3b: the shots fixed in layer 2 land on whatever stands on those cells now: a legion that left is not hit, one that came in is
  // who a fixed strike hits now (an empty list: it hits nothing)
  function strikeHits(k) {
    const L = k.s, cells = k.cells || [k.cell];
    if (L.type === 1) return cells.map(c => G.lg[c]).filter(T => T && !T.dead && T !== L && (T.cell === k.cell ? (T.owner === L.owner || inRange(L, T)) : true));       // the splash round the centre does not need to be in range
    const T = cells.map(c => G.lg[c]).filter(T => T && !T.dead && T.owner !== L.owner && inRange(L, T)).sort((a, b) => hexDist(L.cell, a.cell) - hexDist(L.cell, b.cell) || b.n - a.n)[0];
    return T ? [T] : [];
  }
  // before the shots land, the fixed strikes are shown one after the other: the area each unit aims at (a miss is marked); returns how long that takes
  function clearAim(strikes) {
    const ks = byRegion(strikes.filter(k => !k.s.dead), k => k.cell), st = clrStep(ks.length); if (!st || !ks.length) return 0;
    G._aim = G._aim || [];
    ks.forEach((k, i) => { const dl = i * st; clrCam(k.cell, dl); G._aim.push({ s: k.s.cell, cells: k.cells || [k.cell], t0: performance.now() + dl, miss: !strikeHits(k).length });
      if (!strikeHits(k).length) clrPop(k.cell, '打空', '#cfd5da', dl + 450); });
    return ks.length * st + st;
  }
  async function clearFire(strikes) {
    const evs = [], rep = { shots: 0, miss: 0 };
    for (const k of strikes) {
      const L = k.s; if (L.dead) continue;
      const tg = strikeHits(k);
      if (!tg.length) { rep.miss++; logMsg('logClrMiss', [L.owner, { lg: L.id }, { zn: G.zone[k.cell] }], L.owner, true); continue; }
      for (const T of tg) evs.push({ s: L, t: T, auto: !k.active, half: L.type === 1 && T.cell !== k.cell, fr: T.owner === L.owner });       // splash round the centre does half damage
    }
    rep.shots = evs.length;
    if (evs.length) await resolveFireSeq(evs, G.round, clrStep(evs.length));
    return rep;
  }

  // 2. at the end of the round every legion that can fire does so at once. A legion with an attack command shoots only its named target;
  // every other alert legion shoots the nearest enemy in range (the bigger one if tied). All casualties are settled together.
  function fireRound() {
    const round = G.round;
    if (round === 1) { for (const L of G.L) L.atk = 0; return false; }      // turn 1 is a ceasefire so every nation can set up
    const evs = [], byId = new Map(), firing = new Set();
    for (const L of G.L) byId.set(L.id, L);
    for (const L of G.L) {
      if (!L.atk) continue;
      const T = byId.get(L.atk); L.atk = 0;
      if (L.firedRound === round) continue;
      if (!T || T.dead || L.st !== 'alert' || !inRange(L, T)) { ev('evCancelAtk', [L.owner, { lg: L.id }, !T || T.dead ? tr('evGone') : L.st !== 'alert' ? tr('evNotAlert') : tr('evOutRange')], L.owner); continue; }
      evs.push({ s: L, t: T }); firing.add(L.id);
    }
    for (const L of G.L) {
      if (L.dead || L.st !== 'alert' || firing.has(L.id) || L.firedRound === round || L.splitRound === round) continue;
      const ts = targetsIn(L); if (!ts.length) continue;
      evs.push({ s: L, t: ts[0], auto: true });
    }
    if (!evs.length) return false;
    resolveFire(evs, round); return true;
  }
  // an attack order carried out right now (the computer's step): the legion fires at its target at once, with sound, instead of waiting for the end of the round
  function fireNow(L, T) {
    if (!L || !T) return false;
    if (G.round === 1) { L.atk = 0; return false; }       // ceasefire
    if (L.dead || T.dead || L.st !== 'alert' || !inRange(L, T) || L.firedRound === G.round) return false;
    L.atk = 0; L.firedRound = G.round; L.undo = null; resolveFire([{ s: L, t: T }], G.round); touch(); return true;
  }
  // a player's attack order: under the turn-by-turn rules it is fired at once, like the computer's (the clearing rules wait for the end of the round)
  function attackNow(L, T, vc) {
    if (!orderAttack(L, T, vc)) return false;
    if (!G.clearing) fireNow(L, T);
    return true;
  }
  // shots are fired and their damage applied: at the end of a round for everybody's alert fire, or at once for an order the computer carries out step by step
  // the dice are thrown for every shot at once; then the hits on each target are applied (all together, or one target after the other for the clearing rules' show)
  function rollShots(evs, round) {
    const dmg = new Map();
    for (const e of evs) {
      e.rate = hitRate(e.s, e.t); e.hits = rollHits(e.s.n, e.rate); e.men = e.s.n;
      let d = dmg.get(e.t); if (!d) dmg.set(e.t, d = { D: 0, by: [] });
      d.D += e.hits * TYPES[e.s.type].dmg * (e.half ? 0.5 : 1); d.by.push(e);
      e.s.eng = round; e.t.eng = round; e.s.fired = true;
    }
    return dmg;
  }
  function applyShots(T, d) {
    for (const e of d.by) G.fx.push({ a: e.s.cell, b: e.t.cell, hits: e.hits, t0: performance.now(), o: e.s.owner });
    const tb = T.n, wasCity = G.def[T.cell] >= CITY_MIN && G.co[T.cell] === T.owner;
    let razedPts = 0;
    const c = T.cell;
    // each attack is worked out on its own: the walls take the set share of its damage (1 point of defense per point of damage, while they last), the men the rest
    let baseWall = 0, wallD = 0;       // the share of the damage the walls would take, and what it comes to after the siege multiplier of each attacker (batteries wreck walls)
    if (G.def[c] > 0) for (const e of d.by) { const b = Math.floor(e.hits * TYPES[e.s.type].dmg * (e.half ? 0.5 : 1) * S.share / 100); baseWall += b; wallD += Math.floor(b * TYPES[e.s.type].sg); }
    if (wallD > 0) { razedPts = Math.min(G.def[c], wallD); G.def[c] -= razedPts; if (G.def[c] === 0) cityFalls(c); }
    let loss = Math.floor((d.D - (wallD > 0 ? Math.floor(baseWall * razedPts / wallD) : 0)) / typ(T).per);
    { const men = Math.min(T.n, loss); st(T.owner)[12 + T.type] += men;
      for (const e of d.by) { const sh = d.D > 0 && e.s.owner !== T.owner ? e.hits * TYPES[e.s.type].dmg * (e.half ? 0.5 : 1) / d.D : 0, a = st(e.s.owner); addHate(T.owner, e.s.owner, (men + razedPts * 0.3) * sh + 1); a[9 + T.type] += men * sh; a[11] += men * sh * TYPES[T.type].cost; a[18] += razedPts * sh; } }
    if (loss > 0 && T.n > 0) T.sup = Math.floor(T.sup * Math.max(0, T.n - loss) / T.n);       // the supplies carried shrink with the men: what the dead carried is lost
    T.n -= loss;
    const left = Math.max(0, T.n); let routed = false;
    if (T.n > 0 && T.n < typ(T).min) {       // too few men left to hold together: the legion routs, the rest of the men and its supplies are gone
      routed = true; const rem = T.n; st(T.owner)[12 + T.type] += rem;
      for (const e of d.by) { const sh = d.D > 0 && e.s.owner !== T.owner ? e.hits * TYPES[e.s.type].dmg * (e.half ? 0.5 : 1) / d.D : 0, a = st(e.s.owner); addHate(T.owner, e.s.owner, rem * sh); a[9 + T.type] += rem * sh; a[11] += rem * sh * TYPES[T.type].cost; }
      T.n = 0;
    }
    if (loss > 0) G.pops.push({ cell: c, txt: '−' + loss, t0: performance.now() });
          for (const e of d.by) logMsg('logFire', [e.s.owner, { lg: e.s.id }, T.owner, { lg: T.id }, e.hits, e.men, e.rate, Math.floor(e.hits * TYPES[e.s.type].dmg * (e.half ? 0.5 : 1) / typ(T).per), { zn: G.zone[T.cell] }, e.fr ? 3 : e.half ? 2 : e.auto ? 1 : 0, tb, left], e.s.owner);
    if (T.n <= 0) {
      const foes = d.by.filter(e => e.s.owner !== T.owner), top = (foes.length ? foes : d.by).reduce((m, e) => { const v = e.hits * TYPES[e.s.type].dmg * (e.half ? 0.5 : 1); return v > m.v ? { v, e } : m; }, { v: -1, e: d.by[0] }).e, bump = (p, i) => { const a = st(p); a[i] = (a[i] || 0) + 1; };
      bump(top.s.owner, routed ? 21 : 20); bump(T.owner, routed ? 23 : 22);
      if (wasCity && S.breakBonus > 0) { G.players[top.s.owner].stock += S.breakBonus; st(top.s.owner)[0] += S.breakBonus; ecoEv(top.s.owner, 'brk', S.breakBonus, T.cell); logMsg('logBreak', [top.s.owner, { ct: T.cell }, S.breakBonus], top.s.owner); }       // the garrison of a city was wiped out or routed
      logMsg(routed ? 'logRout' : 'logDead', [T.owner, { lg: T.id }], T.owner);
      kill(T);
    }
  
  }
  function resolveFire(evs, round) {
    const dmg = rollShots(evs, round);
    for (const [T, d] of dmg) applyShots(T, d);
    G.L = G.L.filter(x => !x.dead);
    evs.slice(0, 6).forEach((e, i) => (e.s.type === 1 ? snd.cannon(i * 0.25) : snd.gun(i * 0.25, e.men)));       // guns and cannon, one after another
    touch();
  }
  // the clearing rules: the same result, shown one target after the other
  async function resolveFireSeq(evs, round, stepMs) {
    const g = G, dmg = rollShots(evs, round); let n = 0;
    for (const [T, d] of byRegion([...dmg], x => x[0].cell)) {
      if (G !== g) return;
      const cell = T.cell; applyShots(T, d);
      G.L = G.L.filter(x => !x.dead); touch(); requestDraw();
      const e0 = d.by[0]; (e0.s.type === 1 ? snd.cannon(0) : snd.gun(0, e0.men));
      if (stepMs) { camStep(cell, stepMs); await sleep(stepMs); }
      n++;
    }
    G.L = G.L.filter(x => !x.dead); touch();
  }

  // 3. supplies: production, city upkeep, shipments on the road, repairs, meals, starvation
  // a zone belongs to whoever holds its big cities, in proportion to how many each holds; a zone without a big city belongs to nobody
  function zoneShares() {
    const sh = new Array(G.Z.length).fill(null);
    for (let c = 0; c < G.def.length; c++) {
      if (!(G.def[c] >= CITY_MIN) || G.co[c] < 0 || G.zone[c] < 0) continue;
      const z = G.zone[c]; let m = sh[z]; if (!m) sh[z] = m = new Map(); m.set(G.co[c], (m.get(G.co[c]) || 0) + 1);
    }
    return sh;
  }
  function incomeFor(p) {
    const sh = zoneShares(); let inc = cityTax(p);       // every big city produces a share of its size each turn
    G.Z.forEach((z, zi) => {
      z.shares = sh[zi];
      const m = sh[zi];
      if (m && m.size) {
        let tot = 0; for (const v of m.values()) tot += v;
        if (m.size === 1) z.holder = [...m.keys()][0];
        inc += z.out * (m.get(p) || 0) / tot;
      } else z.holder = -1;
    });
    return Math.round(inc);
  }
  function artLoss(p, from) {      // percentage points lost to enemy batteries covering the route
    const cv = cover(), r = reachOf(p), own = cv.artOwn.get(p); let loss = 0;
    for (let c = from; c >= 0; c = r.par[c]) loss += cv.artTot[c] - (own ? own[c] : 0);
    return loss;
  }
  function economy(p) {
    const P = G.players[p];
    if (G.hate && G.hate[p]) for (let q = 0; q < G.hate[p].length; q++) G.hate[p][q] *= 0.96;       // hatred cools off
    // production, then what the big cities and building sites cost to keep up
    P.income = incomeFor(p);
    P.stock += P.income; st(p)[0] += P.income;
    let cityCost = 0;
    for (const c of G.land) {
      if (!G.def[c] || G.co[c] !== p) continue;
      const cost = cityUpkeep(G.def[c]);
      if (P.stock >= cost) { P.stock -= cost; cityCost += cost; }
      else { G.def[c] = Math.max(0, G.def[c] - 10); if (G.def[c] === 0) cityFalls(c); else logMsg('logCityDecay', [p], p); }
    }
    P.cityCost = cityCost; st(p)[1] += cityCost;
    // shipments already on the road
    const transit = new Map();
    G.ship = G.ship.filter(s => {
      const L = G.L.find(x => x.id === s.lid && !x.dead);
      if (!L) return false;
      if (L.owner !== p) return true;
      if (--s.t <= 0) { L.sup += s.amt; return false; }
      transit.set(L.id, (transit.get(L.id) || 0) + s.amt); return true;
    });
    // legions ordered to repair add 1 point of defense per man, paid from their own supplies (5 each); a site becomes a big city from CITY_MIN (200) points
    for (const L of G.L) {
      if (L.owner !== p || !L.bld) continue;
      const c = L.cell;
      if (L.st !== 'alert' || G.def[c] >= CITY_MAX || (isCity(c) && G.co[c] !== p)) { if (G.def[c] < CITY_MAX) ev('evCancelRep', [p, { lg: L.id }], p); L.bld = false; continue; }
      const pts = Math.min(L.n * typ(L).bsp, CITY_MAX - G.def[c], Math.floor(L.sup / BUILD_COST));
      if (pts <= 0) continue;
      const was = G.def[c] >= CITY_MIN;
      L.sup -= pts * BUILD_COST; G.def[c] += pts; G.co[c] = p; st(p)[6] += pts * BUILD_COST; st(p)[19] += pts;
      // the bonus is for a new city only: a city that dropped below the threshold and is repaired back gets nothing (the cell remembers it was a city until it falls)
      if (!was && G.def[c] >= CITY_MIN && !G.wasCity[c]) { G.wasCity[c] = 1; logMsg('logBuilt', [p, { ct: c }], p); if (S.buildBonus > 0) { P.stock += S.buildBonus; st(p)[0] += S.buildBonus; logMsg('logBuildBonus', [p, { ct: c }, S.buildBonus], p); ecoEv(p, 'bld', S.buildBonus, c); } }
      if (G.def[c] >= CITY_MAX) { L.bld = false; ev('evMax', [p, { ct: c }, CITY_MAX], p); }
    }
    // send supplies: fighting legions first, then the ones closest to the enemy
    const rr = reachOf(p), foes = G.L.filter(x => x.owner !== p), want = [];
    for (const L of G.L) { if (L.owner !== p || L.hoard <= 0) continue; const cut = rr.dist[L.cell] < 0; if (cut && !L.cut) ev('evCut', [p, { lg: L.id }], p); L.cut = cut; }
    for (const L of G.L) {
      if (L.owner !== p || L.hoard <= 0) continue;
      const need = Math.min(L.hoard, SUP_MAX_TURNS) * L.n * typ(L).eat - L.sup - (transit.get(L.id) || 0);
      if (need <= 0) continue;
      let fd = 99; for (const F of foes) { const d = hexDist(L.cell, F.cell); if (d < fd) fd = d; }
      want.push({ L, need, key: (L.eng >= G.round - 1 ? 0 : 1000) + fd });
    }
    // a city can only feed as much per turn as its size (defense points): the men in the city itself first, then the legions around it
    const capLeft = new Map(), rootOf = c => { let x = c, g = 0; while (rr.dist[x] > 0 && rr.par[x] >= 0 && g++ < 500) x = rr.par[x]; return x; };
    for (const w of want) if (rr.dist[w.L.cell] === 0) w.key = -1;
    want.sort((a, b) => a.key - b.key);
    for (const w of want) {
      if (P.stock <= 0) break;
      const L = w.L, d = rr.dist[L.cell]; if (d < 0) continue;
      const root = rootOf(L.cell); if (!capLeft.has(root)) capLeft.set(root, G.def[root] >= CITY_MIN && G.co[root] === p ? Math.floor(G.def[root] * S.supCap) : 1e9);
      const room = capLeft.get(root); if (room <= 0) continue;
      const extra = Math.max(0, Math.ceil(d / 6) - 1);
      const loss = Math.min(1, 0.01 * d + artLoss(p, L.cell) / 100);
      if (loss >= 1) { const burn = Math.min(P.stock, room, w.need); if (burn > 0) { capLeft.set(root, room - burn); P.stock -= burn; st(p)[2] += burn; st(p)[3] += burn; } continue; }       // all of it is lost on the road: same as cut off, but the supplies are still spent
      const send = Math.min(P.stock, room, Math.ceil(w.need / (1 - loss))), eff = Math.floor(send * (1 - loss));
      if (eff <= 0) continue;
      capLeft.set(root, room - send); P.stock -= send; st(p)[2] += send; st(p)[3] += send - eff;
      if (extra === 0) L.sup += eff; else G.ship.push({ lid: L.id, amt: eff, t: extra });
    }
    // meals: one portion a turn, two in a turn the legion fired
    let upk = 0;
    for (const L of G.L) {
      if (L.owner !== p) continue;
      capSup(L);
      const c = supCost(L) * (L.fired ? 2 : 1); upk += c; L.fired = false;
      if (L.sup >= c) { L.sup -= c; L.starve = 0; st(p)[5] += c; }
      else {
        L.sup = 0; L.starve++;
        if (L.starve >= STARVE_AFTER) {
          const lost = Math.min(L.n, L.type === 0 ? 2 : 1); L.n -= lost; st(p)[14] += lost;
          G.pops.push({ cell: L.cell, txt: '−' + lost, t0: performance.now() });
          logMsg('logStarve', [p, { lg: L.id }, lost], p);
          if (L.n <= 0) kill(L);
        }
      }
    }
    P.upkeep = upk;
    G.L = G.L.filter(x => !x.dead);
    // production orders
    const keep = [];
    for (const o of P.pending) {
      if (G.co[o.city] !== p || G.def[o.city] < CITY_MIN) { logMsg('logOrderLost', [p, { ct: o.city }, o.n, tr('ty_' + TYPES[o.type].k), tr(G.co[o.city] !== p ? 'orderWhyCap' : 'orderWhySite')], p); continue; }
      if (o.t > 0) o.t--;
      if (o.t > 0) { keep.push(o); continue; }
      if (!spawn(p, o)) { keep.push(o); if (!o.w) { o.w = 1; logMsg('logBuildWait', [p, { ct: o.city }, o.n, tr('ty_' + TYPES[o.type].k)], p); } }
    }
    P.pending = keep;
    touch();
  }
  function spawn(p, o) {
    const T = TYPES[o.type], cells = [o.city];
    for (let e = 0; e < 6; e++) { const j = G.phys[o.city * 6 + e]; if (j >= 0) cells.push(j); }
    const free = cells.filter(j => !G.lg[j]), k = Math.ceil(o.n / T.cap);
    if (k > free.length) return false;       // no room yet: waits
    let left = o.n; const per = T.eat * HOARD_DEFAULT;
    for (let m = 0; m < k; m++) { const a = Math.ceil(left / (k - m)), N = mkLegion(p, o.type, a, free[m], { sup: a * per }); left -= a; logMsg('logSpawn', [p, tr('ty_' + T.k), a, { ct: o.city }, { lg: N.id }], p); }
    st(p)[7 + o.type] += o.n;
    if (G.players[p].human) snd.reinforce();
    return true;
  }

  function checkAlive() {
    for (const P of G.players) {
      if (!P.alive) continue;
      const has = G.L.some(L => L.owner === P.id) || G.land.some(i => G.def[i] >= CITY_MIN && G.co[i] === P.id);
      if (!has) { P.alive = false; logMsg('logOut', [P.id], P.id); P.pending = []; }
    }
    touch();
  }
  function checkOver() {
    const al = alivePlayers();
    if (G.players.some(p => p.everHuman) && !G.players.some(p => p.everHuman && p.alive)) { G.over = true; G.win = -1; }
    else if (al.length <= 1) { G.over = true; G.win = al[0] ?? -1; }
    if (G.over) showOver();
    return G.over;
  }
  // every N rounds (a setting, default 100) the game stops and asks: carry on, or end it now (the nation with the most big cities wins). Nothing is decided automatically.
  function showCheckpoint() {
    $('cpTitle').textContent = tr((G.cpCount || 1) <= 1 ? 'cpFirst' : 'cpAgain', G.cpEvery || 100);
    $('cpModal').hidden = false; ui(true); requestDraw();
  }
  function checkpointGo(end) {
    $('cpModal').hidden = true;
    if (!G) return;
    if (end) { timeLimit(); ui(true); return; }
    G.pause = 0; ui(true); requestDraw();
    if (!G.over && !G.players[G.cur].human && !G.aiRunning) runAI();
  }
  function timeLimit() {
    // most big cities wins; ties go to the larger total city defense, then the larger army
    const score = p => { let n = 0, d = 0, m = 0; for (const i of G.land) if (G.def[i] >= CITY_MIN && G.co[i] === p) { n++; d += G.def[i]; } for (const L of G.L) if (L.owner === p) m += L.n; return [n, d, m]; };
    let bw = -1, bs = null;
    for (const p of alivePlayers()) { const sc = score(p); if (!bs || sc[0] > bs[0] || (sc[0] === bs[0] && (sc[1] > bs[1] || (sc[1] === bs[1] && sc[2] > bs[2])))) { bs = sc; bw = p; } }
    G.over = true; G.win = bw; G.limit = true; G.limitRound = G.promptedAt || G.round; G.pause = 0; showOver();
  }

  // the end of a round: everybody fires, then supplies and production are settled for every nation
  // when a zone's output changes hands (one nation holds it alone, several share it, nobody holds it) the caption says so
  function zoneChanges() {
    const sh = zoneShares(); if (!G.zstate) G.zstate = [];
    G.Z.forEach((z, zi) => {
      if (!z.cells.length) return;
      const m = sh[zi], key = m && m.size ? (m.size === 1 ? 'o' + [...m.keys()][0] : 'c') : 'n', old = G.zstate[zi];
      G.zstate[zi] = key;
      if (old === undefined || old === key) return;
      if (key === 'c') ev('evZoneFight', [{ zn: zi }], -1); else if (key === 'n') ev('evZoneNone', [{ zn: zi }], -1); else ev('evZoneOwn', [{ zn: zi }, +key.slice(1)], +key.slice(1));
    });
  }
  async function roundEnd() {
    const g = G;
    g.fx = []; g.pops = [];
    if (g.clearing) {
      const phase = k => { g._phase = k; hintUI(); };
      phase('phMove');
      const strikes = declareStrikes(), mv = clearMoves();
      if (mv) { requestDraw(); await wait(450); if (mv.ms) await sleep(mv.ms); if (G !== g) return false; }
      phase('phAim');
      const aimMs = clearAim(strikes);
      if (aimMs) { requestDraw(); await sleep(aimMs); if (G !== g) return false; }
      phase('phFire');
      const fr = await clearFire(strikes);
      if (G !== g) return false;
      phase('phDone');
      if (mv || strikes.length) logMsg('logClrSum', [g.round, mv ? mv.moved : 0, mv ? mv.arrived : 0, fr.shots, fr.miss], -1, true);
      if (fr.shots) { requestDraw(); await wait(450); if (G !== g) return false; }
    } else {
      const fought = fireRound();
      if (fought) { requestDraw(); await wait(650); if (G !== g) return false; }
    }
    for (const id of G.order) if (G.players[id].alive) economy(id);
    zoneChanges();
    for (const L of G.L) if (L.st === 'march' && L.tgt == null) L.st = 'alert';      // arrived or blocked: alert from the next round
    checkAlive();
    return true;
  }
  async function doEndTurn() {
    G.busy = true; G.sel = -1; G.mode = null; ui(true); requestDraw();
    const p = G.cur, g = G;
    g.fx = []; g.pops = [];
    if (!G.clearing && stepMarch(p)) { requestDraw(); await wait(320); if (G !== g) return; }
    // next living player; wrapping around the table ends the round
    const N = G.order.length, i0 = G.order.indexOf(p); let j = i0, wrapped = false;
    for (let k = 1; k <= N; k++) { j = (i0 + k) % N; if (i0 + k >= N) wrapped = true; if (G.players[G.order[j]].alive) break; }
    if (wrapped) {
      if (!(await roundEnd()) || G !== g) return;
      if (checkOver()) { G.busy = false; G._phase = null; ui(true); return; }
      G.round++; G.clearing = !!S.clr; logMsg('logRound', [G.round], -1, true);
      if (G.ffUntil) {
        if (G.round >= G.ffUntil) { G.ffUntil = 0; for (const q of G.players) if (q.everHuman && q.alive) q.human = true; logMsg('logFfDone', [G.round], -1, true); }
        else G._ff = G.round;
      }
      if (G._ffPause != null && G.round > G._ffPause) { G._ffPause = null; if (!G.ffUntil) G.paused = true; }       // the fast-forward button ends with the round it was pressed in: the game stops there so the result can be looked at
      const every = G.cpEvery || 100;
      if (!G.ffUntil && (G.round - 1) % every === 0 && G.round - 1 > (G.promptedAt || 0)) { G.promptedAt = G.round - 1; G.cpCount = (G.cpCount || 0) + 1; G.pause = G.round - 1; }
      j = G.order.findIndex(id => G.players[id].alive);
    }
    G.cur = G.order[j];
    setMul(); startTurn(G.cur);
    G.busy = false; G._phase = null;
    if (G.pause) showCheckpoint();
    if (G.players[G.cur].human) { snd.turn(); showTurn(G.cur, (S.tbs || 1) * 1000); }
    ui(true); requestDraw();
    autosave();
  }
  // hand a nation to the computer (autopilot) or take it back; works at any moment, also in the middle of the computer's turn
  const stepsBegin = () => { STEPS = []; };
  const stepsEnd = () => { const s = STEPS || []; STEPS = null; return s; };
  function setControl(p, human) {
    const P = G.players[p]; if (!P || !P.alive || G.over || P.human === human) return;
    P.human = human; if (human) P.everHuman = true;
    setMul(); logMsg(human ? 'logTake' : 'logAuto', [p], p);
    if (G.cur === p && !human && !G.busy && !G.pause && !G.aiRunning) runAI();
    ui(true); requestDraw(); autosave();
  }
  const humanTurn = () => G && !G.over && !G.busy && !G.pause && G.players[G.cur].human;
  async function endTurn() {
    if (!G || G.over || G.busy || G.pause || !G.players[G.cur].human) return;
    await doEndTurn();
    if (!G.over && !G.players[G.cur].human) runAI();
  }
