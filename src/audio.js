// PhantomCard — WebAudio sound library (REQ-076..078)
// All sounds synthesized; no audio files. Unknown names fail silently.

let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function env(gain, t0, a, d, peak = 0.3) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq, dur, type = 'square', peak = 0.2, slide = null) {
  const c = ac(), t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  env(g, t0, 0.005, dur, peak);
  osc.connect(g).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function noise(dur, peak = 0.3, filterFreq = 1200, q = 0.8, type = 'lowpass') {
  const c = ac(), t0 = c.currentTime;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
  const g = c.createGain();
  env(g, t0, 0.01, dur, peak);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

const library = {
  // classic HyperCard 'boing'
  boing() {
    const c = ac(), t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.08);
    osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.16);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.3);
    env(g, t0, 0.005, 0.35, 0.35);
    osc.connect(g).connect(c.destination);
    osc.start(t0); osc.stop(t0 + 0.4);
  },
  // plucked fake harpsichord arpeggio
  harpsichord() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      setTimeout(() => tone(f, 0.25, 'square', 0.08), i * 70));
  },
  // UI click
  click() { tone(900, 0.03, 'square', 0.12); },
  // haunted door creak — slow sliding sawtooth through a wobble
  creeak() {
    const c = ac(), t0 = c.currentTime;
    const osc = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.linearRampToValueAtTime(260, t0 + 0.5);
    osc.frequency.linearRampToValueAtTime(110, t0 + 1.0);
    lfo.frequency.value = 9;
    lfoG.gain.value = 18;
    lfo.connect(lfoG).connect(osc.frequency);
    env(g, t0, 0.15, 1.0, 0.1);
    osc.connect(g).connect(c.destination);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + 1.2); lfo.stop(t0 + 1.2);
  },
  // thunder — low noise burst with rolling tail
  thunder() {
    noise(0.25, 0.5, 400, 0.5);
    setTimeout(() => noise(0.7, 0.25, 180, 0.5), 180);
    setTimeout(() => noise(0.5, 0.12, 120, 0.5), 500);
  },
  // whisper — breathy filtered noise
  whisper() {
    noise(0.8, 0.12, 3000, 2.5, 'bandpass');
  },
  // ghost moan for the easter egg
  ghost() {
    const c = ac(), t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t0);
    osc.frequency.linearRampToValueAtTime(220, t0 + 0.7);
    osc.frequency.linearRampToValueAtTime(280, t0 + 1.4);
    osc.frequency.linearRampToValueAtTime(150, t0 + 2.2);
    env(g, t0, 0.4, 2.0, 0.18);
    osc.connect(g).connect(c.destination);
    osc.start(t0); osc.stop(t0 + 2.5);
  },
};

export const audio = {
  play(name) {
    const fn = library[String(name).toLowerCase()];
    if (!fn) return; // REQ-078: unknown sound names fail silently
    try { fn(); } catch { /* audio not ready */ }
  },
  names: Object.keys(library),
};
