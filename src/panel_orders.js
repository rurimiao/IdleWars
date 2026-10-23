
  // ---------- to-do tab: the orders given this turn (can be taken back until the turn ends) and what is still left to do ----------
  // what a legion was ordered to do this turn, in words (null when it did something else, e.g. only fought)
  function orderText(L) {
    const u = L.undo; if (!u || !L.acted) return null;
    if (u.split) return tr(u.split.merge ? 'tdMerge' : 'tdSplit', lname(L), u.split.amt);
    if (L.atk === -1 && (u.atk !== -1 || L.atkCell !== u.atkCell)) return tr('tdAtkCell', lname(L), zoneName(G.zone[L.atkCell]));
    if (L.atk > 0 && L.atk !== u.atk) return tr('tdAtk', lname(L), lnameById(L.atk));
    if (L.bld && !u.bld) return tr('tdRep', lname(L), isCity(L.cell) ? cityName(L.cell) : zoneName(G.zone[L.cell]));
    if (L.st === 'march' && L.tgt != null) return tr('tdMarch', lname(L), zoneName(G.zone[L.tgt]));
    return null;
  }
  function todoData() {
    const me = G.cur, P = G.players[me], orders = [], idleL = [], idleC = [];
    for (const L of G.L) {
      if (L.owner !== me || L.dead) continue;
      const u = L.undo;
      if (u && L.acted) {
        const text = orderText(L); if (!text) continue;
        orders.push({ cancel: 'l:' + L.id, go: 'l:' + L.id, text, color: hue(me) });
      } else if (!L.acted && L.st === 'alert') idleL.push(L);
    }
    for (const o of P.pending) if (o.at === G.round) orders.push({ cancel: 'b:' + P.pending.indexOf(o), go: 'c:' + o.city, text: tr('tdBuild', cityName(o.city), o.n, tr('ty_' + TYPES[o.type].k)), color: hue(me) });
    for (const c of cities(me)) {
      if (P.pending.some(o => o.city === c && o.at === G.round)) continue;
      if (!citySupplied(me, c)) continue;
      if (![0, 1].some(t => P.stock >= TYPES[t].min * TYPES[t].cost && buyOK(c, me, t, TYPES[t].min))) continue;
      idleC.push(c);
    }
    return { orders, idleL, idleC };
  }
  // what a shipment to this legion loses on the road (5 % per extra 6 cells, plus enemy batteries covering the route) and how many turns it is under way
  const supDelay = L => { const d = reachOf(L.owner).dist[L.cell]; return d < 0 ? 0 : Math.max(0, Math.ceil(d / 6) - 1); };
  const supLoss = L => Math.min(1, 0.01 * Math.max(0, reachOf(L.owner).dist[L.cell]) + artLoss(L.owner, L.cell) / 100);
  // your own money at a glance, above the orders
  function renderTodoEco() {
    const el = $('todoEco'); if (!el || !G) return;
    const q = viewer(), P = G.players[q], key = G.ver + ':' + G.round + ':' + q + ':' + G.cur + ':' + P.stock; if (el.dataset.key === key) return; el.dataset.key = key;
    const n = v => Math.round(v).toLocaleString('en-US'), spent = P.pending.filter(o => o.at === G.round).reduce((s, o) => s + o.n * TYPES[o.type].cost, 0);
    el.innerHTML = `<div class="kvx"><span>${tr('tdStockNow')}</span><b>${n(P.stock + spent)}</b></div><div class="kvx"><span>${tr('tdOrderedNow')}</span><b>${spent ? '−' : ''}${n(spent)}</b></div><div class="kvx" title="${esc(pname(G.cur))}"><span>${G.cur !== q ? `<i class="cpdot" style="background:${hue(G.cur)}"></i>` : ''}${tr('tdCp')}</span><b>${cpLeft(G.cur)}/${cpMax(G.cur)}</b></div>`;
  }
  const TD = { a: 'orders', b: 'cities' };       // which tab each of the two cards shows
  function renderTodo() {
    const body = $('todoList'); if (!body || !G) return;
    if (DIR.tab !== 'todo') return;
    renderTodoEco();
    if (!humanTurn()) { body.innerHTML = `<div class="sub" style="padding:8px">${G.over ? tr('opsOver') : tr('opsWaitList')}</div>`; body.dataset.key = ''; return; }
    const key = G.ver + ':' + G.round + ':' + G.cur + ':' + G.players[G.cur].stock + TD.a + TD.b; if (body.dataset.key === key) return; body.dataset.key = key;
    const t = todoData(), row = (go, text, color, cancel, sub) => `<div class="tdr" data-go="${go}"><i style="background:${color}"></i><span>${esc(text)}${sub ? `<small>${esc(sub.t)}${sub.t2 ? `<br><em${sub.lvl ? ` class="${sub.lvl}"` : ''}>${esc(sub.t2)}</em>` : ''}</small>` : ''}</span>${cancel ? `<button data-cancel="${cancel}" title="${tr('tdCancel')}">✕</button>` : ''}</div>`;
    const list = (rows, empty) => rows.length ? rows.join('') : `<div class="sub tde">${empty}</div>`;
    const fl = G.players[G.cur].pending.filter(o => o.at !== G.round);
    const tabs = (k, items) => `<div class="tdtabs">${items.map(([v, label]) => `<button data-tdtab="${k}:${v}" aria-pressed="${TD[k] === v}">${label}</button>`).join('')}</div>`;
    const A = TD.a === 'cp'
      ? cpLines(G.cur).map((x, i, a) => `<div class="tdr cpl${i >= a.length - 2 ? ' sum' : ''}"><span>${esc(x)}</span></div>`).join('')
      : TD.a === 'inflight'
      ? list(fl.map(o => row('c:' + o.city, tr('tdInfLine', cityName(o.city), tr('ty_' + TYPES[o.type].k), o.n, o.t > 0 ? tr('tdInfTurns', o.t) : tr('tdInfWait')), hue(G.cur))), tr('tdNone'))
      : list(t.orders.map(o => row(o.go, o.text, o.color, o.cancel)), tr('tdNoOrders'));
    const B = TD.b === 'idle'
      ? list(t.idleL.map(L => row('l:' + L.id, `${lname(L)} · ${zoneName(G.zone[L.cell])} · ${L.n}人`, hue(L.owner), null, (() => { const cut = reachOf(L.owner).dist[L.cell] < 0, loss = Math.round(100 * supLoss(L)); return { t: tr('tdSup', L.sup, supCost(L), daysLeft(L), tr('daysN', L.hoard)), t2: cut ? tr('tdCut') : tr('tdLinked') + ' · ' + tr('tdLoss', loss, supDelay(L)), lvl: cut || loss >= 50 ? 'bad' : loss >= 30 ? 'warn' : '' }; })())), tr('tdNone'))
      : list(t.idleC.map(c => row('c:' + c, `${cityName(c)} · ${zoneName(G.zone[c])}`, hue(G.co[c]))), tr('tdNone'));
    body.innerHTML = `<div class="tdcard">${tabs('a', [['orders', tr('tdTabOrders', t.orders.length)], ['inflight', tr('tdTabInflight', fl.length)], ['cp', tr('tdTabCp', cpLeft(G.cur), cpMax(G.cur))]])}<div class="tdbody">${A}</div></div>`
      + `<div class="tdcard">${tabs('b', [['cities', tr('tdTabCities', t.idleC.length)], ['idle', tr('tdTabIdle', t.idleL.length)]])}<div class="tdbody">${B}</div></div>`;
  }
  function todoCancel(spec) {
    const [k, id] = spec.split(':'); let ok = false;
    if (k === 'l') ok = cancelOrder(G.L.find(x => x.id === +id));
    else if (k === 'b') ok = cancelBuild(G.cur, G.players[G.cur].pending[+id]);
    if (ok) { snd.select(); G.ver++; ui(true); requestDraw(); }
  }
