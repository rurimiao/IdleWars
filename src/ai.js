
  // ---------- AI: same orders, same rules as a player ----------
  const AIK = { easy: { skip: 0.3, grow: 0.9, size: 14, force: 60, dare: 0.6 }, normal: { skip: 0.05, grow: 1.5, size: 20, force: 35, dare: 0.25 }, hard: { skip: 0, grow: 2.2, size: 26, force: 25, dare: 0.15 } };
  // each computer nation plays in a style: how much artillery it builds against infantry, how soon it marches out and how readily it opens a fight
  const AI_STYLES = {
    steady: { art: 0.28, force: 1, dare: 1, artMax: 6 }, wave: { art: 0.15, force: 0.7, dare: 0.7, artMax: 4 }, heavy: { art: 0.9, force: 1.3, dare: 1.35, artMax: 10 },
    hold: { art: 0.5, force: 99, dare: 0.6, artMax: 8, hold: 1, home: 8 },        // stays home: men fall back into the cities, never goes out to take a city, but strikes back at whoever hurts it
  };
  const OLD_STYLE = { balanced: 'steady', inf: 'wave', art: 'heavy', fort: 'hold', choke: 'hold', pincer: 'steady', cut: 'hold' };       // saves from before the styles were renamed
  const ATTACK_STYLES = ['steady', 'wave', 'heavy'];
  // 'random' (or an old name) gives a real style; `not` keeps the current one out of the draw
  const pickStyle = (id, not) => { if (AI_STYLES[id]) return id; if (OLD_STYLE[id]) return OLD_STYLE[id]; const ks = Object.keys(AI_STYLES).filter(k => k !== not); return ks[rnd(ks.length)]; };
  const aiStyleOf = p => AI_STYLES[(G.aiStyle && G.aiStyle[p]) || 'steady'] || AI_STYLES.steady;
  // the two switches that make a style change during the game: a = a fresh draw every 10 rounds, b = by the situation (a city lost: stay home; 5 safe rounds and stronger than the others: go out again)
  const DYN_EVERY = 10, DYN_SAFE = 5, DYN_LOCK = 5;
  const dynOf = p => (G.aiDyn && G.aiDyn[p]) || {};
  const styleText = p => { const D = dynOf(p); return tr('st_' + ((G.aiStyle && G.aiStyle[p]) || 'steady')) + (D.a ? '+' + tr('dynA') : '') + (D.b ? '+' + tr('dynB') : ''); };
  function aiShift(p) {
    const D = G.aiDyn && G.aiDyn[p]; if (!D || (!D.a && !D.b)) return;
    const cur = G.aiStyle[p], n = cities(p).length;
    let to = null, why = '';
    if (D.b) {
      const lost = D.cities != null && n < D.cities;
      D.safe = lost ? 0 : (D.safe || 0) + 1;
      if (G.round >= (D.lock || 0)) {
        const men = q => G.L.reduce((a, L) => a + (L.owner === q ? L.n : 0), 0), others = G.players.filter(P => P.alive && P.id !== p), avg = others.length ? others.reduce((a, P) => a + men(P.id), 0) / others.length : 0;
        if (lost && cur !== 'hold') { to = 'hold'; why = 'logStyleLost'; }
        else if (cur === 'hold' && D.safe >= DYN_SAFE && men(p) > avg) { to = ATTACK_STYLES[rnd(ATTACK_STYLES.length)]; why = 'logStyleSafe'; }
      }
    }
    D.cities = n;
    if (D.a && G.round >= (D.next || DYN_EVERY + 1)) { if (!to) { to = pickStyle('random', cur); why = 'logStyleDraw'; } }
    if (!to || to === cur) return;
    G.aiStyle[p] = to; if (D.a) D.next = G.round + DYN_EVERY; if (D.b) D.lock = G.round + DYN_LOCK;
    ev(why, [p, tr('st_' + to)], p); aiNote(p, tr(why, p, tr('st_' + to)));
  }
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
  // two strikes at once (兵分两路): the main one is kept under the nation's number p, the second under p + PRONG2 (in G.aiGo, G._strike and G._rally)
  const PRONG2 = 100;
  const strikeKeyOf = L => (G._strike && G._strike[L.owner + PRONG2] && G._strike[L.owner + PRONG2].has(L.id) ? L.owner + PRONG2 : L.owner);
  const allStrike = p => new Set([...((G._strike && G._strike[p]) || []), ...((G._strike && G._strike[p + PRONG2]) || [])]);
  const STRIKE_MEN = 160, STRIKE_ARTS = 3, STRIKE_REACH = 16;       // a strike on a city: a big wave of eight full infantry legions and three batteries, gathered from within 16 cells of it (or 8 cells beyond our nearest city when that is farther)
  const wreckOrCity = c => G.def[c] >= CITY_MIN || (G.wasCity[c] && G.def[c] > 0);       // a city knocked below the threshold is still worth taking (or getting back)
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
    // an expedition: the main strike goes for a city far from our land (more than 10 cells from our nearest city); a city on the way, 6 cells or more short of it, shortens the supply road
    const go = G.aiGo && G.aiGo[p], T = go && go.k === 'city' ? go.obj : -1, dT = T >= 0 ? Math.min(...cts.map(q => hexDist(q, T))) : 0, far = !sty.hold && dT > 10;
    if (sites + plans.length >= (sty.hold ? 2 : 3) + (far ? 1 : 0)) return;
    const sh = zoneShares(), cv = cover(), foeM = foeBits(p);
    let best = -1, bsc = -1e9, fwd = false;
    for (const c of G.land) {
      if (G.lg[c] || G.def[c] > 0 || isBlockedCell(c) || G.zone[c] < 0 || (cv.inf[c] & foeM)) continue;
      let dOwn = 99; for (const q of cts) dOwn = Math.min(dOwn, hexDist(c, q));
      if (dOwn < 4 || dOwn > (sty.home || 16)) continue;
      let dFoe = 99; for (const F of foes) dFoe = Math.min(dFoe, hexDist(c, F.cell));
      if (dFoe < 4) continue;
      let dCity = 99; for (const q of G.land) if (G.def[q] >= CITY_MIN && notAlly(p, G.co[q])) dCity = Math.min(dCity, hexDist(c, q));
      const z = G.Z[G.zone[c]], m = sh[G.zone[c]], tot = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0, mine = m ? (m.get(p) || 0) : 0, gain = z.out * ((mine + 1) / (tot + 1) - (tot ? mine / tot : 0)), sc = gain * 0.7 + chokeAt(c) * 40 - dOwn * 8 - Math.min(dCity, 12) * 3 + (dFoe < 8 ? 15 : 0) + (far && hexDist(c, T) >= 6 && hexDist(c, T) < dT ? (dT - hexDist(c, T)) * 60 + dOwn * 8 : 0);
      if (sc > bsc) { bsc = sc; best = c; fwd = far && hexDist(c, T) >= 6 && hexDist(c, T) < dT - 2; }
    }
    if (best < 0) return;
    let pick = null, pd = 1e9;
    const sk = allStrike(p);       // the strike force is not sent off to build
    for (const L of G.L) { if (L.owner !== p || L.type !== 0 || L.st !== 'alert' || L.acted || L.bld || isCity(L.cell) || L.n < 8 || sk.has(L.id)) continue; const d = hexDist(L.cell, best); if (d < pd && d <= 14) { pd = d; pick = L; } }
    if (!pick || !orderMarch(pick, best)) return;
    bs[p].push({ lid: pick.id, cell: best });
    aiNote(p, fwd ? tr('aiForward', lname(pick), zoneName(G.zone[best]), cityName(T)) : tr('aiSite', lname(pick), zoneName(G.zone[best])), 'z:' + G.zone[best], true);
  }
  const enemyInfNear = (p, c, r) => { let s = 0; for (const q of within(c, r)) { const F = G.lg[q]; if (F && notAlly(p, F.owner) && F.type === 0) s += F.n; } return s; };
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
    // gathering a wave for a strike: stock up food for the campaign before buying more men (see campaignFood)
    const Rg = G._rally && G._rally[p], gathering = Rg && G.aiGo && G.aiGo[p] && Rg.id === G.aiGo[p].id && !Rg.go;
    const reserve = upk * 1.2 + 100 + (gathering ? campaignFood(p, p).need : 0), limit = Math.max(260, (P.income || 400) * k.grow);
    for (const c of cts) {
      if (P.stock < reserve + 60 || upk >= limit) break;
      const sty = aiStyleOf(p), type = art < inf * sty.art && P.stock > reserve + 200 ? 1 : 0, T = TYPES[type];
      let n = Math.min(Math.floor((P.stock - reserve) / T.cost), cityRoom(c, p, type), type === 0 ? k.size : sty.artMax, Math.floor((limit - upk) / T.eat));
      while (n >= T.min && !buyOK(c, p, type, n)) n--;
      if (n >= T.min && orderBuildUnits(p, c, type, n)) { aiNote(p, tr('aiBuild', cityName(c), n, tr('ty_' + T.k)), 'c:' + c, true); upk += n * T.eat; if (type === 0) inf += n; else art += n; }
    }
  }
  // food for a campaign: the strike force should carry a full load (10 turns) and the treasury should hold 3 more turns of its meals, more for a long road (1% lost per cell)
  const CAMPAIGN_TURNS = 3;
  function campaignFood(p, key) {
    const s = G._strike && G._strike[key], R = G._rally && G._rally[key]; if (!s) return { need: 0, carried: 0, full: 0 };
    let upk = 0, carried = 0, full = 0;
    for (const x of G.L) if (s.has(x.id) && !x.dead) { const e = x.n * typ(x).eat; upk += e; carried += x.sup; full += Math.min(10, x.hoard) * e; }
    const at = R && R.cell >= 0 ? R.cell : -1, mine = cities(p), d = at >= 0 && mine.length ? Math.min(...mine.map(c => hexDist(c, at))) : 0;
    return { need: Math.round(upk * CAMPAIGN_TURNS * (1 + 0.01 * d)), carried, full };
  }
  // a battery's splash hits the ring round its target: enemies there count for the shot, our own men against it (0 for infantry)
  const splashScore = (L, t) => { let f = 0, e = 0; if (L.type === 1) for (const c of nbrs(t.cell)) { const U = c >= 0 ? G.lg[c] : null; if (U && U !== L) { if (!hostile(L.owner, U.owner)) f += U.n; else e += U.n; } } return e * 0.5 - f * 1.5; };
  function aiPickTarget(L, ts) {       // the garrison of the city under attack first, then batteries, then the biggest legion
    let best = null, bs = -1;
    const go = G.aiGo && G.aiGo[strikeKeyOf(L)];
    for (const t of ts) { const s = (go && go.obj === t.cell ? 200 : 0) + (t.type === 1 ? 100 : 0) + t.n - hexDist(L.cell, t.cell) * 0.5 + splashScore(L, t); if (s > bs) { bs = s; best = t; } }
    return best;
  }
  const passN = c => { let n = 0; for (let e = 0; e < 6; e++) { const v = G.link[c * 6 + e]; if (v >= 0 && !isBlockedCell(v)) n++; } return n; };
  // the stay-home style: a field infantry legion with nothing to shoot at walks into the nearest empty city of its own; true when it was given an order
  function aiPosture(L, p) {
    let best = -1, bd = 1e9;
    for (const i of cities(p)) { if (G.lg[i]) continue; const d = hexDist(L.cell, i); if (d < bd) { bd = d; best = i; } }
    return best >= 0 && orderMarch(L, best);
  }
  // the roads the enemy's supplies travel on: how many enemy legions depend on each cell (only legions we can see)
  // ---------- intentions: what a nation has in mind (attack a city, wipe out the enemy in a zone, take revenge on a nation) ----------
  // Hatred builds up when a nation is shot at (see addHate in game.js) and fades each round. A nation forms an intention by itself, or the player plants one
  // (the panel's "plant an idea" button); either way the same strike force carries it out.
  const HATE_MIN = 120, INTENT_LIFE = 40, MAX_AI_INTENTS = 4, YOU_STR = 10000;
  const intentCell = (p, it) => {       // the cell the strike force heads for, -1 when the intention is over
    const mine = x => x.owner === p;
    // a city stays the target while the enemy holds it; once its walls are down below a city, one of ours walks in and repairs it, and the first point repaired makes it ours
    if (it.k === 'city') return notAlly(p, G.co[it.t]) && G.def[it.t] > 0 ? it.t : -1;
    if (it.k === 'zone') {       // take the zone: enemy legions there are fought, empty ground is occupied, and once it is ours the force stays and defends it
      const z = G.Z[it.t]; if (!z || !z.cells.length) return -1;
      let best = null; for (const L of G.L) if (!L.dead && notAlly(p, L.owner) && G.zone[L.cell] === it.t && (!best || L.n > best.n)) best = L;
      if (best) return best.cell;
      for (const c of G.land) if (G.zone[c] === it.t && G.def[c] >= CITY_MIN && notAlly(p, G.co[c])) return c;
      return z.ai;
    }
    if (allied(p, it.t)) return -1;       // no revenge on an ally
    let bc = -1, bs = -1e18;       // nation: its most attractive city, else its nearest legion
    const mineF = G.L.filter(x => x.owner === p && x.type === 0 && !x.dead);
    const own = aiStyleOf(p).hold ? cities(p) : null, near = c => !own || own.some(q => hexDist(q, c) <= 10);       // the stay-home style strikes back only at cities close to its own land
    for (const c of G.land) if (wreckOrCity(c) && G.co[c] === it.t && near(c)) { const d = mineF.length ? Math.min(...mineF.map(x => hexDist(x.cell, c))) : 20, sc = cityPrize(c) - d * 15 - (G.lg[c] ? G.lg[c].n * 6 : 0) - G.def[c] * 0.4; if (sc > bs) { bs = sc; bc = c; } }
    if (bc >= 0) return bc;
    let bl = null, bd = 1e9; for (const L of G.L) if (!L.dead && L.owner === it.t && near(L.cell)) { const d = mineF.length ? Math.min(...mineF.map(x => hexDist(x.cell, L.cell))) : 20; if (d < bd) { bd = d; bl = L; } }
    return bl ? bl.cell : -1;
  };
  const hateOf = (p, q) => (G.hate && G.hate[p] && G.hate[p][q]) || 0;
  // ---------- alliances ----------
  const notAlly = (p, q) => q >= 0 && !allied(p, q);       // someone to plan against: an enemy, or a nation just out of an alliance
  const ALLY_LEAD = 1.3;       // a leader is a nation 30% stronger than the next one
  const power = q => cities(q).length * 200 + G.L.reduce((a, L) => a + (L.owner === q && !L.dead ? L.n : 0), 0);
  function leaderOf() {
    const al = alivePlayers(); if (al.length < 3) return -1;
    const ps = al.map(q => [q, power(q)]).sort((a, b) => b[1] - a[1]);
    return ps[0][1] >= ps[1][1] * ALLY_LEAD ? ps[0][0] : -1;
  }
  // would computer nation p take q as an ally? the answer and its reason (a text key)
  function aiWantsAlly(p, q) {
    const al = alivePlayers(), lead = leaderOf();
    if (al.length <= 2) return 'dipTwo';
    if (hateOf(p, q) >= HATE_MIN) return 'dipHate';
    if (lead === q) return 'dipLead';
    if (!al.some(x => x !== p && x !== q && !allied(p, x) && !allied(q, x))) return 'dipNoFoe';
    if (lead < 0 || lead === p) return 'dipNoNeed';
    return null;
  }
  // a player asks computer nation q for an alliance: q answers at once
  function askAlly(p, q) {
    const why = G.players[q].human ? null : aiWantsAlly(q, p);
    if (!why) setAlly(p, q, true);
    return why;
  }
  // a computer nation at the start of its turn: it leaves an alliance that no longer helps it, and teams up with another computer nation against a leader
  function aiDiplo(p) {
    const al = alivePlayers(), lead = leaderOf();
    for (const q of allyOf(p)) {
      const why = al.length <= 2 ? 'dipTwo' : q === lead ? 'dipLead' : hateOf(p, q) >= HATE_MIN ? 'dipHate' : !al.some(x => x !== p && !allied(p, x)) ? 'dipNoFoe' : null;
      if (why && setAlly(p, q, false)) aiNote(p, tr('aiUnally', pname(q), tr(why)));
    }
    if (lead < 0 || lead === p) return;
    for (const q of al) {
      if (q === p || q === lead || G.players[q].human || allied(p, q)) continue;
      if (!aiWantsAlly(p, q) && !aiWantsAlly(q, p) && setAlly(p, q, true)) { aiNote(p, tr('aiAlly', pname(q), pname(lead))); return; }       // one new ally a turn
    }
  }
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
    if (!G._strike) G._strike = {}; if (!G.aiGo) G.aiGo = {};
    const prev = [p, p + PRONG2].map(key => ({ set: G._strike[key] || new Set(), id: G.aiGo[key] ? G.aiGo[key].id : null }));
    G._strike[p] = new Set(); G._strike[p + PRONG2] = new Set();
    for (const it of [...I]) { const why = intentOver(p, it); if (why) { aiNote(p, tr(why, intentText(it))); endIntent(p, it, why); } }
    const field = G.L.filter(x => x.owner === p && x.type === 0 && x.n >= 6 && !x.dead && !isCity(x.cell) && !x.bld);
    let force = 0; for (const x of field) force += x.n;
    const need = k.force * sty.force, needHate = k.force * Math.min(sty.force, 1.3);       // the stay-home style never goes out for a city, but it does strike back
    if (field.length && force >= needHate * 0.6) {
      // revenge ideas follow the hatred: one per nation that has hurt us enough, getting stronger as the hatred grows
      for (let q = 0; q < G.players.length; q++) {
        const h = hateOf(p, q); if (q === p || !G.players[q].alive || allied(p, q)) continue;
        const ex = I.find(x => x.k === 'nation' && x.t === q);
        if (ex) { ex.str = intentStr(p, ex); if (h >= ex.last + 60) { ex.last = h; ex.until = Math.min(G.round + INTENT_LIFE, ex.until + 10); intentNote(ex, tr('itHistHate', Math.round(h))); } }
        else if (h >= HATE_MIN && I.filter(x => x.by === 'ai').length < MAX_AI_INTENTS) { addIntent(p, 'nation', q, 'ai', tr('itHistFormHate', Math.round(h))); aiNote(p, tr('aiRevenge', pname(q), Math.round(h))); }
      }
      if (!sty.hold && I.filter(x => x.k === 'city').length < (force >= STRIKE_MEN * 2 ? 2 : 1) && force >= need && I.filter(x => x.by === 'ai').length < MAX_AI_INTENTS) {       // a second city when the army can carry two strikes
        const cs = G.land.filter(i => wreckOrCity(i) && notAlly(p, G.co[i]) && !I.some(x => x.k === 'city' && x.t === i));
        // a city close to our own land, weakly held: the distance counts a lot and the defenders around it (not only the garrison) are weighed in
        const mine = cities(p), local = i => { let n = 0; for (const F of foes) if (hexDist(F.cell, i) <= 4) n += F.type === 0 ? F.n : F.n * 1.5; return n; };
        let best = -1, bd = -1e18; for (const i of cs) { const dOwn = mine.length ? Math.min(...mine.map(q => hexDist(q, i))) : 99; const sc = cityPrize(i) - dOwn * 40 - local(i) * 6 - G.def[i] * 0.4; if (sc > bd) { bd = sc; best = i; } }
        if (best >= 0) { addIntent(p, 'city', best, 'ai', tr('itHistFormCity', Math.round(cityPrize(best)))); aiNote(p, tr('aiStrike', cityName(best), Math.round(force)), 'c:' + best); }
      }
    }
    for (const it of I) it.str = intentStr(p, it);
    // the strongest idea that still has a target is the one carried out now; the others wait
    // with men enough to spare after the main strike (and not the stay-home style), the next idea with another target gets a strike of its own
    const ideas = []; for (const it of [...I].sort((a, b) => b.str - a.str)) { const c = intentCell(p, it); if (c >= 0 && !ideas.some(x => x.cell === c)) ideas.push({ act: it, cell: c }); }
    G.aiGo[p + PRONG2] = null;
    if (!ideas.length) { G.aiGo[p] = null; return; }
    aiProng(p, p, ideas[0].act, ideas[0].cell, field, need, foes, prev[0]);
    const spare = field.filter(x => !G._strike[p].has(x.id)), spareMen = spare.reduce((a, x) => a + x.n, 0);
    if (ideas.length > 1 && !sty.hold && spareMen >= STRIKE_MEN) {
      const two = ideas.find(x => x.act.id === prev[1].id) || ideas[1];       // the second strike keeps its idea while it can
      if (two.act !== ideas[0].act) { if (prev[1].id !== two.act.id) aiNote(p, tr('aiSplit', intentText(two.act))); aiProng(p, p + PRONG2, two.act, two.cell, spare, need, foes, prev[1]); }
    }
  }
  // one strike force (key: p for the main one, p + PRONG2 for the second): pick its men and batteries, gather them, then go in
  function aiProng(p, key, act, cell, field, need, foes, prev) {
    const prevStrike = prev.set, prevFor = prev.id;
    G.aiGo[key] = { obj: cell, k: act.k, id: act.id };
    const peaceful = act.k === 'zone' && !(G.lg[cell] && notAlly(p, G.lg[cell].owner)) && !(G.def[cell] >= CITY_MIN && notAlly(p, G.co[cell]));       // nobody to fight in the zone: a few legions are enough
    let near = 0; for (const F of foes) if (hexDist(F.cell, cell) <= 4) near += F.type === 0 ? F.n : F.n * 1.5;
    const want = peaceful ? 30 : act.by === 'you' ? 1e9 : Math.max(need, (near + 20) * 1.8, act.k === 'city' ? STRIKE_MEN : 0);       // about twice what holds the ground round the target, and for a city at least six full legions (what took a starting city in tests/siege_bench.js)
    // the strike force keeps its members from one turn to the next (so legions do not keep joining and leaving); the nearest field infantry fills it up to what is wanted
    const keep = act.id === prevFor ? field.filter(x => prevStrike.has(x.id)) : [];
    const mineC = cities(p), reach = Math.max(STRIKE_REACH, (mineC.length ? Math.min(...mineC.map(q => hexDist(q, cell))) : 0) + 8);       // far from our land (big maps, few nations) the force comes from round our nearest city
    let sum = 0, nInf = 0; for (const x of [...keep, ...field.filter(x => !keep.includes(x) && hexDist(x.cell, cell) <= reach).sort((a, b) => hexDist(a.cell, cell) - hexDist(b.cell, cell))]) { if (sum >= want && (act.by !== 'you' || peaceful)) break; G._strike[key].add(x.id); sum += x.n; nInf++; x.hoard = 10; }       // carry a full load of food: the march is long
    // a city held far too strongly for what we can bring is given up after a while, so the force can go for a softer one
    if (!peaceful && act.by === 'ai') {
      act.hard = near > sum * 1.2 ? (act.hard || 0) + 1 : 0;
      // a strike that gets no closer for 8 turns once it is storming (enemy legions on the way stop every march) is given up the same way
      const inf = G.L.filter(x => G._strike[key].has(x.id) && x.type === 0), dAvg = inf.length ? inf.reduce((a, x) => a + hexDist(x.cell, cell), 0) / inf.length : 99;
      if (act.dBest == null || dAvg < act.dBest - 1 || G.lg[cell] && notAlly(p, G.lg[cell].owner) && G.lg[cell].n < (act.garLow ?? 1e9)) { act.dBest = Math.min(act.dBest ?? 99, dAvg); act.garLow = G.lg[cell] ? G.lg[cell].n : 0; act.stuckFrom = G.round; }
      if (!act.storm) act.stuckFrom = G.round; else if (G.round - act.stuckFrom >= 8) act.hard = 6;
      if (act.hard >= 6) { aiNote(p, tr('aiIntentHard', intentText(act))); endIntent(p, act, 'aiIntentHard'); G.aiGo[key] = null; G._strike[key] = new Set(); return; }
    }
    // batteries go along to break the walls: about one for every two infantry legions, the nearest ones
    if (!peaceful) {
      const arts = G.L.filter(x => x.owner === p && x.type === 1 && !x.dead && !isCity(x.cell) && x.n >= TYPES[1].min && hexDist(x.cell, cell) <= reach).sort((a, b) => (prevStrike.has(b.id) && act.id === prevFor) - (prevStrike.has(a.id) && act.id === prevFor) || hexDist(a.cell, cell) - hexDist(b.cell, cell));
      for (const x of arts.slice(0, Math.max(STRIKE_ARTS, Math.ceil(nInf / 2)))) { G._strike[key].add(x.id); x.hoard = 10; }
    }
    // gather first, strike together: a rally point on supplied, uncovered ground not too far from the target; the assault starts when most of the force is there
    if (!G._rally) G._rally = {};
    let R = G._rally[key]; if (!R || R.id !== act.id) R = G._rally[key] = { id: act.id, since: G.round, cell: -1, go: false };
    const rr = reachOf(p), cv = cover(), own = 1 << p;
    if (peaceful) R.go = true;
    if (!R.go) {
      let rc = -1, rb = 1e9; for (const c of within(cell, 10)) { if (isBlockedCell(c) || G.lg[c] || rr.dist[c] < 0 || (cv.inf[c] & foeBits(p)) || hexDist(c, cell) < 4) continue; const d = hexDist(c, cell); if (d < rb) { rb = d; rc = c; } }
      R.cell = rc;
      // it goes when the infantry at the rally point comes to most of what is wanted and the batteries are there too (as many as there are, up to three)
      const strikers = G.L.filter(x => G._strike[key].has(x.id)); let there = 0, all = 0, gunsAll = 0, gunsThere = 0;
      for (const x of strikers) { const at = rc < 0 || hexDist(x.cell, rc) <= 5; if (x.type === 1) { gunsAll++; if (at) gunsThere++; continue; } all += x.n; if (at) there += x.n; }
      // and the food is in: the force carries most of a full load and the treasury holds the campaign's meals
      const food = campaignFood(p, key), fed = food.carried >= food.full * 0.8 && G.players[p].stock >= food.need;
      const ready = rc < 0 || all === 0 || (there >= Math.min(all, want) * 0.7 && all >= Math.min(want, STRIKE_MEN) * 0.6 && gunsThere >= Math.min(gunsAll, STRIKE_ARTS));
      if (ready && !fed && act.by !== 'you' && G.round - R.since <= 24) { if (R.hoardNote !== G.round) { R.hoardNote = G.round; aiNote(p, tr('aiHoard', intentText(act), G.players[p].stock, food.need)); } }
      else if (ready || G.round - R.since > (act.by === 'you' ? 8 : 24)) R.go = true;
    }
    // the siege: while our batteries can work on the garrison, the infantry waits out of the city's reach; it goes in once the garrison is weak, the guns are gone or the siege drags on
    const gar = G.lg[cell] && notAlly(p, G.lg[cell].owner) ? G.lg[cell] : null, guns = G.L.filter(x => G._strike[key].has(x.id) && x.type === 1);
    if (R.go && R.siege == null) R.siege = G.round;
    G.aiGo[key].assault = peaceful || !gar || gar.n <= TYPES[gar.type].min * 2 || !guns.length || (R.siege != null && G.round - R.siege > 12);
    act.storm = G.aiGo[key].assault;
    // cutting off help (打援): once the strike is under way, up to two infantry legions of a big enough force stand on the road from the enemy's nearest other city,
    // about 5 cells out from the target, and shoot whatever comes along it
    if (!G._block) G._block = {}; G._block[key] = new Map();
    const sInf = G.L.filter(x => G._strike[key].has(x.id) && x.type === 0);
    if (R.go && !peaceful && act.k === 'city' && sInf.length >= 4 && G.co[cell] >= 0) {
      let E = -1, ed = 1e9; for (const c of cities(G.co[cell])) { const d = hexDist(c, cell); if (c !== cell && d < ed) { ed = d; E = c; } }
      if (E >= 0 && ed > 6) {
        let bc = -1, bsc = 1e9; for (const c of within(cell, 6)) { const d = hexDist(c, cell); if (d < 4 || isBlockedCell(c)) continue; const sc = hexDist(c, E) + Math.abs(d - 5) * 2; if (sc < bsc) { bsc = sc; bc = c; } }
        if (bc >= 0) for (const x of sInf.sort((a, b) => hexDist(a.cell, bc) - hexDist(b.cell, bc)).slice(0, 2)) G._block[key].set(x.id, bc);
      }
    }
  }
  function aiRoutes(p, seen) {
    const w = new Map(), who = new Map();
    for (const F of G.L) {
      if (!notAlly(p, F.owner) || F.dead || !seen(F.cell)) continue;
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
  // cities in danger: enemy men within 5 cells outweigh our men within 2; the nearest idle legions (not the strike force) are sent there, the emptiest city first
  function aiDefend(p, foes) {
    const out = new Map(), used = new Set(), strike = allStrike(p), w = L => (L.type === 0 ? L.n : L.n * 1.5), danger = [];
    // an ally's city close to our land (within 12 cells of one of ours) is helped like our own, after our own
    const mineC = cities(p), helpC = [];
    for (const q of allyOf(p)) for (const c of cities(q)) if (mineC.some(m => hexDist(m, c) <= 12)) helpC.push(c);
    for (const c of [...mineC, ...helpC]) {
      let threat = 0; for (const F of foes) if (hexDist(F.cell, c) <= 5 && hostile(G.co[c], F.owner)) threat += w(F);
      if (!threat) continue;
      let guard = 0; for (const q of within(c, 2)) { const O = G.lg[q]; if (O && allied(O.owner, G.co[c])) guard += w(O); }
      if (threat > guard * 0.8) danger.push({ c, need: threat - guard * 0.8, empty: !G.lg[c], ally: G.co[c] !== p });
    }
    for (const c of G.land) if (G.co[c] === p && G.wasCity[c] && G.def[c] > 0 && G.def[c] < CITY_MIN && !G.lg[c]) danger.push({ c, need: 1, empty: true });       // a wrecked city of ours: someone walks in and repairs it
    danger.sort((a, b) => (!!a.ally - !!b.ally) || (b.empty - a.empty) || (b.need - a.need));
    const idle = G.L.filter(x => x.owner === p && !x.dead && x.st === 'alert' && !x.acted && !x.bld && !isCity(x.cell) && !strike.has(x.id) && x.n >= TYPES[x.type].min);
    // batteries shelling one of our cities: up to two of the nearest idle infantry legions go for each (standing right next to a battery is inside its blind spot)
    const sortie = new Map(), own = cities(p);
    for (const F of foes) {
      if (F.type !== 1 || F.dead || !own.some(c => hexDist(c, F.cell) <= TYPES[1].rmax)) continue;
      for (const x of idle.filter(x => x.type === 0 && !used.has(x.id) && hexDist(x.cell, F.cell) <= 8).sort((a, b) => hexDist(a.cell, F.cell) - hexDist(b.cell, F.cell)).slice(0, 2)) { used.add(x.id); sortie.set(x.id, F.id); }
    }
    if (!G._sortie) G._sortie = {}; G._sortie[p] = sortie;
    for (const D of danger) {
      let got = 0;
      for (const x of idle.filter(x => !used.has(x.id) && hexDist(x.cell, D.c) <= 8).sort((a, b) => hexDist(a.cell, D.c) - hexDist(b.cell, D.c))) { if (got >= D.need) break; used.add(x.id); out.set(x.id, D.c); got += w(x); }
    }
    return out;
  }
  // a march the computer gives only when the road is not a long way round (a pass held by the enemy can make the road to a cell next door fifty cells long)
  // and the legion can actually get off its cell this turn
  function aiMarch(L, c) {
    const r = planRoute(L, c); if (!r || r.cost > hexDist(L.cell, c) * 2 + 4) return false;
    if (r.path.slice(0, typ(L).budget).every(q => G.lg[q] && allied(G.lg[q].owner, L.owner))) return false;       // friends fill every cell it could reach this turn: it would not move at all
    return orderMarch(L, c);
  }
  // walk to the nearest free cell at a distance from lo to hi of `c` (stays put when already there); true when an order was given or none is needed.
  // When no such cell is free (or `avoid` rules them all out) it tries again without `avoid`, and when still nothing fits it at least walks closer
  function aiStandOff(L, c, lo, hi, avoid) {
    const d0 = hexDist(L.cell, c); if (d0 >= lo && d0 <= hi && !(avoid && avoid(L.cell))) return true;
    for (const av of avoid ? [avoid, null] : [null]) {
      const cs = within(c, hi).filter(q => { const d = hexDist(q, c); return d >= lo && !G.lg[q] && !isBlockedCell(q) && !(av && av(q)); }).sort((a, b) => hexDist(L.cell, a) - hexDist(L.cell, b));
      let tries = 0; for (const q of cs) { if (tries++ > 6) break; if (aiMarch(L, q)) return true; }
      if (av === null && d0 >= lo && d0 <= hi) return true;
    }
    if (d0 <= hi) return false;
    for (const r of [hi + 2, hi + 4, hi + 7, hi + 11]) {
      const cs = within(c, r).filter(q => !G.lg[q] && !isBlockedCell(q) && hexDist(q, c) >= lo && hexDist(q, c) < d0).sort((a, b) => hexDist(a, c) - hexDist(b, c) || hexDist(L.cell, a) - hexDist(L.cell, b));
      let tries = 0; for (const q of cs) { if (tries++ > 6) break; if (aiMarch(L, q)) return true; }
    }
    return false;
  }
  // a legion too small to be of use joins a friendly one of the same arm: merged in whole when one stands next to it, otherwise it walks over to the nearest with room
  function aiMerge(L) {
    const T = typ(L), p = L.owner;
    let best = null, bd = 1e9;
    for (const O of G.L) { if (O === L || O.dead || O.owner !== p || O.type !== L.type || O.n + L.n > T.cap) continue; const d = hexDist(L.cell, O.cell); if (d <= 6 && d < bd) { bd = d; best = O; } }
    if (!best) return false;
    if (bd === 1 && orderSplit(L, L.n, best.cell)) return true;
    if (bd === 1) return false;
    return aiStandOff(L, best.cell, 1, 1);
  }
  const smallLegion = L => L.n < (L.type === 0 ? 6 : 5);
  // new troops come out in a city and the ring round it: an idle legion standing in that ring moves 2 to 3 cells out, towards the enemy, so the city can keep building
  function aiMakeRoom(L, foes) {
    const p = L.owner, c = cities(p).find(i => hexDist(i, L.cell) === 1); if (c == null) return false;
    let near = null, nd = 1e9; for (const F of foes) { const d = hexDist(c, F.cell); if (d < nd) { nd = d; near = F; } }
    const cs = within(c, 3).filter(q => { const d = hexDist(q, c); return d >= 2 && !G.lg[q] && !isBlockedCell(q) && !cities(p).some(i => hexDist(i, q) <= 1); }).sort((a, b) => (near ? hexDist(a, near.cell) - hexDist(b, near.cell) : 0) || hexDist(L.cell, a) - hexDist(L.cell, b));
    let tries = 0; for (const q of cs) { if (tries++ > 4) break; if (orderMarch(L, q)) return true; }
    return false;
  }
  function aiLegion(L, k, foes, seen, routes) {
    const p = L.owner, T = typ(L), sty = aiStyleOf(p);
    if (L.acted || Math.random() < k.skip) return;
    const key = strikeKeyOf(L), go = G.aiGo && G.aiGo[key], inStrike = go && go.obj >= 0 && G._strike && G._strike[key] && G._strike[key].has(L.id);
    // a march goes on by itself, unless it is a strike legion still heading for an old rally point or an old target: it is turned round
    if (L.st === 'march' && L.tgt != null && !(inStrike && hexDist(L.tgt, go.obj) > (L.type === 0 ? (go.assault ? 1 : 5) : T.rmax + 1))) return;
    const onCity = isCity(L.cell);
    const ts = targetsIn(L).filter(t => seen(t.cell));
    const R = G._rally && G._rally[key], cv = cover(), foeM = foeBits(p);
    const inFoeReach = q => !!(cv.inf[q] & foeM);
    // standing on a city knocked below the threshold (an enemy's, or one of our own): whoever repairs a site owns it, so rebuild it into our own city
    if (!onCity && G.def[L.cell] > 0) {
      if (L.bld) return;       // keeps repairing (and, being on alert, still fires at round end)
      if (G.co[L.cell] >= 0 && (G.co[L.cell] === p ? G.wasCity[L.cell] : notAlly(p, G.co[L.cell]))) { if (L.sup >= BUILD_COST * 10 && canRepair(L)) orderRepair(L); return; }       // without supplies it stays put and waits for them
    }
    // sent out against a battery that shells one of our cities: next to it, then fire
    const so = G._sortie && G._sortie[p] && G._sortie[p].get(L.id);
    if (so != null) {
      const F = G.L.find(x => x.id === so && !x.dead);
      if (F) {
        if (ts.includes(F)) { orderAttack(L, F); return; }
        if (aiStandOff(L, F.cell, 1, 1)) return;
        if (ts.length) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); }
        return;
      }
    }
    // a city in danger: get into it (when it is empty) or next to it, then fight
    const dc = G._defend && G._defend[p] && G._defend[p].get(L.id);
    if (dc != null) {
      if (!G.lg[dc] && G.co[dc] === p && orderMarch(L, dc)) return;
      if (hexDist(L.cell, dc) > (L.type === 0 ? 1 : 2)) { if (aiStandOff(L, dc, 1, L.type === 0 ? 1 : 2)) return; }
      if (ts.length) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); }
      return;
    }
    // part of the strike force
    if (!onCity && inStrike) {
      // shoot when the city's garrison is in reach, or when the strike is gathering or storming; a battery still on its way keeps walking (standing still it would only fire at whatever screens the city)
      const dObj = hexDist(L.cell, go.obj), gar = ts.find(t => t.cell === go.obj);
      if (gar && splashScore(L, gar) > -20) { orderAttack(L, gar); return; }       // a battery holds its fire on the garrison when our own storming men stand round it
      if (ts.length && !(L.type === 1 && R && R.go && dObj > T.rmax && !foes.some(F => F.type === 0 && hexDist(L.cell, F.cell) <= 2))) { const t = aiPickTarget(L, ts); if (t) { orderAttack(L, t); return; } }
      const bk = G._block && G._block[key] && G._block[key].get(L.id);
      if (bk != null) { if (hexDist(L.cell, bk) > 1) aiStandOff(L, bk, 0, 1); return; }       // cutting off help: on the road, alert (it fires at whatever comes in reach)
      if (R && !R.go && R.cell >= 0) {       // still gathering: walk to the rally point and wait there
        if (hexDist(L.cell, R.cell) > 3) { for (const c of within(R.cell, 3).filter(c => !G.lg[c] && !isBlockedCell(c) && hexDist(c, go.obj) >= 4).sort((a, b) => hexDist(L.cell, a) - hexDist(L.cell, b)).slice(0, 8)) if (aiMarch(L, c)) return; }       // a big force needs room: anywhere within 3 of the rally point, out of the city's reach
        return;
      }
      if (!G.lg[go.obj] && G.def[go.obj] > 0 && G.co[go.obj] !== p && hexDist(L.cell, go.obj) <= 6 && orderMarch(L, go.obj)) return;       // an empty city is walked into (a wrecked one is stood on)
      if (L.type === 1) { aiStandOff(L, go.obj, Math.max(T.rmin, 4), T.rmax, inFoeReach); return; }       // batteries: in reach of the city, out of the garrison's
      if (!go.assault) { aiStandOff(L, go.obj, 4, 4); return; }
      // the storm is on: latecomers from far away do not walk in one by one; they meet at the rally point and go in as the next wave
      if (R && R.cell >= 0 && dObj > 6) {
        const wave = G.L.filter(x => G._strike[key].has(x.id) && x.type === 0 && hexDist(x.cell, R.cell) <= 3).reduce((a, x) => a + x.n, 0);
        if (hexDist(L.cell, R.cell) > 3) { for (const c of within(R.cell, 2).filter(c => !G.lg[c] && !isBlockedCell(c)).sort((a, b) => hexDist(L.cell, a) - hexDist(L.cell, b)).slice(0, 5)) if (aiMarch(L, c)) return; return; }
        if (wave < 40) return;
      }       // infantry waits just out of the city's reach while the guns work
      if (hexDist(L.cell, go.obj) > 2) {
        // the nearest cell we can actually walk to: first around the target itself, then in wider rings (enemy legions can wall a road off)
        for (const r of [2, 4, 6, 9, 12, 16]) {
          const cs = within(go.obj, r).filter(c => !G.lg[c] && !isBlockedCell(c) && hexDist(c, go.obj) <= r && hexDist(L.cell, c) < hexDist(L.cell, go.obj) + 1).sort((a, b) => hexDist(a, go.obj) - hexDist(b, go.obj) || hexDist(L.cell, a) - hexDist(L.cell, b));
          let tries = 0; for (const c of cs) { if (tries++ > 6) break; if (aiMarch(L, c)) return; }
        }
      }
      return;
    }
    // a small legion out in the field: shoot if there is something in reach (that costs nothing), otherwise join a bigger one
    if (!onCity && smallLegion(L) && !ts.length && !L.bld && aiMerge(L)) return;
    if (L.type === 0) {
      // a legion on its own building site keeps building it up to a solid city, then goes back to normal duty
      if (!onCity && G.co[L.cell] === p && G.def[L.cell] > 0 && G.def[L.cell] < CITY_MIN + 100) { if (!L.bld && L.sup > L.n * typ(L).bsp * BUILD_COST && canRepair(L)) orderRepair(L); return; }
      if (L.bld && G.def[L.cell] >= CITY_MIN + 100) { L.bld = false; if (G.players[p].stock < 0) return; }
      if (!onCity && L.bld) return;
      { const bp = G._bs && G._bs[p] && G._bs[p].find(x => x.lid === L.id && x.cell === L.cell); if (bp && G.def[L.cell] === 0 && L.sup > L.n * typ(L).bsp * BUILD_COST && canRepair(L)) { orderRepair(L); return; } }
      // an enemy city with nobody in it is walked into
      if (go && go.obj >= 0 && !G.lg[go.obj] && G.co[go.obj] !== p && hexDist(L.cell, go.obj) <= 5 && !sty.hold && orderMarch(L, go.obj)) return;
      if (onCity) {
        if (G.def[L.cell] < CITY_MAX && L.sup > supCost(L) * 4 + L.n * typ(L).bsp * BUILD_COST && G.players[p].stock > (sty.hold ? 250 : 700) && canRepair(L)) orderRepair(L);
        else if (ts.length) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); }
        return;
      }
      if (ts.length) {
        let foeStr = 0; for (const F of foes) if (hexDist(L.cell, F.cell) <= 4) foeStr += F.type === 0 ? F.n : F.n * 1.5;
        let friends = 0; for (const c of within(L.cell, 3)) { const F = G.lg[c]; if (F && F.owner === p) friends += F.type === 0 ? F.n : F.n * 0.5; }
        const committed = !sty.hold && go && go.obj >= 0 && hexDist(L.cell, go.obj) <= 8;       // once a strike on a city is under way its men fight on
        if (committed || friends >= foeStr * k.dare * sty.dare) { const t = aiPickTarget(L, ts); if (t) orderAttack(L, t); }
        return;
      }
      if (sty.hold && aiPosture(L, p)) return;
      aiMakeRoom(L, foes);
      return;       // otherwise nothing to do: stay on guard, which costs no command point
    }
    // artillery: stay behind the infantry and shoot
    const inf2 = foes.filter(F => F.type === 0 && hexDist(L.cell, F.cell) <= 2);
    if (inf2.length && !onCity) {
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
    if (!sty.hold && !onCity && routes && routes.w.size && aiSuppress(L, p, sty, foes, routes)) return;
    if (!onCity) aiMakeRoom(L, foes);
  }
  // who gets the command points first: the defence of a city in danger, the strike force, legions with a target in reach, builders, then the rest
  function aiOrderOf(p, seen) {
    const df = (G._defend && G._defend[p]) || new Map(), sk = allStrike(p), bs = (G._bs && G._bs[p]) || [];
    const so = (G._sortie && G._sortie[p]) || new Map();
    const pri = L => df.has(L.id) || so.has(L.id) ? 0 : sk.has(L.id) ? 1 : targetsIn(L).some(t => seen(t.cell)) ? 2 : (L.bld || bs.some(x => x.lid === L.id)) ? 3 : 4;
    return shuffle(G.L.filter(x => x.owner === p)).map(L => [pri(L), L]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  // the computer's turn: every order is given, shown and carried out one step at a time (`play` shows the step and does its effect); false when the turn was cut short
  async function aiTurn(p, play) {
    const flush = async () => { const s = stepsEnd(); stepsBegin(); if (!play) for (const x of s) if (x.note) pushNote(x.note); return !play || !s.length || (await play(s)); };
    stepsBegin();
    const k = AIK[(G.aiLevel && G.aiLevel[p]) || 'normal'] || AIK.normal;
    const fogV = S.fog ? visMask(p) : null, seen = c => !fogV || !!fogV[c];
    const foes = G.L.filter(x => hostile(p, x.owner) && seen(x.cell));
    aiShift(p);
    aiDiplo(p);
    aiProduce(p, k, foes);
    if (!(await flush())) { stepsEnd(); return false; }
    aiThink(p, k, aiStyleOf(p), foes);
    if (!(await flush())) { stepsEnd(); return false; }
    aiBuildCity(p, k, aiStyleOf(p), foes); aiBuildCity(p, k, aiStyleOf(p), foes);
    if (!(await flush())) { stepsEnd(); return false; }
    const routes = aiRoutes(p, seen);
    if (!G._defend) G._defend = {}; G._defend[p] = aiDefend(p, foes);
    for (const L of aiOrderOf(p, seen)) {
      if (L.dead || L.acted) continue;
      const cont = L.st === 'march' && L.tgt != null && L.mvRound !== G.round;       // a march from an earlier turn goes on
      aiLegion(L, k, foes, seen, routes);
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
