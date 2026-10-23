
  // ---------- AI: same orders, same rules as a player ----------
  const AIK = { easy: { skip: 0.3, grow: 0.9, size: 14, force: 60, dare: 0.6 }, normal: { skip: 0.05, grow: 1.5, size: 20, force: 35, dare: 0.25 }, hard: { skip: 0, grow: 2.2, size: 26, force: 25, dare: 0.15 } };
  // each computer nation plays in a style: how much artillery it builds against infantry, how soon it marches out and how readily it opens a fight
  const AI_STYLES = {
    balanced: { art: 0.28, force: 1, dare: 1, artMax: 6, expand: 0.7 }, inf: { art: 0.06, force: 0.7, dare: 0.7, artMax: 4, expand: 0.8 }, art: { art: 0.9, force: 1.3, dare: 1.35, artMax: 10, expand: 0.5 },
    fort: { art: 0.5, force: 99, dare: 0.6, artMax: 8, hold: 1, mode: 'fort', expand: 0.5, home: 8 },        // stays home: men fall back into the cities, defense is kept high, batteries sit in the cities
    choke: { art: 0.35, force: 99, dare: 0.8, artMax: 6, hold: 1, mode: 'choke', expand: 0.5, home: 7 },     // holds the narrow passes of its own land and never goes out
    pincer: { art: 0.2, force: 0.8, dare: 1, artMax: 5, mode: 'pincer', expand: 0.5 },               // the strike force splits in two and closes on the target city from both flanks
    cut: { art: 0.6, force: 99, dare: 0.9, artMax: 8, mode: 'cut', expand: 0.4 },                     // raiders stand where their reach covers the enemy's supply road
  };
  const pickStyle = id => { const ks = Object.keys(AI_STYLES); return id === 'random' || !AI_STYLES[id] ? ks[rnd(ks.length)] : id; };
  const aiStyleOf = p => AI_STYLES[(G.aiStyle && G.aiStyle[p]) || 'balanced'] || AI_STYLES.balanced;
  // what the computer is thinking, for the panel: one line per decision, newest first
  function pushNote(n) {
    if (!G.aiLog) G.aiLog = [];
    G.aiLog.unshift({ r: G.round, p: n.p, t: n.t, go: n.go || '' });
    if (G.aiLog.length > 400) G.aiLog.length = 400;
  }
  // `attach`: the note belongs to the step just ordered and shows up in the panel when that step is played; otherwise it is written at once
  function aiNote(p, text, go, attach) {
    const n = { p, t: text, go: go || '' };
    if (attach && STEPS && STEPS.length) STEPS[STEPS.length - 1].note = n; else pushNote(n);
  }
  // what a big city is worth to the computer: a high base, plus the zone's output it sits in and its defense
  const cityPrize = c => 600 + ((G.Z[G.zone[c]] && G.Z[G.zone[c]].out) || 0) * 1.5 + G.def[c] * 0.5;       // zones belong to whoever holds the cities in them: a captured city takes its share of the zone along
  // how much of a choke point a cell is: few open neighbours (1 to 6 pass cells around it)
  const chokeAt = c => 6 - passN(c);
  // new big cities: pick a good empty cell (away from our own cities and from the enemy, on a narrow spot, in ground we do not yet hold) and send an idle infantry legion there;
  // it starts building when it arrives (aiLegion). At most 3 sites per nation at a time (2 for the styles that stay home). A zone belongs to whoever holds its big cities, so a new city is the way into a zone.
  function aiBuildCity(p, k, sty, foes) {
    const P = G.players[p], bs = (G._bs || (G._bs = {}));
    if (P.stock < 300) return;
    const cts = cities(p); if (!cts.length) return;
    let sites = 0; for (const c of G.land) if (G.co[c] === p && G.def[c] > 0 && G.def[c] < CITY_MIN) sites++;
    const plans = (bs[p] || (bs[p] = [])).filter(x => { const L = G.L.find(l => l.id === x.lid && !l.dead); return L && (L.st === 'march' || (L.cell === x.cell && G.def[x.cell] === 0)); });
    bs[p] = plans;
    if (sites + plans.length >= (sty.hold ? 2 : 3)) return;
    const sh = zoneShares(), cv = cover(), own = 1 << p;
    let best = -1, bsc = -1e9;
    for (const c of G.land) {
      if (G.lg[c] || G.def[c] > 0 || isBlockedCell(c) || G.zone[c] < 0 || (cv.inf[c] & ~own)) continue;
      let dOwn = 99; for (const q of cts) dOwn = Math.min(dOwn, hexDist(c, q));
      if (dOwn < 4 || dOwn > (sty.home || 16)) continue;
      let dFoe = 99; for (const F of foes) dFoe = Math.min(dFoe, hexDist(c, F.cell));
      if (dFoe < 4) continue;
      let dCity = 99; for (const q of G.land) if (G.def[q] >= CITY_MIN && G.co[q] !== p) dCity = Math.min(dCity, hexDist(c, q));
      const z = G.Z[G.zone[c]], m = sh[G.zone[c]], tot = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0, mine = m ? (m.get(p) || 0) : 0, gain = z.out * ((mine + 1) / (tot + 1) - (tot ? mine / tot : 0)), sc = gain * 0.7 + chokeAt(c) * 40 - dOwn * 8 - Math.min(dCity, 12) * 3 + (dFoe < 8 ? 15 : 0);
      if (sc > bsc) { bsc = sc; best = c; }
    }
    if (best < 0) return;
    let pick = null, pd = 1e9;
    for (const L of G.L) { if (L.owner !== p || L.type !== 0 || L.st !== 'alert' || L.acted || L.bld || isCity(L.cell) || L.n < 8) continue; const d = hexDist(L.cell, best); if (d < pd && d <= 14) { pd = d; pick = L; } }
    if (!pick || !orderMarch(pick, best)) return;
    bs[p].push({ lid: pick.id, cell: best });
    aiNote(p, tr('aiSite', lname(pick), zoneName(G.zone[best])), 'z:' + G.zone[best], true);
  }
  const enemyInfNear = (p, c, r) => { let s = 0; for (const q of within(c, r)) { const F = G.lg[q]; if (F && F.owner !== p && F.type === 0) s += F.n; } return s; };
  // zones are won by cities (see aiBuildCity and the attack on enemy cities), not by standing in them: nothing to grab with idle infantry any more
  function aiExpand(p) {
    (G._plan || (G._plan = {}))[p] = { grabs: [], splits: 0, note: '' };
    return 0;
  }
  function aiProduce(p, k, foes) {
    const P = G.players[p];
    const cts = cities(p).filter(i => citySupplied(p, i));
    if (!cts.length) return;
    let inf = 0, art = 0, upk = P.cityCost || 0;
    for (const L of G.L) if (L.owner === p) { if (L.type === 0) inf += L.n; else art += L.n; upk += L.n * typ(L).eat; }
    for (const o of P.pending) { if (o.type === 0) inf += o.n; else art += o.n; upk += o.n * TYPES[o.type].eat; }
    const front = c => { let d = 99; for (const F of foes) { const e = hexDist(c, F.cell); if (e < d) d = e; } return d; };
    const fd = new Map(cts.map(c => [c, front(c)]));
    cts.sort((a, b) => fd.get(a) - fd.get(b));
    const reserve = upk * 1.2 + 100, limit = Math.max(260, (P.income || 400) * k.grow);
    for (const c of cts) {
      if (P.stock < reserve + 60 || upk >= limit) break;
      const sty = aiStyleOf(p), type = art < inf * sty.art && P.stock > reserve + 200 ? 1 : 0, T = TYPES[type];
      let n = Math.min(Math.floor((P.stock - reserve) / T.cost), cityRoom(c, p, type), type === 0 ? k.size : sty.artMax, Math.floor((limit - upk) / T.eat));
      while (n >= T.min && !buyOK(c, p, type, n)) n--;
      if (n >= T.min && orderBuildUnits(p, c, type, n)) { aiNote(p, tr('aiBuild', cityName(c), n, tr('ty_' + T.k)), 'c:' + c, true); upk += n * T.eat; if (type === 0) inf += n; else art += n; }
    }
  }
  function aiPickTarget(L, ts) {       // the garrison of the city under attack first, then batteries, then the biggest legion
    let best = null, bs = -1;
    const go = G.aiGo && G.aiGo[L.owner];
    for (const t of ts) { const s = (go && go.obj === t.cell ? 200 : 0) + (t.type === 1 ? 100 : 0) + t.n - hexDist(L.cell, t.cell) * 0.5; if (s > bs) { bs = s; best = t; } }
    return best;
  }
  const passN = c => { let n = 0; for (let e = 0; e < 6; e++) { const v = G.link[c * 6 + e]; if (v >= 0 && !isBlockedCell(v)) n++; } return n; };
  const freeFor = (L, c) => { const O = G.lg[c]; return !O || O === L; };
  // postures of the special styles for a field infantry legion with nothing to shoot at; true when it was given an order
  function aiPosture(L, p, sty, foes, enemyCities) {
    const mode = sty.mode, here = L.cell;
    if (mode === 'fort') {
      let best = -1, bd = 1e9;
      for (const i of cities(p)) { if (G.lg[i]) continue; const d = hexDist(here, i); if (d < bd) { bd = d; best = i; } }
      return best >= 0 && orderMarch(L, best);
    }
    if (mode === 'choke') {
      if (!G.aiChoke) G.aiChoke = {};
      let ch = G.aiChoke[p];
      if (!ch || ch.round !== G.round) {
        const cand = G.land.filter(c => G.owner[c] === p && G.def[c] < CITY_MIN && !isBlockedCell(c) && passN(c) <= 3);
        const dEn = c => { let d = 99; for (const i of enemyCities) d = Math.min(d, hexDist(c, i)); return d; };
        cand.sort((a, b) => dEn(a) - dEn(b));
        const pick = []; for (const c of cand) { if (pick.length >= 8) break; if (pick.every(q => hexDist(q, c) >= 3)) pick.push(c); }
        ch = G.aiChoke[p] = { round: G.round, cells: pick };
      }
      if (ch.cells.includes(here)) return false;
      let best = -1, bd = 1e9;
      for (const c of ch.cells) { if (!freeFor(L, c)) continue; const d = hexDist(here, c); if (d < bd) { bd = d; best = c; } }
      if (best >= 0) return orderMarch(L, best);
      return aiPosture(L, p, AI_STYLES.fort, foes, enemyCities);
    }
    if (mode === 'cut') {
      if (!G.aiCut) G.aiCut = {};
      let ct = G.aiCut[p]; if (!ct || ct.round !== G.round) ct = G.aiCut[p] = { round: G.round, set: new Set() };
      if (L.n < 6) return false;
      const cv = cover(), own = 1 << p;
      let bestF = null, bd = 1e9;
      for (const F of foes) {
        if (F.type !== 0 || isCity(F.cell) || ct.set.has(F.id)) continue;
        const d = hexDist(here, F.cell); if (d <= 14 && d < bd) { bd = d; bestF = F; }
      }
      if (!bestF) return false;
      const r = reachOf(bestF.owner); let c = bestF.cell;
      if (r.dist[c] < 0) return false;
      for (let s = 0; s < 3 && r.par[c] >= 0; s++) c = r.par[c];
      let pick = -1, bs = 1e9;
      for (const q of within(c, 1)) {
        if (isBlockedCell(q) || !freeFor(L, q)) continue;
        const sc = ((cv.inf[q] & ~own) ? 6 : 0) + hexDist(here, q);
        if (sc < bs) { bs = sc; pick = q; }
      }
      ct.set.add(bestF.id);
      if (pick >= 0 && pick !== here) return orderMarch(L, pick);
      return false;
    }
    return false;
  }
  // the roads the enemy's supplies travel on: how many enemy legions depend on each cell (only legions we can see)
  // ---------- intentions: what a nation has in mind (attack a city, wipe out the enemy in a zone, take revenge on a nation) ----------
  // Hatred builds up when a nation is shot at (see addHate in game.js) and fades each round. A nation forms an intention by itself, or the player plants one
  // (the panel's "plant an idea" button); either way the same strike force carries it out.
  const HATE_MIN = 120, INTENT_LIFE = 40, MAX_AI_INTENTS = 4, YOU_STR = 10000;
  const intentCell = (p, it) => {       // the cell the strike force heads for, -1 when the intention is over
    const mine = x => x.owner === p;
    if (it.k === 'city') return G.co[it.t] !== p && G.def[it.t] >= CITY_MIN ? it.t : -1;
    if (it.k === 'zone') {       // take the zone: enemy legions there are fought, empty ground is occupied, and once it is ours the force stays and defends it
      const z = G.Z[it.t]; if (!z || !z.cells.length) return -1;
      let best = null; for (const L of G.L) if (!L.dead && !mine(L) && G.zone[L.cell] === it.t && (!best || L.n > best.n)) best = L;
      if (best) return best.cell;
      for (const c of G.land) if (G.zone[c] === it.t && G.def[c] >= CITY_MIN && G.co[c] >= 0 && G.co[c] !== p) return c;
      return z.ai;
    }
    let bc = -1, bs = -1e18;       // nation: its most attractive city, else its nearest legion
    const mineF = G.L.filter(x => x.owner === p && x.type === 0 && !x.dead);
    for (const c of G.land) if (G.def[c] >= CITY_MIN && G.co[c] === it.t) { const d = mineF.length ? Math.min(...mineF.map(x => hexDist(x.cell, c))) : 20, sc = cityPrize(c) - d * 15 - (G.lg[c] ? G.lg[c].n * 6 : 0) - G.def[c] * 0.4; if (sc > bs) { bs = sc; bc = c; } }
    if (bc >= 0) return bc;
    let bl = null, bd = 1e9; for (const L of G.L) if (!L.dead && L.owner === it.t) { const d = mineF.length ? Math.min(...mineF.map(x => hexDist(x.cell, L.cell))) : 20; if (d < bd) { bd = d; bl = L; } }
    return bl ? bl.cell : -1;
  };
  const hateOf = (p, q) => (G.hate && G.hate[p] && G.hate[p][q]) || 0;
  const intentOver = (p, it) => {
    if (G.round > it.until) return 'aiIntentTimeout';
    if (it.k === 'nation') { if (!G.players[it.t].alive) return 'aiIntentDone'; if (it.by === 'ai' && hateOf(p, it.t) < 30 && G.round - it.r0 > 4) return 'aiIntentCalm'; }
    return intentCell(p, it) < 0 ? 'aiIntentDone' : null;
  };
  const intentText = it => it.k === 'city' ? tr('itCity', cityName(it.t)) : it.k === 'zone' ? tr('itZone', zoneName(it.t)) : tr('itNation', pname(it.t));
  // how strong an idea is: the player's ideas always win; a revenge idea is as strong as the hatred behind it; a city by its prize
  const intentStr = (p, it) => (it.by === 'you' ? YOU_STR : 0) + (it.k === 'nation' ? hateOf(p, it.t) : it.k === 'city' ? cityPrize(it.t) : 300);
  const intentNote = (it, txt) => { it.hist.push([G.round, txt]); if (it.hist.length > 30) it.hist.splice(1, 1); };
  function addIntent(p, k, t, by, why) {       // an idea exists once per target; asking again strengthens it (and makes it the player's when the player asks)
    const I = G.intent[p], ex = I.find(x => x.k === k && x.t === t);
    if (ex) {
      if (by === 'you' && ex.by !== 'you') { ex.by = 'you'; intentNote(ex, tr('itHistTaken')); }
      else intentNote(ex, tr('itHistAgain'));
      ex.until = G.round + INTENT_LIFE; ex.str = intentStr(p, ex); return ex;
    }
    G.iseq = (G.iseq || 0) + 1;
    const it = { id: G.iseq, k, t, by, r0: G.round, until: G.round + INTENT_LIFE, str: 0, last: 0, hist: [[G.round, why]] };
    it.str = intentStr(p, it); it.last = it.str; I.push(it); return it;
  }
  function endIntent(p, it, whyKey) {       // finished ideas go to the history
    const I = G.intent[p], i = I.indexOf(it); if (i >= 0) I.splice(i, 1);
    intentNote(it, tr(whyKey, '').replace(/[：:]\s*$/, '')); if (!G.ihist) G.ihist = []; G.ihist.unshift({ p, r: G.round, why: whyKey, it }); if (G.ihist.length > 60) G.ihist.pop();
  }
  function aiThink(p, k, sty, foes) {
    if (!Array.isArray(G.intent[p])) G.intent[p] = G.intent[p] ? [G.intent[p]] : [];
    const I = G.intent[p];
    if (!G._strike) G._strike = {}; G._strike[p] = new Set();
    if (!G.aiGo) G.aiGo = {};
    for (const it of [...I]) { const why = intentOver(p, it); if (why) { aiNote(p, tr(why, intentText(it))); endIntent(p, it, why); } }
    const field = G.L.filter(x => x.owner === p && x.type === 0 && x.n >= 6 && !x.dead && !isCity(x.cell) && !x.bld);
    let force = 0; for (const x of field) force += x.n;
    const need = k.force * sty.force;
    if (!sty.hold && field.length && force >= need * 0.6) {
      // revenge ideas follow the hatred: one per nation that has hurt us enough, getting stronger as the hatred grows
      for (let q = 0; q < G.players.length; q++) {
        const h = hateOf(p, q); if (q === p || !G.players[q].alive) continue;
        const ex = I.find(x => x.k === 'nation' && x.t === q);
        if (ex) { ex.str = intentStr(p, ex); if (h >= ex.last + 60) { ex.last = h; ex.until = Math.min(G.round + INTENT_LIFE, ex.until + 10); intentNote(ex, tr('itHistHate', Math.round(h))); } }
        else if (h >= HATE_MIN && I.filter(x => x.by === 'ai').length < MAX_AI_INTENTS) { addIntent(p, 'nation', q, 'ai', tr('itHistFormHate', Math.round(h))); aiNote(p, tr('aiRevenge', pname(q), Math.round(h))); }
      }
      if (!I.some(x => x.k === 'city') && force >= need && I.filter(x => x.by === 'ai').length < MAX_AI_INTENTS) {
        const cs = G.land.filter(i => G.def[i] >= CITY_MIN && G.co[i] !== p && G.co[i] >= 0);
        let best = -1, bd = -1e18; for (const i of cs) { const sc = cityPrize(i) - Math.min(...field.map(x => hexDist(x.cell, i))) * 15 - (G.lg[i] ? G.lg[i].n * 6 : 0) - G.def[i] * 0.4; if (sc > bd) { bd = sc; best = i; } }
        if (best >= 0) { addIntent(p, 'city', best, 'ai', tr('itHistFormCity', Math.round(cityPrize(best)))); aiNote(p, tr('aiStrike', cityName(best), Math.round(force)), 'c:' + best); }
      }
    }
    for (const it of I) it.str = intentStr(p, it);
    // the strongest idea that still has a target is the one carried out now; the others wait
    let act = null, cell = -1; for (const it of [...I].sort((a, b) => b.str - a.str)) { const c = intentCell(p, it); if (c >= 0) { act = it; cell = c; break; } }
    if (!act) { G.aiGo[p] = null; return; }
    G.aiGo[p] = { obj: cell, k: act.k, id: act.id };
    const peaceful = act.k === 'zone' && !(G.lg[cell] && G.lg[cell].owner !== p) && !(G.def[cell] >= CITY_MIN && G.co[cell] >= 0 && G.co[cell] !== p);       // nobody to fight in the zone: a few legions are enough
    const want = peaceful ? 30 : act.by === 'you' ? 1e9 : Math.max(need, ((G.lg[cell] ? G.lg[cell].n : 0) + 20) * 1.5);
    let sum = 0; for (const x of [...field].sort((a, b) => hexDist(a.cell, cell) - hexDist(b.cell, cell))) { if (sum >= want && (act.by !== 'you' || peaceful)) break; G._strike[p].add(x.id); sum += x.n; x.hoard = 10; }       // carry a full load of food: the march is long
    // gather first, strike together: a rally point on supplied, uncovered ground not too far from the target; the assault starts when most of the force is there
    if (!G._rally) G._rally = {};
    let R = G._rally[p]; if (!R || R.id !== act.id) R = G._rally[p] = { id: act.id, since: G.round, cell: -1, go: false };
    const rr = reachOf(p), cv = cover(), own = 1 << p;
    if (peaceful) R.go = true;
    if (!R.go) {
      let rc = -1, rb = 1e9; for (const c of within(cell, 10)) { if (isBlockedCell(c) || G.lg[c] || rr.dist[c] < 0 || (cv.inf[c] & ~own) || hexDist(c, cell) < 4) continue; const d = hexDist(c, cell); if (d < rb) { rb = d; rc = c; } }
      R.cell = rc;
      const strikers = G.L.filter(x => G._strike[p].has(x.id)); let there = 0, all = 0;
      for (const x of strikers) { all += x.n; if (rc < 0 || hexDist(x.cell, rc) <= 3) there += x.n; }
      if (rc < 0 || all === 0 || there >= all * 0.6 || G.round - R.since > (act.by === 'you' ? 8 : 14)) R.go = true;
    }
  }
  function aiRoutes(p, seen) {
    const w = new Map(), who = new Map();
    for (const F of G.L) {
      if (F.owner === p || F.dead || !seen(F.cell)) continue;
      const rr = reachOf(F.owner); if (rr.dist[F.cell] <= 0) continue;
      for (let c = F.cell; c >= 0; c = rr.par[c]) { w.set(c, (w.get(c) || 0) + 1); let m = who.get(c); if (!m) who.set(c, m = new Map()); m.set(F.owner, (m.get(F.owner) || 0) + 1); }
    }
    return { w, who };
  }
  // artillery loses nobody's road but costs it supplies: stand where the guns reach as much enemy supply road as possible, close to our own infantry
  function aiSuppress(L, p, sty, foes, routes) {
    const T = typ(L), R = T.rmax;
    const score = c => { let s = 0; for (const q of within(c, R)) if (hexDist(c, q) >= T.rmin) s += routes.w.get(q) || 0; return s; };
    const cur = score(L.cell); let best = L.cell, bs = cur;
    for (let e = 0; e < 6; e++) {
      const v = G.link[L.cell * 6 + e]; if (v < 0 || G.lg[v] || isBlockedCell(v)) continue;
      let mi = 99; for (const F of foes) if (F.type === 0) mi = Math.min(mi, hexDist(v, F.cell));
      let fr = 0; for (const q of within(v, 3)) { const F = G.lg[q]; if (F && F.owner === p && F.type === 0) fr++; }
      if (mi < 3 || !fr) continue;
      const s = score(v); if (s > bs + 1) { bs = s; best = v; }
    }
    if (best !== L.cell && orderMarch(L, best)) {
      const hit = new Map(); for (const q of within(best, R)) if (hexDist(best, q) >= T.rmin) { const m = routes.who.get(q); if (m) for (const [o, n] of m) hit.set(o, (hit.get(o) || 0) + n); }
      const top = [...hit].sort((a, b) => b[1] - a[1])[0];
      aiNote(p, tr('aiSuppress', lname(L), top ? pname(top[0]) : '', bs), 'z:' + G.zone[best], true);
      return true;
    }
    return cur > 0;       // already in a good spot: stay
  }
  function aiLegion(L, k, foes, seen, enemyCities, routes) {
    const p = L.owner, T = typ(L), sty = aiStyleOf(p);
    if (L.acted || Math.random() < k.skip) return;
    if (L.st === 'march' && L.tgt != null) return;
    const onCity = isCity(L.cell);
    const ts = targetsIn(L).filter(t => seen(t.cell));
    if (L.type === 0 && !onCity && G._strike && G._strike[p] && G._strike[p].has(L.id) && G.aiGo && G.aiGo[p]) {
      // part of the strike force: shoot what is in reach (the garrison of the target first), otherwise move up to the target; an empty city is walked into
      const go = G.aiGo[p], R = G._rally && G._rally[p];
      if (ts.length) { const t = aiPickTarget(L, ts); if (t) { orderAttack(L, t); return; } }
      if (R && !R.go && R.cell >= 0) {       // still gathering: walk to the rally point and wait there
        if (hexDist(L.cell, R.cell) > 2) { for (const c of within(R.cell, 2).filter(c => !G.lg[c] && !isBlockedCell(c)).sort((a, b) => hexDist(L.cell, a) - hexDist(L.cell, b)).slice(0, 5)) if (orderMarch(L, c)) return; }
        return;
      }
      if (!G.lg[go.obj] && isCity(go.obj) && G.co[go.obj] !== p && hexDist(L.cell, go.obj) <= 6 && orderMarch(L, go.obj)) return;
      if (hexDist(L.cell, go.obj) > 2) {
        // the nearest cell we can actually walk to: first around the target itself, then in wider rings (enemy legions can wall a road off)
        for (const r of [2, 4, 6, 9, 12, 16]) {
          const cs = within(go.obj, r).filter(c => !G.lg[c] && !isBlockedCell(c) && hexDist(c, go.obj) <= r && hexDist(L.cell, c) < hexDist(L.cell, go.obj) + 1).sort((a, b) => hexDist(a, go.obj) - hexDist(b, go.obj) || hexDist(L.cell, a) - hexDist(L.cell, b));
          let tries = 0; for (const c of cs) { if (tries++ > 6) break; if (orderMarch(L, c)) return; }
        }
      }
      return;
    }
    if (L.type === 0) {
      // a legion on its own building site keeps building it up to a solid city, then goes back to normal duty
      if (!onCity && G.co[L.cell] === p && G.def[L.cell] > 0 && G.def[L.cell] < CITY_MIN + 100) { if (!L.bld && L.sup > L.n * typ(L).bsp * BUILD_COST && canRepair(L)) orderRepair(L); return; }
      if (L.bld && G.def[L.cell] >= CITY_MIN + 100) { L.bld = false; if (G.players[p].stock < 0) return; }
      if (!onCity && L.bld) return;
      { const bp = G._bs && G._bs[p] && G._bs[p].find(x => x.lid === L.id && x.cell === L.cell); if (bp && G.def[L.cell] === 0 && L.sup > L.n * typ(L).bsp * BUILD_COST && canRepair(L)) { orderRepair(L); return; } }
      // an enemy city with nobody in it is walked into
      { const go1 = G.aiGo && G.aiGo[p]; if (go1 && go1.obj >= 0 && !G.lg[go1.obj] && G.co[go1.obj] !== p && hexDist(L.cell, go1.obj) <= 5 && !(sty.hold) && orderMarch(L, go1.obj)) return; }
      if (onCity) {
        if (G.def[L.cell] < CITY_MAX && L.sup > supCost(L) * 4 + L.n * typ(L).bsp * BUILD_COST && G.players[p].stock > (sty.hold ? 250 : 700) && canRepair(L)) orderRepair(L);
        else if (ts.length) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); }
        return;
      }
      if (ts.length) {
        let foeStr = 0; for (const F of foes) if (hexDist(L.cell, F.cell) <= 4) foeStr += F.type === 0 ? F.n : F.n * 1.5;
        let friends = 0; for (const c of within(L.cell, 3)) { const F = G.lg[c]; if (F && F.owner === p) friends += F.type === 0 ? F.n : F.n * 0.5; }
        const go0 = G.aiGo && G.aiGo[p], committed = !sty.hold && go0 && go0.obj >= 0 && hexDist(L.cell, go0.obj) <= 8;       // once a strike on a city is under way its men fight on
        if (committed || friends >= foeStr * k.dare * aiStyleOf(p).dare) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); }
        return;
      }
      if (sty.mode && sty.mode !== 'pincer' && sty.mode !== 'cut' && aiPosture(L, p, sty, foes, enemyCities)) return;
      // the strike force moves together: all field infantry head for the same enemy city once enough men are gathered
      const go = G.aiGo && G.aiGo[p];
      if (go && go.obj >= 0 && L.n >= 6 && hexDist(L.cell, go.obj) > 2) {
        let pick = -1, bd = 1e9;
        if (sty.mode === 'pincer') {
          // one half of the force swings to each side of the line towards the city, then both close in
          const side = L.id % 2 ? 1 : -1, ax = G.X[go.obj] - G.X[L.cell], ay = G.Y[go.obj] - G.Y[L.cell], far = hexDist(L.cell, go.obj) > 6;
          for (const c of within(go.obj, far ? 6 : 2)) {
            if (G.lg[c] || isBlockedCell(c)) continue;
            const hd = hexDist(go.obj, c); if (far && hd < 4) continue;
            const rx = G.X[c] - G.X[go.obj], ry = G.Y[c] - G.Y[go.obj], sn = (rx * ay - ry * ax) / ((Math.hypot(rx, ry) * Math.hypot(ax, ay)) || 1);
            const sc = hexDist(L.cell, c) - side * sn * 4; if (sc < bd) { bd = sc; pick = c; }
          }
        } else for (const c of within(go.obj, 2)) { if (G.lg[c] || isBlockedCell(c)) continue; const d = hexDist(L.cell, c); if (d < bd) { bd = d; pick = c; } }
        if (pick >= 0) orderMarch(L, pick);
      }
      return;
    }
    // artillery: stay behind the infantry and shoot
    const inf2 = foes.filter(F => F.type === 0 && hexDist(L.cell, F.cell) <= 2);
    if (inf2.length) {
      let pick = -1, bs = -1;
      for (const c of within(L.cell, 1)) {
        if (c === L.cell || G.lg[c] || isBlockedCell(c)) continue;
        let md = 99; for (const F of foes) if (F.type === 0) md = Math.min(md, hexDist(c, F.cell));
        let fr = 0; for (const q of within(c, 3)) { const F = G.lg[q]; if (F && F.owner === p && F.type === 0) fr++; }
        const sc = md * 3 + fr; if (sc > bs && md >= 3) { bs = sc; pick = c; }
      }
      if (pick >= 0 && orderMarch(L, pick)) return;
    }
    if (ts.length) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); return; }
    if (!sty.hold && routes && routes.w.size && aiSuppress(L, p, sty, foes, routes)) return;
    if (sty.hold) return;
    let near = null, nd = 99;
    for (const F of foes) { const d = hexDist(L.cell, F.cell); if (d < nd) { nd = d; near = F; } }
    if (near && nd <= 14) {
      let pick = -1, bs = 1e9;
      for (const c of within(L.cell, 1)) {
        if (G.lg[c] || isBlockedCell(c)) continue;
        let md = 99; for (const F of foes) { const d = hexDist(c, F.cell); if (d < md) md = d; }
        let mi = 99; for (const F of foes) if (F.type === 0) mi = Math.min(mi, hexDist(c, F.cell));
        let fr = 0; for (const q of within(c, 3)) { const F = G.lg[q]; if (F && F.owner === p && F.type === 0) fr++; }
        if (mi < 3 || !fr) continue;
        const sc = Math.abs(md - 4) * 2 - fr * 0.5 + hexDist(L.cell, c) * 0.2; if (sc < bs) { bs = sc; pick = c; }
      }
      if (pick >= 0 && pick !== L.cell) orderMarch(L, pick);
    }
  }
  // the computer's turn: every order is given, shown and carried out one step at a time (`play` shows the step and does its effect); false when the turn was cut short
  async function aiTurn(p, play) {
    const flush = async () => { const s = stepsEnd(); stepsBegin(); if (!play) for (const x of s) if (x.note) pushNote(x.note); return !play || !s.length || (await play(s)); };
    stepsBegin();
    const k = AIK[(G.aiLevel && G.aiLevel[p]) || 'normal'] || AIK.normal;
    const fogV = S.fog ? visMask(p) : null, seen = c => !fogV || !!fogV[c];
    const foes = G.L.filter(x => x.owner !== p && seen(x.cell));
    aiProduce(p, k, foes);
    if (!(await flush())) { stepsEnd(); return false; }
    aiThink(p, k, aiStyleOf(p), foes);
    aiExpand(p, k, aiStyleOf(p), foes);
    if (!(await flush())) { stepsEnd(); return false; }
    aiBuildCity(p, k, aiStyleOf(p), foes); aiBuildCity(p, k, aiStyleOf(p), foes);
    if (!(await flush())) { stepsEnd(); return false; }
    const enemyCities = G.land.filter(i => G.def[i] >= CITY_MIN && G.co[i] !== p && G.co[i] >= 0);
    const routes = aiRoutes(p, seen);
    for (const L of shuffle(G.L.filter(x => x.owner === p))) {
      if (L.dead || L.acted) continue;
      const cont = L.st === 'march' && L.tgt != null && L.mvRound !== G.round;       // a march from an earlier turn goes on
      aiLegion(L, k, foes, seen, enemyCities, routes);
      if (cont && STEPS && !STEPS.length) STEPS.push({ k: 'march', id: L.id, p, cell: L.cell, to: L.tgt, cont: true });
      if (!(await flush())) { stepsEnd(); return false; }
    }
    stepsEnd(); return true;
  }
  // the pause button: the computer stops before its next move until resumed
  async function holdWhilePaused(g) { if (g.paused) cast(tr('pausedMsg')); while (g.paused && G === g) await sleep(150); }
  async function runAI() {
    const g = G; if (g.aiRunning) return; g.aiRunning = true;
    try {
      while (G === g && !g.over && !g.pause && !g.players[g.cur].human) {
        setMul(); ui(false);
        const cur = g.cur;
        // the banner says who is to move and what is on its mind; the computer waits for it (a setting of 1 to 9 seconds, plus one second for every idea listed). Its orders are then replayed step by step
        const ideas = [...(G.intent[cur] || [])].sort((x, y) => y.str - x.str).slice(0, 5).map(it => ({ t: (it.by === 'you' ? '🔧 ' : '💡 ') + intentText(it), you: it.by === 'you' })), hold = ((S.tbs || 1) + ideas.length) * 1000;       // the base time plus one second for every idea listed
        if (!quick()) showTurn(cur, hold, ideas);
        await (quick() ? wait(250) : sleep(hold));
        if (G !== g) return;
        await holdWhilePaused(g);
        if (G !== g) return;
        if (g.cur !== cur || g.players[g.cur].human) continue;
        g.stepCount = 0;
        const done = await aiTurn(g.cur, (steps) => playLive(g, cur, steps));
        if (G !== g) return;
        cast(''); g.aiShow = null; requestDraw();
        if (!done || g.cur !== cur || g.players[g.cur].human) continue;
        await doEndTurn();
      }
    } finally { cast(''); g.aiRunning = false; if (G === g) { g.busy = false; ui(true); requestDraw(); } }
  }
