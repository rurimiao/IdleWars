  // ---------- sound (synthesized, no assets) ----------
  let ac = null, muted = false, master = null, volume = 0.8;
  try { const v = parseFloat(localStorage.getItem('idlewars-vol')); if (v >= 0 && v <= 1) volume = v; } catch (e) {}
  try { muted = localStorage.getItem('idlewars-mute') === '1'; } catch (e) {}
  function audio() {
    if (muted) return null;
    try { const fresh = !ac; ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); if (fresh) setTimeout(loadSamples, 0); return ac; } catch (e) { return null; }
  }
  // the recorded gun and cannon shots, decoded once; the synthesized versions below stay as a fallback
  const SAMPLES = { gun: [], cannon: [], bolt: [] };
  let samplesLoading = null;
  function loadSamples() {
    if (samplesLoading) return samplesLoading;
    const c = audio(); if (!c) return null;
    samplesLoading = (async () => {
      for (const k of Object.keys(SAMPLE_B64)) for (const b64 of SAMPLE_B64[k]) {
        try { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); SAMPLES[k].push(await c.decodeAudioData(u.buffer)); } catch (e) { /* this clip stays out */ }
      }
    })();
    return samplesLoading;
  }
  function playSample(k, t0, gain, rate, dur) {
    const arr = SAMPLES[k], c = audio(); if (!arr.length || !c) return false;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = arr[Math.floor(Math.random() * arr.length)]; src.playbackRate.value = (rate || 1) * (0.95 + Math.random() * 0.1); g.gain.value = gain;
    src.connect(g); g.connect(out());
    const when = c.currentTime + (t0 || 0);
    if (dur) { g.gain.setValueAtTime(gain, when + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, when + dur); src.start(when, 0, dur); } else src.start(when);
    return true;
  }
  // everything goes through one master volume
  function out() { const c = audio(); if (!master || master.context !== c) { master = c.createGain(); master.connect(c.destination); } master.gain.value = volume; return master; }
  // a burst of filtered noise that dies away: the body of shots and booms
  function noise(t0, dur, type, freq, q, gain) {
    const c = audio(); if (!c) return;
    const len = Math.max(64, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; g.gain.value = gain;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(out()); src.start(c.currentTime + t0);
  }
  function tone(f, t0, d, type, v, f2) {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(out()); o.start(t); o.stop(t + d + 0.03);
  }
  function click(t0, v) {
    const c = audio(); if (!c) return;
    const len = Math.floor(c.sampleRate * 0.035), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 1400 + Math.random() * 1800; g.gain.value = v || 0.5;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(out()); src.start(c.currentTime + t0);
  }
  // Quiet during fast-forwarded AI turns so a 100-player round is not a wall of noise.
  const loud = () => !G || (parseFloat(S.speed) * G.speedMul) >= 0.2;
  const snd = {
    select() { tone(660, 0, 0.07, 'square', 0.04); },
    deselect() { tone(440, 0, 0.06, 'square', 0.03); },
    roll() { if (!loud()) return; for (let i = 0; i < 9; i++) click(i * 0.055 + Math.random() * 0.02, 0.35 + Math.random() * 0.4); },
    win() { if (!loud()) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, 'square', 0.05)); },
    lose() { if (!loud()) return; tone(300, 0, 0.32, 'sawtooth', 0.05, 110); },
    tie() { if (!loud()) return; tone(420, 0, 0.1, 'triangle', 0.07); tone(420, 0.14, 0.1, 'triangle', 0.07); },
    reinforce() { if (!loud()) return; for (let i = 0; i < 5; i++) tone(500 + i * 90, i * 0.05, 0.06, 'triangle', 0.05); },
    step(k) { if (k === 'atk') { tone(330, 0, 0.09, 'square', 0.05); tone(247, 0.07, 0.1, 'square', 0.05); } else if (k === 'build' || k === 'rep') { tone(520, 0, 0.06, 'triangle', 0.06); tone(700, 0.06, 0.08, 'triangle', 0.06); } else tone(620, 0, 0.07, 'triangle', 0.06); },
    // a rifle volley: a sharp crack, the body of the shot, a low thump and a short echo from the hills
    // infantry fire: one short crack per shot, rattled off one after another (ta-ta-ta-ta), as many as the legion has men firing (up to 10)
    gun(t, n) {
      if (!loud()) return; t = t || 0; n = Math.max(1, Math.min(10, n || 4));
      const gap = Math.min(0.13, 1.0 / n);
      for (let i = 0; i < n; i++) {
        const at = t + i * gap + Math.random() * 0.02;
        if (playSample('gun', at, 0.55, 1, 0.34)) continue;
        noise(at, 0.07, 'highpass', 2200, 0.7, 0.45); noise(at, 0.14, 'bandpass', 950, 0.9, 0.34); tone(190, at, 0.09, 'sine', 0.16, 55);
      }
      snd.bolt(t + n * gap + 0.4);          // then the bolt is worked: clack, clack
    },
    bolt(t) {
      if (!loud()) return; t = t || 0;
      if (playSample('bolt', t, 0.7)) return;
      click(t, 0.5); click(t + 0.12, 0.4); tone(900, t + 0.12, 0.04, 'square', 0.04, 500);
    },
    // a cannon: the muzzle crack, a deep boom that sinks, a long rumble and its echo
    cannon(t) {
      if (!loud()) return; t = t || 0;
      if (playSample('cannon', t, 1)) return;
      noise(t, 0.05, 'bandpass', 1500, 0.8, 0.5); tone(78, t, 0.75, 'sine', 0.5, 24); tone(120, t, 0.3, 'sawtooth', 0.07, 40);
      noise(t, 0.8, 'lowpass', 380, 0.7, 0.6); noise(t + 0.28, 0.9, 'lowpass', 240, 0.6, 0.22);
    },
    turn() { tone(740, 0, 0.1, 'sine', 0.08); tone(988, 0.1, 0.16, 'sine', 0.08); },
    victory() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.2, 'square', 0.05)); },
    defeat() { [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.2, 0.3, 'sawtooth', 0.05)); },
  };
  // the sound test panel's list (label key, function); volume is saved
  const SND_LIST = [['sndSelect', () => snd.select()], ['sndDeselect', () => snd.deselect()], ['sndGun', () => snd.gun(0, 8)], ['sndBolt', () => snd.bolt()], ['sndCannon', () => snd.cannon()],
    ['sndVolley', () => { snd.gun(0, 6); snd.cannon(0.9); snd.gun(1.3, 8); snd.cannon(2.1); }],
    ['sndStepMarch', () => snd.step('march')], ['sndStepAtk', () => snd.step('atk')], ['sndStepBuild', () => snd.step('build')],
    ['sndReinforce', () => snd.reinforce()], ['sndTurn', () => snd.turn()], ['sndVictory', () => snd.victory()], ['sndDefeat', () => snd.defeat()]];
  const getVolume = () => volume, setVolume = v => { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume; try { localStorage.setItem('idlewars-vol', String(volume)); } catch (e) {} };
