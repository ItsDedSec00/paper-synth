export const KEYS = [
  'C', 'G', 'D', 'A', 'E', 'F',
  'Bb', 'Eb', 'Ab', 'Db', 'F#', 'B',
] as const;
export type Key = (typeof KEYS)[number];

export const CHORD_TYPES = ['maj', 'min', 'dim'] as const;
export type ChordType = (typeof CHORD_TYPES)[number];

export const VOICINGS_AVAILABLE = [
  'maj', 'min', 'dim',
  'maj7', 'dom7', 'add9', 'sus4', 'aug', 'min7',
] as const;
export type VoicingName = (typeof VOICINGS_AVAILABLE)[number];

export const WAVE_TYPES = ['triangle', 'sine', 'sawtooth', 'square'] as const;
export type WaveType = (typeof WAVE_TYPES)[number];

export const PLAY_MODES = ['PLAY', 'STRUM', 'DRONE'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

export type Octave = -1 | 0 | 1;
