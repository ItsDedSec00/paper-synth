import * as Tone from 'tone';
import type { ChordType, Key, VoicingName } from './types';

/**
 * Roots for each scale degree (I..VII) in every major key.
 * Used both for chord roots and as the single notes the right-hand zone plays.
 */
export const SCALE_ROOTS: Record<Key, [string, string, string, string, string, string, string]> = {
  C:  ['C4',  'D4',  'E4',  'F4',  'G4',  'A4',  'B4'],
  G:  ['G4',  'A4',  'B4',  'C5',  'D5',  'E5',  'F#5'],
  D:  ['D4',  'E4',  'F#4', 'G4',  'A4',  'B4',  'C#5'],
  A:  ['A4',  'B4',  'C#5', 'D5',  'E5',  'F#5', 'G#5'],
  E:  ['E4',  'F#4', 'G#4', 'A4',  'B4',  'C#5', 'D#5'],
  F:  ['F4',  'G4',  'A4',  'A#4', 'C5',  'D5',  'E5'],
  Bb: ['A#4', 'C5',  'D5',  'D#5', 'F5',  'G5',  'A5'],
  Eb: ['D#4', 'F4',  'G4',  'G#4', 'A#4', 'C5',  'D5'],
  Ab: ['G#4', 'A#4', 'C5',  'C#5', 'D#5', 'F5',  'G5'],
  Db: ['C#4', 'D#4', 'F4',  'F#4', 'G#4', 'A#4', 'C5'],
  'F#': ['F#4', 'G#4', 'A#4', 'B4',  'C#5', 'D#5', 'F5'],
  B:  ['B4',  'C#5', 'D#5', 'E5',  'F#5', 'G#5', 'A#5'],
};

/** Chord types for major-scale degrees I..VII. */
export const SCALE_CHORD_TYPES: ChordType[] = [
  'maj', 'min', 'min', 'maj', 'maj', 'min', 'dim',
];

/** Display names per key, one entry per scale degree (I..VII). */
export const CHORD_NAMES: Record<Key, [string, string, string, string, string, string, string]> = {
  C:  ['C',  'Dm', 'Em',  'F',  'G',  'Am', 'B°'],
  G:  ['G',  'Am', 'Bm',  'C',  'D',  'Em', 'F#°'],
  D:  ['D',  'Em', 'F#m', 'G',  'A',  'Bm', 'C#°'],
  A:  ['A',  'Bm', 'C#m', 'D',  'E',  'F#m', 'G#°'],
  E:  ['E',  'F#m', 'G#m', 'A',  'B',  'C#m', 'D#°'],
  F:  ['F',  'Gm', 'Am',  'Bb', 'C',  'Dm', 'E°'],
  Bb: ['Bb', 'Cm', 'Dm',  'Eb', 'F',  'Gm', 'A°'],
  Eb: ['Eb', 'Fm', 'Gm',  'Ab', 'Bb', 'Cm', 'D°'],
  Ab: ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'G°'],
  Db: ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'C°'],
  'F#': ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#°'],
  B:  ['B',  'C#m', 'D#m', 'E',  'F#', 'G#m', 'A#°'],
};

export const TYPE_TAG: Record<ChordType, string> = {
  maj: 'MAJ',
  min: 'MIN',
  dim: 'DIM',
};

/** Voicings as semitone intervals from the root. */
export const VOICINGS: Record<VoicingName, number[]> = {
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  dim:  [0, 3, 6],
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
  sus4: [0, 5, 7],
  aug:  [0, 4, 8],
  min7: [0, 3, 7, 10],
};

/** Convert a chord-root note name + interval set into concrete note names. */
export function getChordNotes(rootNote: string, intervals: number[]): string[] {
  const midi = Tone.Frequency(rootNote).toMidi();
  return intervals.map((i) => Tone.Frequency(midi + i, 'midi').toNote());
}

/**
 * Pick a voicing based on the touch-drag delta.
 * Spec §FX-Mapping — Chord buttons (X axis chord extension, Y axis selects aug/sus4).
 */
export function resolveVoicing(
  baseType: ChordType,
  deltaX: number,
  deltaY: number,
): VoicingName {
  if (deltaX > 80) return 'add9';
  if (deltaX > 40) return baseType === 'maj' ? 'maj7' : 'min7';
  if (deltaX > 15) return 'dom7';
  if (deltaX < -15) return baseType === 'maj' ? 'min' : 'dim';
  if (deltaY < -20) return 'aug';
  if (deltaY > 20) return 'sus4';
  return baseType;
}

/** Apply an octave offset to a note name. */
export function transposeOctave(note: string, octave: number): string {
  if (octave === 0) return note;
  const midi = Tone.Frequency(note).toMidi() + octave * 12;
  return Tone.Frequency(midi, 'midi').toNote();
}
