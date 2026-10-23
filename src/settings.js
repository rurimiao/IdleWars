
  // ---------- settings ----------
  const DEFAULTS = { players: 4, homeZ: 6, humans: 1, obs: 'mid', tbs: 1, cpBase: 4, cpDiv: 200, ai: 'normal', speed: '1', fog: false, clr: false, chk: 50, step: 1.5, hitInf: 50, hitArt: 30, share: 50, tax: 50, upkeep: 20, buildCost: 5, supCap: 2, cityStart: 300, cityMin: 200, cityMax: 1000, capBonus: 3000, plunder: 10, buildBonus: 2000, breakBonus: 2000, aiStyle: 'random', names: { nation: [], city: [], zone: [] }, zone: 200, u: [{ budget: 2, rmin: 1, rmax: 2, min: 5, cost: 20, build: 1, eat: 2, dmg: 1, per: 1, cb: 1, bsp: 2, sg: 1 }, { budget: 1, rmin: 2, rmax: 5, min: 3, cost: 80, build: 3, eat: 8, dmg: 3, per: 3, cb: 1, bsp: 5, sg: 4 }] };
  let S = { ...DEFAULTS };
  try { S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('idlewars-command-1') || '{}') }; } catch (e) {}
  S.speed = '1';       // no speed setting any more: every step waits for the "step pause" setting
  if (S.u && S.u[1] && S.u[1].bsp === 4) S.u[1].bsp = 5;       // 4 was the old default for artillery
  if (S.tax === 100) S.tax = DEFAULTS.tax;       // 100 was the old flat tax per city; the tax is now a percentage of the city's size
  if (S.buildBonus === 200) S.buildBonus = DEFAULTS.buildBonus;       // 200 was the old default
  if (S.capBonus === 300) S.capBonus = DEFAULTS.capBonus;
  if (S.cityMin == null && S.cityStart === 200) S.cityStart = DEFAULTS.cityStart;       // 200 was the old starting size, when it was also the threshold; the starting cities now get some room above it       // 300 was the old default
  if (S.breakBonus === 100) S.breakBonus = DEFAULTS.breakBonus;       // 100 was the old default: settings saved with it move to the new one
  try { if (!localStorage.getItem('idlewars-players-4')) { localStorage.setItem('idlewars-players-4', '1'); if (S.players === 8) S.players = DEFAULTS.players; } } catch (e) { /* once: the old default of 8 nations becomes the new default of 4 */ }
  const num = (v, lo, hi, d) => { const n = Math.round(+v); return isFinite(n) && v !== '' && v != null ? Math.max(lo, Math.min(hi, n)) : d; };
  // unit and zone numbers are live settings: written into TYPES / the zones, so a change takes effect at once
  function applyParams() {
    const U = Array.isArray(S.u) ? S.u : DEFAULTS.u;
    TYPES.forEach((T, i) => {
      const d = DEFAULTS.u[i], u = U[i] || d;
      T.budget = num(u.budget, 1, 8, d.budget); T.rmin = num(u.rmin, 1, 10, d.rmin); T.rmax = Math.max(T.rmin, num(u.rmax, 1, 14, d.rmax));
      T.cost = num(u.cost, 1, 1000, d.cost); T.min = num(u.min, 1, T.cap, d.min); T.build = num(u.build, 1, 10, d.build); T.eat = num(u.eat, 0, 100, d.eat); T.dmg = num(u.dmg, 1, 20, d.dmg); T.per = num(u.per, 1, 20, d.per); T.cb = num(u.cb, 0, 6, d.cb); T.bsp = num(u.bsp, 1, 50, d.bsp); T.sg = num(u.sg, 1, 50, d.sg);
    });
    S.u = TYPES.map(t => ({ budget: t.budget, rmin: t.rmin, rmax: t.rmax, cost: t.cost, min: t.min, build: t.build, eat: t.eat, dmg: t.dmg, per: t.per, cb: t.cb, bsp: t.bsp, sg: t.sg }));
    S.cpBase = num(S.cpBase, 0, 99, 4); S.cpDiv = num(S.cpDiv, 10, 5000, 200);
    S.zone = num(S.zone, 0, 2000, 200); S.share = num(S.share, 0, 100, 50); S.tax = num(S.tax, 0, 200, 50); S.capBonus = num(S.capBonus, 0, 10000, 3000); S.cityMax = num(S.cityMax, 200, 5000, 1000); S.upkeep = num(S.upkeep, 0, 100, 20); S.buildCost = num(S.buildCost, 1, 100, 5); BUILD_COST = S.buildCost; S.supCap = num(S.supCap, 0, 20, 2); S.cityMin = num(S.cityMin, 50, S.cityMax, 200); S.cityStart = num(S.cityStart, S.cityMin, S.cityMax, 300); CITY_MAX = S.cityMax; CITY_START = S.cityStart; CITY_MIN = S.cityMin; S.plunder = num(S.plunder, 0, 100, 10); S.buildBonus = num(S.buildBonus, 0, 10000, 2000); S.breakBonus = num(S.breakBonus, 0, 10000, 2000);
    if (typeof G !== 'undefined' && G) for (const z of G.Z) z.out = S.zone;
  }
  function writeForm() {
    if (!['few', 'mid', 'many'].includes(S.obs)) S.obs = 'mid';
    $('sPlayers').value = S.players; $('sPlayersOut').textContent = S.players; $('sHomeZ').value = S.homeZ || 6; $('sHomeZOut').textContent = S.homeZ || 6; $('sHumans').value = S.humans;
    $('sObs').value = S.obs; $('sSpeed').value = S.speed; $('sFog').checked = !!S.fog; $('sClr').checked = !!S.clr; $('sCp').value = S.chk || 50; $('sStep').value = String(S.step || 1.5); $('sTb').value = String(S.tbs || 1);
  }
  const clampHit = (v, dflt) => Math.max(10, Math.min(100, Math.round((+v || dflt || 50) / 5) * 5));
  function readForm() {
    S = { players: +$('sPlayers').value, homeZ: Math.max(3, Math.min(10, +$('sHomeZ').value || 6)), humans: +$('sHumans').value, obs: $('sObs').value, speed: $('sSpeed').value, fog: $('sFog').checked, clr: $('sClr').checked, chk: Math.max(10, Math.min(1000, Math.round(+$('sCp').value) || 50)), step: +$('sStep').value || 1.5, tbs: Math.max(1, Math.min(9, Math.round(+$('sTb').value) || 1)), hitInf: clampHit(S.hitInf, 50), hitArt: clampHit(S.hitArt, 30), zone: S.zone, u: S.u, anaGap: S.anaGap, names: S.names, share: S.share, tax: S.tax, capBonus: S.capBonus, plunder: S.plunder, buildBonus: S.buildBonus, breakBonus: S.breakBonus, cityStart: S.cityStart, cityMin: S.cityMin, cityMax: S.cityMax, upkeep: S.upkeep, cpBase: S.cpBase, cpDiv: S.cpDiv, buildCost: S.buildCost, supCap: S.supCap };
    S.players = Math.max(2, Math.min(8, S.players)); S.humans = Math.min(S.humans, S.players);
    applyParams();
    try { localStorage.setItem('idlewars-command-1', JSON.stringify(S)); } catch (e) {}
  }

