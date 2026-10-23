
  // ---------- world: an island board with holes, cut into zones ----------
  const waveSet = (n, lmin, lmax) => Array.from({ length: n }, () => { const a = Math.random() * 6.283, k = 6.283 / (lmin + Math.random() * (lmax - lmin)); return { kx: Math.cos(a) * k, ky: Math.sin(a) * k, ph: Math.random() * 6.283 }; });
  const waveAt = (ws, x, y) => { let s = 0; for (const w of ws) s += Math.sin(w.kx * x + w.ky * y + w.ph); return s / Math.sqrt(ws.length / 2); };
  function landComponents(isLand, total) {
    const comp = new Int32Array(total).fill(-1), list = [];
    for (let i = 0; i < total; i++) {
      if (!isLand[i] || comp[i] >= 0) continue;
      const q = [i]; comp[i] = list.length; const cells = [];
      while (q.length) { const u = q.pop(); cells.push(u); for (const v of nbrs(u)) if (v >= 0 && isLand[v] && comp[v] < 0) { comp[v] = list.length; q.push(v); } }
      list.push(cells);
    }
    return { comp, list };
  }

  // zone objects and the physical links between land cells, from the zone map alone (also used to restore a saved game)
  function makeZones(n, zone, isLand, X, Y, land) {
    const total = COLS * ROWS;
    const Z = Array.from({ length: n }, (_, id) => ({ id, cells: [], nb: new Set(), terrain: 'zone', ax: 0, ay: 0, ai: 0, path: new Path2D(), edge: new Path2D(), bx0: Infinity, by0: Infinity, bx1: -Infinity, by1: -Infinity, out: ZONE_OUT, holder: -1, shares: null, home: -1 }));
    for (const i of land) Z[zone[i]].cells.push(i);
    const phys = new Int32Array(total * 6).fill(-1);
    for (const i of land) {
      const z = Z[zone[i]], x = X[i], y = Y[i], nb = nbrs(i);
      hexPath(z.path, x, y);
      z.bx0 = Math.min(z.bx0, x - SZ); z.by0 = Math.min(z.by0, y - SZ); z.bx1 = Math.max(z.bx1, x + SZ); z.by1 = Math.max(z.by1, y + SZ + 6);
      for (let e = 0; e < 6; e++) {
        const j = nb[e];
        if (j >= 0 && isLand[j]) { phys[i * 6 + e] = j; if (zone[j] !== zone[i]) z.nb.add(zone[j]); }
        if (j < 0 || !isLand[j] || zone[j] !== zone[i]) { const [x1, y1] = corner(x, y, e), [x2, y2] = corner(x, y, (e + 1) % 6); z.edge.moveTo(x1, y1); z.edge.lineTo(x2, y2); }
      }
    }
    for (const z of Z) {
      if (!z.cells.length) continue;
      let sx = 0, sy = 0; for (const c of z.cells) { sx += X[c]; sy += Y[c]; }
      sx /= z.cells.length; sy /= z.cells.length;
      let bd = Infinity; for (const c of z.cells) { const d = Math.hypot(X[c] - sx, Y[c] - sy); if (d < bd) { bd = d; z.ai = c; } }
      z.ax = X[z.ai]; z.ay = Y[z.ai];
    }
    return { Z, phys };
  }
  // ---------- connectivity: no long detours around holes ----------
  const MAX_DETOUR = 10, WALL_STEP = 8;
  // greedy straight line of cells from a to b
  function hexLine(a, b) {
    const out = [a]; let u = a; const ax = cellXY(a % COLS, (a / COLS) | 0), bx = cellXY(b % COLS, (b / COLS) | 0);
    const dx = bx[0] - ax[0], dy = bx[1] - ax[1], len = Math.hypot(dx, dy) || 1;
    for (let g = 0; g < 400 && u !== b; g++) {
      let best = -1, bs = Infinity; const du = hexDist(u, b);
      for (const v of nbrs(u)) { if (v < 0 || hexDist(v, b) >= du) continue; const [x, y] = cellXY(v % COLS, (v / COLS) | 0); const off = Math.abs((x - ax[0]) * dy - (y - ax[1]) * dx) / len; if (off < bs) { bs = off; best = v; } }
      if (best < 0) break; out.push(best); u = best;
    }
    return out;
  }
  function bfsFrom(s, isLand, total) {
    const d = new Int32Array(total).fill(-1), q = [s]; d[s] = 0;
    for (let h = 0; h < q.length; h++) { const u = q[h]; for (const v of nbrs(u)) if (v >= 0 && isLand[v] && d[v] < 0) { d[v] = d[u] + 1; q.push(v); } }
    return d;
  }
  // thin hole walls get an opening every WALL_STEP cells; then any pair of cells whose shortest walk exceeds the straight distance by more than MAX_DETOUR gets a cut through the holes between them
  function openUp(isLand, isl, total) {
    const holes = new Uint8Array(total); for (let i = 0; i < total; i++) if (isl[i] && !isLand[i]) holes[i] = 1;
    const hc = landComponents(holes, total);
    for (const l of hc.list) {
      if (l.length < 6) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; const pts = l.map(i => { const [x, y] = cellXY(i % COLS, (i / COLS) | 0); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); return [x / (SZ * SQ), y / (SZ * 1.5)]; });
      const ext = Math.hypot((x1 - x0) / (SZ * SQ), (y1 - y0) / (SZ * 1.5));
      if (ext <= WALL_STEP || l.length / ext > 3) continue;       // blobs are not walls
      const ax = (x1 - x0) / (SZ * SQ) >= (y1 - y0) / (SZ * 1.5) ? 0 : 1, lo = Math.min(...pts.map(p => p[ax])), n = Math.floor(ext / WALL_STEP);
      for (let k = 0; k < n; k++) {
        const tgt = lo + (k + 0.5) * (Math.max(...pts.map(p => p[ax])) - lo) / n;
        let bi = -1, bd = Infinity; l.forEach((i, t) => { const dd = Math.abs(pts[t][ax] - tgt); if (dd < bd) { bd = dd; bi = i; } });
        if (bi >= 0) { isLand[bi] = 1; for (const v of nbrs(bi)) if (v >= 0 && holes[v] && isl[v]) isLand[v] = 1; }
      }
    }
    const land = []; for (let i = 0; i < total; i++) if (isLand[i]) land.push(i);
    const skip = new Set();
    for (let clean = 0, round = 0; clean < 60 && round < 1800; round++) {
      const s = land[rnd(land.length)], d = bfsFrom(s, isLand, total);
      let worst = -1, ws = MAX_DETOUR;
      for (const v of land) { if (d[v] < 0) continue; const e = d[v] - hexDist(s, v); if (e > ws && !skip.has(s * total + v)) { ws = e; worst = v; } }
      if (worst < 0) { clean++; continue; }
      const line = hexLine(s, worst);
      for (const c of line) if (!isLand[c]) { isLand[c] = 1; land.push(c); }
      clean = 0;
    }
    // a cut must never leave a loose cell: keep only the biggest piece
    const cc = landComponents(isLand, total), big = cc.list.reduce((a, b) => (b.length > a.length ? b : a), []);
    for (const l of cc.list) if (l !== big) for (const i of l) isLand[i] = 0;
  }
  // P nations, cpp playable cells per nation, vf share of the board that is hole
  function genWorld(P, cpp, vf, K) {
    const want = P * cpp;
    let area = want / (1 - vf) * 1.06;
    for (let attempt = 0; attempt < 60; attempt++) {
      const rect = area / 0.72;
      const rows = Math.max(24, Math.min(150, Math.round(Math.sqrt(rect / 1.45)))), cols = Math.max(34, Math.min(210, Math.round(rows * 1.45)));
      setGrid(cols, rows); buildCoords();
      const total = COLS * ROWS;
      // island outline
      const wv = [0, 1, 2, 3].map(() => ({ fx: (0.2 + Math.random() * 0.5) * 26 / COLS * 1.6, fy: (0.2 + Math.random() * 0.5) * 20 / ROWS * 1.6, px: Math.random() * 6.3, py: Math.random() * 6.3, a: 0.09 + Math.random() * 0.1 }));
      const isl = new Uint8Array(total);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const dx = (c - COLS / 2 + 0.5) / (COLS / 2), dy = (r - ROWS / 2 + 0.5) / (ROWS / 2);
        let n = 0; for (const w of wv) n += w.a * Math.sin(c * w.fx + w.px) * Math.sin(r * w.fy + w.py) * 2;
        isl[idx(c, r)] = dx * dx + dy * dy + n < 0.95 ? 1 : 0;
      }
      let cc = landComponents(isl, total), main = cc.list.reduce((a, b) => (b.length > a.length ? b : a), []);
      if (main.length < area * 0.82) { area *= 1.08; continue; }
      isl.fill(0); for (const i of main) isl[i] = 1;
      const X = new Float32Array(total), Y = new Float32Array(total), ux = new Float32Array(total), uy = new Float32Array(total);
      for (let i = 0; i < total; i++) { const [x, y] = cellXY(i % COLS, (i / COLS) | 0); X[i] = x; Y[i] = y; ux[i] = x / (SZ * SQ); uy[i] = y / (SZ * 1.5); }
      // holes: ridges make long walls, blobs make big holes; the quantiles are tuned until the share fits
      const wa = waveSet(5, 16, 34), wb = waveSet(5, 22, 46), A = new Float32Array(total), B = new Float32Array(total);
      for (const i of main) { A[i] = waveAt(wa, ux[i], uy[i]); B[i] = Math.abs(waveAt(wb, ux[i], uy[i])); }
      const sa = main.map(i => A[i]).sort((p, q) => p - q), sb = main.map(i => B[i]).sort((p, q) => p - q), n = main.length;
      const isLand = new Uint8Array(total);
      let fa = vf * 0.45, fb = vf * 0.6;
      for (let it = 0; it < 10; it++) {
        const ta = sa[Math.min(n - 1, Math.floor((1 - fa) * n))], tb = sb[Math.min(n - 1, Math.floor(fb * n))];
        let v = 0; isLand.fill(0);
        for (const i of main) { if (A[i] > ta || B[i] < tb) v++; else isLand[i] = 1; }
        const share = v / n; if (Math.abs(share - vf) < 0.012) break;
        const k = vf / Math.max(0.01, share); fa = Math.min(0.9, fa * k); fb = Math.min(0.9, fb * k);
      }
      // drop small scraps, then join what is left with narrow gaps so the board stays connected
      cc = landComponents(isLand, total);
      for (const l of cc.list) if (l.length < 14) for (const i of l) isLand[i] = 0;
      for (let guard = 0; guard < 80; guard++) {
        cc = landComponents(isLand, total);
        if (cc.list.length <= 1) break;
        const big = cc.list.reduce((a, b) => (b.length > a.length ? b : a), []), bigId = cc.comp[big[0]];
        const prev = new Int32Array(total).fill(-2), q = [];
        for (const i of big) { prev[i] = -1; q.push(i); }
        let hit = -1;
        for (let h = 0; h < q.length && hit < 0; h++) {
          const u = q[h];
          for (const v of nbrs(u)) {
            if (v < 0 || !isl[v] || prev[v] !== -2) continue;
            prev[v] = u; q.push(v);
            if (isLand[v] && cc.comp[v] !== bigId) { hit = v; break; }
          }
        }
        if (hit < 0) { for (const l of cc.list) if (l !== big) for (const i of l) isLand[i] = 0; break; }
        for (let c = prev[hit]; c >= 0 && prev[c] !== -1; c = prev[c]) {
          isLand[c] = 1;
          if (Math.random() < 0.45) { const o = nbrs(c).filter(v => v >= 0 && isl[v] && !isLand[v]); if (o.length) isLand[o[rnd(o.length)]] = 1; }
        }
      }
      openUp(isLand, isl, total);
      const land = []; for (let i = 0; i < total; i++) if (isLand[i]) land.push(i);
      if (land.length < want * 0.9) { area *= 1.1; continue; }
      // zones: Voronoi growth over the land graph
      const Zn = P * 12;
      const seeds = [land[rnd(land.length)]];
      while (seeds.length < Zn) {
        let bc = -1, bd = -1;
        for (let t = 0; t < 14; t++) {
          const c = land[rnd(land.length)]; let md = Infinity;
          for (const s of seeds) { const dx = X[c] - X[s], dy = Y[c] - Y[s]; md = Math.min(md, dx * dx + dy * dy); }
          if (md > bd) { bd = md; bc = c; }
        }
        seeds.push(bc);
      }
      const zone = new Int16Array(total).fill(-1), dist = new Float32Array(total).fill(Infinity), done = new Uint8Array(total), open = new Heap();
      seeds.forEach((s, t) => { zone[s] = t; dist[s] = 0; open.push(0, s); });
      while (open.size) {
        const key = open.k[0], u = open.pop(); if (done[u]) continue; done[u] = 1;
        for (const v of nbrs(u)) {
          if (v < 0 || !isLand[v] || done[v]) continue;
          const nd = key + 1 + Math.random() * 1.4;
          if (nd < dist[v]) { dist[v] = nd; zone[v] = zone[u]; open.push(nd, v); }
        }
      }
      const { Z, phys } = makeZones(seeds.length, zone, isLand, X, Y, land);
      if (Z.some(z => z.cells.length < 2)) { area *= 1.02; continue; }
      // deal the zones: every nation gets K connected zones; the rest stay empty. Nations are kept apart by 3-4 empty zones where the board has room.
      const ZN = Z.length, zd = Array.from({ length: ZN }, () => new Int16Array(ZN).fill(32000));
      for (let a0 = 0; a0 < ZN; a0++) { const q = [a0]; zd[a0][a0] = 0; for (let h = 0; h < q.length; h++) { const u = q[h]; for (const v of Z[u].nb) if (zd[a0][v] === 32000) { zd[a0][v] = zd[a0][u] + 1; q.push(v); } } }
      // seeds are packed as tightly as the spacing allows; every nation then grows a compact blob of K zones, never closer than `sep` steps to another nation
      const deal = sep => {
        const taken = new Int16Array(ZN).fill(-1), nz = Array.from({ length: P }, () => []);
        const nseeds = [rnd(ZN)], minSeed = sep + 2;
        while (nseeds.length < P) {
          let best = -1, bm = 1e9;
          for (let z = 0; z < ZN; z++) {
            if (nseeds.includes(z)) continue;
            let md = 1e9; for (const s of nseeds) md = Math.min(md, zd[z][s]);
            if (md < minSeed) continue;
            const key = md + Math.random() * 0.9; if (key < bm) { bm = key; best = z; }
          }
          if (best < 0) return null;
          nseeds.push(best);
        }
        const ok = (o, p) => { for (let q = 0; q < P; q++) if (q !== p) for (const z of nz[q]) if (zd[o][z] < sep) return false; return true; };
        nseeds.forEach((z, p) => { taken[z] = p; nz[p].push(z); });
        for (let progress = true; progress;) {
          progress = false;
          for (const p of shuffle([...Array(P).keys()])) {
            if (nz[p].length >= K) continue;
            let pick = -1, pk = 1e9;
            for (const z of nz[p]) for (const o of Z[z].nb) {
              if (taken[o] >= 0 || !ok(o, p)) continue;
              let sd = 0; for (const y of nz[p]) sd += zd[o][y];
              const key = sd + Math.random() * 1.5; if (key < pk) { pk = key; pick = o; }
            }
            if (pick < 0) continue;
            taken[pick] = p; nz[p].push(pick); progress = true;
          }
        }
        return nz.every(a => a.length >= K) ? { nz, taken } : null;
      };
      // nations are kept apart by one or two empty zones (never touching): every pair is at least 2 zone-steps apart and every nation has a neighbour at 2 or 3
      const nearest = nz => nz.map((zs, p) => { let m = 99; for (const z of zs) for (let q = 0; q < P; q++) if (q !== p) for (const y of nz[q]) m = Math.min(m, zd[z][y]); return m; });
      let dealt = null, gapZ = 0;
      for (const sep of attempt >= 40 ? [3, 2, 1] : [3, 2]) for (let t = 0; t < (sep === 3 ? 25 : 60) && !dealt; t++) {
        const r = deal(sep); if (!r) continue;
        const ne = nearest(r.nz.map(a => a.slice(0, K)));
        if (sep === 1 || ne.every(m => m <= 3)) { dealt = r; gapZ = sep - 1; }
      }
      if (!dealt) continue;
      const { nz } = dealt, kz = K;
      const owner = new Int16Array(total).fill(-1);
      for (let p = 0; p < P; p++) nz[p].slice(0, kz).forEach(z => { Z[z].holder = p; Z[z].home = p; for (const c of Z[z].cells) owner[c] = p; });
      for (const z of Z) z.out = ZONE_OUT;
      // narrow gaps: land cells that never get more than 2 cells from a hole and have no wide ground nearby
      const dv = new Int16Array(total).fill(-1), q = [];
      for (const i of land) { const nb = nbrs(i); if (nb.some(j => j < 0 || !isLand[j])) { dv[i] = 1; q.push(i); } }
      for (let h = 0; h < q.length; h++) { const u = q[h]; for (const v of nbrs(u)) if (v >= 0 && isLand[v] && dv[v] < 0) { dv[v] = dv[u] + 1; q.push(v); } }
      const narrow = new Uint8Array(total);
      for (const i of land) if (dv[i] <= 2 && !within(i, 3).some(j => isLand[j] && dv[j] >= 3)) narrow[i] = 1;
      const gap = new Uint8Array(total), ngc = landComponents(narrow, total);
      for (const l of ngc.list) { let bi = l[0], bs = -1; for (const c of l) { const s = dv[c] * 10 - Math.hypot(X[c] - X[l[0]], Y[c] - Y[l[0]]) * 0.01; if (s > bs) { bs = s; bi = c; } } gap[bi] = 1; }
      return { Z, zone, phys, link: Int32Array.from(phys), X, Y, land, owner, gap, K: kz, gapZ };
    }
    throw new Error('map generation failed');
  }
