// Optional sound, off by default: a low room hum, a soft click when rings lock,
// and a rising tone for the transformation. Synthesised in the browser, so there is nothing to download.
export function createSound() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let tone: { osc: OscillatorNode; gain: GainNode } | null = null;
  let on = false;

  const start = () => {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    lp.connect(master);
    for (const [f, g] of [[55, 0.5], [82.5, 0.22], [110.4, 0.1]]) {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; gn.gain.value = g;
      o.connect(gn).connect(lp); o.start();
    }
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle'; gain.gain.value = 0;
    osc.connect(gain).connect(master); osc.start();
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
    click() {
      if (!on || !ctx || !master) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.05);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.1);
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
