// computer-only games: how many starting cities change hands (walked into, or knocked down to a site and rebuilt by the taker) in 60 rounds, how many legions are too small to be of use. Usage: node tests/ai_capture.js <html> [games] [rounds]
const { chromium } = require('playwright');
const [file, games = '3', rounds = '60'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const errs = [], out = [];
  for (let g = 0; g < +games; g++) {
    const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + file); await p.waitForTimeout(500);
    await p.evaluate(() => { sPlayers.value = '6'; sHumans.value = '0'; sCp.value = '1000'; sSpeed.value = '0.05'; sSpeed.dispatchEvent(new Event('change')); newBtn.click(); const G = window.__game.G; window.__home = G.land.filter(c => G.def[c] > 0).map(c => [c, G.co[c]]); });
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) { const r = await p.evaluate(() => window.__game.G.round); if (r > +rounds || errs.length) break; await p.waitForTimeout(500); }
    const r = await p.evaluate(() => { const d = window.__game, G = d.G, sum = k => (G.stats || []).reduce((a, row) => a + (row ? row.reduce((b, x) => b + x[k], 0) : 0), 0);
      const small = G.L.filter(L => L.n < (L.type === 0 ? 6 : 5)).length;
      const home = window.__home || [], turned = home.filter(([c, o]) => d.isCity(c) && G.co[c] !== o).length, taking = home.filter(([c, o]) => !d.isCity(c) && G.def[c] > 0 && G.co[c] !== o).length, sites = home.filter(([c, o]) => !d.isCity(c) && G.def[c] > 0 && G.co[c] === o).length, gone = home.filter(([c]) => !G.def[c]).length;
      return { round: G.round, turned, taking, sites, gone, captured: sum(15), lost: sum(17), razed: sum(18), wrecked: (G.ihist || []).filter(h => h.why === 'aiIntentDone' && h.it.k === 'city').length, alive: G.players.filter(P => P.alive).length, cities: G.players.map((_, q) => d.cities(q).length).join(','), legions: G.L.length, small, stock: G.players.map(P => Math.round(P.stock)).join(','), styles: G.aiStyle.join(',') }; });
    out.push(r); console.log(JSON.stringify(r));
    await p.close();
  }
  const cap = out.map(r => r.turned);
  console.log('cities taken (walked in or rebuilt) per game', cap.join(' '), 'average', (cap.reduce((a, b) => a + b, 0) / cap.length).toFixed(1));
  console.log(errs.length ? 'errors ' + JSON.stringify(errs.slice(0, 3)) : 'no errors');
  await b.close();
})();
