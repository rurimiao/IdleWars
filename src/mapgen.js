
  // ---------- world: an island board with holes, cut into zones ----------
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
  // narrow gaps: land cells that never get more than 2 cells from a hole and have no wide ground nearby
  function narrowGaps(isLand, land, X, Y, total) {
    const dv = new Int16Array(total).fill(-1), q = [];
    for (const i of land) { const nb = nbrs(i); if (nb.some(j => j < 0 || !isLand[j])) { dv[i] = 1; q.push(i); } }
    for (let h = 0; h < q.length; h++) { const u = q[h]; for (const v of nbrs(u)) if (v >= 0 && isLand[v] && dv[v] < 0) { dv[v] = dv[u] + 1; q.push(v); } }
    const narrow = new Uint8Array(total);
    for (const i of land) if (dv[i] <= 2 && !within(i, 3).some(j => isLand[j] && dv[j] >= 3)) narrow[i] = 1;
    const gap = new Uint8Array(total), ngc = landComponents(narrow, total);
    for (const l of ngc.list) { let bi = l[0], bs = -1; for (const c of l) { const s = dv[c] * 10 - Math.hypot(X[c] - X[l[0]], Y[c] - Y[l[0]]) * 0.01; if (s > bs) { bs = s; bi = c; } } gap[bi] = 1; }
    return gap;
  }
  // ---------- symmetric worlds: one nation's wedge, copied around the centre ----------
  // Every nation gets a wedge: n home zones, then along each border with a neighbour either a hole wall or one layer of neutral zones (the neighbour has the other layer),
  // and in the middle a common ground of P/2 zones (one zone facing every two nations; one per nation when P is odd), with big and small holes.
  // On wall maps a layer of neutral zones lies between each nation's home ground and the common ground.
  // Even P mirror every other wedge (exact for 2, 4 and 6 nations on the hex grid), odd P turn it (exact for 3); 5, 7 and 8 come out nearly equal.
  const ZONE_CELLS = 25;
  // the same, all at once (genSymSteps yields after each step so that the panel can show how far it got)
  function genSymWorld(P, n = 6, opt = {}) { const it = genSymSteps(P, n, opt); for (;;) { const r = it.next(); if (r.done) return r.value; } }
  // a step at a time, letting the page draw between steps: onStep({ a: attempt, s: step text key, f: share of the attempt done, fail: why the last attempt was thrown away })
  async function genSymAsync(P, n, opt, onStep) {
    const it = genSymSteps(P, n, opt); let t0 = performance.now();
    for (;;) { const r = it.next(); if (r.done) return r.value; onStep(r.value); if (performance.now() - t0 > 30) { await new Promise(ok => setTimeout(ok, 0)); t0 = performance.now(); } }
  }
  function* genSymSteps(P, n = 6, opt = {}) {       // opt.edge: 'wall' or 'band' (picked at random when absent); opt.holes: how many small holes (1 = normal)
    const why = opt.why || (() => {}), holes = opt.holes ?? 1, edge = opt.edge || (Math.random() < 0.5 ? 'wall' : 'band');
    const th = 2 * Math.PI / P, even = P % 2 === 0, f0 = P === 2 ? -Math.PI / 2 : 0, AZ = ZONE_CELLS * SQ / 2;
    const rot = (a, x, y) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
    const refl = (a, x, y) => { const c = Math.cos(2 * a), s = Math.sin(2 * a); return [x * c + y * s, x * s - y * c]; };
    // which nation's wedge a point lies in, and the same point seen from nation 0 (cells exactly on a border are dealt left and right by turns)
    const fold = (x, y) => {
      const r = Math.hypot(x, y); if (r < 1e-9) return { g: 0, x: 0, y: 0 };
      const f = (((Math.atan2(y, x) - f0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let g = Math.min(P - 1, Math.floor(f / th)); const rem = f - g * th;
      if (r * Math.sin(Math.min(rem, Math.PI / 2)) < 1e-6) g = (Math.round(r) % 2 ? g : g - 1 + P) % P;
      else if (r * Math.sin(Math.min(th - rem, Math.PI / 2)) < 1e-6) g = (Math.round(r) % 2 ? (g + 1) % P : g);
      let p = even ? rot(-(g >> 1) * 2 * th, x, y) : rot(-g * th, x, y);
      if (even && g & 1) p = refl(f0 + th, p[0], p[1]);
      return { g, x: p[0], y: p[1] };
    };
    const rayD = (r, a) => (a < Math.PI / 2 ? r * Math.sin(a) : r);       // distance to a border half-line, a = angle from it
    const W = P >= 7 ? 3 : P >= 6 ? 3.4 : 4.6, WALL = 1.6, Rc = Math.sqrt(P / 2 * AZ / 0.72 / Math.PI) + 0.8;       // with 6 to 8 nations the border layers are narrower, so there are not more neutral zones than home zones
    const FRONT = Math.max(3, Math.sqrt(Rc * Rc + 2 * AZ / th) - Rc);       // wall maps: a layer of neutral ground (about one zone) between the home ground and the common ground
    // region of a nation-0 point: -1 hole, 0 home, 1/2 border layer at the first/second edge, 3 common ground
    let fail = '';
    for (let attempt = 0; attempt < 400; attempt++) {
      yield { a: attempt + 1, s: 'mgRim', f: 0, fail };
      const rimW = [1, 2, 3].map(m => ({ m, a: (Math.random() - 0.5) * 0.08 })), rimAt = a => 1 + rimW.reduce((s, w) => s + w.a * Math.cos(2 * Math.PI * w.m * a / th), 0);
      const blobs = [], lake = Rc * (0.25 + Math.random() * 0.2);
      const region = (x, y, Ro) => {
        const r = Math.hypot(x, y), a = Math.atan2(y, x) - f0;
        if (r > Ro * rimAt(a)) return -1;
        for (const [bx, by, br] of blobs) if (Math.hypot(x - bx, y - by) < br) return -1;
        if (r < Rc) return r < lake ? -1 : 3;
        const d0 = rayD(r, a), d1 = rayD(r, th - a);
        if (edge === 'wall') return Math.min(d0, d1) < WALL ? -1 : r < Rc + FRONT ? 1 : 0;
        return d0 < W && d0 <= d1 ? 1 : d1 < W ? 2 : 0;
      };
      // the wedge radius that gives n home zones
      const cellsOf = Ro => { let k = 0; const R = Math.ceil(Ro * 1.1) + 2; for (let dr = -R; dr <= R; dr++) for (let dq = -2 * R; dq <= 2 * R; dq++) { const x = dq + dr / 2, y = dr * SQ / 2; if (Math.hypot(x, y) > Ro * 1.1) continue; const F = fold(x, y); if (F.g === 0 && region(F.x, F.y, Ro) === 0) k++; } return k; };
      let lo = Rc + 3, hi = Rc + 60;
      for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (cellsOf(mid) < n * ZONE_CELLS) lo = mid; else hi = mid; yield { a: attempt + 1, s: 'mgRim', f: (it + 1) / 18 * 0.4, fail }; }
      yield { a: attempt + 1, s: 'mgHoles', f: 0.42, fail };
      const Ro = hi;
      // small holes in the home ground and border layers, a few in the common ground
      const nb = Math.round(n * 0.5 * holes);
      for (let t = 0, k = 0; t < 200 && k < nb; t++) { const r = Rc + 1.5 + Math.random() * (Ro - Rc - 2), a = f0 + Math.random() * th; blobs.push([r * Math.cos(a), r * Math.sin(a), 0.7 + Math.random() * 0.6]); k++; }
      for (let k = 0; k < (holes > 0 ? 1 : 0) + (Math.random() < 0.5 ? 1 : 0); k++) { const r = lake + Math.random() * (Rc - lake), a = f0 + Math.random() * th; blobs.push([r * Math.cos(a), r * Math.sin(a), 0.8 + Math.random() * 0.9]); }
      yield { a: attempt + 1, s: 'mgCells', f: 0.5, fail };
      const R1 = Ro * 1.1 + 2, cols = Math.ceil(2 * R1 + 3), rows = Math.ceil(2 * R1 / (SQ / 2) + 3) | 1;
      setGrid(cols, rows); buildCoords();
      const total = COLS * ROWS, ci = idx(cols >> 1, rows >> 1);
      const X = new Float32Array(total), Y = new Float32Array(total), cg = new Int16Array(total), bx = new Float64Array(total), by = new Float64Array(total), reg = new Int8Array(total);
      for (let i = 0; i < total; i++) {
        const dq = CQ[i] - CQ[ci], dr = CR[i] - CR[ci], F = fold(dq + dr / 2, dr * SQ / 2);
        cg[i] = F.g; bx[i] = F.x; by[i] = F.y; reg[i] = even && dq === 0 && dr === 0 ? -1 : region(F.x, F.y, Ro);
        const [x, y] = cellXY(i % COLS, (i / COLS) | 0); X[i] = x; Y[i] = y;
      }
      // zone seeds of nation 0's wedge, spread evenly over each region (a few rounds of moving every seed to the middle of its cells)
      const base = [0, 1, 2].map(k => { const pts = []; for (let i = 0; i < total; i++) if (cg[i] === 0 && reg[i] === k) pts.push([bx[i], by[i]]); return pts; });
      const lloyd = (pts, k) => {
        if (!pts.length) return [];
        const s = [pts[rnd(pts.length)]];
        while (s.length < k) { let b = null, bd = -1; for (const p of pts) { let m = Infinity; for (const q of s) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); if (m > bd) { bd = m; b = p; } } s.push(b); }
        for (let it = 0; it < 25; it++) {
          const sx = new Float64Array(k), sy = new Float64Array(k), sn = new Int32Array(k);
          for (const p of pts) { let bj = 0, bd = Infinity; s.forEach((q, j) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bj = j; } }); sx[bj] += p[0]; sy[bj] += p[1]; sn[bj]++; }
          for (let j = 0; j < k; j++) if (sn[j]) s[j] = [sx[j] / sn[j], sy[j] / sn[j]];
        }
        return s;
      };
      yield { a: attempt + 1, s: 'mgZones', f: 0.6, fail };
      const sd = [lloyd(base[0], n), lloyd(base[1], Math.max(1, Math.round(base[1].length / ZONE_CELLS))), lloyd(base[2], Math.max(1, Math.round(base[2].length / ZONE_CELLS)))];
      // zones: nation g's copy of each seed; the common ground is one zone per two nations (or one for all)
      const key = new Map(), zh = [], zone = new Int16Array(total).fill(-1), isLand = new Uint8Array(total);
      const zid = (k, h) => { if (!key.has(k)) { key.set(k, zh.length); zh.push(h); } return key.get(k); };
      for (let i = 0; i < total; i++) {
        const k = reg[i]; if (k < 0) continue;
        isLand[i] = 1;
        if (k === 3) { zone[i] = zid('c' + (even ? cg[i] >> 1 : cg[i]), -1); continue; }       // odd P: one piece of common ground per nation, not one big zone
        let bj = 0, bd = Infinity; sd[k].forEach((q, j) => { const d = Math.hypot(bx[i] - q[0], by[i] - q[1]); if (d < bd) { bd = d; bj = j; } });
        zone[i] = zid(k + ':' + cg[i] + ':' + bj, k === 0 ? cg[i] : -1);
      }
      // a zone keeps only its biggest piece; the board keeps only its biggest piece
      for (let z = 0; z < zh.length; z++) {
        const m = new Uint8Array(total); for (let i = 0; i < total; i++) if (isLand[i] && zone[i] === z) m[i] = 1;
        const cc = landComponents(m, total); if (cc.list.length < 2) continue;
        const big = cc.list.reduce((a, b) => (b.length > a.length ? b : a), []);
        for (const l of cc.list) if (l !== big) for (const i of l) isLand[i] = 0;
      }
      const cc = landComponents(isLand, total), big = cc.list.reduce((a, b) => (b.length > a.length ? b : a), []);
      for (const l of cc.list) if (l !== big) for (const i of l) isLand[i] = 0;
      const cnt = new Int32Array(zh.length); for (let i = 0; i < total; i++) if (isLand[i]) cnt[zone[i]]++; else zone[i] = -1;
      // the copies of one zone come out a few cells apart where the grid does not turn exactly (5, 7 and 8 nations): the bigger copies give up cells at their edge
      // (outermost first, only cells whose loss splits neither the zone nor the board), so that every nation gets the same
      { const zc = new Map(); for (let i = 0; i < total; i++) if (isLand[i]) { const z = zone[i]; if (!zc.has(z)) zc.set(z, []); zc.get(z).push(i); }
        const cls = new Map(); for (const [k, z] of key) { const p = k.split(':'), c = k[0] === 'c' ? 'c' : p[0] + ':' + p[2]; if (!cls.has(c)) cls.set(c, []); cls.get(c).push(z); }
        const runs = flags => { let n = 0; for (let e = 0; e < 6; e++) if (flags[e] && !flags[(e + 5) % 6]) n++; return flags.every(x => x) ? 1 : n; };
        const free = i => { const nb = nbrs(i), land = nb.map(j => j >= 0 && isLand[j] === 1), same = nb.map(j => j >= 0 && isLand[j] === 1 && zone[j] === zone[i]); return land.some(x => !x) && runs(land) === 1 && runs(same) === 1; };
        for (const zs of cls.values()) {
          if (zs.length < 2) continue;
          const lo = Math.min(...zs.map(z => cnt[z]));
          for (const z of zs) for (let k = cnt[z]; k > lo; k--) {
            let bi = -1, br = -1; for (const i of zc.get(z)) if (isLand[i] && free(i)) { const r = bx[i] * bx[i] + by[i] * by[i]; if (r > br) { br = r; bi = i; } }
            if (bi < 0) break;
            isLand[bi] = 0; zone[bi] = -1; cnt[z]--;
          }
        } }
      if (zh.some((h, z) => cnt[z] < (h >= 0 ? 14 : 8))) { why('small'); fail = 'mgSmall'; continue; }
      yield { a: attempt + 1, s: 'mgFair', f: 0.85, fail };
      const land = []; for (let i = 0; i < total; i++) if (isLand[i]) land.push(i);
      const { Z, phys } = makeZones(zh.length, zone, isLand, X, Y, land), owner = new Int16Array(total).fill(-1);
      Z.forEach((z, k) => { z.out = ZONE_OUT; if (zh[k] >= 0) { z.holder = zh[k]; z.home = zh[k]; for (const c of z.cells) owner[c] = zh[k]; } });
      if (!symFair(Z, P, n, why)) { why('fair'); fail = 'mgUnfair'; continue; }
      return { Z, zone, phys, link: Int32Array.from(phys), X, Y, land, owner, gap: narrowGaps(isLand, land, X, Y, total), K: n, gapZ: 1, edge };
    }
    throw new Error('symmetric map generation failed');
  }
  // every nation: n connected home zones, never touching another nation, and the same ground and the same neutral zones next door as the others
  function symFair(Z, P, n, why = () => {}) {
    const sig = [];
    for (let p = 0; p < P; p++) {
      const hz = Z.filter(z => z.home === p); if (hz.length !== n) { why('fn'); return false; }
      const seen = new Set([hz[0].id]), q = [hz[0]];
      while (q.length) for (const o of q.pop().nb) if (Z[o].home === p && !seen.has(o)) { seen.add(o); q.push(Z[o]); }
      if (seen.size !== n) { why('fconn'); return false; }
      const ring = new Set(); for (const z of hz) for (const o of z.nb) { if (Z[o].home >= 0 && Z[o].home !== p) { why('ftouch'); return false; } if (Z[o].home < 0) ring.add(o); }
      sig.push({ home: hz.reduce((a, z) => a + z.cells.length, 0), ring: [...ring].reduce((a, o) => a + Z[o].cells.length, 0), rn: ring.size });
    }
    const span = k => Math.max(...sig.map(s => s[k])) / Math.max(1, Math.min(...sig.map(s => s[k])));
    const hs = sig.map(s => s.home);
    if (span('home') > 1.06 && Math.max(...hs) - Math.min(...hs) > 5) { why('fhome'); return false; }       // within 6%, or within 5 cells (small homes)
    if (span('rn') > 1 || span('ring') > 1.1) { why('fring'); return false; }
    return true;
  }
  // ---------- a world packed into a few strings, and back (saved maps) ----------
  // zones: the zone of every cell, row by row, as runs ("zone+1 in base 36" "." "run length in base 36", comma separated; 0 is a hole);
  // home: the nation each zone belongs to at the start (-1 neutral); gap: the cells of the narrow gaps
  function packMap(g) {
    const total = COLS * ROWS, runs = [];
    for (let i = 0; i < total;) { const z = g.zone[i] < 0 || !g.land.includes(i) ? -1 : g.zone[i]; let n = 1; while (i + n < total && (g.zone[i + n] < 0 || !g.land.includes(i + n) ? -1 : g.zone[i + n]) === z) n++; runs.push((z + 1).toString(36) + '.' + n.toString(36)); i += n; }
    const gap = []; for (let i = 0; i < total; i++) if (g.gap[i]) gap.push(i);
    return { cols: COLS, rows: ROWS, zones: runs.join(','), home: g.Z.map(z => z.home ?? -1), gap, k: g.K, edge: g.edge };
  }
  function loadMap(m) {
    setGrid(m.cols, m.rows); buildCoords();
    const total = COLS * ROWS, zone = new Int16Array(total).fill(-1), isLand = new Uint8Array(total), land = [];
    let i = 0; for (const r of m.zones.split(',')) { const [a, b] = r.split('.'), z = parseInt(a, 36) - 1, n = parseInt(b, 36); for (let k = 0; k < n; k++, i++) if (z >= 0) { zone[i] = z; isLand[i] = 1; land.push(i); } }
    const X = new Float32Array(total), Y = new Float32Array(total);
    for (let c = 0; c < total; c++) { const [x, y] = cellXY(c % COLS, (c / COLS) | 0); X[c] = x; Y[c] = y; }
    const { Z, phys } = makeZones(m.home.length, zone, isLand, X, Y, land), owner = new Int16Array(total).fill(-1);
    Z.forEach((z, k) => { const h = m.home[k]; if (h >= 0) { z.holder = h; z.home = h; for (const c of z.cells) owner[c] = h; } z.out = ZONE_OUT; });
    const gap = new Uint8Array(total); for (const c of m.gap) gap[c] = 1;
    return { Z, zone, phys, link: Int32Array.from(phys), X, Y, land, owner, gap, K: m.k || 6, gapZ: 1, edge: m.edge };
  }
