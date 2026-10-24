// alliances: allies do not count as targets, share vision, cannot take each other's cities; a break lets them fight only from the next round;
// a computer refuses when nobody leads and accepts against a leader; the diplomacy button works; alliances survive a save. Usage: node tests/alliance.js <html>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(500);
  await p.evaluate(() => { sPlayers.value = 4; sPlayers.dispatchEvent(new Event('input')); sHumans.value = '1'; sSpeed.value = '0.05'; sSpeed.dispatchEvent(new Event('change')); newBtn.click(); });
  await p.waitForFunction(() => { const G = window.__game.G; return G && G.players[G.cur].human && !G.busy; }, null, { timeout: 30000 });
  const r = await p.evaluate(() => {
    const d = window.__game, G = d.G, me = G.cur, o = G.order.filter(q => q !== me), [a, c, lead] = o, out = {};
    const fail = []; const ok = (k, v) => { out[k] = v; if (!v) fail.push(k); };
    // a computer with nobody far ahead says no
    ok('refuse when balanced', d.askAlly(me, a) === 'dipNoNeed' && !d.allied(me, a));
    // make one nation the leader: then the others accept and team up
    for (const L of G.L) if (L.owner === lead) L.n *= 6;
    ok('leader found', d.leaderOf() === lead);
    ok('refuse the leader', d.askAlly(lead, a) === 'dipLead');
    ok('accept against the leader', d.askAlly(me, a) === null && d.allied(me, a) && d.allied(a, me));
    d.aiDiplo(c);
    ok('computers team up', d.allied(c, a) || d.allied(c, me));
    // allies: no targets, shared vision, cities cannot be taken
    const mine = G.L.find(L => L.owner === me), theirs = G.L.find(L => L.owner === a), city = G.land.find(i => d.isCity(i) && G.co[i] === a);
    ok('not hostile', !d.hostile(me, a));
    ok('ally city not takable', !d.canTake(city, me));
    const vis = d.visMask(me); ok('shared vision', !!vis[theirs.cell]);
    const old = mine.cell; G.lg[old] = null; const near = G.land.find(i => !G.lg[i] && d.hexDist(i, theirs.cell) === 2); G.lg[near] = mine; mine.cell = near; G.ver++;
    ok('ally not a target', !d.targetsIn(mine).includes(theirs));
    // a break: still no fire this round, fire from the next
    d.setAlly(me, a, false);
    ok('truce this round', !d.allied(me, a) && !d.hostile(me, a) && !d.targetsIn(mine).includes(theirs));
    G.round++; G.ver++;
    ok('hostile next round', d.hostile(me, a) && d.targetsIn(mine).includes(theirs) && d.canTake(city, me));
    G.round--; G.lg[near] = null; G.lg[old] = mine; mine.cell = old; G.ver++;
    out.log = G.log.filter(m => /Ally|Unally/.test(m.key)).map(m => d.logText ? d.logText(m) : m.key);
    out.fail = fail; return out;
  });
  console.log(JSON.stringify(r));
  // the button: open the full nations table and ask the leader's victim again
  await p.click('#tabPanel'); await p.waitForTimeout(150); await p.click('#natMore'); await p.waitForTimeout(200);
  const btn = await p.evaluate(() => [...document.querySelectorAll('#natAll button[data-dip]')].map(x => [x.dataset.dip, x.textContent, x.disabled]));
  const lead = await p.evaluate(() => window.__game.leaderOf());
  console.log('buttons', JSON.stringify(btn), 'leader', lead);
  const target = btn.find(x => x[1] === '结盟' && !x[2] && +x[0] !== lead);       // the one just broken with shows 停战中 and has no button
  let click = null;
  if (target) { await p.click(`#natAll button[data-dip="${target[0]}"]`); await p.waitForTimeout(200); click = await p.evaluate(q => ({ note: (document.querySelector('#natAll .dipnote') || {}).textContent, allied: window.__game.allied(window.__game.G.cur, q) }), +target[0]); }
  console.log('click', JSON.stringify(click));
  await p.screenshot({ path: '/tmp/alliance.png' }); await p.keyboard.press('Escape'); await p.waitForTimeout(200); await p.screenshot({ path: '/tmp/alliance_side.png', clip: { x: 990, y: 90, width: 370, height: 180 } });
  const saved = await p.evaluate(() => { const d = window.__game; const before = JSON.stringify(d.G.ally); d.unpackGame(JSON.parse(JSON.stringify(d.packGame()))); return before === JSON.stringify(d.G.ally); });
  const pass = !r.fail.length && btn.length === 2 && click && click.allied && /同意/.test(click.note) && saved && !errs.length;
  console.log('save keeps alliances', saved);
  console.log(errs.join('\n') || 'no errors');
  console.log(pass ? '通过' : '失败');
  await b.close();
})();
