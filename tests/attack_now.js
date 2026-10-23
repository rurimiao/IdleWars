// 轮流制：真人下的攻击命令当场开火（和电脑一样），回合末不再开第二枪；撤销不了
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const er = []; p.on('pageerror', e => er.push(e.message));
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => { sHumans.value = '1'; sPlayers.value = 4; sFf.value = '0'; sSpeed.value = '0.05'; sSpeed.dispatchEvent(new Event('change')); newBtn.click(); });
  const hum = () => p.waitForFunction(() => { const G = __game.G; return G.players[G.cur].human && !G.busy && !G.pause; }, null, { timeout: 90000 });
  const end = () => p.evaluate(() => { endBtn.click(); __game.G._endWarnAt = -1e9; endBtn.click(); });
  await hum(); await end(); await hum();       // round 1 is a ceasefire
  const r = await p.evaluate(() => {
    const d = __game, G = d.G, me = G.cur;
    const E = G.L.find(l => l.owner !== me && l.type === 0);
    let A = null, spot = -1;       // one of my standing infantry with a free cell next to it; the enemy legion is moved there
    for (const L of G.L) {
      if (L.owner !== me || L.type !== 0 || L.st !== 'alert' || L.acted) continue;
      for (let e = 0; e < 6 && spot < 0; e++) { const v = G.link[L.cell * 6 + e]; if (v >= 0 && !G.lg[v] && G.zone[v] >= 0 && !(G.def[v] > 0)) spot = v; }
      if (spot >= 0) { A = L; break; }
    }
    G.lg[E.cell] = null; E.cell = spot; G.lg[spot] = E; G.ver++;
    const before = E.n, ok = d.attackNow(A, E);
    return { ok, fired: A.firedRound === G.round, before, after: E.dead ? 0 : E.n, undo: d.cancelOrder(A) };
  });
  console.log(JSON.stringify(r), er);
  console.log(r.ok && r.fired && r.undo === false && er.length === 0 ? 'ok' : 'bad');
  await b.close();
})();
