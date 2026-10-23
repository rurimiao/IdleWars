  // ---------- players: faces and flags ----------
  const SPECIES = [
    { k: 'cat', fur: '#f2a65a', ear: 'tri', inner: '#f9cfae', nose: '#e8798f', whisk: true },
    { k: 'dog', fur: '#dcb785', ear: 'floppy', earc: '#8a5a35', nose: '#2b2b2b', muzzle: '#f3e2c8' },
    { k: 'bear', fur: '#a06c43', ear: 'round', inner: '#d8b48a', nose: '#2b2b2b', muzzle: '#dcb98e' },
    { k: 'panda', fur: '#f7f7f5', ear: 'round', earc: '#2b2b2b', nose: '#2b2b2b', patch: true },
    { k: 'rabbit', fur: '#f6f2f2', ear: 'long', inner: '#f7b9c6', nose: '#e8798f' },
    { k: 'fox', fur: '#ee7b35', ear: 'tri', inner: '#2b2b2b', nose: '#2b2b2b', cheeks: '#fff6ea' },
    { k: 'frog', fur: '#6fc473', ear: 'none', frog: true, nose: '#3f8f4a' },
    { k: 'pig', fur: '#f7a9b9', ear: 'tri', inner: '#e8798f', nose: '#d9607c', snout: true },
    { k: 'mouse', fur: '#bcbfc7', ear: 'biground', inner: '#f7b9c6', nose: '#e8798f' },
    { k: 'koala', fur: '#a1a6ae', ear: 'biground', inner: '#e7e9ec', nose: '#2b2b2b', bignose: true },
    { k: 'lion', fur: '#f2c35c', ear: 'round', inner: '#b8742f', mane: '#b8742f', nose: '#6b3b1a' },
    { k: 'owl', fur: '#b08a66', ear: 'tufts', nose: '#f0a43a', owl: true },
    { k: 'tiger', fur: '#f0a53c', ear: 'round', earc: '#f0a53c', inner: '#f7e3c0', nose: '#2b2b2b', stripes: true, muzzle: '#fff3dc' },
    { k: 'monkey', fur: '#b5835a', ear: 'biground', inner: '#f3d9b8', nose: '#5a3a24', mask: '#f3d9b8' },
    { k: 'deer', fur: '#c98f55', ear: 'tri', inner: '#f3d9b8', nose: '#2b2b2b', muzzle: '#f3e2c8', antlers: true },
    { k: 'penguin', fur: '#2f3b4c', ear: 'none', nose: '#f0a43a', beak: true, belly: true },
  ];
  const speciesOf = p => p % SPECIES.length;
  const spName = i => tr('s_' + SPECIES[i].k);
  const faceIdx = p => (G && G.av && G.av[p] >= 0) ? G.av[p] : speciesOf(p);
  const nameOf = p => (G && G.nnames && G.nnames[p]) || spName(faceIdx(p));
  // one fixed color per nation, from a palette of colors that are far apart (the best-separated come first)
  const NATION_COLORS = ['#f218d2', '#eff218', '#0a8fcc', '#27f218', '#b161f2', '#f21877', '#1bb267', '#7388e6'];       // one colour per hue family (yellow, green, sea green, blue, periwinkle, violet, magenta, pink), all fairly light, none orange or red
  const hue = p => NATION_COLORS[p % NATION_COLORS.length];

  function drawAvatar(ctx, x, y, r, sp) {
    const S = SPECIES[sp];
    ctx.save(); ctx.translate(x, y); ctx.scale(r, r); ctx.lineJoin = 'round';
    const ell = (cx, cy, rx, ry, fill, rot, stroke) => {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, 7); ctx.fillStyle = fill; ctx.fill();
      if (stroke !== false) { ctx.lineWidth = 0.09; ctx.strokeStyle = '#3b2a20'; ctx.stroke(); }
    };
    const tri = (pts, fill) => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 0.09; ctx.strokeStyle = '#3b2a20'; ctx.stroke(); };
    if (S.mane) ell(0, 0.05, 1.22, 1.15, S.mane);
    for (const s of [-1, 1]) {
      if (S.ear === 'tri') { tri([[s * 0.35, -0.6], [s * 0.95, -0.55], [s * 0.78, -1.3]], S.fur); tri([[s * 0.5, -0.68], [s * 0.82, -0.66], [s * 0.76, -1.05]], S.inner); }
      else if (S.ear === 'round') { ell(s * 0.72, -0.72, 0.34, 0.34, S.earc || S.fur); ell(s * 0.72, -0.72, 0.17, 0.17, S.inner || S.earc || S.fur, 0, false); }
      else if (S.ear === 'long') { ell(s * 0.42, -1.0, 0.24, 0.7, S.fur, s * 0.12); ell(s * 0.42, -1.0, 0.12, 0.5, S.inner, s * 0.12, false); }
      else if (S.ear === 'floppy') ell(s * 0.92, -0.05, 0.3, 0.6, S.earc, s * 0.25);
      else if (S.ear === 'biground') { ell(s * 0.82, -0.62, 0.5, 0.5, S.fur); ell(s * 0.82, -0.62, 0.3, 0.3, S.inner, 0, false); }
      else if (S.ear === 'tufts') tri([[s * 0.3, -0.7], [s * 0.95, -0.6], [s * 0.85, -1.25]], S.fur);
    }
    if (S.frog) for (const s of [-1, 1]) ell(s * 0.52, -0.72, 0.36, 0.36, S.fur);
    if (S.antlers) { ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.strokeStyle = '#7a4a22'; ctx.beginPath(); for (const s of [-1, 1]) { ctx.moveTo(s * 0.4, -0.8); ctx.lineTo(s * 0.62, -1.38); ctx.moveTo(s * 0.5, -1.1); ctx.lineTo(s * 0.98, -1.3); ctx.moveTo(s * 0.58, -1.28); ctx.lineTo(s * 0.34, -1.5); } ctx.stroke(); }
    ell(0, 0.02, 1, 0.92, S.fur);
    if (S.stripes) { ctx.lineWidth = 0.1; ctx.lineCap = 'round'; ctx.strokeStyle = '#3b2a20'; ctx.beginPath(); for (const dx of [-0.32, 0, 0.32]) { ctx.moveTo(dx, -0.88); ctx.lineTo(dx * 0.8, -0.58); } for (const s of [-1, 1]) { ctx.moveTo(s * 0.98, 0); ctx.lineTo(s * 0.74, 0.04); ctx.moveTo(s * 0.96, 0.3); ctx.lineTo(s * 0.74, 0.28); } ctx.stroke(); }
    if (S.mask) for (const s of [-1, 1]) ell(s * 0.3, -0.04, 0.38, 0.34, S.mask, 0, false);
    if (S.belly) ell(0, 0.18, 0.74, 0.68, '#f4f6f8', 0, false);
    if (S.patch) for (const s of [-1, 1]) ell(s * 0.4, -0.05, 0.27, 0.36, '#2b2b2b', s * 0.5, false);
    if (S.cheeks) for (const s of [-1, 1]) tri([[s * 0.98, 0.1], [s * 0.35, 0.78], [s * 0.2, 0.2]], S.cheeks);
    if (S.muzzle) ell(0, 0.34, 0.5, 0.36, S.muzzle, 0, false);
    if (S.owl) for (const s of [-1, 1]) ell(s * 0.4, -0.12, 0.38, 0.38, '#fff6e0');
    if (S.frog) for (const s of [-1, 1]) ell(s * 0.52, -0.72, 0.2, 0.2, '#fff', 0, false);
    const eyeR = S.owl ? 0.17 : 0.13, ey = S.frog ? -0.72 : -0.1, ex = S.frog ? 0.52 : (S.owl ? 0.4 : 0.38);
    for (const s of [-1, 1]) { ell(s * ex, ey, eyeR, eyeR * 1.1, '#1d1a18', 0, false); ell(s * ex + 0.05, ey - 0.05, 0.05, 0.05, '#fff', 0, false); }
    if (!S.frog && !S.owl && !S.beak) for (const s of [-1, 1]) { ctx.globalAlpha = 0.45; ell(s * 0.62, 0.3, 0.15, 0.1, '#ff7a90', 0, false); ctx.globalAlpha = 1; }
    if (S.snout) ell(0, 0.3, 0.38, 0.28, '#f58fa4');
    if (S.owl || S.beak) tri([[-0.12, 0.12], [0.12, 0.12], [0, 0.42]], S.nose);
    else if (S.bignose) ell(0, 0.14, 0.24, 0.17, S.nose, 0, false);
    else if (S.snout) { for (const s of [-1, 1]) ell(s * 0.12, 0.3, 0.05, 0.08, '#b84860', 0, false); }
    else ell(0, 0.17, 0.12, 0.085, S.nose, 0, false);
    if (!S.owl && !S.snout && !S.beak) { ctx.lineWidth = 0.07; ctx.strokeStyle = '#3b2a20'; ctx.beginPath(); ctx.moveTo(0, 0.26); ctx.quadraticCurveTo(-0.12, 0.42, -0.26, 0.34); ctx.moveTo(0, 0.26); ctx.quadraticCurveTo(0.12, 0.42, 0.26, 0.34); ctx.stroke(); }
    if (S.whisk) { ctx.lineWidth = 0.05; ctx.strokeStyle = '#6a5240'; ctx.beginPath(); for (const s of [-1, 1]) for (const dy of [0, 0.12]) { ctx.moveTo(s * 0.5, 0.25 + dy * 0.4); ctx.lineTo(s * 1.0, 0.22 + dy); } ctx.stroke(); }
    ctx.restore();
  }
  const faceCache = new Map(), discCache = new Map(), urlCache = new Map();
  function faceSprite(sp) {
    if (faceCache.has(sp)) return faceCache.get(sp);
    const c = document.createElement('canvas'); c.width = c.height = 96; drawAvatar(c.getContext('2d'), 48, 52, 38, sp); faceCache.set(sp, c); return c;
  }
  // Face on a disc in the player's flag color.
  // the avatar library: pictures the player uploaded (cropped to a small square, kept in this browser)
  const AVKEY = 'idlewars-avatars-1', AV_MAX = 16;
  const AVLIB = (() => { try { const v = JSON.parse(localStorage.getItem(AVKEY)); return { list: ((v && v.list) || []).filter(u => typeof u === 'string' && u.startsWith('data:image/')).slice(0, AV_MAX) }; } catch (e) { return { list: [] }; } })();
  const avSave = () => { try { localStorage.setItem(AVKEY, JSON.stringify(AVLIB)); } catch (e) { /* storage full or blocked */ } };
  const upCache = new Map();
  function uploadFace(url) {
    if (upCache.has(url)) return upCache.get(url);
    const c = document.createElement('canvas'); c.width = c.height = 96; upCache.set(url, c);
    const im = new Image(); im.onload = () => { c.ready = true; const x = c.getContext('2d'); x.save(); x.beginPath(); x.arc(48, 48, 41, 0, 7); x.clip(); x.drawImage(im, 7, 7, 82, 82); x.restore(); avReset(); try { ui(true); requestDraw(); if (!$('modal').hidden && modalTab === 'naming') renderModal(); } catch (e) { /* no game yet */ } };
    im.onerror = () => { c.ready = true; }; im.src = url; return c;
  }
  setTimeout(() => AVLIB.list.forEach(uploadFace), 0);       // decode the uploaded pictures up front, so a face is ready the moment it is picked
  function avReset() { discCache.clear(); urlCache.clear(); }
  const faceOf = p => (G && G.avImg && G.avImg[p]) ? uploadFace(G.avImg[p]) : faceSprite(faceIdx(p));
  function discSprite(p) {
    if (discCache.has(p)) return discCache.get(p);
    const c = document.createElement('canvas'); c.width = 96; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = hue(p); x.beginPath(); x.arc(48, 48, 46, 0, 7); x.fill();
    x.drawImage(faceOf(p), 0, 0); x.lineWidth = 5; x.strokeStyle = '#fff'; x.beginPath(); x.arc(48, 48, 45, 0, 7); x.stroke();
    discCache.set(p, c); return c;
  }
  const avatarURL = p => { if (!urlCache.has(p)) urlCache.set(p, discSprite(p).toDataURL()); return urlCache.get(p); };

