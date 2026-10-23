
  // ---------- computer tab: what each computer nation is up to, and a log of its decisions ----------
  let aiFilter = -1;
  function renderAi() {
    const body = $('aiList'); if (!body || !G) return;
    if (DIR.tab !== 'panel') return;
    aiFilter = G.blink >= 0 ? G.blink : G.cur;       // follows the row picked in the nations table above, else whoever is acting
    const key = ((G.intent && G.intent[aiFilter]) || []).map(i => i.id + i.by + Math.round(i.str / 50) + (i.until - G.round)).join(',') + ':' + (G.hate && G.hate[aiFilter] ? G.hate[aiFilter].map(v => Math.round(v / 10)).join() : '') + ':' + G.ver + ':' + (G.aiLevel ? G.aiLevel[aiFilter] : '') + ':' + (G.aiStyle ? G.aiStyle[aiFilter] : '') + ':' + G.round + ':' + G.cur + ':' + aiFilter + ':' + (G.aiLog ? G.aiLog.length : 0) + ':' + (G.aiLog && G.aiLog[0] ? G.aiLog[0].t : '');
    if (body.dataset.key === key) return; body.dataset.key = key;
    const ai = G.players.filter(x => !x.human && x.alive);
    const sh = liveShares(), shown = ai.filter(x => x.id === aiFilter);
    let h = shown.length ? '' : `<p class="note">${tr('aiPick')}</p>`;
    for (const P of shown) {
      const p = P.id;
      const zones = G.Z.filter(z => { const m = sh[z.id]; return m && m.has(p); }).length;
      const I = (G.intent && G.intent[p]) || [], act = G.aiGo && G.aiGo[p] && I.find(x => x.id === G.aiGo[p].id);
      const goTxt = I.length ? tr('aiIntents', I.length, I.filter(x => x.by === 'you').length, I.filter(x => x.by !== 'you').length) + (act ? ' · ' + tr('aiDoing', intentText(act)) : '') : tr('aiGoNone');
      const hs = (G.hate && G.hate[p] || []).map((v, q) => [q, v]).filter(([q, v]) => q !== p && v >= 20 && G.players[q].alive).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const hateTxt = hs.length ? tr('aiHate', hs.map(([q, v]) => `${nameOf(q)} ${Math.round(v)}`).join('、')) : '';
      const opt = (list, cur, pre) => list.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${tr(pre + v)}</option>`).join('');
      h += `<div class="tdr aicard"><i style="background:${hue(p)}"></i><span><b><img class="avp" src="${avatarURL(p)}" alt="">${esc(pname(p))}</b><span class="aisels"><select data-aip="${p}" data-k="lv" title="${tr('aiLevelL')}">${opt(['easy', 'normal', 'hard'], (G.aiLevel && G.aiLevel[p]) || 'normal', 'ai_')}</select><select data-aip="${p}" data-k="st" title="${tr('aiStyleL')}">${opt(['steady', 'wave', 'heavy', 'hold'], G.aiStyle && G.aiStyle[p], 'st_')}</select><label class="dyn" title="${tr('dynATip')}"><input type="checkbox" data-aip="${p}" data-dyn="a" ${dynOf(p).a ? 'checked' : ''}>${tr('dynA')}</label><label class="dyn" title="${tr('dynBTip')}"><input type="checkbox" data-aip="${p}" data-dyn="b" ${dynOf(p).b ? 'checked' : ''}>${tr('dynB')}</label><button class="btn sm" data-avp="${p}">${tr('avBtn')}</button><button class="btn sm itbtn" data-intent="${p}">${tr("intentBtn")}</button></span>`
        + `<small>${esc(tr('aiState', cities(p).length, zones, P.stock))}</small><small>${esc(goTxt)}</small>${hateTxt ? `<small>${esc(hateTxt)}</small>` : ''}</span></div>`;
    }
    const logs = (G.aiLog || []).filter(n => n.p === aiFilter).slice(0, 150);
    h += `<h4>${tr('aiLogTitle')}</h4>` + (logs.length ? logs.map(n => `<div class="tdr" ${n.go ? `data-go="${n.go}"` : ''}><i style="background:${hue(n.p)}"></i><span class="aiw">${esc(tr('aiRound', n.r))} ${esc(n.t)}</span></div>`).join('') : `<div class="sub tde">${tr('aiEmpty')}</div>`);
    body.innerHTML = h;
  }

  // ---------- economy tab: where one nation's money comes from and goes to, right now ----------
  const ECO_K = { cap: 'ecoCap', brk: 'ecoBrk', bld: 'ecoBld' };
  function renderEco() {
    const body = $('ecoBody'); if (!body || !G || DIR.tab !== 'eco') return;
    const q = G.blink >= 0 ? G.blink : mineId(), key = [G.ver, G.round, q, G.eco ? G.eco.length : 0, G.players[q].stock].join(':');
    if (body.dataset.key === key) return; body.dataset.key = key;
    const fv = S.fog && q !== viewer();
    const P = G.players[q], num = (v, sign) => Math.round(v) === 0 ? '0' : `${sign && v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}`;
    const row = (l, v, cls, sub) => `<div class="er${sub ? ' sub2' : ''}"><span>${l}</span><b class="${cls || ''}">${v}</b></div>`;
    let h = `<div class="ecohd"><i style="background:${hue(q)}"></i><b>${esc(pname(q))}</b><span>${tr('ecoStock')} <b>${fv ? '?' : num(P.stock)}</b></span></div>`;
    if (fv) { body.innerHTML = h + `<p class="note">${tr('ecoFog')}</p>`; return; }
    // income, as the next round will pay it
    const sh = zoneShares(), lines = []; let zoneInc = 0;
    G.Z.forEach((z, zi) => {
      const m = sh[zi]; let v = 0, txt = '';
      if (m && m.size) { let tot = 0; for (const x of m.values()) tot += x; if (m.has(q)) { v = z.out * m.get(q) / tot; txt = `${m.get(q)}/${tot}`; } }
      if (v > 0) { zoneInc += v; lines.push([zoneName(zi), txt, v]); }
    });
    const nCity = cities(q).length, tax = cityTax(q), income = Math.round(zoneInc) + tax;
    h += `<section class="ecs"><h5>${tr('ecoIncome')}<b class="pos">${num(income, 1)}</b></h5>`
      + row(tr('ecoZones', lines.length), num(zoneInc, 1), 'pos') + lines.sort((a, b) => b[2] - a[2]).map(([n, t, v]) => row(`${esc(n)} <small>${esc(t)}</small>`, num(v, 1), 'pos', 1)).join('')
      + row(tr('ecoTax', nCity, S.tax), num(tax, 1), 'pos') + `</section>`;
    // spending: city upkeep, supplies sent to the legions (with what is lost on the way), what is paid for orders
    let upkeep = 0, sites = 0; for (const c of G.land) if (G.def[c] > 0 && G.co[c] === q) { upkeep += cityUpkeep(G.def[c]); if (G.def[c] < CITY_MIN) sites++; }
    const transit = new Map(); for (const s of G.ship) transit.set(s.lid, (transit.get(s.lid) || 0) + s.amt);
    let need = 0, sent = 0, cut = 0, heavy = 0, meals = 0;
    for (const L of G.L) {
      if (L.owner !== q || L.dead) continue;
      meals += supCost(L);
      if (L.hoard <= 0) continue;
      const n = Math.min(L.hoard, SUP_MAX_TURNS) * L.n * typ(L).eat - L.sup - (transit.get(L.id) || 0); if (n <= 0) continue;
      const o = supplyOf(L);
      if (o.cut) { cut++; continue; }
      const loss = o.home ? 0 : Math.min(100, o.total) / 100;
      if (loss >= 1) { heavy++; sent += n; need += 0; continue; }
      if (loss >= 0.3) heavy++;
      need += n; sent += n / (1 - loss);
    }
    const lost = sent - need, pend = P.pending.reduce((s, o) => s + o.n * TYPES[o.type].cost, 0);
    h += `<section class="ecs"><h5>${tr('ecoSpend')}<b class="neg">${num(-(upkeep + sent), 1)}</b></h5>`
      + row(tr('ecoUpkeep', nCity, sites), num(-upkeep, 1), 'neg')
      + row(tr('ecoShip'), num(-sent, 1), 'neg') + row(tr('ecoShipDeliv'), num(need), '', 1) + row(tr('ecoShipLost', heavy), num(-lost, 1), 'neg', 1)
      + (cut ? row(tr('ecoCut', cut), '', 'neg', 1) : '')
      + `<p class="note">${tr('ecoShipNote', Math.round(meals))}</p>`
      + row(tr('ecoQueued'), num(pend), '') + `</section>`;
    // legions building or repairing a city: what that costs them each turn (paid out of the supplies they carry)
    const builders = G.L.filter(L => L.owner === q && !L.dead && L.bld);
    if (builders.length) {
      let tot = 0;
      const rows = builders.map(L => {
        const eat = typ(L).eat, sp = typ(L).bsp, want = L.n * sp, pts = Math.min(want, CITY_MAX - G.def[L.cell], Math.floor(L.sup / BUILD_COST)), per = L.n * eat + pts * BUILD_COST, goal = G.def[L.cell] < CITY_MIN ? CITY_MIN : CITY_MAX, left = Math.max(0, Math.ceil((goal - G.def[L.cell]) / Math.max(1, want)));
        tot += per;
        return row(`${esc(lname(L))} <small>${tr('ecoBldRow', L.n, eat, sp, BUILD_COST)}</small>`, num(-per, 1), 'neg') + row(`<small>${esc(G.def[L.cell] < CITY_MIN ? tr('siteWord') : cityName(L.cell))} ${tr('defShort')} ${G.def[L.cell]} → ${goal}，${tr('ecoBldLeft', left, Math.round(left * per))}${pts < want ? '，' + tr('ecoBldShort') : ''}</small>`, '', '', 1);
      });
      h += `<section class="ecs"><h5>${tr('ecoBuild')}<b class="neg">${num(-tot, 1)}</b></h5>${rows.join('')}<p class="note">${tr('ecoBldNote', BUILD_COST)}</p></section>`;
    }
    // what actually happened in the last full round and so far in this one
    const A = G.stats || [], cur = A[G.round - 1] && A[G.round - 1][q], prev = A[G.round - 2] && A[G.round - 2][q];
    const act = (r, t) => r ? `<h6>${t}</h6>` + row(tr('ecoActIn'), num(r[0], 1), 'pos') + row(tr('ecoActUp'), num(-r[1], 1), 'neg') + row(tr('ecoActShip'), num(-r[2], 1), 'neg') + row(tr('ecoActLost'), num(-r[3], 1), 'neg', 1) + row(tr('ecoActBuild'), num(-r[4], 1), 'neg') + row(tr('ecoActMeals'), num(r[5]), '') + row(tr('ecoActRep'), num(r[6]), '') : '';
    h += `<section class="ecs"><h5>${tr('ecoActual')}</h5>${act(prev, tr('ecoLast'))}${act(cur, tr('ecoThis'))}${prev || cur ? '' : `<p class="note">${tr('ecoNoData')}</p>`}</section>`;
    // one-off income
    const ev = (G.eco || []).filter(e => e.p === q).slice(0, 12);
    h += `<section class="ecs"><h5>${tr('ecoOnce')}</h5>` + (ev.length ? ev.map(e => row(`${tr('ecoR', e.r)} ${tr(ECO_K[e.k])} <small>${esc(cityName(e.c))}</small>`, num(e.n, 1), 'pos')).join('') : `<p class="note">${tr('ecoNone')}</p>`) + `</section>`;
    body.innerHTML = h;
  }
