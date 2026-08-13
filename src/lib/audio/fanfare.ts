/**
 * Reveal audio, synthesised in the browser.
 *
 * No audio files: nothing to license, nothing to host, nothing to load
 * before the moment it's needed. The trade-off is honest - this sounds like
 * a good synth fanfare, not a recorded orchestra.
 *
 * Browsers refuse to play audio that wasn't triggered by a user gesture.
 * Every function here is called from a click handler, which is why it works
 * at all - do not try to fire these on a timer or a page load.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  // Safari in particular starts the context suspended until a gesture.
  if (context.state === "suspended") void context.resume();
  return context;
}

interface ToneOptions {
  frequency: number;
  startAt: number;
  duration: number;
  /** Peak gain before the decay. Kept well under 1 to leave headroom. */
  peak?: number;
  type?: OscillatorType;
  /** Slight upward bend, which is what makes brass sound like brass. */
  bendTo?: number;
}

function tone(ctx: AudioContext, options: ToneOptions) {
  const {
    frequency,
    startAt,
    duration,
    peak = 0.18,
    type = "sawtooth",
    bendTo,
  } = options;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  // Rolls off the harsh top end of the saw so it reads as brassy rather
  // than buzzy on laptop speakers.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, startAt);

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  if (bendTo) {
    osc.frequency.exponentialRampToValueAtTime(bendTo, startAt + duration * 0.5);
  }

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

/** Low filtered noise burst - the drum hit under the brass. */
function thump(ctx: AudioContext, startAt: number, peak = 0.3) {
  const length = Math.floor(ctx.sampleRate * 0.35);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Noise that dies away quickly, so it lands as a hit not a hiss.
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(220, startAt);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.35);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(startAt);
}

/**
 * Short punchy hit for a regular pick. Deliberately brief - this fires
 * eleven times in a row, and anything longer would wear out fast.
 */
export function playStinger() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;

  thump(ctx, now, 0.25);
  // A bare fifth: strong and neutral, so it doesn't imply a key that then
  // clashes with the pick-one fanfare.
  tone(ctx, { frequency: 196.0, startAt: now, duration: 0.45, peak: 0.16 });
  tone(ctx, { frequency: 293.66, startAt: now, duration: 0.45, peak: 0.13 });
  tone(ctx, {
    frequency: 392.0,
    startAt: now + 0.06,
    duration: 0.4,
    peak: 0.1,
    bendTo: 400,
  });
}

/**
 * The pick-one fanfare: a rising major triad that lands on a sustained
 * chord. Roughly two seconds, meant to play under the confetti.
 */
export function playFanfare() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;

  // Rising G major arpeggio into the octave.
  const rise = [196.0, 246.94, 293.66, 392.0];
  rise.forEach((frequency, i) => {
    tone(ctx, {
      frequency,
      startAt: now + i * 0.12,
      duration: 0.3,
      peak: 0.15,
    });
  });

  // The chord it lands on, held.
  const landing = now + rise.length * 0.12;
  thump(ctx, landing, 0.35);
  for (const [i, frequency] of [196.0, 246.94, 293.66, 392.0, 493.88].entries()) {
    tone(ctx, {
      frequency,
      startAt: landing,
      duration: 1.6,
      peak: i === 0 ? 0.16 : 0.11,
      bendTo: frequency * 1.004, // barely-there drift, keeps it from sounding dead
    });
  }
  // A second hit halfway through so the sustain doesn't just sag.
  thump(ctx, landing + 0.5, 0.2);
}
