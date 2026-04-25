// Tiny WebAudio sound effects so we don't ship binary assets.
// Tones: spark zap, vouch stamp, crown fanfare. All gated by the user toggle.

let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq, duration = 0.12, type = "sine", gain = 0.06, slideTo }) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(slideTo, 1),
      c.currentTime + duration
    );
  }
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

export const sounds = {
  spark(enabled) {
    if (!enabled) return;
    tone({ freq: 880, slideTo: 220, duration: 0.18, type: "sawtooth", gain: 0.05 });
  },
  vouch(enabled) {
    if (!enabled) return;
    tone({ freq: 220, duration: 0.08, type: "square", gain: 0.06 });
    setTimeout(
      () => tone({ freq: 110, duration: 0.12, type: "square", gain: 0.05 }),
      70
    );
  },
  crown(enabled) {
    if (!enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(
        () => tone({ freq: f, duration: 0.22, type: "triangle", gain: 0.07 }),
        i * 110
      );
    });
  },
};
