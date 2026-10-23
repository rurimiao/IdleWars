// controlled siege: one enemy city (200 walls) against a set attack force, both sides played by script under the real rules. Usage: node tests/siege_bench.js <html> [trials]
// the defender gives no orders (its legions stay on alert and fire at round end); the attacker walks in, fires at whatever is in reach (the city's garrison first), batteries stand 4–5 off
const { chromium } = require('playwright');
const [file, trialsArg = '12'] = process.argv.slice(2);
const SETUPS = [
  { name: '守军20步｜攻4步', def: 'gar', inf: 4, art: 0 },
  { name: '守军20步｜攻2步+1炮', def: 'gar', inf: 2, art: 1 },
  { name: '开局城(20步城内+20步10炮城边)｜攻4步+2炮', def: 'full', inf: 4, art: 2 },
  { name: '开局城｜攻6步+3炮', def: 'full', inf: 6, art: 3 },
  { name: '开局城｜攻8步', def: 'full', inf: 8, art: 0 },
];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(500);
  await p.evaluate(() => { sSpeed.value = '0.05'; sSpeed.dispatchEvent(new Event('change')); });
  for (const su of SETUPS) {
    const res = [];
    for (let t = 0; t < +trialsArg; t++) {
      const r = await p.evaluate(async su => {
        const d = window.__game; sPlayers.value = '2'; sHumans.value = '2'; sCp.value = '1000'; newBtn.click();
        await new Promise(ok => setTimeout(ok, 300));
        let G = d.G; const H = d.hexDist;
        const mk = (owner, type, n, cell) => { const L = { id: G.nid++, no: ++G.seq[owner][type], owner, type, n, cell, st: 'alert', tgt: null, sup: n * d.TYPES[type].eat * 10, hoard: 10, starve: 0, acted: false, atk: 0, fired: false, eng: 0, bld: false, dead: false, mv: null, route: null, ordRound: 0 }; G.lg[cell] = L; G.L.push(L); G.lgInfo[L.id] = { o: owner, t: type, no: L.no, name: null }; return L; };
        const home0 = d.cities(0), cs1 = d.cities(1);
        const tc = cs1.map(c => [c, Math.min(...home0.map(h => H(h, c)))]).sort((a, b) => a[1] - b[1])[0][0];
        for (const L of G.L) { G.lg[L.cell] = null; L.dead = true; } G.L = [];
        const free = c => c >= 0 && G.zone[c] >= 0 && !G.lg[c] && !d.isCity(c) && !G.def[c];
        mk(1, 0, 20, tc);
        if (su.def === 'full') { const ring = d.within(tc, 1).filter(c => H(c, tc) === 1 && free(c)); mk(1, 0, 20, ring[0]); mk(1, 1, 10, ring[1]); }
        const near0 = c => Math.min(...home0.map(h => H(h, c)));
        const start = d.within(tc, 6).filter(c => H(c, tc) >= 5 && free(c)).sort((a, b) => near0(a) - near0(b));
        const atk = []; for (let i = 0; i < su.inf + su.art; i++) atk.push(mk(0, i < su.inf ? 0 : 1, i < su.inf ? 20 : 10, start[i]));
        const men0 = atk.reduce((a, L) => a + L.n * (L.type ? 4 : 1), 0);
        G.round = 2; G.cur = 0; G.order = [0, 1]; G.ver++;
        let garDead = 0, taken = 0, wallAt = 0;
        for (let k = 0; k < 30 && !taken; k++) {
          G = d.G;
          if (G.cur === 0) {
            for (const L of atk) {
              if (L.dead || L.acted) continue;
              if (L.st === 'alert') {
                const ts = d.targetsIn(L), g = ts.find(x => x.cell === tc);
                const t = g || ts[0];
                if (t && d.attackNow(L, t)) continue;
              }
              if (L.st === 'march' && L.tgt != null) continue;
              if (!G.lg[tc] && L.type === 0 && G.def[tc] < 200) { if (d.orderMarch(L, tc)) continue; }
              if (L.type === 1) { const dd = H(L.cell, tc); if (dd >= 4 && dd <= 5) continue; const c = d.within(tc, 5).filter(c => H(c, tc) >= 4 && free(c)).sort((a, b) => H(L.cell, a) - H(L.cell, b))[0]; if (c != null) d.orderMarch(L, c); continue; }
              const c = d.within(tc, 2).filter(c => c !== tc && free(c)).sort((a, b) => H(L.cell, a) - H(L.cell, b) || H(a, tc) - H(b, tc))[0];
              if (c != null && H(L.cell, tc) > 1) d.orderMarch(L, c);
            }
          }
          await d.endTurn(); await new Promise(ok => setTimeout(ok, 30));
          while (d.G.busy) await new Promise(ok => setTimeout(ok, 30));
          G = d.G;
          const g = G.lg[tc]; if (!garDead && !(g && g.owner === 1)) garDead = G.round;
          if (!wallAt && G.def[tc] < 200) wallAt = G.round;
          if (g && g.owner === 0) taken = G.round;
        }
        const men1 = atk.filter(L => !L.dead).reduce((a, L) => a + L.n * (L.type ? 4 : 1), 0);
        return { garDead: garDead ? garDead - 2 : -1, wallAt: wallAt ? wallAt - 2 : -1, taken: taken ? taken - 2 : -1, lost: men0 - men1, defLeft: G.L.filter(L => L.owner === 1 && !L.dead).length, wall: G.def[tc], cp: d.cpMax(0) };
      }, su);
      res.push(r);
    }
    const ok = res.filter(r => r.taken >= 0), avg = (a, k) => a.length ? (a.reduce((s, r) => s + r[k], 0) / a.length).toFixed(1) : '-';
    console.log(`${su.name}: 拿下 ${ok.length}/${res.length} 次；守军全灭平均第 ${avg(res.filter(r => r.garDead >= 0), 'garDead')} 回合；城墙跌破 200 平均第 ${avg(res.filter(r => r.wallAt >= 0), 'wallAt')} 回合；拿下平均第 ${avg(ok, 'taken')} 回合；攻方损失(步兵人数，炮兵按 4 人算) ${avg(res, 'lost')}；收尾城防 ${avg(res, 'wall')}；指挥点 ${res[0].cp}`);
  }
  console.log(errs.length ? 'errors ' + JSON.stringify(errs.slice(0, 3)) : 'no errors');
  await b.close();
})();
