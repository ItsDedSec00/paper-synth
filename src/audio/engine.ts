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
  /** Master gain after all effects — leaves headroom for the compressor. */
  masterGain: Tone.Gain;
  /** Soft-knee compressor catching peaks. Slow release so it doesn't
   *  audibly pump on sustained notes the way a hard limiter does. */
  compressor: Tone.Compressor;
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
    const reverb = new Tone.Reverb({ decay: DREAMY.reverbDecay, wet: DREAMY.reverbWet });
    await reverb.generate();

    const recorderTap = new Tone.Gain(1);
    // Master gain handles most of the headroom — quarter unity so 4-voice
    // chords + wet reverb + delay summed together stay well below clipping.
    const masterGain = new Tone.Gain(0.35);
    // Soft-knee compressor as a safety net — only engages on real peaks,
    // releases over 250 ms so it never pumps audibly on sustained notes
    // (which a fast brick-wall limiter does, killing held chords).
    const compressor = new Tone.Compressor({
      threshold: -6,
      ratio: 3,
      attack: 0.01,
      release: 0.25,
      knee: 8,
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
