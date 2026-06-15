// Synthesized review feedback sounds. We generate short tones with the Web Audio
// API rather than shipping audio files, so they work offline and stay tunable.
// A single AudioContext is shared and lazily created on first play — browsers
// start it suspended until a user gesture, and answering a card is one, so we
// resume it before playing.

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// One short tone with a quick attack and exponential decay so it never clicks.
function tone(
  ac: AudioContext,
  type: OscillatorType,
  startFreq: number,
  endFreq: number,
  startAt: number,
  duration: number,
  peakGain: number
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, startAt);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startAt + duration);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** A bright two-note chime for a passing (right) swipe. */
export function playCorrectSound(): void {
  const ac = getContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone(ac, 'sine', 660, 660, now, 0.12, 0.18);
  tone(ac, 'sine', 880, 880, now + 0.09, 0.16, 0.18);
}

/** A short descending whoosh for an "again" (left) swipe. */
export function playSwipeSound(): void {
  const ac = getContext();
  if (!ac) return;
  const now = ac.currentTime;
  tone(ac, 'triangle', 440, 200, now, 0.18, 0.14);
}
