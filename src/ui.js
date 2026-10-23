
  // ---------- view options (display only, no rule effect) ----------
  const V = { supply: true };
  try { Object.assign(V, JSON.parse(localStorage.getItem('idlewars-view-3') || '{}')); } catch (e) {}
  const saveV = () => { try { localStorage.setItem('idlewars-view-3', JSON.stringify(V)); } catch (e) {} };
  function syncView() {
    { const c = $('sSupplyLine'); if (c) c.checked = V.supply; }
  }

  // ---------- camera ----------
  // the follow indicator in the header: on while the camera follows the computer; blinks once the player's own pan or zoom has switched it off
  function camUI() { const b = $('camBtn'); if (!b) return; const off = !!(G && G._camOff); b.classList.toggle('off', off); b.querySelector('span').textContent = tr(off ? 'camOff' : 'camOn'); b.title = tr(off ? 'camTipOff' : 'camTipOn'); b.disabled = !G || G.over; }
  function camPause() { if (G && !G._camOff && !humanTurn()) { G._camOff = true; G.paused = true; ui(true); } }
  // glide the view to a point (zoom unchanged); gives up at once if the player grabs the map
  function camTo(x, y, ms) {
    return new Promise(res => {
      const x0 = view.cx, y0 = view.cy, t0 = performance.now(), g = G;
      const fr = t => {
        if (G !== g || g._camOff) return res();
        const k = Math.min(1, (t - t0) / ms), e = k * k * (3 - 2 * k);
        view.cx = x0 + (x - x0) * e; view.cy = y0 + (y - y0) * e; clampCam(); requestDraw();
        if (k < 1) requestAnimationFrame(fr); else res();
      };
      requestAnimationFrame(fr);
    });
  }
  // events that are not a legion's own step (a zone changing hands, supplies cut, an order cancelled ...) go to the same caption, one after another
  const evQ = []; let evBusy = false, evDropped = 0;
  function castEvent(text) {
    if (!text || !G || quick()) return;
    if (evQ.length >= 6) { evDropped++; return; }
    evQ.push(text); if (!evBusy) runEvents();
  }
  async function runEvents() {
    evBusy = true; const g = G;
    while (evQ.length && G === g) {
      while (G === g && G.aiShow) await sleep(200);
      cast(evQ.shift() + (evQ.length === 0 && evDropped ? tr('evMore', evDropped) : ''), null); if (!evQ.length) evDropped = 0;
      await sleep(1600);
    }
    if (G === g && !G.aiShow) cast('');
    evBusy = false;
  }
  // the running commentary: who is about to do what (shown before each step)
  function castText(s) {
    const B = pnameB(s.p), L = s.id != null ? G.L.find(x => x.id === s.id) : null, ln = L ? bk(lname(L)) : '', zn = c => zoneName(G.zone[c]);
    if (s.k === 'march') return tr('castMarch', B, ln, L ? L.n : 0, zn(s.cell), zn(s.to));
    if (s.k === 'atk') { const T = s.tid != null ? G.L.find(x => x.id === s.tid) : null; return tr('castAtk', B, ln, T ? pnameB(T.owner) : '', bk(T ? lname(T) : lnameById(s.tid)), zn(s.to)); }
    if (s.k === 'rep') return tr('castRep', B, ln, isCity(s.cell) ? cm(cityName(s.cell)) : zn(s.cell));
    if (s.k === 'build') return tr('castBuild', B, cm(cityName(s.cell)), s.n, tr('ty_' + TYPES[s.type].k));
    return s.merge ? tr('castMerge', B, ln, s.amt, bk(lnameById(s.tid))) : tr('castSplit', B, ln, s.amt, bk(lnameById(s.tid)));
  }
  // who is to move, in the middle of the board with the avatar
  let turnBnT = 0;
  async function showTurn(p, ms, lines) {
    const el = $('turnBn'); if (!el) return;
    // an uploaded face may still be decoding: wait for it (a moment at most) so the banner never shows the bare flag-colored disc
    const up = G && G.avImg && G.avImg[p] ? uploadFace(G.avImg[p]) : null;
    for (let k = 0; up && !up.ready && k < 12; k++) await sleep(50);
    el.firstElementChild.src = avatarURL(p); el.querySelector('b').textContent = tr('turnBn', pname(p));
    el.querySelector('ul').innerHTML = (lines || []).map(l => `<li${l.you ? ' class="you"' : ''}>${esc(l.t)}</li>`).join('');
    el.style.setProperty('--tc', hue(p)); el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(turnBnT); turnBnT = setTimeout(() => { el.hidden = true; }, ms);
  }
  function cast(text, p) {
    const el = $('cast'); if (!el) return;
    if (!text) { el.hidden = true; return; }
    el.innerHTML = rich(text); el.style.borderLeftColor = p != null ? hue(p) : 'transparent'; el.hidden = false;
  }
  // how long the computer stays on each step (a setting, 1 to 2 seconds, default 1.5; longer at the slow animation speed)
  const stepMs = () => Math.round(1000 * (S.step || 1.5));
  // one step of the computer, played live: the commentary, a sound, the camera and an arrow first; then the step really happens (a march walks right now); then a short pause.
  // Every step is played, one after another; only what the watching human could see (fog) is skipped, and a player who grabs the map is left alone.
  async function playLive(g, p, steps) {
    for (const s of steps) {
      if (G !== g || g.players[g.cur].human || g.cur !== p) return false;
      if (!quick() && g.paused) { await holdWhilePaused(g); if (G !== g || g.players[g.cur].human || g.cur !== p) return false; }       // paused (by the button or by the player grabbing the map): wait here, whether or not this step would be shown
      if (s.note) { pushNote(s.note); renderAi(); }
      const fv = S.fog ? visMask(viewer()) : null;
      const seen = !fv || fv[s.cell] || (s.to != null && s.to >= 0 && fv[s.to]);
      const show = !quick() && !g._camOff && seen;
      if (show) {
        g.stepCount = (g.stepCount || 0) + 1;
        g.aiShow = s; g._aiLast = s.cell; renderCard(); cast(castText(s), s.p); snd.step(s.k); requestDraw();
        await camTo(G.X[s.cell], G.Y[s.cell], 450);
      }
      if (g.clearing) { /* the clearing rules: the step is only shown, nothing is walked or shot until the end of the round */ }
      else if (s.k === 'march') { const L = G.L.find(x => x.id === s.id); if (L && !L.dead) { L.mvRound = G.round; marchLegion(L); G.L = G.L.filter(x => !x.dead); requestDraw(); } }
      else if (s.k === 'atk') { const L = G.L.find(x => x.id === s.id), T = G.L.find(x => x.id === s.tid); if (L && T && fireNow(L, T)) requestDraw(); }
      if (show) await sleep(Math.max(0, stepMs() - 450));
    }
    return true;
  }
  function fitCam(initial) {
    const { cw, ch } = view;
    view.fit = Math.min(cw / W, ch / H); view.min = Math.min(view.fit * 0.9, 0.5); view.max = 3.5;
    view.cx = W / 2; view.cy = H / 2; view.s = view.fit;
    if (initial && G) {           // a new game starts zoomed in on your land (or the middle of the map when only computers play); the Fit button shows the whole board
      const z = Math.min(view.max, Math.max(view.fit * 1.9, 0.85));
      if (G.players.some(p => p.human && p.alive)) myLand(z); else { view.s = z; clampCam(); }
    }
  }
  function myLand(z) {
    if (!G) return;
    mineId(); const h = G.lastHuman != null && G.players[G.lastHuman].alive ? G.players[G.lastHuman] : G.players.find(p => p.human && p.alive); if (!h) return;
    const cs = cities(h.id);
    let cx = 0, cy = 0;
    if (cs.length) { for (const c of cs) { cx += G.X[c]; cy += G.Y[c]; } cx /= cs.length; cy /= cs.length; }
    else { const ls = G.L.filter(L => L.owner === h.id); if (!ls.length) return; for (const L of ls) { cx += G.X[L.cell]; cy += G.Y[L.cell]; } cx /= ls.length; cy /= ls.length; }
    view.cx = cx; view.cy = cy; view.s = Math.max(view.fit, z || 1); clampCam(); requestDraw();
  }
  function clampCam() {
    view.s = Math.max(view.min, Math.min(view.max, view.s));
    view.cx = Math.max(0, Math.min(W, view.cx)); view.cy = Math.max(0, Math.min(H, view.cy));
  }
  function zoomAt(px, py, f) {
    const wx = (px - view.cw / 2) / view.s + view.cx, wy = (py - view.ch / 2) / view.s + view.cy;
    view.s = Math.max(view.min, Math.min(view.max, view.s * f));
    view.cx = wx - (px - view.cw / 2) / view.s; view.cy = wy - (py - view.ch / 2) / view.s;
    clampCam(); requestDraw();
  }

  // ---------- input ----------
  let lastWorld = [0, 0];
  function pickCell(ev) {
    const r = $('board').getBoundingClientRect();
    const wx = (ev.clientX - r.left - view.cw / 2) / view.s + view.cx, wy = (ev.clientY - r.top - view.ch / 2) / view.s + view.cy;
    lastWorld = [wx, wy];
    const x = wx - M - SZ * SQ / 2, y = wy - M - SZ;
    const q = (SQ / 3 * x - y / 3) / SZ, rr = (2 / 3 * y) / SZ;
    let rx = Math.round(q), rz = Math.round(rr), ry = Math.round(-q - rr);
    const dx = Math.abs(rx - q), dy = Math.abs(ry + q + rr), dz = Math.abs(rz - rr);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const row = rz, col = rx + (rz - (rz & 1)) / 2;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    const i = idx(col, row);
    return G.zone[i] >= 0 ? i : -1;
  }
  const selLegion = () => (G && G.sel >= 0 && G.lg[G.sel] && G.lg[G.sel].owner === viewer() ? G.lg[G.sel] : null);
  const canOrder = L => humanTurn() && L && canAct(L);
  const flash = k => { G.flash = k ? tr(k) : ''; };
  // a refused order is explained in a small window instead of a line in the card
  let denyFn = null, denyAlt = null;
  function deny(title, body) {
    denyFn = null; denyAlt = null; $('denyNo').hidden = true; $('denyAlt').hidden = true; $('denyOk').textContent = tr('denyOk'); for (const id of ['denyNo', 'denyAlt', 'denyOk']) $(id).dataset.tone = '';
    $('denyT').textContent = title; $('denyP').textContent = body || ''; $('denyModal').hidden = false; $('denyOk').focus();
  }
  // the same window as a yes / no question: fn runs only when the player confirms (Esc, Enter or a click outside count as no)
  // `alt` is the other way of going ahead: [label, fn] (shown between the cancel and the main button)
  function confirmBox(title, body, okText, noText, fn, alt, tones) { deny(title, body); if (tones) ['denyNo', 'denyAlt', 'denyOk'].forEach((id, i) => { $(id).dataset.tone = tones[i] || ''; }); denyFn = fn; $('denyOk').textContent = okText; $('denyNo').textContent = noText; $('denyNo').hidden = false; if (alt) { denyAlt = alt[1]; $('denyAlt').textContent = alt[0]; $('denyAlt').hidden = false; } $('denyNo').focus(); }
  const denyClose = () => { $('denyModal').hidden = true; denyFn = null; denyAlt = null; };
  const denyYes = () => { const fn = denyFn; denyClose(); if (fn) fn(); };
  const denyOther = () => { const fn = denyAlt; denyClose(); if (fn) fn(); };
  const whyAp = L => !canOrder(L) ? (humanTurn() && L && !L.acted && !L.dead && L.owner === G.cur ? [tr('dnNoCp'), tr('dnNoCpB', cpMax(G.cur))] : [tr('dnNoAp'), tr('dnNoApB')]) : null;
  function whyMarch(L, i) {
    const a = whyAp(L); if (a) return a;
    const O = i >= 0 ? G.lg[i] : null;
    if (i < 0 || G.zone[i] < 0) return [tr('rHole'), tr('dnHoleB')];
    if (i === L.cell) return [tr('rSame'), tr('dnSameB')];
    if (isBlockedCell(i)) return [tr('dnBlocked'), tr('dnBlockedB')];
    if (O && O.owner !== L.owner) return [tr('rEnemyThere'), tr('dnEnemyB')];
    if (O) return [tr('rFriendThere'), tr('dnFriendB')];
    return [tr('rNoPath'), tr('dnNoPathB')];
  }
  function whyAttack(L, i) {
    const a = whyAp(L); if (a) return a;
    if (L.st !== 'alert') return [tr('rNotAlert'), tr('dnNotAlertB')];
    const [lo, hi] = rangeOf(L), d = i >= 0 ? hexDist(L.cell, i) : -1, T = i >= 0 ? lgAt(i) : null;
    if (i < 0 || G.zone[i] < 0) return [tr('rHole'), tr('dnHoleB')];
    if (d < lo) return [tr('rClose'), tr('dnCloseB', lo, d)];
    if (d > hi) return [tr('rFar'), tr('dnFarB', lo, hi, d)];
    if (G.clearing && L.type === 0) return [tr('dnCorner'), tr('dnCornerB')];
    if (!T) return [tr('rNoUnit'), tr('dnNoUnitB')];
    if (T.owner === L.owner) return [tr('rOwn'), tr('dnOwnB')];
    return [tr('xBadAttack'), ''];
  }
  function whySplit(L, amt, i) {
    const a = whyAp(L); if (a) return a;
    const T = typ(L), O = i >= 0 ? G.lg[i] : null;
    if (amt < 1 || amt > L.n) return [tr('dnSplitAmt'), tr('dnSplitAmtB', L.n)];
    if (i < 0 || G.zone[i] < 0 || !linked(L.cell, i)) return [tr('dnSplitFar'), tr('dnSplitFarB')];
    if (isBlockedCell(i)) return [tr('dnBlocked'), tr('dnBlockedB')];
    if (O) {
      if (O.owner !== L.owner) return [tr('rEnemyThere'), tr('dnSplitEnemyB')];
      if (O.type !== L.type) return [tr('rOtherType'), tr('dnSplitTypeB')];
      if (O.acted && !O.recvN) return [tr('dnRecvActed'), tr('dnRecvActedB')];
      if (O.n >= T.cap) return [tr('rFull'), tr('dnFullB', T.cap)];
      const left = L.n - Math.min(amt, T.cap - O.n);
      if (left > 0 && left < T.min) return [tr('dnMinLeft'), tr('dnMergeLeftB', T.min)];
    }
    if (amt < T.min) return [tr('dnMinNew'), tr('dnMinNewB', T.min)];
    if (L.n - amt < T.min) return [tr('dnMinLeft'), tr('dnMinLeftB', T.min)];
    return [tr('xBadSplit'), ''];
  }
  function whyRepair(L) {
    const a = whyAp(L); if (a) return a;
    const c = L.cell;
    if (L.st !== 'alert') return [tr('dnRepState'), tr('dnRepStateB')];
    if (L.bld) return [tr('dnRepAlready'), tr('dnRepAlreadyB')];
    if (G.def[c] >= CITY_MAX) return [tr('dnRepMax'), tr('dnRepMaxB', CITY_MAX)];
    if (isCity(c) && G.co[c] !== L.owner) return [tr('dnRepEnemy'), tr('dnRepEnemyB')];
    return [tr('xNoOrder'), ''];
  }
  function whyBuy(c, type, n) {
    const p = G.co[c], T = TYPES[type];
    if (!citySupplied(p, c)) return [tr('dnBuyCut'), tr('dnBuyCutB')];
    if (G.players[p].pending.some(o => o.city === c && o.at === G.round)) return [tr('dnBuyOnce'), tr('dnBuyOnceB')];
    if (cityRoom(c, p, type) < T.min) return [tr('dnBuyRoom'), tr('dnBuyRoomB')];
    if (n * T.cost > G.players[p].stock) return [tr('dnBuyMoney'), tr('dnBuyMoneyB', n * T.cost, G.players[p].stock)];
    if (!buyOK(c, p, type, n)) return [tr('dnBuyFit'), tr('dnBuyFitB', T.min)];
    return [tr('xNoBuy'), ''];
  }
  function onClick(ev) {
    if (!G) return;
    camPause();
    G.blink = -1;
    const i = pickCell(ev);
    if (i < 0) { G.sel = -1; G.focus = -1; G.mode = null; flash(); ui(true); requestDraw(); return; }
    const L = selLegion();
    if (humanTurn() && L && G.mode === 'march') {
      if (orderMarch(L, i)) { G.mode = null; flash(); snd.select(); } else deny(...whyMarch(L, i));
      ui(true); requestDraw(); return;
    }
    if (humanTurn() && L && G.mode === 'attack') {
      const T = lgAt(i);
      if (G.clearing) { if (orderStrike(L, i, L.type === 0 ? vertexCells(i, lastWorld[0], lastWorld[1]) : null)) { G.mode = null; flash(); snd.select(); } else deny(...whyAttack(L, i)); ui(true); requestDraw(); return; }
      if (T && attackNow(L, T, G.clearing && L.type === 0 ? vertexCells(i, lastWorld[0], lastWorld[1]) : null)) { G.mode = null; flash(); snd.select(); } else deny(...whyAttack(L, i));
      ui(true); requestDraw(); return;
    }
    if (humanTurn() && L && G.mode === 'split') {
      if (orderSplit(L, G.splitN, i)) { G.mode = null; flash(); snd.reinforce(); } else deny(...whySplit(L, G.splitN, i));
      ui(true); requestDraw(); return;
    }
    G.mode = null; flash();
    const O = G.lg[i], me = viewer();
    if (G.sel !== i) G._buyOpen = false;
    if ((O && O.owner === me) || (G.def[i] > 0 && G.co[i] === me)) { if (G.sel !== i) snd.select(); G.sel = i; G.focus = -1; }
    else { G.focus = i; G.sel = -1; }       // one thing at a time: looking at something that is not yours drops your selection (attack orders go through the Attack button)
    ui(true); requestDraw();
  }
  const ptrs = new Map(); let drag = null, pinch = null;
  function onDown(ev) {
    $('board').setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.size === 1) drag = { x: ev.clientX, y: ev.clientY, cx: view.cx, cy: view.cy, moved: false };
    else if (ptrs.size === 2) { drag = null; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; }
  }
  function onMove(ev) {
    if (!G) return;
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], r = $('board').getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      zoomAt(mx, my, pinch.s * d / pinch.d / view.s); return;
    }
    if (drag) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; $('board').classList.add('grab'); }
      if (drag.moved) { camPause(); view.cx = drag.cx - dx / view.s; view.cy = drag.cy - dy / view.s; clampCam(); requestDraw(); return; }
    }
    if (ev.pointerType === 'mouse') {
      const i = pickCell(ev), r0 = $('board').getBoundingClientRect();
      G.hoverPx = { x: ev.clientX - r0.left, y: ev.clientY - r0.top }; G.hoverW = lastWorld.slice();
      if (i !== G.hover) { G.hover = i; hintUI(); requestDraw(); } else if (G.mode) requestDraw();
    }
  }
  function onUp(ev) {
    const was = ptrs.has(ev.pointerId); ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) pinch = null;
    $('board').classList.remove('grab');
    if (drag && !drag.moved && ev.type === 'pointerup' && was) onClick(ev);
    if (ptrs.size === 0) drag = null;
  }

  // ---------- numbers shown to the player ----------
  function stats() {
    if (G._sv === G.ver) return G._st;
    const P = G.players.length, st = Array.from({ length: P }, () => ({ n: 0, men: 0, legions: 0, infN: 0, infM: 0, artN: 0, artM: 0 }));
    for (const i of G.land) { const o = G.co[i]; if (o >= 0 && G.def[i] >= CITY_MIN) st[o].n++; }
    for (const L of G.L) { const s = st[L.owner]; s.men += L.n; s.legions++; if (L.type === 0) { s.infN++; s.infM += L.n; } else { s.artN++; s.artM += L.n; } }
    G._sv = G.ver; G._st = st; return st;
  }
  // fog of war as seen by the human at the table
  const viewer = () => { if (!G) return 0; if (G.players[G.cur].human) return G.cur; const h = G.players.find(p => p.human && p.alive); return h ? h.id : G.cur; };
  // the nation 'mine' means in the directory: the human one, or the one played last while everything is on autopilot
  const mineId = () => { if (!G) return 0; const h = G.players[G.cur].human ? G.cur : (G.players.find(p => p.human && p.alive) || {}).id; if (h != null) { G.lastHuman = h; return h; } return G.lastHuman != null ? G.lastHuman : G.cur; };
  function fogVis() {
    if (!S.fog || !G) return null;
    const key = G.ver + ':' + viewer();
    if (G._fk !== key) { G._fk = key; G._fv = visMask(viewer()); }
    return G._fv;
  }
  const seeLegion = L => { if (!L) return null; const v = fogVis(); return !v || L.owner === viewer() || v[L.cell] ? L : null; };
  const lgAt = i => seeLegion(G.lg[i]);
  // short hover line: no output figure, no nation name (the avatar in front already says whose it is)
  function cellLine(i, names) {
    const bits = [];
    if (names && G.zone[i] >= 0) bits.push(zoneName(G.zone[i]));       // the status bar names the zone and the city under the pointer
    if (names && G.def[i] >= CITY_MIN) bits.push(`【${cityName(i)}】`);
    if (G.def[i] >= CITY_MIN) bits.push(tr('cityDef', G.def[i]));
    else if (G.def[i] > 0) bits.push(tr('siteLine', G.def[i]));
    const L = lgAt(i); if (L) bits.push(`${bk(lname(L))}·${L.n}人`);
    return bits.join(' · ');
  }
  const stateText = L => {
    let s = tr('st_' + L.st);
    if (L.st === 'march' && L.tgt != null) { const t = routeTurns(L, L.tgt); s += t > 0 ? ` · ${L.eta0 > t ? tr('etaLeft', t, L.eta0) : tr('etaAll', t)}` : ''; }
    if (L.atk) s += ' · ' + tr('atkOrdered');
    if (L.bld) s += ' · ' + tr('repairing');
    return s;
  };
  function odds(Lsrc, T) {
    const rate = hitRate(Lsrc, T), exp = Lsrc.n * rate / 100, dmg = exp * TYPES[Lsrc.type].dmg, men = dmg / typ(T).per;
    return { rate, exp, men };
  }

  // this round's split of a zone: first the total, then one line per nation
  function liveShares() {
    if (G._lsv === G.ver) return G._ls;
    G._ls = zoneShares(); G._lsv = G.ver; return G._ls;
  }
  // zone ground: a lone holder's color (light), grey if nobody has shares, red if nations fight over it; fog hides what you cannot see
  function zoneFills() {
    const fv = fogVis(), key = G.ver + ':' + (fv ? viewer() : -1);
    if (G._zfk === key) return G._zf;
    const sh = liveShares(), me = viewer(), out = G.Z.map((z, zi) => {
      let m = sh[zi];
      if (fv && m) { m = new Map([...m].filter(([o]) => o === me)); }
      if (!m || !m.size) return (!sh[zi] && z.holder >= 0 && (!fv || z.holder === me)) ? blendHex('#f3f4f1', hue(z.holder), TINT_IDLE) : ZONE_NONE;       // nobody is on guard: the last sole holder still gets the output, shown in a fainter tint
      if (m.size === 1) return blendHex('#f3f4f1', hue([...m.keys()][0]), TINT_HELD);
      return ZONE_FIGHT;
    });
    G._zfk = key; G._zf = out; return out;
  }
  function zoneLines(zi) {
    const z = G.Z[zi], m = liveShares()[zi], fv = fogVis(), me = viewer(), out = [tr('zOutLine', z.out)];
    let tot = 0; if (m) for (const v of m.values()) tot += v;
    // the output goes by big cities only: nations with cities here first (most cities first), then nations that only have legions here
    const order = m ? [...m].sort((a, b) => b[1] - a[1]).map(x => x[0]) : [];
    const cts = G.land.filter(c => G.zone[c] === zi && G.def[c] >= CITY_MIN && G.co[c] >= 0), lgs = G.L.filter(L => !L.dead && G.zone[L.cell] === zi);
    for (const L of lgs) if (!order.includes(L.owner)) order.push(L.owner);
    for (const o of order) {
      if (fv && o !== me) continue;
      const mc = cts.filter(c => G.co[c] === o);
      if (mc.length) {
        out.push(tr('zShareLine', nameOf(o), mc.length, Math.round(z.out * mc.length / tot)));
        out.push('\u3000' + tr('zCities', mc.map(c => `【${cityName(c)}】${tr("defShort")}${G.def[c]}`).join(' ')));
      } else out.push(tr('zNoShareLine', nameOf(o)));
    }
    out.push(m && m.size ? tr('zRule', tot) : tr('zNobodyWhy'));
    return out;
  }

  // ---------- panels ----------
  const fmt1 = v => (Math.round(v * 10) / 10).toString();
  function buyState() { if (!G.buy) G.buy = { type: 0, n: 5 }; return G.buy; }
  // the cell the Info and Actions tabs talk about: the selected one, else the one being looked at, else (computer's turn) the one it is acting on
  const infoCell = () => G.sel >= 0 ? G.sel : G.focus >= 0 ? G.focus : (!G.players[G.cur].human && !G.over && G._aiLast >= 0 ? G._aiLast : -1);
  const stripOps = html => { const t = document.createElement('div'); t.innerHTML = html; t.querySelectorAll('.ops-part').forEach(n => n.remove()); return t.innerHTML; };
  function zoneInfoHTML(cell) {
    const z = G.zone[cell];
    return `<div class="card"><div class="hd"><div><div class="t">${nameEdit('z', z, zoneName(z), true)}<span class="kw">（${tr('zoneWord')}）</span></div></div></div><div class="sub">${zoneLines(z).join('<br>')}</div></div>`;
  }
  function foeHTML(F) {
    const T = typ(F);
    return `<div class="card"><div class="hd"><img alt="" src="${avatarURL(F.owner)}"><div><div class="t">${esc(lname(F))}</div><div class="s">${pname(F.owner)} · ${esc(zoneName(G.zone[F.cell]))}</div></div></div>`
      + `<div class="kv"><span>${tr('men')}</span><b>${F.n}/${T.cap}人</b><span>${tr('state')}</span><b>${stateText(F)}</b>`
      + `<span>${tr('supply')}</span><b>${F.starve > 0 ? `<span class="warn">${tr('starving', F.starve)}</span>` : `${tr('daysN', daysLeft(F))} <span class="sub">(${F.sup})</span>`}</b><span>${tr('range')}</span><b>${rangeOf(F).join('–')}</b></div>${supplyHTML(F)}</div>`;
  }
  // everything about the cell, top to bottom: the zone, then the city or building site, then the legion and its supplies
  function infoHTML(cell) {
    const L = lgAt(cell), me = viewer(), parts = [zoneInfoHTML(cell)];
    if (G.def[cell] > 0) parts.push(stripOps(cityHTML(cell)));
    if (L) parts.push(L.owner === me ? stripOps(legionHTML(L)) : foeHTML(L));
    return parts.map(h => `<section class="isec">${h}</section>`).join('');
  }
  // the short version for the Actions tab: one line each for the zone, the city and the legion
  function briefHTML(cell) {
    const L = lgAt(cell), z = G.zone[cell];
    const city = G.def[cell] >= CITY_MIN ? `<b>${tr('cityWord')}</b>【${esc(cityName(cell))}】${tr('cityDef', G.def[cell])}` : G.def[cell] > 0 ? `<b>${tr("cityWord")}</b>${tr("siteLine", G.def[cell])}` : '';
    return `<div class="bl bl2"><span><b>${tr('zoneWord')}</b>${esc(zoneName(z))}</span>${city ? `<span>${city}</span>` : ''}</div>`
      + (L ? `<div class="bl"><b>${tr('lgWord')}</b>${esc(lname(L))} ${L.n}人 · ${stateText(L)}</div>` : '');
  }
  // the order buttons come only from what you have selected that is yours
  function opsHTML() {
    const sc = G.sel, L = selLegion(); let o = '';
    const take = html => { const t = document.createElement('div'); t.innerHTML = html; t.querySelectorAll('.ops-part').forEach(n => { o += n.innerHTML; }); };
    if (L) take(legionHTML(L));
    if (sc >= 0 && G.def[sc] > 0 && (isCity(sc) ? G.co[sc] === viewer() : true)) take(cityHTML(sc));
    if (o.includes('data-act="buyOpen"')) {       // the produce button always sits at the top right, next to the legion orders
      const box = document.createElement('div'); box.innerHTML = o;
      const b = box.querySelector('button[data-act="buyOpen"]'), row = b.parentElement;
      b.classList.add('buybtn'); if (!row.children.length || row.children.length === 1) row.remove(); else b.remove();
      const first = box.querySelector('.obtns');
      if (first) first.appendChild(b); else { const r = document.createElement('div'); r.className = 'obtns'; r.appendChild(b); box.insertBefore(r, box.firstChild); }
      o = box.innerHTML;
    }
    return o;
  }
  // names in the card heading are only shown (no renaming)
  function nameEdit(kind, id, text) { return esc(text); }
  // ---------- command mode: what would happen under the pointer ----------
  function cmdCheck(L, h) {
    const key = [G.ver, G.mode, L.id, h, G.clearing && G.hoverW ? (G.hoverW[0] >> 3) + ',' + (G.hoverW[1] >> 3) : ''].join(':');
    if (G._cmd && G._cmd.key === key) return G._cmd.r;
    let r;
    if (G.mode === 'march') {
      const O = h >= 0 ? G.lg[h] : null;
      if (h < 0 || G.zone[h] < 0) r = { no: 'rHole' };
      else if (h === L.cell) r = { no: 'rSame' };
      else if (O && O.owner !== L.owner) r = { no: 'rEnemyThere' };
      else if (O) r = { no: 'rFriendThere' };
      else {
        const rt = planRoute(L, h);
        if (!rt) r = { no: 'rNoPath' };
        else {
          const path = [L.cell, ...rt.path], cv = cover(); let stop = -1;
          for (let k = 1; k < path.length; k++) if ((cv.inf[path[k]] & ~(1 << L.owner)) !== 0) { stop = k; break; }
          r = { ok: true, path: stop >= 0 ? path.slice(0, stop + 1) : path, full: path, stop: stop >= 0 ? path[stop] : -1, turns: routeTurns(L, h) };
        }
      }
    } else if (G.clearing) {
      if (h < 0 || G.zone[h] < 0) r = { no: 'rHole' };
      else {
        const d = hexDist(L.cell, h), [lo, hi] = rangeOf(L);
        if (d < lo) r = { no: 'rClose' }; else if (d > hi) r = { no: 'rFar' };
        else if (L.type === 0) { const vc = vertexCells(h, G.hoverW ? G.hoverW[0] : G.X[h], G.hoverW ? G.hoverW[1] : G.Y[h]); r = vc.length === 3 && vc.every(c => { const k = hexDist(L.cell, c); return k >= lo && k <= hi; }) ? { ok: true, T: { cell: h }, cells: vc } : { no: 'rFar' }; }
        else r = { ok: true, T: { cell: h }, cells: [h, ...nbrs(h).filter(c => c >= 0 && G.zone[c] >= 0)] };
      }
    } else {
      const T = h >= 0 ? lgAt(h) : null;
      if (!T) r = { no: 'rNoUnit' };
      else if (T.owner === L.owner) r = { no: 'rOwn' };
      else {
        const d = hexDist(L.cell, T.cell), [lo, hi] = rangeOf(L);
        if (d < lo) r = { no: 'rClose' }; else if (d > hi) r = { no: 'rFar' }; else r = { ok: true, T, men: odds(L, T).men };
      }
    }
    G._cmd = { key, r }; return r;
  }
  function legionHTML(L) {
    const T = typ(L), ok = canOrder(L), ctl = L.owner === viewer();
    const [lo, hi] = rangeOf(L);
    const hoardSel = `<select id="hoardS" data-act="hoard" title="${tr('hoard')}">${[0, 3, 5, 8, 10].map(v => `<option value="${v}" ${L.hoard === v ? 'selected' : ''}>${v === 0 ? tr('hoardOff') : String(v).padStart(2, '0')}</option>`).join('')}</select>`;
    const sup = L.starve > 0 ? `<span class="warn">${tr('starving', L.starve)}</span>` : `${tr('daysN', daysLeft(L))} <span class="sub">(${L.sup})</span>`;
    let h = `<div class="hd"><img alt="" src="${avatarURL(L.owner)}"><div><div class="t">${nameEdit('l', L.id, lname(L), ctl)}</div><div class="s">${pname(L.owner)} · ${esc(zoneName(G.zone[L.cell]))}${isCity(L.cell) ? ' · 【' + esc(cityName(L.cell)) + '】' : ''}</div></div></div>`;
    h += `<div class="kv"><span>${tr('men')}</span><b>${L.n}/${T.cap}人</b><span>${tr('state')}</span><b>${stateText(L)}</b>`
      + `<span>${tr('supply')}</span><b>${sup}</b>` + (ctl ? `<span>${tr('hoardS')}</span><b>${hoardSel}</b>` : '') + `<span>${tr('range')}</span><b>${lo}–${hi}</b>`;
    if (L.bld) h += `<span class="full">${tr('building', G.def[L.cell], CITY_MAX)}</span>`;
    h += `</div>`;
    if (ctl) h += supplyHTML(L);
    if (ctl) {
      let o = '';
      o += `<div class="obtns" title="${tr('orders')} · ${L.acted ? tr('apUsed') : tr('apFree')}">`
        + `<button data-act="march" aria-pressed="${G.mode === 'march'}" title="${ok ? '' : tr('rNoAp')}" ${ok ? '' : 'disabled'}>${tr('cmdMarch')}</button>`
        + `<button data-act="attack" aria-pressed="${G.mode === 'attack'}" title="${!ok ? tr('rNoAp') : L.st !== 'alert' ? tr('rNotAlert') : !G.clearing && !targetsIn(L).some(t => lgAt(t.cell)) ? tr('rNoTarget') : ''}" ${ok && L.st === 'alert' && (G.clearing || targetsIn(L).some(t => lgAt(t.cell))) ? '' : 'disabled'}>${tr('cmdAttack')}</button>`
        + `<button data-act="split" title="${tr('minHint', T.min)}" aria-pressed="${G.mode === 'split'}" ${ok ? '' : 'disabled'}>${tr('split')}</button><button data-act="repair" title="${G.def[L.cell] < CITY_MAX && !L.bld ? tr('repairHint', L.n, L.n * BUILD_COST, G.def[L.cell]).replace(/"/g, '') : ''}" ${canRepair(L) && humanTurn() ? '' : 'disabled'}>${tr('cmdRepair')}</button></div>`;
      if (!ok && humanTurn()) o += `<div class="sub">${(L.acted ? (orderText(L) ? tr('apNone', orderText(L)) : L.why ? tr(L.why[0], lname(L), lnameById(L.why[1])) : tr('apActed', lname(L))) : tr('dnNoCp'))}</div>`;
      const stop = k => `<div class="sub modehint"><span>${tr(k)}</span><button class="mhx" data-act="cancelMode" title="Esc">${tr('cancelMode')} ✕</button></div>`;
      if (G.mode === 'march') o += stop('pickTarget');
      if (G.mode === 'attack') o += stop('pickAttack');
      if (G.mode === 'split') {
        G.splitN = Math.max(1, Math.min(L.n, G.splitN));
        o += `<div class="stepper"><span class="olabel" style="margin:0">${tr('splitGo')}</span><input type="range" id="splitR" min="1" max="${L.n}" value="${G.splitN}" aria-label="${tr('split')}"><output id="splitO">${G.splitN}</output></div>`
          + stop('pickSplit');
      }
      h += `<div class="ops-part">${o}</div>`;
    }
    return `<div class="card">${h}</div>`;
  }
  function cityHTML(c) {
    const p = G.co[c], mine = p === viewer();
    if (!isCity(c)) return `<div class="card"><div class="hd"><div><div class="t">${tr('site')}</div><div class="s">${tr('siteLine', G.def[c])} · ${tr('cityKeep', cityUpkeep(G.def[c]))}</div></div></div><div class="sub">${tr('siteNote', CITY_MIN)}</div></div>`;
    const P = G.players[p], b = buyState(), T = TYPES[b.type], supplied = citySupplied(p, c);
    const room = cityRoom(c, p, b.type), maxN = Math.max(0, Math.min(room, Math.floor(P.stock / T.cost)));
    b.n = Math.max(T.min, Math.min(Math.max(T.min, maxN), b.n));
    let h = `<div class="hd"><div><div class="t">${nameEdit('c', c, cityName(c), mine)}<span class="kw">（${tr('cityWord')}）</span></div><div class="s">${[tr('citySizeDef', G.def[c]), tr('cityOut', Math.floor(G.def[c] * S.tax / 100)), tr('cityKeep', cityUpkeep(G.def[c])), tr('citySup', citySupCap(G.def[c])), pname(p), esc(zoneName(G.zone[c]))].map((x, k, a) => `<span class="nw">${x}${k < a.length - 1 ? ' ·' : ''}</span>`).join(' ')}</div></div></div>`;
    if (mine) {
      let o = '';
      if (!supplied) o += `<div class="warn">${tr('cityCut')}</div>`;
      const ordNow = P.pending.filter(x => x.at === G.round && x.city === c);       // one order per city per turn
      const canBuy = supplied && maxN >= T.min;
      o += `<div class="obtns"><button data-act="buyOpen" aria-pressed="${!!G._buyOpen}" ${supplied && room >= T.min && !ordNow.length ? '' : 'disabled'}>${tr('produce')}</button></div>`;
      if (G._buyOpen && supplied && room >= T.min && !ordNow.length) {
        o += `<div class="obtns" title="${tr('produce')}">${TYPES.map((t, k) => `<button data-act="buyType" data-v="${k}" aria-pressed="${b.type === k}">${tr('ty_' + t.k)} · ${t.cost}/${tr('perMan')}</button>`).join('')}</div>`;
        const okBuy = buyOK(c, p, b.type, b.n);
        if (maxN >= T.min) {
          o += `<div class="stepper"><input type="range" id="buyR" min="${T.min}" max="${maxN}" value="${b.n}" aria-label="${tr('produce')}"><output id="buyO">${b.n}</output></div>`
            + `<div class="stepper sub"><span>${tr('cost')} <b id="buyC">${b.n * T.cost}</b> · ${tr('ready')} <b>${tr('inTurns', T.build)}</b></span><span style="margin-left:auto;display:flex;gap:6px"><button class="btn alt sm" data-act="buyOpen" title="Esc">✕ ${tr('cancelMode')}</button><button class="btn sm" data-act="buy" title="${tr('roomN', room)}" ${okBuy ? '' : 'disabled'}>${tr('placeOrder')}</button></span></div>${okBuy ? '' : `<div class="sub warn">${tr('minNew', T.min)}</div>`}`;
        } else o += `<div class="sub">${tr('cantAfford')}</div>`;
      } else if (supplied && (room < T.min || ordNow.length)) { const pn = ordNow; o += `<div class="sub">${pn.length ? tr('cityOrdered', cityName(c), pn.map(x => x.n + '人' + tr('ty_' + TYPES[x.type].k)).join('、')) : tr('cityFull')}</div>`; }
      void canBuy;
      h += `<div class="ops-part">${o}</div>`;
    }
    h += citySupplyHTML(c);
    const pend = P.pending.filter(o => o.city === c);
    if (pend.length && (mine || p === viewer())) h += `<div class="olabel">${tr('queue')}</div><ul class="pend">${pend.map(o => `<li>${tr('ty_' + TYPES[o.type].k)} × ${o.n} · ${o.t > 0 ? tr('inTurns', o.t) : tr('waitRoom')}</li>`).join('')}</ul>`;
    return `<div class="card">${h}</div>`;
  }
  function renderCard() {
    if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ren')) return;     // do not wipe a name being typed
    if (G._aiCur !== G.cur) { G._aiCur = G.cur; G._aiLast = -1; }
    const el = $('card'), el2 = $('card2'), ops = $('ops'), cell = infoCell(), mineTurn = humanTurn();
    $('opsBlk').classList.toggle('off', !mineTurn);
    ops.dataset.empty = mineTurn ? tr('opsEmpty') : G.over ? tr('opsOver') : tr('opsWait', pname(G.cur));
    const emptyTxt = tr(!G.players[G.cur].human && !G.over ? 'selAi' : 'selEmpty'); $('selEmpty').textContent = emptyTxt; $('selEmpty2').textContent = emptyTxt;
    if (cell < 0 || G.zone[cell] < 0) { for (const e of [el, el2]) { e.hidden = true; e.innerHTML = ''; } ops.innerHTML = ''; $('selEmpty').hidden = false; $('selEmpty2').hidden = false; return; }
    el.hidden = false; el.innerHTML = infoHTML(cell);
    el2.hidden = false; el2.innerHTML = (G.flash ? `<div class="warn">${G.flash}</div>` : '') + briefHTML(cell);
    $('selEmpty').hidden = true; $('selEmpty2').hidden = true; ops.innerHTML = opsHTML();
  }
  function hintUI() {
    if (!G) return;
    const img = $('hintImg'), t = $('hintText');
    img.hidden = true;
    if (G.over) { t.textContent = tr('hOver'); return; }
    if (G.clearing && !G._phase && G.busy && !G.players[G.cur].human) { img.hidden = false; img.src = avatarURL(G.cur); t.textContent = tr('phIntent', pname(G.cur)); return; }
    if (G.busy && !G._phase && !G.players[G.cur].human) { img.hidden = false; img.src = avatarURL(G.cur); t.textContent = tr('hThink', pname(G.cur)); return; }
    if (G.busy && G._phase) { t.textContent = tr(G._phase); return; }
    if (G.busy) { t.textContent = tr('hResolve'); return; }
    const h = G.hover;
    if (G.mode === 'march' && h >= 0) {
      const L = selLegion();
      if (L) { const tt = routeTurns(L, h); t.textContent = tt > 0 && validTarget(L, h) ? tr('hMarchOk', tt) + (cellLine(h, true) ? ' · ' + cellLine(h, true) : '') : tr('xBadTarget'); return; }
    }
    if (h >= 0) { const o = G.def[h] >= CITY_MIN ? G.co[h] : (lgAt(h) ? lgAt(h).owner : -1); if (o >= 0) { img.hidden = false; img.src = avatarURL(o); } t.textContent = cellLine(h, true); return; }
    if (G.players[G.cur].human) { t.innerHTML = tr(G.clearing ? 'phIntentMe' : 'hPick'); return; }
    img.hidden = false; img.src = avatarURL(G.cur); t.textContent = G.clearing ? tr('phIntent', pname(G.cur)) : tr('hThink', pname(G.cur));
  }
  // nations table: the panel shows the first few, the dialog all of them
  function natRows(limit, wide) {
    const st = stats(), hide = id => S.fog && id !== viewer();
    const upk = id => { let u = 0; for (const L of G.L) if (L.owner === id) u += supCost(L); for (const c of G.land) if (G.def[c] > 0 && G.co[c] === id) u += cityUpkeep(G.def[c]); return u; };
    const rows = [...G.order].map(id => ({ id, n: st[id].n, s: st[id], a: G.players[id].alive, u: upk(id) }));
    rows.sort((a, b) => (b.a - a.a) || (b.n - a.n) || (b.s.men - a.s.men));
    const shown = limit ? rows.slice(0, limit) : rows, q = i => (hide(i) ? '?' : '');
    // legions come in two kinds, each shown as "legions/men"
    let h = `<div class="r hd"><i style="visibility:hidden"></i><span></span><em>${tr('colCity')}</em><em>${tr('colInf')}</em><em>${tr('colArt')}</em><em>${tr('stock')}</em><em>${tr('income')}</em><em>${tr('upkeep')}</em>` + (wide ? '<em></em>' : '') + `</div>`;
    h += shown.map(r => `<div class="r ${r.id === G.cur ? 'cur' : ''} ${r.a ? '' : 'out'} ${r.id === G.blink ? 'blk' : ''}" data-p="${r.id}"><i style="background:${hue(r.id)}"></i><span>${pname(r.id)}${wide && !G.players[r.id].human && G.aiStyle ? `<small class="sty">${tr('st_' + (G.aiStyle[r.id] || 'balanced'))}</small>` : ''}</span><b>${r.n}</b>`
      + `<b>${q(r.id) || `${r.s.infN}/${r.s.infM}`}</b><b>${q(r.id) || `${r.s.artN}/${r.s.artM}`}</b><b>${q(r.id) || G.players[r.id].stock}</b><b>${q(r.id) || '+' + G.players[r.id].income}</b><b>${q(r.id) || '−' + r.u}</b>`
      + (wide ? `<button class="cb" data-ctl="${r.id}" ${r.a && !G.over ? '' : 'disabled'}>${G.players[r.id].human ? tr('autoPlay') : tr('takeOver')}</button>` : '') + `</div>`).join('');
    if (limit && rows.length > limit) h = h.replace(`<span></span>`, `<span><a href="#" id="natMore">${tr('allShort')} +${rows.length - limit}</a></span>`);
    return h;
  }
  // the two rule switches under the camera buttons: fog of war, and who acts when (in turn, or cleared together at the end of the round)
  function ruleBtns() {
    const fog = $('zFog'), clr = $('zClr'); if (!fog || !clr) return;
    fog.textContent = tr(S.fog ? 'zFogOn' : 'zFogOff'); fog.setAttribute('aria-pressed', !!S.fog); fog.title = tr('zFogTip');
    clr.textContent = tr(G && G.clearing ? 'zModeClr' : 'zModeSeq') + (G && !!G.clearing !== !!S.clr ? ' → ' + tr(S.clr ? 'zModeClr' : 'zModeSeq') + tr('zNextRound') : ''); clr.setAttribute('aria-pressed', !!(G && G.clearing)); clr.title = tr('zModeTip');
  }
  function ui(full) {
    if (!G) return;
    ruleBtns();
    if (G.avImg) for (const u of G.avImg) if (u) uploadFace(u);       // decode uploaded faces early
    $('roundNo').textContent = G.round;
    { mineId(); $('zMine').textContent = G.lastHuman != null ? tr('mineOf', nameOf(G.lastHuman)) : tr('mine'); }       // the button says who "me" is right now
    { const tn = $('turnName'); tn.firstElementChild.src = avatarURL(G.cur); tn.firstElementChild.dataset.avp = tn.children[1].dataset.avp = G.cur; tn.firstElementChild.title = tn.children[1].title = tr('avTip'); tn.children[1].textContent = pname(G.cur); const ss = $('styleSel'); ss.value = (G.aiStyle && G.aiStyle[G.cur]) || 'steady'; ss.title = tr('aiStyleL'); const ls = $('levelSel'); ls.value = (G.aiLevel && G.aiLevel[G.cur]) || 'normal'; ls.title = tr('aiLevelL'); }
    camUI(); const pb = $('pauseBtn'); pb.textContent = G.paused ? tr('resumeBtn') : tr('pauseBtn'); pb.classList.toggle('on', !!G.paused); pb.disabled = G.over;
    { const h = G.players[G.cur].human; const tk = $('ctlBtn'), au = $('autoBtn'); tk.disabled = G.over || h; au.disabled = G.over || !h; tk.title = tr('takeTip'); au.title = tr('autoTip'); }       // play this nation / hand it over: only the one that makes sense is clickable, pause or not
    $('endBtn').disabled = !humanTurn();
    { const eb = $('endBtn'), key = G.ver + ':' + G.round + ':' + G.cur, warn = humanTurn() && G._endWarn === key;
      eb.classList.toggle('warn', !!warn); eb.textContent = warn ? tr('endWarn') : tr('endTurn'); const bk = $('endBack'); bk.hidden = !warn; bk.textContent = tr('endBack'); }
    { const ff = $('ffBtn'); ff.disabled = G.over || G.busy && humanTurn() || G._ff === G.round || !!G.pause; ff.title = tr(humanTurn() ? 'ffTipHuman' : 'ffTip'); }
    $('nat').innerHTML = natRows(Math.max(3, Math.min(16, Math.floor((window.innerHeight - 640) / 22))));
    renderCard(); hintUI();
    if (typeof renderDir === 'function') renderDir();
    if (typeof renderTodo === 'function') renderTodo();
    if (typeof renderAi === 'function') renderAi();
    if (typeof renderEco === 'function') renderEco();
  }

  // ---------- drawing ----------
  let raf = 0, dirty = true, lastDraw = 0;
  function requestDraw() { dirty = true; if (!raf) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0;
    const anim = !!G && !G.over;
    if (dirty || (anim && t - lastDraw >= 60)) { dirty = false; lastDraw = t; draw(t); }
    if (anim || dirty) raf = requestAnimationFrame(frame);
  }
  const cellPath = i => { if (!G.cp[i]) { const p = new Path2D(); hexPath(p, G.X[i], G.Y[i]); G.cp[i] = p; } return G.cp[i]; };
  function pill(ctx, x, y, text, k, bg, fg, edge) {
    ctx.font = `800 ${11 * k}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 9 * k, h = 14 * k;
    ctx.fillStyle = bg || 'rgba(12,18,24,0.88)'; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.stroke(); } ctx.fillStyle = fg || '#fff'; ctx.fillText(text, x, y + 0.5 * k);
  }
  function drawLegion(ctx, L, now, z) {
    const o = L.owner;
    let x = G.X[L.cell], y = G.Y[L.cell];
    if (L.mv && !quick()) {
      const k = (now - L.mv.t0) / (L.mv.dur || 320 * parseFloat(S.speed) * G.speedMul) ;
      if (k < 0) { x = G.X[L.mv.from]; y = G.Y[L.mv.from]; }       // waiting for its turn in the clearing
      else if (k < 1) { const e = k * k * (3 - 2 * k), fx = G.X[L.mv.from], fy = G.Y[L.mv.from]; x = fx + (x - fx) * e; y = fy + (y - fy) * e; }
      else L.mv = null;
    }
    if (z < 0.2) { ctx.fillStyle = hue(o); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); return; }
    const fs = z >= 0.85 ? 14 : Math.min(26, Math.max(11.5, 9 / z));
    let badge = null;
    if (z >= 0.55) badge = L.starve > 0 ? { k: 'starve', t: L.starve >= STARVE_AFTER ? '−' + (L.type === 0 ? 2 : 1) : String(STARVE_AFTER - L.starve) } : L.bld ? { k: 'bld' } : { k: 'sup', t: String(L.sup), low: daysLeft(L) < 2 };
    legionMark(ctx, x, y, { color: hue(o), type: L.type, n: L.n, fs, badge });
  }
  // the legion label with its state mark and badge; shared by the map and the help legend
  // a city cell: a ring of wall (dashed for a site under 100), the defense number in the upper left corner where no legion label covers it
  function cityMark(ctx, x, y, dd, wallColor, withNumber) {
    const big = dd >= CITY_MIN;
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); for (let e = 0; e < 6; e++) { const a = (30 + 60 * e) * Math.PI / 180; const px = 17.5 * Math.cos(a), py = 17.5 * Math.sin(a); e ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath();
    ctx.lineJoin = 'round';
    if (big) { ctx.strokeStyle = 'rgba(20,24,30,0.85)'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = wallColor; ctx.lineWidth = 3.4; ctx.setLineDash([]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(40,30,20,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.stroke(); }
    ctx.restore(); ctx.setLineDash([]);
    if (withNumber) pill(ctx, x, y - 17.5, String(dd), 0.72, big ? '#37424d' : '#8a5a2b');       // the defence number sits right above the cell
  }
  function legionMark(ctx, x, y, o) {
    // a label instead of an icon: type character plus two digits of men, in the nation's color. No state mark: what a legion does this turn is shown by its orders
    const label = (o.type === 0 ? '步' : '炮') + String(o.n).padStart(2, '0'), fs = o.fs;
    ctx.save(); ctx.globalAlpha = 1;
    ctx.font = `800 ${fs}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,16,22,0.9)'; ctx.strokeText(label, x, y); ctx.fillStyle = o.color; ctx.fillText(label, x, y);
    ctx.restore();
    // one corner badge, only the most urgent: out of supplies (red countdown), repairing (hammer), otherwise the supplies on hand as a number (yellow under two turns of food)
    if (o.badge) {
      const bx = x, by = y + 17.5;          // right below the cell, opposite the defence number above it
      if (o.badge.k === 'starve') {
        ctx.beginPath(); ctx.arc(bx, by, 6.5, 0, 7); ctx.fillStyle = '#d6322b'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 9px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.badge.t, bx, by + 0.5);
      } else if (o.badge.k === 'sup') {      // the legion's supplies: a number, yellow when it is under two turns of food
        { const m = /^#([0-9a-f]{6})$/i.exec(o.color || ''), v = m ? parseInt(m[1], 16) : 0, lum = m ? 0.3 * (v >> 16) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255) : 0;
          pill(ctx, bx, by, o.badge.t, 0.72, m ? o.color : 'rgba(12,18,24,0.88)', lum > 150 ? '#111' : '#fff', o.badge.low ? '#e02424' : 'rgba(255,255,255,0.85)'); }
      } else if (o.badge.k === 'bld') {      // repairing: a hammer on an orange disc
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fillStyle = '#ff9f2e'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.font = '10px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('🔨', bx, by + 0.5);
      }
    }
  }

  // animated backdrop: slow and dark so it never competes with the board
  // the backdrop: slow drifting clouds
  function drawBackground(ctx, cv, now) {
    const w = cv.width, h = cv.height, d = view.dpr, t = now / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2b3e'); g.addColorStop(1, '#27394f'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 11; k++) {
      const sp = 6 + (k % 4) * 3, r = (90 + (k * 53) % 90) * d, cx = (((k * 197 + t * sp) % (w / d + 300)) - 150) * d, cy = (((k * 131) % 100) / 100 * 0.9 + 0.05) * h;
      for (let j = 0; j < 3; j++) { const x = cx + (j - 1) * r * 0.6, rg = ctx.createRadialGradient(x, cy, 0, x, cy, r); rg.addColorStop(0, 'rgba(205,222,240,0.10)'); rg.addColorStop(1, 'rgba(205,222,240,0)'); ctx.fillStyle = rg; ctx.fillRect(x - r, cy - r, r * 2, r * 2); }
    }
  }

  // why a legion's supplies cannot get through: walk the straight way to the nearest big city and name the enemy infantry that covers the first blocked cell
  function cutReason(L) {
    const key = G.ver + ':' + L.id; if (G._cr && G._cr.key === key) return G._cr.t;
    const p = L.owner, cv = cover(), cts = cities(p), fv = fogVis(); let t = tr('cutWhyNone'), best = -1, bd = 1e9;
    for (const c of cts) { const d = hexDist(L.cell, c); if (d < bd) { bd = d; best = c; } }
    const r = best >= 0 ? findPath(G.link, L.cell, best, v => { const o = G.lg[v]; return o && o.owner !== p ? 3 : 1; }) : null;
    if (r && r.path) {
      for (const c of r.path) {
        if (!cutFor(p, c, cv)) continue;
        const O = G.lg[c], list = [];
        if (O && O.owner !== p) list.push(O);
        for (const F of G.L) { if (F.dead || F.owner === p || F.type !== 0 || F.st === 'march' || list.includes(F)) continue; const [lo, hi] = rangeOf(F), d = hexDist(F.cell, c); if (d >= lo && d <= hi) list.push(F); }
        const vis = list.filter(F => !fv || fv[F.cell]).sort((a, b) => hexDist(a.cell, c) - hexDist(b.cell, c)).slice(0, 2);
        const names = vis.map(F => `${pnameB(F.owner)}的${lname(F)}`).join('、');
        if (c === L.cell) t = vis.length ? tr('cutWhyHere', names, L.st === 'march' ? tr('cutMarching') : '') : tr('cutWhyHidden', zoneName(G.zone[c]));       // its own cell is in the enemy's range and none of our infantry covers it
        else t = vis.length ? tr('cutWhy', names, zoneName(G.zone[c])) : tr('cutWhyHidden', zoneName(G.zone[c]));
        break;
      }
    }
    G._cr = { key, t: t === tr('cutWhyNone') && r && r.path ? tr('cutWhyAround') : t }; return G._cr.t;
  }
  // a legion's supplies in detail: where they come from, how far, and what is lost on the way (distance, and which enemy batteries cover the road)
  // everything about one legion's supply road: the source city, the length, what is lost, and which enemy batteries cost it what
  function supplyOf(L) {
    const p = L.owner, rr = reachOf(p), d = rr.dist[L.cell];
    if (d < 0) return { cut: true };
    const route = []; for (let c = L.cell; c >= 0; c = rr.par[c]) route.push(c);
    const src = route[route.length - 1];
    if (d === 0) return { d, src, home: true, total: 0 };
    const extra = Math.max(0, Math.ceil(d / 6) - 1), far = d, per = new Map();
    for (const F of G.L) {
      if (F.dead || F.owner === p || F.type !== 1 || F.st === 'march') continue;
      const T = typ(F), R = T.rmax + (isCity(F.cell) ? T.cb : 0); let s = 0;
      for (const c of route) { const dd = hexDist(F.cell, c); if (dd >= T.rmin && dd <= R) s += F.n; }
      if (s > 0) per.set(F, s);
    }
    const art = [...per.values()].reduce((a, b) => a + b, 0);
    return { d, src, extra, far, art, per, total: Math.min(100, far + art) };
  }
  function supplyHTML(L) {
    const o = supplyOf(L), fv = fogVis();
    const head = `<div class="olabel">${tr('supHead')}</div>`;
    if (o.cut) return `<div class="supinfo">${head}<div class="warn">${esc(cutReason(L))}</div></div>`;
    if (o.home) return `<div class="supinfo">${head}<div>${tr('supHome', esc(cityName(o.src)))}</div></div>`;
    let h = head + `<div>${tr('supFrom', esc(cityName(o.src)), esc(zoneName(G.zone[o.src])), o.d, o.extra ? tr('supTurns', o.extra) : tr('supNow'))}</div>`;
    h += `<div${o.total >= 50 ? ' class="bad"' : o.total >= 30 ? ' class="warn2"' : ''}>${tr('supLoss', o.total, o.far, o.art, o.far)}</div><div class="sub">${tr('supFormula')}</div>`;
    if (o.total >= 100) h += `<div class="warn">${tr('supAllLost')}</div>`;
    let hid = 0;
    for (const [F, s] of [...o.per].sort((a, b) => b[1] - a[1])) { if (fv && !fv[F.cell]) { hid += s; continue; } h += `<div class="sup2">${tr('supBy', esc(pnameB(F.owner)), esc(lname(F)), F.n, s, Math.round(s / F.n))}</div>`; }
    if (hid) h += `<div class="sup2">${tr('supHidden', hid)}</div>`;
    return `<div class="supinfo">${h}</div>`;
  }
  // a big city's side of it: the legions whose supplies come from here, with the road length and what they lose
  function citySupplyHTML(c) {
    const p = G.co[c], fv = fogVis(), me = viewer(); if (fv && p !== me) return '';
    const rows = [];
    for (const L of G.L) {
      if (L.owner !== p || L.dead) continue;
      const o = supplyOf(L); if (o.cut || o.src !== c) continue;
      rows.push({ L, o });
    }
    if (!rows.length) return '';
    rows.sort((a, b) => b.o.total - a.o.total);
    const avg = Math.round(rows.reduce((s, r) => s + r.o.total, 0) / rows.length), far = rows.reduce((s, r) => Math.max(s, r.o.d), 0);
    const list = rows.map(({ L, o }) => `<div class="sup2${o.total >= 50 ? ' bad' : o.total >= 30 ? ' warn2' : ''}">${o.home ? tr('supRowHome', esc(lname(L))) : tr('supRow', esc(lname(L)), o.d, o.total, o.extra)}</div>`).join('');
    return `<div class="supinfo"><div>${tr('supCity', rows.length, avg, far)}</div>${list}</div>`;
  }
  // supply routes: from each big city to each legion it feeds (cached per board state)
  // a legion that has not yet finished sliding to its new cell still counts as standing on the old one, so that the supply lines change step by step with the moves
  const sliding = (L, now) => !!L.mv && !quick() && !L.dead && L.mv.from !== L.cell && now < L.mv.t0 + (L.mv.dur || 320 * parseFloat(S.speed) * G.speedMul) + 1;
  function supplyViz() {
    const now = performance.now(), pend = G.L.filter(L => sliding(L, now)), mv = pend.map(L => L.id).join(',');
    if (G._svz && G._svz.ver === G.ver && G._svz.mv === mv) return G._svz;
    let undo = null;
    if (pend.length) {       // the state as it is drawn now: the unfinished legions back on their old cells, with every cache set aside
      const now0 = pend.map(L => [L, L.cell]), sv = { cv: G.cv, cvVer: G.cvVer, reach: G.reach, ver: G.ver };
      for (const [L, c] of now0) if (G.lg[c] === L) G.lg[c] = null;
      for (const [L] of now0) { L.cell = L.mv.from; if (!G.lg[L.cell]) G.lg[L.cell] = L; }
      G.cv = null; G.cvVer = 0; G.reach = []; G.ver = sv.ver + 0.5;
      undo = () => {
        for (const [L] of now0) if (G.lg[L.cell] === L) G.lg[L.cell] = null;
        for (const [L, c] of now0) { L.cell = c; G.lg[c] = L; }
        G.cv = sv.cv; G.cvVer = sv.cvVer; G.reach = sv.reach; G.ver = sv.ver;
      };
    }
    const real = undo ? G.ver - 0.5 : G.ver;
    try { return supplyCompute(mv, real); } finally { if (undo) undo(); }
  }
  function supplyCompute(mv, ver) {
    const cv = cover(), out = { ver, mv, lines: new Map(), hot: [], cuts: [] };
    for (const P of G.players) {
      if (!P.alive) continue;
      const rr = reachOf(P.id), own = cv.artOwn.get(P.id), seen = new Set(), solid = [], dashed = [];
      for (const L of G.L) {
        if (L.owner !== P.id) continue;
        const d = rr.dist[L.cell];
        if (d < 0) { out.cuts.push(L); continue; }
        if (d === 0) continue;
        if (supplyOf(L).total >= 100) out.cuts.push(L);       // everything is lost on the road: marked like a cut-off legion
        const slow = Math.ceil(d / 6) - 1 > 0;
        for (let c = L.cell; rr.par[c] >= 0; c = rr.par[c]) {
          const n = rr.par[c], key = c * 65536 + n; if (seen.has(key)) continue; seen.add(key);
          const hot = cv.artTot[c] - (own ? own[c] : 0) > 0 || cv.artTot[n] - (own ? own[n] : 0) > 0;
          // supplies travel from the city (n) to the legion (c)
          (hot ? out.hot : slow ? dashed : solid).push([G.X[n], G.Y[n], G.X[c], G.Y[c]]);
        }
      }
      out.lines.set(P.id, { solid, dashed });
    }
    G._svz = out; return out;
  }
  // a stream of small arrowheads running along each supply edge, city to legion:  > > > > >
  // the end of a line pulled back a little, so that the (round) end of the stroke hides under the arrow head instead of sticking out past its tip
  const pullBack = (x1, y1, x2, y2, d) => { const l = Math.hypot(x2 - x1, y2 - y1) || 1, k = Math.min(d, l * 0.5) / l; return [x2 - (x2 - x1) * k, y2 - (y2 - y1) * k]; };
  // an arrow head at the end of a line; U keeps it readable when the map is zoomed far out
  function arrowHead(ctx, x1, y1, x2, y2, c, U) {
    const a = Math.atan2(y2 - y1, x2 - x1), k = 13 * U;
    ctx.save(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - k * Math.cos(a - 0.45), y2 - k * Math.sin(a - 0.45)); ctx.lineTo(x2 - k * Math.cos(a + 0.45), y2 - k * Math.sin(a + 0.45)); ctx.closePath();
    ctx.lineWidth = 2.6 * U; ctx.strokeStyle = 'rgba(10,16,22,0.85)'; ctx.stroke(); ctx.fillStyle = c; ctx.fill(); ctx.restore();
  }
  // the four things an order or a computer step can be, drawn the same way for you and for the computer: a march / split / merge (green flowing dashes, arrow at the end), an attack (red), a repair (orange arrow jumping over the city), new troops (yellow arrow)
  const RANGE_COLOR = 'rgba(255,90,70,0.95)';       // the range outlines are red, the reach outlines are in the nation's colour
  const ORDER_COLOR = { march: 'rgba(125,255,176,0.95)', atk: 'rgba(255,90,70,0.95)', rep: '#ff9f2e', build: '#ffd23f' };
  function flowLine(ctx, pts, c, U, now) {
    const n = pts.length; if (n < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    pts.forEach(([x, y], i) => { if (i === n - 1) { const q = pullBack(pts[i - 1][0], pts[i - 1][1], x, y, 7 * U); ctx.lineTo(q[0], q[1]); } else i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(10,16,22,0.6)'; ctx.lineWidth = 5.4 * U; ctx.stroke();
    ctx.setLineDash([7 * U, 5 * U]); ctx.lineDashOffset = -now / 50; ctx.strokeStyle = c; ctx.lineWidth = 2.8 * U; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore(); arrowHead(ctx, pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1], c, U);
  }
  // a marker pin hopping over a city: a hammer on orange = repairing, the character 兵 on yellow = new troops
  function bounceArrow(ctx, x, y, c, U, ph, k) {
    ctx.save(); ctx.translate(x, y - (34 + ph * 6) * U); ctx.scale(U, U); ctx.lineJoin = 'round';
    ctx.lineWidth = 3.4; ctx.strokeStyle = 'rgba(10,16,22,0.85)'; ctx.fillStyle = c = ORDER_COLOR.build;       // repairing and building share one look
    const body = () => { ctx.beginPath(); ctx.roundRect(-21, -15, 42, 24, 8); }, tip = () => { ctx.beginPath(); ctx.moveTo(-7.5, 7); ctx.lineTo(0, 21); ctx.lineTo(7.5, 7); ctx.closePath(); };
    body(); ctx.stroke(); tip(); ctx.stroke(); body(); ctx.fill(); tip(); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 15px ${MONO}`; ctx.fillStyle = '#3a2b00';
    ctx.fillText(tr(k === 'rep' ? 'pinRep' : 'pinBuild'), 0, -2.5);
    ctx.restore();
  }
  function chevrons(ctx, edges, now, size) {
    const phase = (now / 900) % 1;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of edges) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, cnt = Math.max(3, Math.round(len / (size * 2.3)));
      for (let i = 0; i < cnt; i++) {
        const t = ((i + phase) / cnt) * len, px = x1 + ux * t, py = y1 + uy * t;
        ctx.moveTo(px - ux * size + nx * size * 0.75, py - uy * size + ny * size * 0.75); ctx.lineTo(px, py); ctx.lineTo(px - ux * size - nx * size * 0.75, py - uy * size - ny * size * 0.75);
      }
    }
    ctx.stroke();
  }

  // cells the selected legion can reach this turn: as many steps as it walks, not through enemies, and a hostile infantry's range ends the walk
  function reachCells(L) {
    const key = G.ver + ':' + L.id + ':' + L.cell;
    if (G._rcz && G._rcz.key === key) return G._rcz.path;
    const cv = cover(), T = typ(L), seen = new Map([[L.cell, 0]]), q = [L.cell], path = new Path2D(), set = new Set([L.cell]);
    for (let h = 0; h < q.length; h++) {
      const u = q[h], dd = seen.get(u); if (dd >= T.budget) continue;
      if (u !== L.cell && (cv.inf[u] & ~(1 << L.owner)) !== 0) continue;
      for (let e = 0; e < 6; e++) {
        const v = G.link[u * 6 + e]; if (v < 0 || seen.has(v)) continue;
        const O = G.lg[v]; if (O && O.owner !== L.owner) continue;
        seen.set(v, dd + 1); q.push(v);
        if (!O || (O.type === L.type && O.n < T.cap)) { path.addPath(cellPath(v)); set.add(v); }
      }
    }
    G._rcz = { key, path, set }; return path;
  }
  // outer edge of the cells a legion can walk to this turn
  // the two outlines of a legion's range: the outer one runs clockwise, the inner one counter-clockwise (every edge is stored in that direction, so the flowing dashes turn that way); what lies between them is what can be reached / shot at
  function orientedEdge(path, x1, y1, x2, y2, cx, cy, clockwise) {
    const cw = (x1 - cx) * (y2 - cy) - (y1 - cy) * (x2 - cx) > 0;       // screen y points down: a positive cross product is clockwise on the screen
    if (cw === clockwise) { path.moveTo(x1, y1); path.lineTo(x2, y2); } else { path.moveTo(x2, y2); path.lineTo(x1, y1); }
  }
  function rangeRing(L) {
    const key = G.ver + ':' + L.id + ':' + L.cell + ':r';
    if (G._rrz && G._rrz.key === key) return G._rrz.rings;
    const [lo, hi] = rangeOf(L), outer = new Path2D(), inner = new Path2D(), cx = G.X[L.cell], cy = G.Y[L.cell];
    for (const c of within(L.cell, hi)) {
      const d = hexDist(L.cell, c); if (d !== hi && d !== lo) continue;
      const nb = nbrs(c), x = G.X[c], y = G.Y[c];
      for (let e = 0; e < 6; e++) {
        const n = nb[e], [x1, y1] = corner(x, y, e), [x2, y2] = corner(x, y, (e + 1) % 6);
        if (d === hi && (n < 0 || hexDist(L.cell, n) > hi)) orientedEdge(outer, x1, y1, x2, y2, cx, cy, true);
        if (d === lo && n >= 0 && hexDist(L.cell, n) < lo) orientedEdge(inner, x1, y1, x2, y2, cx, cy, false);
      }
    }
    const rings = { outer, inner }; G._rrz = { key, rings }; return rings;
  }

  // the front-line overview: a dimmed map, every legion a small unit icon in its nation's color, and an arc on the side of each group that faces an enemy group
  let frontOn = false;
  function drawFront(ctx, d, z, fv, me) {
    ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.fillStyle = 'rgba(5,10,18,0.66)'; ctx.fillRect(0, 0, view.cw, view.ch); ctx.restore();
    const Ls = G.L.filter(L => !L.dead && !(fv && L.owner !== me && !fv[L.cell])), step = SZ * SQ, grp = Ls.map((_, i) => i);
    const find = i => { while (grp[i] !== i) i = grp[i] = grp[grp[i]]; return i; };
    for (let i = 0; i < Ls.length; i++) for (let j = i + 1; j < Ls.length; j++) {
      if (Ls[i].owner !== Ls[j].owner) continue;
      if (Math.hypot(G.X[Ls[i].cell] - G.X[Ls[j].cell], G.Y[Ls[i].cell] - G.Y[Ls[j].cell]) <= step * 2.4) grp[find(i)] = find(j);
    }
    const gs = new Map();
    Ls.forEach((L, i) => { const r = find(i); if (!gs.has(r)) gs.set(r, { o: L.owner, ls: [] }); gs.get(r).ls.push(L); });
    const G2 = [...gs.values()];
    for (const g of G2) {
      g.x = g.ls.reduce((s, L) => s + G.X[L.cell], 0) / g.ls.length; g.y = g.ls.reduce((s, L) => s + G.Y[L.cell], 0) / g.ls.length;
      g.r = Math.max(...g.ls.map(L => Math.hypot(G.X[L.cell] - g.x, G.Y[L.cell] - g.y))) + step * 0.9;
    }
    ctx.save(); ctx.lineCap = 'round';
    for (const a of G2) {
      let nb = null, nd = 1e9;       // the facing side is the one towards the nearest enemy group
      for (const b of G2) { if (b.o === a.o) continue; const dd = Math.hypot(b.x - a.x, b.y - a.y) - b.r; if (dd < nd) { nd = dd; nb = b; } }
      if (!nb || nd > a.r + step * 4) continue;
      const th = Math.atan2(nb.y - a.y, nb.x - a.x), R = Math.min(a.r, step * 4.5) + 6 / z, col = hue(a.o);
      ctx.shadowColor = col; ctx.shadowBlur = 7; ctx.strokeStyle = col; ctx.lineWidth = 2 / z;
      ctx.beginPath(); ctx.arc(a.x, a.y, R, th - 0.7, th + 0.7); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineWidth = 5 / z; ctx.setLineDash([1.2 / z, 3.6 / z]); ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(a.x, a.y, R + 3.5 / z, th - 0.7, th + 0.7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const L of Ls) {
      const x = G.X[L.cell], y = G.Y[L.cell], s = 8.5 / z, col = hue(L.owner);
      ctx.shadowColor = col; ctx.shadowBlur = 9; ctx.fillStyle = 'rgba(6,12,20,0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 2.2 / z;
      ctx.beginPath();
      if (L.type === 0) { ctx.moveTo(x, y - s * 1.15); ctx.lineTo(x + s, y - s * 0.45); ctx.lineTo(x + s * 0.8, y + s * 0.7); ctx.lineTo(x, y + s * 1.2); ctx.lineTo(x - s * 0.8, y + s * 0.7); ctx.lineTo(x - s, y - s * 0.45); ctx.closePath(); }
      else ctx.arc(x, y, s, 0, 7);
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.beginPath();
      if (L.type === 0) { ctx.moveTo(x - s * 0.45, y + s * 0.35); ctx.lineTo(x, y - s * 0.45); ctx.lineTo(x + s * 0.45, y + s * 0.35); }
      else { ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x + s * 0.5, y); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x, y + s * 0.5); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function draw(time) {
    const cv = $('board'); if (!cv || !G) return;
    if (DIR.tab === 'todo') renderTodoEco();       // the computer's orders change the command points while it plays
    const ctx = cv.getContext('2d'), z = view.s, d = view.dpr, now = performance.now();
    drawBackground(ctx, cv, now);
    ctx.setTransform(d * z, 0, 0, d * z, d * (view.cw / 2 - view.cx * z), d * (view.ch / 2 - view.cy * z));
    const vx0 = view.cx - view.cw / 2 / z - 30, vx1 = view.cx + view.cw / 2 / z + 30, vy0 = view.cy - view.ch / 2 / z - 40, vy1 = view.cy + view.ch / 2 / z + 30;
    const zones = G.Z.filter(q => q.bx1 >= vx0 && q.bx0 <= vx1 && q.by1 >= vy0 && q.by0 <= vy1);
    const r0 = Math.max(0, Math.floor((vy0 - M - SZ) / (1.5 * SZ)) - 1), r1 = Math.min(ROWS - 1, Math.ceil((vy1 - M - SZ) / (1.5 * SZ)) + 1);
    const c0 = Math.max(0, Math.floor((vx0 - M - SZ * SQ / 2) / (SZ * SQ)) - 1), c1 = Math.min(COLS - 1, Math.ceil((vx1 - M - SZ * SQ / 2) / (SZ * SQ)) + 1);
    const sel = G.sel, fv = fogVis(), me = viewer();
    const pulse = 0.16 + 0.12 * Math.sin(now / 180);

    // the board is a slab floating on the backdrop: shadow, thickness, then the ground colored by output tier
    ctx.save(); ctx.translate(0, 13); ctx.fillStyle = 'rgba(0,8,16,0.22)'; for (const q of zones) ctx.fill(q.path); ctx.restore();
    ctx.save(); ctx.translate(0, 6);
    const zf = zoneFills();
    for (const q of zones) { ctx.fillStyle = mix(zf[q.id], -0.55); ctx.fill(q.path); }
    ctx.restore();
    for (const q of zones) { const f = zf[q.id]; ctx.fillStyle = f; ctx.strokeStyle = f; ctx.lineWidth = 1; ctx.fill(q.path); ctx.stroke(q.path); }
    if (z >= 0.3) { ctx.strokeStyle = 'rgba(20,40,30,0.16)'; ctx.lineWidth = 0.8; for (const q of zones) ctx.stroke(q.path); }

    const vis = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const i = idx(c, r); if (G.zone[i] >= 0) vis.push(i); }

    // zone borders: one neutral thin line
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(14,30,22,0.6)'; ctx.lineWidth = 1.8; for (const q of zones) ctx.stroke(q.edge);

    // ranges are drawn for the legion you select (yours or an enemy's), no switch
    const SL = selLegion();
    // two blinking outlines in the legion's nation color, nothing filled: dotted (running one way) = where it can walk this turn, dashed (running the other way) = where its guns reach
    const ringDraw = (path, col, dashed, blink, dots) => {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (dashed) { ctx.setLineDash(dots ? [1, 7] : [7, 6]); ctx.lineDashOffset = -now / 60; }       // a negative offset moves the dashes along the path, i.e. clockwise on the outer ring and counter-clockwise on the inner one
      ctx.strokeStyle = 'rgba(10,16,22,0.6)'; ctx.lineWidth = 5.4; ctx.stroke(path);
      ctx.globalAlpha = 0.45 + 0.55 * blink; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(path); ctx.restore();
    };
    if (SL && !G.over) {
      const [lo, hi] = rangeOf(SL), foeRing = new Path2D();
      for (const c of within(SL.cell, hi)) if (G.zone[c] >= 0 && hexDist(SL.cell, c) >= lo) { const T = lgAt(c); if (T && T.owner !== SL.owner) foeRing.addPath(cellPath(c)); }
      ctx.strokeStyle = 'rgba(255,90,70,0.95)'; ctx.lineWidth = G.mode === 'attack' ? 3.4 : 2.2; ctx.stroke(foeRing);
      const blink = 0.5 + 0.5 * Math.sin(now / 260);
      const rg = rangeRing(SL);
      ctx.save(); ctx.globalAlpha = 0.12 + 0.3 * blink; ctx.fillStyle = '#fff'; ctx.fill(reachCells(SL)); ctx.restore();       // the cells it can walk to flash white (a nation's own colour would vanish on its own ground)
      for (const pth of [rg.outer, rg.inner]) ringDraw(pth, RANGE_COLOR, true, 1 - blink * 0.6);
    }
    const FL = G.focus >= 0 && G.focus !== G.sel ? lgAt(G.focus) : null;
    if (FL && FL.owner !== viewer() && !G.over) { const bl = 0.5 + 0.5 * Math.sin(now / 260), rg = rangeRing(FL); ctx.save(); ctx.globalAlpha = 0.12 + 0.3 * bl; ctx.fillStyle = '#fff'; ctx.fill(reachCells(FL)); ctx.restore(); for (const pth of [rg.outer, rg.inner]) ringDraw(pth, RANGE_COLOR, true, 1 - bl * 0.6); }
    if (sel >= 0 && G.zone[sel] >= 0) { ctx.fillStyle = `rgba(255,255,255,${0.2 + pulse})`; ctx.fill(cellPath(sel)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.2; ctx.stroke(cellPath(sel)); }
    if (G.focus >= 0 && G.focus !== sel) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.stroke(cellPath(G.focus)); ctx.setLineDash([]); }
    if (G.mode === 'split' && SL) {
      ctx.fillStyle = `rgba(80,220,140,${0.18 + pulse * 0.6})`;
      for (let e = 0; e < 6; e++) { const v = G.link[SL.cell * 6 + e]; if (v >= 0) { const O = G.lg[v]; if (!O || (O.owner === SL.owner && O.type === SL.type)) ctx.fill(cellPath(v)); } }
    }
    if (G.mode === 'march' && G.hover >= 0 && SL && G.hover !== SL.cell) { ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 3; ctx.stroke(cellPath(G.hover)); }

    // fog of war: darken what the viewer cannot see
    if (fv) {
      const fp = new Path2D();
      for (const i of vis) if (!fv[i]) fp.addPath(cellPath(i));
      ctx.fillStyle = 'rgba(10,18,30,0.5)'; ctx.fill(fp);
    }

    // big cities (always visible): a ring of wall with the defense beside it; sites get a dashed wall
    if (z >= 0.3) for (const i of vis) {
      const dd = G.def[i]; if (!dd) continue;
      cityMark(ctx, G.X[i], G.Y[i], dd, G.co[i] >= 0 ? mix(hue(G.co[i]), 0.25) : '#cfd5da', z >= 0.55);
    }

    // supply routes (toggle)
    if (V.supply) {
      const sv = supplyViz(), U = Math.max(1, 0.8 / view.s), sz = 2.6 * U;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [p, ln] of sv.lines) {
        if (p !== me && fv) continue;
        ctx.strokeStyle = 'rgba(10,16,22,0.5)'; ctx.lineWidth = 2.6 * U; chevrons(ctx, ln.solid, now, sz); chevrons(ctx, ln.dashed, now, sz);
        ctx.strokeStyle = hue(p); ctx.lineWidth = 1.3 * U; ctx.globalAlpha = 1; chevrons(ctx, ln.solid, now, sz); ctx.globalAlpha = 1; chevrons(ctx, ln.dashed, now, sz);
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(10,16,22,0.55)'; ctx.lineWidth = 2.8 * U; chevrons(ctx, sv.hot, now, sz);
      ctx.strokeStyle = '#ff9f2e'; ctx.lineWidth = 1.5 * U; chevrons(ctx, sv.hot, now, sz);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.6;
      for (const L of sv.cuts) {
        if (L.owner !== me && fv) continue;
        if (fv && L.owner !== me && !fv[L.cell]) continue;
        const x = G.X[L.cell], y = G.Y[L.cell] - 31; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
      }
    }

    // nation names (where each nation began; no borders are drawn)
    if (z < 1.2 && z >= 0.25) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let p = 0; p < G.nameAt.length; p++) {
        const a = G.nameAt[p]; if (!a || a[0] < vx0 || a[0] > vx1 || a[1] < vy0 || a[1] > vy1) continue;
        const k = Math.max(1, Math.min(3, 0.6 / z));
        ctx.font = `800 ${13 * k}px ${MONO}`;
        ctx.lineWidth = 3.4 * k; ctx.strokeStyle = 'rgba(10,16,22,0.7)'; ctx.strokeText(nameOf(p), a[0], a[1] + 30 * k);
        ctx.fillStyle = '#fff'; ctx.fillText(nameOf(p), a[0], a[1] + 30 * k);
      }
    }

    // legions
    for (const L of G.L) {
      const x = G.X[L.cell], y = G.Y[L.cell]; if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      if (fv && L.owner !== me && !fv[L.cell]) continue;
      drawLegion(ctx, L, now, z);
    }

    // legend click: the nation's legions, big cities and sole-held zones blink together
    if (G.blink >= 0 && !G.over) {
      const bp = G.blink, ph = 0.5 + 0.5 * Math.sin(now / 200), sh = liveShares();
      ctx.fillStyle = hue(bp); ctx.globalAlpha = 0.12 + 0.4 * ph;
      for (const q of zones) { const m = sh[q.id]; if (m && m.size === 1 && m.has(bp) && !(fv && bp !== me)) ctx.fill(q.path); }
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 + 2.5 * ph;
      for (const i of G.land) if (G.def[i] >= CITY_MIN && G.co[i] === bp && !(fv && bp !== me && !fv[i])) ctx.stroke(cellPath(i));
      for (const L of G.L) if (L.owner === bp && !(fv && bp !== me && !fv[L.cell])) { ctx.stroke(cellPath(L.cell)); ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.35 * ph})`; ctx.fill(cellPath(L.cell)); }
    }

    // this turn's orders, drawn exactly like the computer's steps: marching routes, attack targets, repairs and new troops, only during your own turn
    if (humanTurn()) {
      const U = Math.max(1, 0.85 / view.s), ph = 0.5 + 0.5 * Math.sin(now / 160);
      for (const L of G.L) {
        if (L.owner !== me) continue;
        if (L.ordRound === G.round && L.route && L.st === 'march' && L.tgt != null) flowLine(ctx, L.route.map(c => [G.X[c], G.Y[c]]), ORDER_COLOR.march, U, now);
        if (L.ordRound === G.round && L.atk) { const T = L.atk > 0 ? G.L.find(x => x.id === L.atk) : { cell: L.atkCell }; if (T) flowLine(ctx, [[G.X[L.cell], G.Y[L.cell]], [G.X[T.cell], G.Y[T.cell]]], ORDER_COLOR.atk, U, now);
          if (T && L.atk === -1 && L.type === 1) { ctx.save(); ctx.fillStyle = 'rgba(214,40,40,0.2)'; for (const c of [L.atkCell, ...nbrs(L.atkCell).filter(x => x >= 0)]) { ctx.beginPath(); hexPath(ctx, G.X[c], G.Y[c]); ctx.fill(); } ctx.restore(); }
          if (T && L.atkV && L.atkV.length === 3) { ctx.save(); ctx.beginPath(); L.atkV.forEach((c, k) => k ? ctx.lineTo(G.X[c], G.Y[c]) : ctx.moveTo(G.X[c], G.Y[c])); ctx.closePath(); ctx.fillStyle = 'rgba(214,40,40,0.25)'; ctx.fill(); ctx.strokeStyle = ORDER_COLOR.atk; ctx.lineWidth = 2 * U; ctx.stroke(); ctx.restore(); } }
        if (L.bld && L.acted) bounceArrow(ctx, G.X[L.cell], G.Y[L.cell], ORDER_COLOR.rep, U, ph, 'rep');
      }
      for (const o of G.players[me].pending) if (o.at === G.round) bounceArrow(ctx, G.X[o.city], G.Y[o.city], ORDER_COLOR.build, U, ph, 'build');
    }

    // the step the computer is playing right now: its intent drawn as an arrow (a flowing line with a head), or a bouncing arrow over a city
    if (G.aiShow && !G.over) {
      const s = G.aiShow, ph = 0.5 + 0.5 * Math.sin(now / 160), col = hue(s.p);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const L0 = s.id != null ? G.L.find(x => x.id === s.id) : null, U = Math.max(1, 0.85 / view.s);       // keep the arrow readable when the map is zoomed far out
      if (s.k === 'march' && L0 && L0.route && L0.route.length > 1) flowLine(ctx, L0.route.map(c => [G.X[c], G.Y[c]]), ORDER_COLOR.march, U, now);
      else if ((s.k === 'atk' || s.k === 'split') && s.to >= 0) flowLine(ctx, [[G.X[s.cell], G.Y[s.cell]], [G.X[s.to], G.Y[s.to]]], s.k === 'atk' ? ORDER_COLOR.atk : ORDER_COLOR.march, U, now);
      else if (s.k === 'rep' || s.k === 'build') bounceArrow(ctx, G.X[s.cell], G.Y[s.cell], ORDER_COLOR[s.k], U, ph, s.k);
      ctx.strokeStyle = 'rgba(10,16,22,0.8)'; ctx.lineWidth = 6.5; ctx.stroke(cellPath(s.cell)); ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + 0.5 * ph; ctx.lineWidth = 3.4; ctx.stroke(cellPath(s.cell)); ctx.globalAlpha = 1;
    }

    // command mode: the route / attack line under the pointer, and a cross with the reason when it cannot be done
    let cmdText = null;
    if (SL && (G.mode === 'march' || G.mode === 'attack') && G.hoverPx && humanTurn()) {
      const r = cmdCheck(SL, G.hover);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (r.ok && G.mode === 'march') {
        { const pn = r.path.length, UU = Math.max(1, 0.85 / view.s); ctx.strokeStyle = 'rgba(10,16,22,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); r.path.forEach((c, n) => { if (n === pn - 1 && n > 0) { const q = pullBack(G.X[r.path[n - 1]], G.Y[r.path[n - 1]], G.X[c], G.Y[c], 7 * UU); ctx.lineTo(q[0], q[1]); } else n ? ctx.lineTo(G.X[c], G.Y[c]) : ctx.moveTo(G.X[c], G.Y[c]); }); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(125,255,176,0.95)'; ctx.lineWidth = 2.6; ctx.stroke();
        { const pn = r.path.length; if (pn >= 2) arrowHead(ctx, G.X[r.path[pn - 2]], G.Y[r.path[pn - 2]], G.X[r.path[pn - 1]], G.Y[r.path[pn - 1]], 'rgba(125,255,176,0.95)', Math.max(1, 0.85 / view.s)); }
        if (r.stop >= 0) { const sx = G.X[r.stop], sy = G.Y[r.stop]; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 7); ctx.fillStyle = '#d6322b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(sx - 3.5, sy - 1.2, 7, 2.4); }
        cmdText = { ok: true, t: tr('turnsN', r.turns) + (r.stop >= 0 ? ' · ' + tr('stopHere') : '') };
      } else if (r.ok) {
        { const q = pullBack(G.X[SL.cell], G.Y[SL.cell], G.X[r.T.cell], G.Y[r.T.cell], 7 * Math.max(1, 0.85 / view.s)); ctx.strokeStyle = 'rgba(10,16,22,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(G.X[SL.cell], G.Y[SL.cell]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,90,70,0.95)'; ctx.lineWidth = 2.6; ctx.stroke();
        arrowHead(ctx, G.X[SL.cell], G.Y[SL.cell], G.X[r.T.cell], G.Y[r.T.cell], 'rgba(255,90,70,0.95)', Math.max(1, 0.85 / view.s));
        if (r.cells) { ctx.save(); ctx.fillStyle = 'rgba(214,40,40,0.22)'; ctx.strokeStyle = 'rgba(255,90,70,0.95)'; ctx.lineWidth = 2; if (r.cells.length === 3) { ctx.beginPath(); r.cells.forEach((c, k) => k ? ctx.lineTo(G.X[c], G.Y[c]) : ctx.moveTo(G.X[c], G.Y[c])); ctx.closePath(); ctx.fill(); ctx.stroke(); } else for (const c of r.cells) { ctx.beginPath(); hexPath(ctx, G.X[c], G.Y[c]); ctx.fill(); } ctx.restore(); }
        cmdText = r.cells ? { ok: true, t: tr(r.cells.length === 3 ? 'strikeInf' : 'strikeArt') } : { ok: true, t: tr('menLost', fmt1(r.men)) };
      } else cmdText = { ok: false, t: tr(r.no) };
    }

    // pointing at one of your legions whose supplies are cut: the reason
    if (!cmdText && G.hover >= 0 && G.hoverPx && !G.over) { const HL = G.lg[G.hover]; if (HL && (!fv || HL.owner === me || fv[HL.cell]) && (reachOf(HL.owner).dist[HL.cell] < 0 || supplyOf(HL).total >= 100)) cmdText = { ok: false, noX: true, t: (HL.owner === me ? '' : tr('cutWho', pnameB(HL.owner), lname(HL))) + (reachOf(HL.owner).dist[HL.cell] < 0 ? cutReason(HL) : tr('supAllLost')) }; }

    // fire lines and casualty numbers
    G.fx = G.fx.filter(f => now - f.t0 < 1100 * Math.max(0.3, parseFloat(S.speed)));
    for (const f of G.fx) {
      if (fv && !fv[f.a] && !fv[f.b]) continue;
      const age = (now - f.t0) / (1100 * Math.max(0.3, parseFloat(S.speed))), x1 = G.X[f.a], y1 = G.Y[f.a], x2 = G.X[f.b], y2 = G.Y[f.b];
      const k = Math.min(1, age * 3), px = x1 + (x2 - x1) * k, py = y1 + (y2 - y1) * k;
      ctx.globalAlpha = Math.max(0, 1 - age); ctx.strokeStyle = f.hits ? '#ffb020' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
    }
    // the strike areas shown one after the other before the shots land (clearing rules): a red area, the line from the unit, and the unit itself ringed
    if (G._aim && G._aim.length) {
      G._aim = G._aim.filter(a => now - a.t0 < 900);
      for (const a of G._aim) {
        const age = (now - a.t0) / 900; if (age < 0) continue;
        ctx.save(); ctx.globalAlpha = Math.sin(Math.min(1, age) * Math.PI) * 0.9;
        ctx.fillStyle = a.miss ? 'rgba(200,205,210,0.35)' : 'rgba(214,40,40,0.38)'; ctx.strokeStyle = a.miss ? 'rgba(220,225,230,0.9)' : 'rgba(255,90,70,0.95)'; ctx.lineWidth = 2.4;
        if (a.cells.length === 3) { ctx.beginPath(); a.cells.forEach((c, i) => i ? ctx.lineTo(G.X[c], G.Y[c]) : ctx.moveTo(G.X[c], G.Y[c])); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        else for (const c of a.cells) { ctx.beginPath(); hexPath(ctx, G.X[c], G.Y[c]); ctx.fill(); }
        ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(G.X[a.s], G.Y[a.s]); ctx.lineTo(G.X[a.cells[0]], G.Y[a.cells[0]]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(G.X[a.s], G.Y[a.s], 17, 0, 7); ctx.stroke(); ctx.restore();
      }
    }
    G.pops = G.pops.filter(p => now - p.t0 < 1500);
    for (const p of G.pops) {
      if (fv && !fv[p.cell]) continue;
      const age = (now - p.t0) / 1500; if (age < 0) continue; ctx.globalAlpha = 1 - age; ctx.font = `800 15px ${MONO}`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,16,22,0.85)'; ctx.strokeText(p.txt, G.X[p.cell], G.Y[p.cell] - 14 - age * 16); ctx.fillStyle = p.c || '#ff6a5a'; ctx.fillText(p.txt, G.X[p.cell], G.Y[p.cell] - 14 - age * 16); ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
    if (frontOn) drawFront(ctx, d, z, fv, me);
    // beside the pointer (screen space): the turns / preview, or a red cross and the reason
    if (cmdText && G.hoverPx) {
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const px = Math.min(G.hoverPx.x + 16, view.cw - 20), py = G.hoverPx.y + 18;
      ctx.font = `700 12.5px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (!cmdText.ok && !cmdText.noX) { ctx.beginPath(); ctx.arc(G.hoverPx.x, G.hoverPx.y, 9, 0, 7); ctx.fillStyle = 'rgba(214,50,43,0.92)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(G.hoverPx.x - 4, G.hoverPx.y - 4); ctx.lineTo(G.hoverPx.x + 4, G.hoverPx.y + 4); ctx.moveTo(G.hoverPx.x + 4, G.hoverPx.y - 4); ctx.lineTo(G.hoverPx.x - 4, G.hoverPx.y + 4); ctx.stroke(); }
      const w = ctx.measureText(cmdText.t).width + 14, bx = Math.max(4, Math.min(px, view.cw - w - 4)), by = Math.min(py, view.ch - 28);
      ctx.fillStyle = cmdText.ok ? 'rgba(12,28,20,0.88)' : 'rgba(60,14,12,0.9)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, w, 22, 6); else ctx.rect(bx, by, w, 22); ctx.fill();
      ctx.fillStyle = cmdText.ok ? '#bff5d2' : '#ffd0cb'; ctx.fillText(cmdText.t, bx + 7, by + 11.5);
    }
  }
  function resize() {
    const wrap = $('boardWrap'), cv = $('board'), cw = wrap.clientWidth, ch = wrap.clientHeight; if (!cw || !ch) return;
    view.dpr = Math.min(2, window.devicePixelRatio || 1); view.cw = cw; view.ch = ch;
    cv.width = Math.round(cw * view.dpr); cv.height = Math.round(ch * view.dpr);
    if (G) { const zr = view.s / (view.fit || 1); view.fit = Math.min(cw / W, ch / H); view.min = Math.min(view.fit * 0.9, 0.5); view.s = Math.max(view.min, view.fit * zr); clampCam(); }
    requestDraw();
  }

  // ---------- end of game ----------
  function showOver() {
    const o = $('over'); o.hidden = false;
    const w = G.win;
    if (w >= 0) { $('overImg').src = avatarURL(w); $('overImg').hidden = false; } else $('overImg').hidden = true;
    if (G.limit) { $('overTitle').textContent = tr('tlTitle', w >= 0 ? pname(w) : '—'); $('overSub').textContent = tr('tlSub', G.limitRound); }
    else if (w < 0) { $('overTitle').textContent = tr('allDead'); $('overSub').textContent = tr('loseSub', G.round); }
    else { $('overTitle').textContent = tr('winTitle', pname(w)); $('overSub').textContent = tr('winSub', G.round); }
    if (w >= 0 && G.players[w].human) snd.victory(); else if (G.players.some(p => p.everHuman)) snd.defeat();
    hintUI();
  }
