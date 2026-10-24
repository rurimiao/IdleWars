// 对称地图：2 到 8 家、每家 3/6/10 个大区、两种边界，各造一张，存成字符串再读回来检查：
// 每家正好 n 个大区且连成一片、不和别家的家贴着、地盘格数差不多（差 6% 以内或不超过 5 格；2、3、4、6 家要完全一样）、整张图连通
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(500);
  const bad = await p.evaluate(() => {
    const d = window.__game, bad = [];
    for (let P = 2; P <= 8; P++) for (const n of [3, 6, 10]) for (const edge of ['wall', 'band']) {
      const tag = `${P}家 ${n}区 ${edge}`;
      let g; try { g = d.loadMap(d.packMap(d.genSymWorld(P, n, { edge }))); } catch (e) { bad.push(tag + ' 造不出来'); continue; }
      const Z = g.Z, sizes = [];
      for (let q = 0; q < P; q++) {
        const hz = Z.filter(z => z.home === q); if (hz.length !== n) { bad.push(tag + ' 大区数'); break; }
        if (hz.some(z => [...z.nb].some(o => Z[o].home >= 0 && Z[o].home !== q))) bad.push(tag + ' 两家贴着');
        sizes.push(hz.map(z => z.cells.length).sort((a, b) => a - b).join(' '));
      }
      const tot = sizes.map(s => s.split(' ').reduce((a, x) => a + +x, 0));
      if ([2, 3, 4, 6].includes(P) ? new Set(sizes).size > 1 : Math.max(...tot) > Math.min(...tot) * 1.06 && Math.max(...tot) - Math.min(...tot) > 5) bad.push(tag + ' 不公平 ' + tot.join(','));
      const seen = new Set([g.land[0]]), q = [g.land[0]];
      while (q.length) { const u = q.pop(); for (let e = 0; e < 6; e++) { const v = g.link[u * 6 + e]; if (v >= 0 && !seen.has(v)) { seen.add(v); q.push(v); } } }
      if (seen.size !== g.land.length) bad.push(tag + ' 不连通');
    }
    return bad;
  });
  console.log('bad', JSON.stringify(bad), 'errors', JSON.stringify(errs));
  await b.close();
})();
