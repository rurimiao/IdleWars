
<script>
(() => {
  'use strict';
  const SZ = 22, SQ = Math.sqrt(3), M = 16;
  let COLS = 26, ROWS = 20, W = 0, H = 0;
  const setGrid = (c, r) => { COLS = c; ROWS = r; W = SZ * SQ * (COLS + 0.5) + 2 * M; H = SZ * (1.5 * (ROWS - 1) + 2) + 2 * M; };
  // Edge i of a pointy-top hex faces: SE, SW, W, NW, NE, E. The opposite edge is (i + 3) % 6.
  const EVEN = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, 0]];
  const ODD = [[1, 1], [0, 1], [-1, 0], [0, -1], [1, -1], [1, 0]];
  const STARVE_AFTER = 1;       // a legion that cannot pay one turn of meals starts losing men at once
  const HOARD_DEFAULT = 5, SUP_MAX_TURNS = 10;       // a legion never carries more than 10 turns of its own meals

  // ---------- data tables (rule book: map, unit table, military) ----------
  // hit: base hit chance. dmg: damage points per hit. per: damage points that remove one man from this type. cap: men per legion.
  // cost/eat: supplies per man to build / per man per turn. budget: cells walked per turn.
  const MONO = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", monospace';
  const TYPES = [
    { k: 'inf', rmin: 1, rmax: 2, cb: 1, hit: 50, dmg: 1, per: 1, min: 5, cap: 30, cost: 20, build: 1, eat: 2, take: true, budget: 2, bsp: 2, sg: 1 },
    { k: 'art', rmin: 2, rmax: 5, cb: 1, hit: 30, dmg: 3, per: 3, min: 3, cap: 10, cost: 80, build: 3, eat: 8, take: true, budget: 1, bsp: 5, sg: 4 },
  ];
  let CITY_START = 200, CITY_MAX = 1000;       // set from the parameters: size of a new city, the cap for everyone
  let CITY_MIN = 200;       // a cell is a big city from this size (set from the parameters; the starting cities begin above it); smaller is a building site
  let BUILD_COST = 5;       // supplies a legion spends per point of city size it builds (set from the parameters)   // city defense: a cell is a big city from CITY_MIN (200) points, the cap is 1000
  const ZONE_OUT = 200;                                   // every zone yields the same each turn
  const ZONE_NONE = '#cfd2cf', ZONE_FIGHT = '#e0847c';    // zone ground: nobody holds shares / two or more nations contest it (a lone holder gets a light tint of its color)

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const idx = (c, r) => r * COLS + c;
  const cellXY = (c, r) => [M + SZ * SQ * (c + 0.5 * (r & 1)) + SZ * SQ / 2, M + SZ * 1.5 * r + SZ];
  function nbrs(i) {
    const c = i % COLS, r = (i / COLS) | 0;
    return (r & 1 ? ODD : EVEN).map(([dc, dr]) => {
      const nc = c + dc, nr = r + dr;
      return nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS ? -1 : idx(nc, nr);
    });
  }
  const corner = (x, y, i) => { const a = (30 + 60 * i) * Math.PI / 180; return [x + SZ * Math.cos(a), y + SZ * Math.sin(a)]; };
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const f255 = v => Math.max(0, Math.min(255, Math.round(v)));
  const mix = (hex, k) => {
    const [r, g, b] = rgb(hex);
    return k < 0 ? `rgb(${f255(r * (1 + k))},${f255(g * (1 + k))},${f255(b * (1 + k))})` : `rgb(${f255(r + (255 - r) * k)},${f255(g + (255 - g) * k)},${f255(b + (255 - b) * k)})`;
  };
  const hex2 = v => f255(v).toString(16).padStart(2, '0');
  const TINT_HELD = 0.6, TINT_IDLE = 0.35;       // how far a nation's color is faded for a zone it holds with a guard / without one
  const blendHex = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + hex2(x[0] + (y[0] - x[0]) * t) + hex2(x[1] + (y[1] - x[1]) * t) + hex2(x[2] + (y[2] - x[2]) * t); };
  const hexPath = (p, x, y) => { for (let i = 0; i < 6; i++) { const [px, py] = corner(x, y, i); i ? p.lineTo(px, py) : p.moveTo(px, py); } p.closePath(); };

  // axial coordinates make hex distance and "all cells within R" cheap
  let CQ = new Int16Array(0), CR = new Int16Array(0);
  const wcache = new Map();
  function buildCoords() {
    const n = COLS * ROWS; CQ = new Int16Array(n); CR = new Int16Array(n); wcache.clear();
    for (let i = 0; i < n; i++) { const c = i % COLS, r = (i / COLS) | 0; CR[i] = r; CQ[i] = c - ((r - (r & 1)) >> 1); }
  }
  const hexDist = (a, b) => { const dq = CQ[a] - CQ[b], dr = CR[a] - CR[b]; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)); };
  function within(i, R) {
    let a = wcache.get(R); if (!a) { a = new Array(COLS * ROWS); wcache.set(R, a); }
    let out = a[i]; if (out) return out;
    out = []; const q0 = CQ[i], r0 = CR[i];
    for (let dq = -R; dq <= R; dq++) for (let dr = Math.max(-R, -dq - R); dr <= Math.min(R, -dq + R); dr++) {
      const r = r0 + dr; if (r < 0 || r >= ROWS) continue;
      const c = q0 + dq + ((r - (r & 1)) >> 1); if (c < 0 || c >= COLS) continue;
      out.push(r * COLS + c);
    }
    a[i] = out; return out;
  }
  // small binary heap for route finding
  class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
      k[i] = key; v[i] = val;
    }
    pop() {
      const k = this.k, v = this.v, rv = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
      if (n) {
        let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
        k[i] = lk; v[i] = lv;
      }
      return rv;
    }
  }
