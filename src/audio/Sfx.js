import { gameState } from '../core/GameState.js';

// Sonidos 100% procedurales (Web Audio). Sin archivos.

let ctx = null;
let master = null;
let compressor = null;
const noiseCache = new Map();

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = gameState.muted ? 0 : 0.42;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  master.connect(compressor).connect(ctx.destination);
}

export function setMuted(muted) {
  gameState.muted = muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.42, ctx.currentTime, 0.02);
}

function noise(dur) {
  const key = Math.round(dur * 1000);
  if (noiseCache.has(key)) return noiseCache.get(key);
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(key, buf);
  return buf;
}

function env(gain, t, peak, attack, release) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

function tone({ type = 'square', f0, f1 = f0, dur, peak = 0.2, at = 0, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, peak, attack, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
  return o;
}

function burst({ dur, peak = 0.3, type = 'lowpass', f0 = 2000, f1 = f0, q = 1, at = 0 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise(dur);
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, peak, 0.004, dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const SOUNDS = {
  // Cachetada al pasar la bomba
  slap() {
    burst({ dur: 0.09, peak: 0.6, type: 'bandpass', f0: 2500, q: 0.8 });
    tone({ type: 'triangle', f0: 600, f1: 180, dur: 0.08, peak: 0.25 });
    tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.11, peak: 0.11, at: 0.055 });
  },
  boom() {
    tone({ type: 'sine', f0: 190, f1: 32, dur: 0.8, peak: 0.65 });
    tone({ type: 'triangle', f0: 380, f1: 55, dur: 0.5, peak: 0.26, at: 0.025 });
    burst({ dur: 1.1, peak: 0.7, f0: 1400, f1: 90 });
    burst({ dur: 0.25, peak: 0.4, type: 'highpass', f0: 3000, at: 0.02 });
    [1046, 784, 523].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * 0.75, dur: 0.22, peak: 0.1, at: 0.14 + i * 0.09 }));
  },
  // Pedo: sierra grave con vibrato + ruido filtrado
  fart({ big = false } = {}) {
    const dur = big ? 1.1 : 0.35 + Math.random() * 0.2;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = big ? 70 : 95 + Math.random() * 40;
    o.frequency.setValueAtTime(base * 1.3, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = big ? 18 : 24 + Math.random() * 10;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = base * 0.35;
    lfo.connect(lfoGain).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = big ? 700 : 500;
    const g = ctx.createGain();
    env(g, t, big ? 0.5 : 0.32, 0.02, dur);
    o.connect(lp).connect(g).connect(master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
    burst({ dur: dur * 0.8, peak: big ? 0.25 : 0.12, type: 'lowpass', f0: 400 });
    if (big) burst({ dur: 0.4, peak: 0.3, type: 'bandpass', f0: 900, f1: 200, q: 3, at: dur * 0.7 });
  },
  whoosh() {
    burst({ dur: 0.35, peak: 0.3, type: 'bandpass', f0: 400, f1: 2400, q: 2 });
  },
  // Pitido de mecha: más agudo cuanto más caliente
  beep({ heat = 0, loud = false } = {}) {
    tone({ type: 'sine', f0: 650 + heat * 175, f1: 740 + heat * 190, dur: 0.065, peak: loud ? 0.18 : 0.08 });
    if (heat >= 2) tone({ type: 'triangle', f0: 1160 + heat * 120, dur: 0.035, peak: loud ? 0.07 : 0.035, at: 0.075 });
  },
  pop() {
    tone({ type: 'sine', f0: 400, f1: 900, dur: 0.08, peak: 0.25 });
  },
  // Bocina de payaso para el pollito
  honk() {
    tone({ type: 'sawtooth', f0: 330, dur: 0.14, peak: 0.18 });
    tone({ type: 'sawtooth', f0: 262, dur: 0.22, peak: 0.18, at: 0.16 });
  },
  laugh() {
    for (let i = 0; i < 4; i++) tone({ type: 'triangle', f0: 520 - i * 25, f1: 380 - i * 20, dur: 0.07, peak: 0.16, at: i * 0.11 });
  },
  count({ final = false } = {}) {
    tone({ type: 'square', f0: final ? 1046 : 523, dur: final ? 0.3 : 0.12, peak: 0.15 });
  },
  round() {
    [392, 523, 659, 784].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, dur: 0.22, peak: 0.11, at: i * 0.095 }));
  },
  ready() {
    tone({ type: 'sine', f0: 680, f1: 1050, dur: 0.12, peak: 0.09 });
    tone({ type: 'sine', f0: 1050, dur: 0.11, peak: 0.07, at: 0.1 });
  },
  fanfare() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) =>
      tone({ type: 'square', f0: f, dur: i === 5 ? 0.5 : 0.12, peak: 0.13, at: i * 0.13 }));
  },
  sad() {
    [392, 370, 349, 330].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, f1: i === 3 ? 250 : f, dur: i === 3 ? 0.7 : 0.25, peak: 0.18, at: i * 0.3 }));
  },
  ghost() {
    tone({ type: 'sine', f0: 300, f1: 600, dur: 0.5, peak: 0.12, attack: 0.1 });
    burst({ dur: 0.5, peak: 0.2, type: 'bandpass', f0: 600, f1: 300, q: 4 });
  },
};

export function play(name, opts) {
  if (!ctx || gameState.muted) return;
  try { SOUNDS[name]?.(opts); } catch (err) { console.warn('[sfx]', name, err); }
}
