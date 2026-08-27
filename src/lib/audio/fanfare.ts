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

/** Rising filtered-noise sweep - the intake of breath before the hit. */
function riser(ctx: AudioContext, startAt: number, duration: number, peak = 0.1) {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.setValueAtTime(6, startAt);
  // Sweeping the passband upwards is what makes it feel like it's climbing.
  filter.frequency.setValueAtTime(300, startAt);
  filter.frequency.exponentialRampToValueAtTime(4200, startAt + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + duration * 0.85);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.05);
}

// A minor-pentatonic-ish climb. Using scale degrees rather than a chord
// keeps each stinger a little different from the last.
const STINGER_STEPS = [0, 3, 5, 7, 10, 12];

function semitonesToRatio(semitones: number): number {
  return 2 ** (semitones / 12);
}

/**
 * Hit for a regular pick.
 *
 * `tension` runs 0 at the first reveal to 1 just before the first pick, and
 * everything keys off it: the root note climbs about an octave over the
 * course of the draw, the riser gets longer, and the motif gains a note.
 * Eleven identical hits in a row was the problem - this way the room hears
 * the thing tightening as the picks count down.
 */
/**
 * A single blip for the countdown, rising in pitch as the draft nears.
 *
 * Deliberately tiny next to the stinger - this fires on a timer for hours,
 * so it has to be something you stop noticing and then notice again when
 * it speeds up. The module's rule about gestures still holds: the beeping
 * only ever runs after somebody has switched sound on, which is itself
 * the gesture that unlocks the context.
 */
export function playBeep(tension = 0) {
  const ctx = getContext();
  if (!ctx) return;
  const t = Math.min(Math.max(tension, 0), 1);
  const now = ctx.currentTime + 0.01;

  // Up a fifth across the whole build, so the last hour sits noticeably
  // higher than the days before it without ever becoming shrill.
  tone(ctx, {
    frequency: 523.25 * semitonesToRatio(t * 7),
    startAt: now,
    duration: 0.05 + t * 0.03,
    peak: 0.03 + t * 0.05,
    type: "square",
  });
}

export function playStinger(tension = 0) {
  const ctx = getContext();
  if (!ctx) return;
  const t = Math.min(Math.max(tension, 0), 1);
  const now = ctx.currentTime + 0.02;

  const riserLength = 0.28 + t * 0.34;
  riser(ctx, now, riserLength, 0.07 + t * 0.06);

  const landing = now + riserLength;
  thump(ctx, landing, 0.28 + t * 0.1);

  // Root climbs from a low G up towards the octave as the draft tightens.
  const root = 146.83 * semitonesToRatio(t * 12);

  // Later picks get a longer motif, so the last few feel like more of an
  // event than the first few.
  const noteCount = 3 + Math.round(t * 2);
  for (let i = 0; i < noteCount; i++) {
    const step = STINGER_STEPS[Math.min(i, STINGER_STEPS.length - 1)];
    tone(ctx, {
      frequency: root * semitonesToRatio(step),
      startAt: landing + i * 0.085,
      duration: 0.42 + t * 0.2,
      peak: 0.15 - i * 0.012,
      bendTo: root * semitonesToRatio(step) * 1.01,
    });
  }

  // Low root underneath, holding the whole thing together.
  tone(ctx, {
    frequency: root / 2,
    startAt: landing,
    duration: 0.6 + t * 0.3,
    peak: 0.13,
    type: "triangle",
  });
}

/**
 * The hold after pick 2 lands: a low, unresolved drone under the "one team
 * remains" screen. Deliberately doesn't resolve - that's what the finale is
 * for.
 */
export function playSuspense() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;

  // A tritone, the most unresolved interval there is.
  tone(ctx, { frequency: 98.0, startAt: now, duration: 2.6, peak: 0.12, type: "triangle" });
  tone(ctx, { frequency: 138.59, startAt: now, duration: 2.6, peak: 0.09, type: "triangle" });
  // Slow pulse on top so it doesn't sit completely still.
  for (let i = 0; i < 5; i++) {
    tone(ctx, {
      frequency: 587.33,
      startAt: now + i * 0.5,
      duration: 0.22,
      peak: 0.05,
    });
  }
}

/**
 * The pick-one fanfare: a riser, a rising major arpeggio, then a big
 * sustained chord with hits under it. Around five seconds, so it plays for
 * the length of the confetti rather than finishing while it's still
 * falling.
 */
export function playFanfare() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime + 0.02;

  riser(ctx, now, 0.6, 0.13);
  const arpeggioStart = now + 0.6;

  // Rising G major arpeggio into the octave.
  const rise = [196.0, 246.94, 293.66, 392.0, 493.88, 587.33];
  rise.forEach((frequency, i) => {
    tone(ctx, {
      frequency,
      startAt: arpeggioStart + i * 0.11,
      duration: 0.3,
      peak: 0.16,
    });
  });

  // The chord it lands on, held long.
  const landing = arpeggioStart + rise.length * 0.11;
  thump(ctx, landing, 0.4);
  for (const [i, frequency] of [
    98.0, 196.0, 246.94, 293.66, 392.0, 493.88, 587.33,
  ].entries()) {
    tone(ctx, {
      frequency,
      startAt: landing,
      duration: 3.4,
      peak: i === 0 ? 0.17 : 0.1,
      bendTo: frequency * 1.004, // barely-there drift, keeps it from sounding dead
      type: i === 0 ? "triangle" : "sawtooth",
    });
  }

  // Hits underneath so the long sustain doesn't sag.
  for (const offset of [0.55, 1.1, 1.75, 2.5]) {
    thump(ctx, landing + offset, 0.22);
  }

  // A second, higher flourish partway through the sustain.
  [784.0, 987.77, 1174.66].forEach((frequency, i) => {
    tone(ctx, {
      frequency,
      startAt: landing + 1.5 + i * 0.1,
      duration: 0.9,
      peak: 0.07,
    });
  });
}
