const { chromium } = require('playwright');
const [file, players = '6', maxRound = '60', ai = 'normal', size = 'std', secs = '90'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 300)); });
  await p.addInitScript(f => { window.__FOG = f; }, !!process.env.FOG); await p.goto('file://' + file);
  await p.waitForTimeout(500);
  await p.evaluate(([pl, ai, size]) => { document.getElementById('sPlayers').value = pl; document.getElementById('sHumans').value = '0'; document.getElementById('sFog').checked = !!window.__FOG; document.getElementById('sSpeed').value = '0.05'; document.getElementById('sSpeed').dispatchEvent(new Event('change')); document.getElementById('newBtn').click(); }, [players, ai, size]);
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < secs * 1000) {
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const d = window.__game, G = d.G; const st = d.stats();
      const bad = [];
      const seen = new Set();
      for (const L of G.L) {
        if (L.dead) bad.push('dead in list');
        if (G.lg[L.cell] !== L) bad.push('lg mismatch ' + L.id);
        if (seen.has(L.cell)) bad.push('dup cell');
        seen.add(L.cell);
        if (L.n <= 0) bad.push('n<=0');
        if (L.n > d.TYPES[L.type].cap) bad.push('over cap ' + L.n);
        if (!(L.sup >= 0)) bad.push('sup nan ' + L.sup);
        const bl = !G.zone[L.cell] < 0; if (bl) bad.push('on blocked');
        
      }
      for (const i of G.land) { if (G.def[i] > 0 && G.co[i] < 0) bad.push('big no owner'); if (G.def[i] > 500) bad.push('def>500');   }
      let infM = 0, artM = 0; for (const L of G.L) if (L.type === 0) infM += L.n; else artM += L.n;
      return { round: G.round, over: G.over, win: G.win, legions: G.L.length, infM, artM, cities: st.map(s => s.n), stock: G.players.map(p => Math.round(p.stock)), income: G.players.map(p => p.income), alive: G.players.map(p => p.alive ? 1 : 0).join(''), bad: [...new Set(bad)], totalCities: [...G.land].filter(i => (G.def[i] >= 100)).length, defs: Math.round([...G.land].reduce((a, i) => a + G.def[i], 0)) };
    });
    if (r.round !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(r)); last = r.round; }
    if (r.over || r.round >= +maxRound) break;
    if (errs.length) break;
  }
  console.log(errs.join('\n') || 'no errors');
  await p.screenshot({ path: '/tmp/sim.png' });
  await b.close();
})();
