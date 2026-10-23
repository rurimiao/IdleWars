// 生成固定地图：每个人数（2 到 8 家）随机造很多张，按平衡打分，挑最好的 3 张写进 src/maps.js。
// 用法：node tests/make_maps.js <html> [每种人数试几张，默认 40]；环境变量 CPP（每家大约多少格，默认 250）、SEP（两家之间最多隔几个大区，默认 2）
// 平衡看四样：各家地盘格数、各家城到最近敌城的路程（平均、最近）、各家附近的中立大区数（扩张余地）、各家邻国数；路程还要接近目标（约 12 格），不能太远也不能贴脸
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [file, triesArg = '40'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.goto('file://' + file); await p.waitForTimeout(500);
  const out = {};
  for (let P = 2; P <= 8; P++) {
    const best = await p.evaluate(({ P, tries, cpp, sep }) => {
      const d = window.__game, TARGET = 12, CPP = cpp, SEP = sep, list = [];
      const cv = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return m ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m : 0; };
      for (let t = 0; t < tries; t++) {
        let g; try { g = d.genWorld(P, CPP, 0.3, 6, 12, 16, SEP); } catch (e) { continue; }
        const m = d.packMap(g), g2 = d.loadMap(m);       // what is stored is what is measured
        const n = g2.link.length / 6, bfs = srcs => { const dist = new Int16Array(n).fill(-1), q = [...srcs]; for (const s of srcs) dist[s] = 0; for (let h = 0; h < q.length; h++) { const u = q[h]; for (let e = 0; e < 6; e++) { const v = g2.link[u * 6 + e]; if (v >= 0 && dist[v] < 0) { dist[v] = dist[u] + 1; q.push(v); } } } return dist; };
        const cities = g2.Z.filter(z => z.home >= 0 && z.cells.length).map(z => [z.ai, z.home]);
        if (new Set(cities.map(c => c[1])).size !== P) continue;
        const fromNation = [...Array(P).keys()].map(q => bfs(cities.filter(c => c[1] === q).map(c => c[0])));
        const cells = [], exp = [], dmin = [], room = new Array(P).fill(0), nb = [];
        for (let q = 0; q < P; q++) {
          cells.push(g2.land.filter(c => g2.owner[c] === q).length);
          const near = cities.filter(c => c[1] === q).map(([c]) => Math.min(...[...Array(P).keys()].filter(o => o !== q).map(o => fromNation[o][c])));
          exp.push(near.reduce((a, x) => a + x, 0) / near.length); dmin.push(Math.min(...near));
        }
        const gmin = Math.min(...dmin);
        for (let q = 0; q < P; q++) { let k = 0; for (let o = 0; o < P; o++) if (o !== q && Math.min(...cities.filter(c => c[1] === q).map(([c]) => fromNation[o][c])) <= gmin + 6) k++; nb.push(k); }
        for (const z of g2.Z) { if (z.home >= 0 || !z.cells.length) continue; let bq = -1, bd = 1e9, tie = false; for (let q = 0; q < P; q++) { const v = fromNation[q][z.ai]; if (v < 0) continue; if (v < bd) { bd = v; bq = q; tie = false; } else if (v === bd) tie = true; } if (bq >= 0 && !tie) room[bq]++; }
        const avgExp = exp.reduce((a, x) => a + x, 0) / P;
        const score = cv(cells) * 2 + cv(exp) * 2 + cv(room.map(x => x + 1)) + (Math.max(...nb) - Math.min(...nb)) * 0.3 + Math.abs(avgExp - TARGET) / TARGET + (gmin < 7 ? 1 : 0);
        list.push({ score, m, info: { land: g2.land.length, cells, exp: exp.map(x => +x.toFixed(1)), dmin, room, nb } });
      }
      return list.sort((a, b) => a.score - b.score).slice(0, 3);
    }, { P, tries: +triesArg, cpp: +(process.env.CPP || 250), sep: +(process.env.SEP || 2) });
    out[P] = best.map(x => x.m);
    console.log('P' + P, best.map(x => x.score.toFixed(3) + ' ' + JSON.stringify(x.info)).join('\n   '));
  }
  const body = Object.entries(out).map(([P, ms]) => `    ${P}: [\n` + ms.map(m => '      ' + JSON.stringify(m)).join(',\n') + '\n    ]').join(',\n');
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'maps.js'), `  // 固定地图：2 到 8 家每种 3 张，由 tests/make_maps.js 挑出（打包格式见 mapgen.js 的 packMap）\n  const MAPS = {\n${body}\n  };\n`);
  console.log('src/maps.js', fs.statSync(path.join(__dirname, '..', 'src', 'maps.js')).size, 'bytes');
  await b.close();
})();
