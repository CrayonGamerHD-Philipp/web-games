/**
 * Leuchtturmwächter – Toneffekte, live im Browser erzeugt (Web Audio API, keine Dateien).
 * Die Lautstärke folgt der Effekt-Einstellung der App (`web-games:effects-volume`, 0 = stumm).
 */

/** @type {AudioContext | null} */
let ctx = null;
/** @type {AudioBuffer | null} */
let noiseBuffer = null;

function volume() {
  try {
    const stored = Number(localStorage.getItem('web-games:effects-volume') ?? '0.85');
    return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 0.85;
  } catch {
    return 0.85;
  }
}

function audio() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** @param {AudioContext} ac */
function noise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  return source;
}

/**
 * Hüllkurve: schnell an, dann ausklingen.
 * @param {AudioContext} ac @param {AudioNode} out @param {number} t @param {number} peak
 * @param {number} attack @param {number} decay
 */
function envelope(ac, out, t, peak, attack, decay) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  gain.connect(out);
  return gain;
}

/**
 * Ein Ton.
 * @param {AudioContext} ac @param {AudioNode} out
 * @param {{ type?: OscillatorType, from: number, to?: number, at?: number, peak?: number, attack?: number, decay?: number, filter?: number }} o
 */
function tone(ac, out, o) {
  const t = ac.currentTime + (o.at ?? 0);
  const osc = ac.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.attack ?? 0.01) + (o.decay ?? 0.2));
  const env = envelope(ac, out, t, o.peak ?? 0.3, o.attack ?? 0.01, o.decay ?? 0.2);
  if (o.filter) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.filter;
    osc.connect(lp).connect(env);
  } else {
    osc.connect(env);
  }
  osc.start(t);
  osc.stop(t + (o.attack ?? 0.01) + (o.decay ?? 0.2) + 0.05);
}

/**
 * Rauschen durch einen Filter (Wellen, Gischt, Donner).
 * @param {AudioContext} ac @param {AudioNode} out
 * @param {{ kind?: BiquadFilterType, freq: number, freqTo?: number, q?: number, at?: number, peak?: number, attack?: number, decay?: number }} o
 */
function hiss(ac, out, o) {
  const t = ac.currentTime + (o.at ?? 0);
  const src = noise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = o.kind ?? 'lowpass';
  filter.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) filter.frequency.exponentialRampToValueAtTime(o.freqTo, t + (o.attack ?? 0.05) + (o.decay ?? 0.3));
  filter.Q.value = o.q ?? 0.7;
  const env = envelope(ac, out, t, o.peak ?? 0.3, o.attack ?? 0.05, o.decay ?? 0.3);
  src.connect(filter).connect(env);
  src.start(t, Math.random());
  src.stop(t + (o.attack ?? 0.05) + (o.decay ?? 0.3) + 0.05);
}

/** @type {Record<string, (ac: AudioContext, out: AudioNode) => void>} */
const EFFECTS = {
  /** Wächter hüpft ein Feld weiter. */
  hop(ac, out) {
    tone(ac, out, { from: 420, to: 640, peak: 0.16, attack: 0.01, decay: 0.09 });
    tone(ac, out, { from: 300, to: 220, at: 0.13, peak: 0.12, attack: 0.005, decay: 0.07 });
  },
  /** Sandsack plumpst aufs Feld. */
  sack(ac, out) {
    tone(ac, out, { from: 150, to: 55, peak: 0.45, attack: 0.005, decay: 0.18 });
    hiss(ac, out, { freq: 900, freqTo: 300, peak: 0.18, attack: 0.005, decay: 0.2 });
  },
  /** Feuer wird angefacht: Fauchen und ein heller Schimmer. */
  glow(ac, out) {
    hiss(ac, out, { kind: 'bandpass', freq: 600, freqTo: 2400, q: 1.2, peak: 0.22, attack: 0.08, decay: 0.35 });
    tone(ac, out, { type: 'triangle', from: 880, at: 0.12, peak: 0.08, attack: 0.02, decay: 0.5 });
    tone(ac, out, { type: 'triangle', from: 1320, at: 0.2, peak: 0.06, attack: 0.02, decay: 0.5 });
  },
  /** Feuer flackert oder geht aus: kurzes Knistern, dann ein fallender Ton. */
  shake(ac, out) {
    for (let i = 0; i < 4; i += 1) hiss(ac, out, { kind: 'highpass', freq: 2500, at: i * 0.06 + Math.random() * 0.03, peak: 0.12, attack: 0.002, decay: 0.03 });
    tone(ac, out, { type: 'triangle', from: 600, to: 250, at: 0.2, peak: 0.1, attack: 0.01, decay: 0.3 });
  },
  /** Schiff wird gelotst oder fährt weiter: Schiffsglocke. */
  sail(ac, out) {
    tone(ac, out, { from: 988, peak: 0.12, attack: 0.003, decay: 0.7 });
    tone(ac, out, { from: 1976, peak: 0.04, attack: 0.003, decay: 0.4 });
    hiss(ac, out, { freq: 500, peak: 0.06, attack: 0.2, decay: 0.4 });
  },
  /** Neues Schiff am Horizont: fernes Nebelhorn. */
  pop(ac, out) {
    tone(ac, out, { type: 'sawtooth', from: 98, peak: 0.16, attack: 0.15, decay: 0.8, filter: 520 });
    tone(ac, out, { type: 'sawtooth', from: 147, peak: 0.08, attack: 0.15, decay: 0.8, filter: 520 });
  },
  /** Schiff legt an: fröhlicher Dreiklang. */
  dock(ac, out) {
    [523, 659, 784, 1047].forEach((freq, i) => tone(ac, out, { type: 'triangle', from: freq, at: i * 0.09, peak: 0.16, attack: 0.005, decay: 0.45 }));
    tone(ac, out, { from: 988, at: 0.4, peak: 0.08, attack: 0.003, decay: 0.8 });
  },
  /** Schiff zerschellt: Krachen, Knarzen, Gischt. */
  wreck(ac, out) {
    hiss(ac, out, { kind: 'bandpass', freq: 800, q: 0.8, peak: 0.4, attack: 0.005, decay: 0.35 });
    tone(ac, out, { from: 110, to: 40, peak: 0.5, attack: 0.005, decay: 0.4 });
    tone(ac, out, { type: 'sawtooth', from: 220, to: 90, at: 0.15, peak: 0.08, attack: 0.05, decay: 0.6, filter: 900 });
    hiss(ac, out, { freq: 3000, freqTo: 600, at: 0.3, peak: 0.2, attack: 0.05, decay: 0.8 });
  },
  /** Schiff treibt ab: dumpfes Warnhorn, zweimal. */
  drift(ac, out) {
    tone(ac, out, { type: 'square', from: 196, peak: 0.07, attack: 0.02, decay: 0.22, filter: 700 });
    tone(ac, out, { type: 'square', from: 165, at: 0.28, peak: 0.07, attack: 0.02, decay: 0.3, filter: 700 });
  },
  /** Flut: eine Welle rauscht heran. */
  flood(ac, out) {
    hiss(ac, out, { freq: 300, freqTo: 1600, peak: 0.3, attack: 0.35, decay: 0.7 });
  },
  /** Feld versinkt: Welle und blubbernde Blasen. */
  sink(ac, out) {
    hiss(ac, out, { freq: 400, freqTo: 1400, peak: 0.3, attack: 0.3, decay: 0.6 });
    for (let i = 0; i < 5; i += 1) {
      const base = 300 + Math.random() * 300;
      tone(ac, out, { from: base, to: base * 1.8, at: 0.45 + i * 0.09, peak: 0.07, attack: 0.005, decay: 0.06 });
    }
    tone(ac, out, { from: 180, to: 60, at: 0.4, peak: 0.25, attack: 0.02, decay: 0.5 });
  },
  /** Sturmflut: Donnergrollen. */
  surge(ac, out) {
    hiss(ac, out, { freq: 1200, freqTo: 120, peak: 0.55, attack: 0.02, decay: 1.6 });
    tone(ac, out, { from: 70, to: 35, peak: 0.35, attack: 0.05, decay: 1.4 });
  }
};

/** Doppelte Töne im selben Moment vermeiden. @type {Map<string, number>} */
const lastPlayed = new Map();

/**
 * Spielt einen Effekt.
 * @param {string} name
 * @param {number} [delayMs]
 */
export function playEffect(name, delayMs = 0) {
  const effect = EFFECTS[name];
  if (!effect) return;
  const vol = volume();
  if (vol <= 0) return;
  const run = () => {
    const now = Date.now();
    if (now - (lastPlayed.get(name) ?? 0) < 120) return;
    lastPlayed.set(name, now);
    const ac = audio();
    if (!ac) return;
    const master = ac.createGain();
    master.gain.value = vol * 0.9;
    master.connect(ac.destination);
    try {
      effect(ac, master);
    } catch {}
    setTimeout(() => master.disconnect(), 3000);
  };
  if (delayMs > 0) setTimeout(run, delayMs);
  else run();
}

/** Beim ersten Tippen freischalten, damit Töne später ohne Verzögerung kommen. */
export function unlockAudio() {
  audio();
}
