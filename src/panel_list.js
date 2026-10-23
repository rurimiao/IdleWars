
  // ---------- directory sidebar: zones, cities and legions as a tree ----------
  const DIR = { open: true, tab: 'todo', mode: 'dir', ex: new Set(), mine: false, type: 'all', state: 'any', fight: false, q: '', key: '' };
  const lowFood = L => daysLeft(L) < 2;
  const stateOK = (L, s) => (s === 'any' ? true : s === 'march' ? L.st === 'march' : s === 'alert' ? L.st === 'alert' : s === 'starve' ? L.starve > 0 : s === 'low' ? lowFood(L) && !L.starve : s === 'bld' ? L.bld : s === 'ap' ? !L.acted : true);
  // the three flat lists: zones, cities and legions (tabs 'zones' / 'cities' / 'legions'); every row jumps to the thing
  const LST = { q: '', mine: false, fight: false, state: 'any', tab: '' };
  function renderDir() {
    const body = $('listBody'), flt = $('listFlt'); if (!body || !G) return;
    const tab = DIR.tab; if (tab !== 'zones' && tab !== 'cities' && tab !== 'legions') return;
    if (LST.tab !== tab) {         // the filter row is rebuilt only when the tab changes, so typing in the search box is not interrupted
      LST.tab = tab; LST.key = '';
      flt.innerHTML = `<label class="chk"><input type="checkbox" id="lMine"><span id="lMineL"></span></label>`
        + (tab === 'zones' ? `<label class="chk"><input type="checkbox" id="lFight"><span>${tr('fFight')}</span></label>` : '')
        + (tab === 'legions' ? `<select id="lState"><option value="any">${tr('fAny')}</option><option value="march">${tr('fMarch')}</option><option value="alert">${tr('fAlert')}</option><option value="starve">${tr('fStarve')}</option><option value="low">${tr('fLow')}</option></select>` : '')
        + `<input type="search" id="lQ" placeholder="${tr('fSearch')}" value="${esc(LST.q)}">`;
      $('lMine').checked = LST.mine; if ($('lFight')) $('lFight').checked = LST.fight; if ($('lState')) $('lState').value = LST.state;
    }
    const real = (mineId(), G.lastHuman != null), me = real ? G.lastHuman : -1, fv = fogVis(), sh = liveShares(), q = LST.q.trim();       // `me` is nobody when no human has ever played: there is no "you" to speak of
    { const ln = G.lastHuman != null ? nameOf(G.lastHuman) + (G.players[G.lastHuman].human ? '' : ' · ' + tr('autoPlay')) : tr('nobody'); $('lMineL').textContent = tr('fMine') + '（' + ln + '）'; $('lMine').disabled = !real; }
    const key = [tab, G.ver, G.round, G.cur, me, real, LST.mine, LST.fight, LST.state, q].join('|');
    if (key === LST.key) return; LST.key = key;
    const match = t => !q || t.includes(q);
    const rank = p => (p === me ? -1 : G.order.indexOf(p));
    const row = (color, text, go, extra, w, xw) => `<div class="dr l1" style="color:${color}" data-go="${go}"><i>▷</i><span class="dn">${w ? `<span class="dc1" style="min-width:${w}em">${esc(text[0])}</span>${esc(text[1])}` : esc(text)}</span>${extra ? `<span class="x"${xw ? ` style="flex:none;min-width:${xw}em;text-align:right"` : ''}>${esc(extra)}</span>` : ''}</div>`;
    const who = o => o >= 0 ? '（' + pname(o) + '）' : o === -2 ? '（多方）' : '（' + tr('nobody') + '）';
    const items = [];
    if (tab === 'zones') {
      G.Z.forEach((z, zi) => {
        if (!z.cells.length) return;
        const m = sh[zi], own = m && m.size === 1 ? [...m.keys()][0] : m && m.size > 1 ? -2 : z.holder, fight = !!(m && m.size > 1);
        if (LST.fight && !fight) return;
        if (real && LST.mine && !((m && m.has(me)) || z.holder === me)) return;
        if (fv && !(m && m.has(me)) && !match(zoneName(zi))) { /* fog hides only the details, the zone itself stays listed */ }
        if (!match(zoneName(zi))) return;
        let tot = 0; if (m) for (const v of m.values()) tot += v;
        const mine = m && m.has(me) ? Math.round(z.out * m.get(me) / tot) : 0;
        items.push({ r: own === -2 ? 99 : rank(own), n: zoneName(zi), html: row(own >= 0 ? hue(own) : own === -2 ? ZONE_FIGHT : '#8a948f', zoneName(zi) + who(fv && own !== me ? -3 : own), 'z:' + zi, mine ? `${tr('yourShare')} ${mine}` : fight ? tr('fightShort') : `${tr('zOutLine', z.out)}`) });
      });
    } else if (tab === 'cities') {
      for (const c of G.land) {
        if (!(G.def[c] > 0)) continue;
        const big = G.def[c] >= CITY_MIN, o = G.co[c], nm = big ? '【' + cityName(c) + '】' : tr('site');
        if (real && LST.mine && o !== me) continue;
        if (!match(cityName(c)) && !match(zoneName(G.zone[c]))) continue;
        items.push({ r: rank(o), n: nm, html: row(o >= 0 ? hue(o) : '#8a948f', [nm, `·${zoneName(G.zone[c])}${who(o)}`], 'c:' + c, `${tr('defShort')} ${String(G.def[c]).padStart(3, '\u2007')}`, 5.6) });
      }
    } else {
      for (const L of G.L) {
        if (L.dead || !lgAt(L.cell)) continue;
        if (real && LST.mine && L.owner !== me) continue;
        if (!stateOK(L, LST.state)) continue;
        if (!match(lname(L)) && !match(zoneName(G.zone[L.cell]))) continue;
        items.push({ r: rank(L.owner), n: lname(L), html: row(hue(L.owner), [lname(L), `·${zoneName(G.zone[L.cell])}${who(L.owner)}`], 'l:' + L.id, `${L.starve > 0 ? '！' : ''}${L.type === 0 ? '步' : '炮'}${String(L.n).padStart(2, '0')}${tr('st_' + L.st)}`, 6.2, 5.6) });
      }
    }
    items.sort((a, b) => a.r - b.r || a.n.localeCompare(b.n, 'zh', { numeric: true }));
    let top = '';
    if (tab === 'zones') {         // zones that two or more nations share come first, as cards that say who gets what and why
      const zs = []; G.Z.forEach((z, zi) => { const m = sh[zi]; if (!z.cells.length || !m || m.size < 2) return; if (fv && !m.has(me)) return; if (!match(zoneName(zi))) return; zs.push(zi); });
      if (zs.length) top = `<h4 class="lh">${tr('fightHead', zs.length)}</h4><div class="fcards">` + zs.map(zi => { const ls = zoneLines(zi); return `<div class="fcard" data-go="z:${zi}"><b>${esc(zoneName(zi))}</b>` + ls.map((s, i) => `<div class="fl${i && !s.startsWith('\u3000') && !s.startsWith('共') ? ' h' : ''}">${esc(s)}</div>`).join('') + `</div>`; }).join('') + `</div><h4 class="lh">${tr('allZones')}</h4>`;
    }
    body.innerHTML = top + (items.length ? items.map(x => x.html).join('') : `<div class="sub" style="padding:8px">${tr('dirEmpty')}</div>`);
  }
  function dirGo(spec) {
    const [k, id] = spec.split(':'), me = viewer(); let cell = -1;
    if (k === 'l') { const L = G.L.find(x => x.id === +id); if (!L) return; cell = L.cell; }
    else if (k === 'c') cell = +id;
    else if (k === 'z') cell = G.Z[+id].ai;
    if (cell < 0) return;
    const mineHere = (G.lg[cell] && G.lg[cell].owner === me) || (G.def[cell] >= CITY_MIN && G.co[cell] === me);
    G.mode = null; G.blink = -1;
    if (mineHere) { G.sel = cell; G.focus = -1; } else { G.focus = cell; if (!(k === 'z')) G.sel = G.sel; }
    view.cx = G.X[cell]; view.cy = G.Y[cell]; view.s = Math.max(view.s, 1.1); clampCam();
    DIR.key = ''; ui(true); requestDraw();
  }
