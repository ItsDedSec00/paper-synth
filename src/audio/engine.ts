import * as Tone from 'tone';
import type { WaveType } from './types';

/**
 * Module-level singleton — Tone.js objects are mutable and must outlive
 * React renders. `initEngine()` is idempotent and only does real work the
 * first time it's called (after Tone.start()).
 */

export type Engine = {
  synth: Tone.PolySynth<Tone.Synth>;
  vibrato: Tone.Vibrato;
  tremolo: Tone.Tremolo;
  filter: Tone.Filter;
  chorus: Tone.Chorus;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  /** A pre-Destination tap (post-reverb) the looper records from. */
  recorderTap: Tone.Gain;
  /** Master gain after all effects — controls overall headroom. */
  masterGain: Tone.Gain;
  /** Gentle bus compressor — glues the chord+note signal without pumping. */
  compressor: Tone.Compressor;
  /** Final soft limiter — catches isolated peaks so the master out never
   *  clips and iOS doesn't have to fire its own emergency duck. */
  safeLimiter: Tone.Compressor;
};

let engine: Engine | null = null;
let initPromise: Promise<Engine> | null = null;

/** Dreamy preset values — applied on init and used as "default" by resetFXSmooth. */
export const DREAMY = {
  // Sustain at 0.9 so a held key stays at almost full peak amplitude
  // instead of dipping to 0.7 right after the decay phase (which the ear
  // hears as "the note got quieter / stopped").
  envelope: { attack: 0.4, decay: 0.2, sustain: 0.9, release: 3.0 },
  reverbWet: 0.55,
  reverbDecay: 5,
  delayWet: 0.25,
  delayTime: '4n' as const,
  delayFeedback: 0.35,
  chorusWet: 0.4,
  chorusDepth: 0.5,
  filterFreq: 6000,
  vibratoDepth: 0,
  tremoloDepth: 0,
} as const;

export async function initEngine(): Promise<Engine> {
  if (engine) return engine;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { ...DREAMY.envelope },
      // Per-voice cut so 4-voice chord + simultaneous note + reverb wet
      // never sum past the safe-limiter threshold in one place.
      volume: -8,
    });
    // Generous polyphony so chords (up to 4 voices) + held notes + voicing
    // morphs (release tails) + looper playback never steal active voices.
    synth.maxPolyphony = 32;

    const vibrato = new Tone.Vibrato({ frequency: 5, depth: DREAMY.vibratoDepth });
    const tremolo = new Tone.Tremolo({ frequency: 4, depth: DREAMY.tremoloDepth }).start();
    const filter = new Tone.Filter({ frequency: DREAMY.filterFreq, type: 'lowpass' });
    const chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: DREAMY.chorusDepth,
      wet: DREAMY.chorusWet,
    }).start();
    const delay = new Tone.FeedbackDelay({
      delayTime: DREAMY.delayTime,
      feedback: DREAMY.delayFeedback,
      wet: DREAMY.delayWet,
    });
    // Shorter reverb decay (3 s instead of 5 s) keeps the impulse response
    // small enough that iOS Safari's worklet doesn't choke when many
    // voices feed it simultaneously.
    const reverb = new Tone.Reverb({ decay: 3, wet: DREAMY.reverbWet });
    await reverb.generate();

    const recorderTap = new Tone.Gain(1);
    const masterGain = new Tone.Gain(0.6);

    // Stage 1 — barely-there bus glue. Slow attack (40 ms) lets the
    // transient of each new key pass through cleanly so a fast riff
    // doesn't sound pumped or clicky. Long release keeps the gain
    // movement smooth.
    const compressor = new Tone.Compressor({
      threshold: -12,
      ratio: 2,
      attack: 0.04,
      release: 0.35,
      knee: 16,
    });

    // Stage 2 — extra-soft brick wall. Threshold close to 0 dB and a
    // big knee so this stage only engages on rare in-phase peaks.
    const safeLimiter = new Tone.Compressor({
      threshold: -1,
      ratio: 8,
      attack: 0.005,
      release: 0.22,
      knee: 6,
    });

    synth.chain(
      vibrato,
      tremolo,
      filter,
      chorus,
      delay,
      reverb,
      recorderTap,
      masterGain,
      compressor,
      safeLimiter,
      Tone.Destination,
    );

    engine = {
      synth,
      vibrato,
      tremolo,
      filter,
      chorus,
      delay,
      reverb,
      recorderTap,
      masterGain,
      compressor,
      safeLimiter,
    };
    return engine;
  })();

  return initPromise;
}

export function getEngine(): Engine | null {
  return engine;
}

/** Set the oscillator type on the running synth. No-op if not yet started. */
export function setWave(type: WaveType): void {
  if (!engine) return;
  engine.synth.set({ oscillator: { type } });
}

/** Detune all currently playing voices in cents. ±100 = one semitone. */
export function setDetune(cents: number): void {
  if (!engine) return;
  engine.synth.set({ detune: cents });
}

/** Trigger one or more notes (chord) for a held duration. */
export function triggerChord(notes: string[], duration: Tone.Unit.Time = '2n'): void {
  if (!engine) return;
  engine.synth.triggerAttackRelease(notes, duration);
}

/** Trigger a sustained chord; release with releaseChord(notes). */
export function attackChord(notes: string[]): void {
  if (!engine) return;
  engine.synth.triggerAttack(notes);
}

export function releaseChord(notes: string[]): void {
  if (!engine) return;
  engine.synth.triggerRelease(notes);
}

/** Single-note attack (used by the note buttons). */
export function attackNote(note: string): void {
  if (!engine) return;
  engine.synth.triggerAttack(note);
}

export function releaseNote(note: string): void {
  if (!engine) return;
  engine.synth.triggerRelease(note);
}

export function releaseAll(): void {
  if (!engine) return;
  engine.synth.releaseAll();
}
