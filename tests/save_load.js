const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(500);
  console.log('ng open at start', await p.evaluate(() => !document.getElementById('ngModal').hidden), 'G', await p.evaluate(() => !!window.__game.G));
  await p.screenshot({ path: '/tmp/ng.png' });
  await p.evaluate(() => { sPlayers.value = 6; sHumans.value = '1'; sSpeed.value = '0.05'; sSpeed.dispatchEvent(new Event('change')); sFog.checked = true; newBtn.click(); });
  await p.waitForFunction(() => { const G = window.__game.G; return G && G.players[G.cur].human && !G.busy; }, null, { timeout: 30000 });
  for (let k = 0; k < 4; k++) { const r0 = await p.evaluate(() => window.__game.G.round); await p.evaluate(()=>{endBtn.click();if(__game.G._endWarn)__game.G._endWarnAt=-1e9;endBtn.click()}); await p.waitForFunction(r0 => { const G = window.__game.G; return (G.round > r0 && G.players[G.cur].human && !G.busy) || G.over; }, r0, { timeout: 40000 }); }
  const before = await p.evaluate(() => { const G = window.__game.G; return { round: G.round, cur: G.cur, L: G.L.length, men: G.L.reduce((a, l) => a + l.n, 0), stock: G.players.map(q => q.stock), def: G.def.reduce((a, v) => a + v, 0), log: G.log.length, saved: !!localStorage.getItem('idlewars-command-save-1'), fog: window.__game.S().fog }; });
  console.log('before', JSON.stringify(before));
  await p.reload(); await p.waitForTimeout(800);
  const after = await p.evaluate(() => { const G = window.__game.G; return G && { round: G.round, cur: G.cur, L: G.L.length, men: G.L.reduce((a, l) => a + l.n, 0), stock: G.players.map(q => q.stock), def: G.def.reduce((a, v) => a + v, 0), log: G.log.length, ng: !document.getElementById('ngModal').hidden, fog: window.__game.S().fog }; });
  console.log('after ', JSON.stringify(after));
  // keep playing after resume
  for (let k = 0; k < 3; k++) { const r0 = await p.evaluate(() => window.__game.G.round); await p.evaluate(()=>{endBtn.click();if(__game.G._endWarn)__game.G._endWarnAt=-1e9;endBtn.click()}); await p.waitForFunction(r0 => { const G = window.__game.G; return (G.round > r0 && G.players[G.cur].human && !G.busy) || G.over; }, r0, { timeout: 40000 }); }
  console.log('played on to round', await p.evaluate(() => window.__game.G.round));
  // file round trip
  const rt = await p.evaluate(() => { const d = window.__game; const js = JSON.stringify(d.packGame()); d.unpackGame(JSON.parse(js)); return { bytes: js.length, round: d.G.round, L: d.G.L.length }; });
  console.log('file round trip', JSON.stringify(rt));
  await p.click('#bSet'); await p.waitForTimeout(150); await p.screenshot({ path: '/tmp/menu.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
