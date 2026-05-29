import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import {
  initEngine,
  setWave as setWaveEngine,
  attackChord as attackChordEngine,
  releaseChord as releaseChordEngine,
  attackNote as attackNoteEngine,
  releaseNote as releaseNoteEngine,
  releaseAll as releaseAllEngine,
} from '../audio/engine';
import type { FXLabel } from '../audio/fx';
import {
  CHORD_NAMES,
  SCALE_CHORD_TYPES,
  SCALE_ROOTS,
  TYPE_TAG,
  VOICINGS,
  getChordNotes,
  transposeOctave,
} from '../audio/chords';
import type { Key, Octave, PlayMode, WaveType } from '../audio/types';

export type ChordButtonInfo = {
  index: number;
  label: string;     // "Dm", "B°", …
  sublabel: string;  // "MAJ" | "MIN" | "DIM"
};

export type NoteButtonInfo = {
  index: number;
  label: string;     // "1".."7"
  sublabel: string;  // "C" | "D" | …
};

export type AudioEngineState = {
  started: boolean;
  start: () => Promise<void>;

  // UI selections
  key: Key;
  setKey: (k: Key) => void;
  octave: Octave;
  setOctave: (o: Octave) => void;
  wave: WaveType;
  setWave: (w: WaveType) => void;
  mode: PlayMode;
  setMode: (m: PlayMode) => void;

  // Derived button info
  chordButtons: ChordButtonInfo[];
  noteButtons: NoteButtonInfo[];

  // Triggers
  attackChord: (index: number) => string[];
  releaseChord: (notes: string[]) => void;
  attackNote: (index: number) => string;
  releaseNote: (note: string) => void;

  // Coarse "something just played" pulse — display subscribes for star spawn.
  playPulse: number;
  /** Last FX label the joystick is currently producing, null when idle. */
  currentFX: FXLabel | null;
  setCurrentFX: (fx: FXLabel | null) => void;
  /** Number of fingers/pointers currently holding a chord or note button. */
  heldCount: number;
  incrementHeld: () => void;
  decrementHeld: () => void;
};

export function useAudioEngine(): AudioEngineState {
  const [started, setStarted] = useState(false);
  const [key, setKeyState] = useState<Key>('C');
  const [octave, setOctaveState] = useState<Octave>(0);
  const [wave, setWaveState] = useState<WaveType>('triangle');
  const [mode, setMode] = useState<PlayMode>('PLAY');
  const [playPulse, setPlayPulse] = useState(0);
  const [currentFX, setCurrentFX] = useState<FXLabel | null>(null);
  const [heldCount, setHeldCount] = useState(0);
  const starting = useRef(false);

  const incrementHeld = useCallback(() => setHeldCount((c) => c + 1), []);
  const decrementHeld = useCallback(
    () => setHeldCount((c) => (c > 0 ? c - 1 : 0)),
    [],
  );

  const start = useCallback(async () => {
    if (started || starting.current) return;
    starting.current = true;
    try {
      await Tone.start();
      await initEngine();
      setStarted(true);
    } finally {
      starting.current = false;
    }
  }, [started]);

  // Build the synth + FX chain as soon as the hook mounts, even before any
  // user gesture. The audio context stays suspended until the first key
  // tap fires Tone.start(), but having the graph ready means there's no
  // perceptible delay between touching a key and hearing it.
  useEffect(() => {
    initEngine().catch((e) => console.warn('engine preinit failed', e));
  }, []);

  // Propagate wave changes to the engine
  useEffect(() => {
    if (started) setWaveEngine(wave);
  }, [started, wave]);

  const chordButtons = useMemo<ChordButtonInfo[]>(() => {
    const names = CHORD_NAMES[key];
    return SCALE_CHORD_TYPES.map((type, index) => ({
      index,
      label: names[index],
      sublabel: TYPE_TAG[type],
    }));
  }, [key]);

  const noteButtons = useMemo<NoteButtonInfo[]>(() => {
    const roots = SCALE_ROOTS[key];
    return roots.map((note, index) => ({
      index,
      label: String(index + 1),
      sublabel: note.replace(/\d+$/, ''),
    }));
  }, [key]);

  const attackChord = useCallback(
    (index: number) => {
      const root = SCALE_ROOTS[key][index];
      const type = SCALE_CHORD_TYPES[index];
      const intervals = VOICINGS[type];
      const notes = getChordNotes(root, intervals).map((n) => transposeOctave(n, octave));
      // First touch counts as the user gesture — unlock audio context.
      if (!started) void start();
      attackChordEngine(notes);
      setPlayPulse((p) => p + 1);
      return notes;
    },
    [key, octave, started, start],
  );

  const releaseChord = useCallback((notes: string[]) => {
    releaseChordEngine(notes);
  }, []);

  const attackNote = useCallback(
    (index: number) => {
      const baseNote = SCALE_ROOTS[key][index];
      const note = transposeOctave(baseNote, octave);
      if (!started) void start();
      attackNoteEngine(note);
      setPlayPulse((p) => p + 1);
      return note;
    },
    [key, octave, started, start],
  );

  const releaseNote = useCallback((note: string) => {
    releaseNoteEngine(note);
  }, []);

  // Release everything if the tab is hidden — prevents stuck notes.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) releaseAllEngine();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Watchdog — both Safari and Chrome can park the AudioContext under
  // background-tab, memory or system-audio-grab pressure. The UI keeps
  // showing keys as held while no sound is coming out. Poll 4× per
  // second and also subscribe to the raw context state event so recovery
  // happens within a frame of the dropout.
  useEffect(() => {
    if (!started) return;
    const resumeIfNeeded = () => {
      try {
        const ctx = Tone.getContext();
        if (ctx.state !== 'running') void ctx.resume();
      } catch {
        /* ignore — resume can throw if context already closed */
      }
    };
    const id = window.setInterval(resumeIfNeeded, 250);
    const raw = Tone.getContext().rawContext as AudioContext;
    raw.addEventListener?.('statechange', resumeIfNeeded);
    return () => {
      window.clearInterval(id);
      raw.removeEventListener?.('statechange', resumeIfNeeded);
    };
  }, [started]);

  return {
    started,
    start,
    key,
    setKey: setKeyState,
    octave,
    setOctave: setOctaveState,
    wave,
    setWave: setWaveState,
    mode,
    setMode,
    chordButtons,
    noteButtons,
    attackChord,
    releaseChord,
    attackNote,
    releaseNote,
    playPulse,
    currentFX,
    setCurrentFX,
    heldCount,
    incrementHeld,
    decrementHeld,
  };
}
