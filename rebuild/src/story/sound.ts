// Optional sound, off by default: a low room hum, a soft tick when a ring locks, a click when the mark forms,
// and a rising tone for the transformation.
// The hum and the tick are recordings (two small files, about 50 KB together, built by art/build_audio.py). They are
// fetched only when the visitor turns sound on. If one fails to load or decode, its synthesised version plays
// instead, so sound never depends on a download. The click and the tone are always synthesised.
const HUM_URL = '/audio/hum.mp3';
const TICK_URL = '/audio/tick.mp3';
// The hum file is a 12 s loop with 50 ms of itself before and after, so a decoder's start-up samples stay outside
// the loop. Keep both in step with HUM_LOOP and HUM_PAD in art/build_audio.py.
const HUM_PAD = 0.05, HUM_LOOP = 12;
const HUM_GAIN = 3; // the file is levelled to -20 dBFS; this sits it a little under the synthesised hum's level
const TICK_GAIN = 0.3; // the file peaks at -3 dBFS; this matches the synthesised click's peak

export function createSound() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let tone: { osc: OscillatorNode; gain: GainNode } | null = null;
  let tickBuf: AudioBuffer | null = null;
  let on = false;

  const load = async (c: AudioContext, url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return c.decodeAudioData(await res.arrayBuffer());
  };

  // Each hum fades in over a second, so whichever one starts never starts with a bump
  const fadeIn = (c: AudioContext, level: number) => {
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(level, c.currentTime + 1);
    return g;
  };

  const recordedHum = (c: AudioContext, out: AudioNode, buf: AudioBuffer) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = HUM_PAD;
    src.loopEnd = Math.min(buf.duration, HUM_PAD + HUM_LOOP);
    src.connect(fadeIn(c, HUM_GAIN)).connect(out);
    src.start(0, HUM_PAD);
  };

  const synthHum = (c: AudioContext, out: AudioNode) => {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    lp.connect(fadeIn(c, 1)).connect(out);
    for (const [f, g] of [[55, 0.5], [82.5, 0.22], [110.4, 0.1]]) {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = 'sine'; o.frequency.value = f; gn.gain.value = g;
      o.connect(gn).connect(lp); o.start();
    }
  };

  const synthClick = (c: AudioContext, out: AudioNode) => {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.05);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
  };

  const start = () => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (ctx = new AC());
    const m = (master = c.createGain());
    m.gain.value = 0;
    m.connect(c.destination);
    load(c, HUM_URL).then((buf) => recordedHum(c, m, buf), (err) => { console.warn('Hum recording not loaded; using the synthesised hum', err); synthHum(c, m); });
    load(c, TICK_URL).then((buf) => { tickBuf = buf; }, (err) => console.warn('Tick recording not loaded; using the synthesised click', err));
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'triangle'; gain.gain.value = 0;
    osc.connect(gain).connect(m); osc.start();
    tone = { osc, gain };
  };

  return {
    set(next: boolean) {
      on = next;
      if (on && !ctx) start();
      if (!ctx || !master) return;
      if (on) void ctx.resume();
      master.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.3);
    },
    /** A ring locks: the recorded tick, or the synthesised click until (or unless) it has loaded */
    tick() {
      if (!on || !ctx || !master) return;
      if (!tickBuf) { synthClick(ctx, master); return; }
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = tickBuf;
      g.gain.value = TICK_GAIN;
      src.connect(g).connect(master);
      src.start();
    },
    /** The mark has formed */
    click() {
      if (!on || !ctx || !master) return;
      synthClick(ctx, master);
    },
    /** progress 0..1 while the transformation is moving, -1 when it is still */
    tone(progress: number) {
      if (!on || !ctx || !tone) return;
      const t = ctx.currentTime;
      if (progress < 0) { tone.gain.gain.setTargetAtTime(0, t, 0.12); return; }
      tone.osc.frequency.setTargetAtTime(160 + progress * 480, t, 0.05);
      tone.gain.gain.setTargetAtTime(0.1, t, 0.05);
    },
  };
}
