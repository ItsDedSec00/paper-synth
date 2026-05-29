import { useRef, useState, type PointerEvent } from 'react';
import { KeyButton } from './Button';
import { FXOverlay } from './FXOverlay';
import { useAudio } from '../hooks/AudioContext';
import { applyChordFX, resetFXSmooth, type FXLabel } from '../audio/fx';
import { attackChord as engineAttackChord } from '../audio/engine';
import {
  SCALE_CHORD_TYPES,
  SCALE_ROOTS,
  VOICINGS,
  getChordNotes,
  resolveVoicing,
  transposeOctave,
} from '../audio/chords';

const THRESHOLD = 8;

export function ChordZone() {
  const audio = useAudio();
  /** pointerId → { btnIndex, startX, startY, lastVoicing, lastNotes } */
  const active = useRef<
    Map<
      number,
      {
        index: number;
        startX: number;
        startY: number;
        voicing: string;
        notes: string[];
      }
    >
  >(new Map());
  const [heldIndex, setHeldIndex] = useState<number | null>(null);
  const [fx, setFX] = useState<FXLabel | null>(null);

  function pickNotes(index: number, voicing: keyof typeof VOICINGS): string[] {
    const root = SCALE_ROOTS[audio.key][index];
    return getChordNotes(root, VOICINGS[voicing]).map((n) =>
      transposeOctave(n, audio.octave),
    );
  }

  const onDown = (index: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic pointer events (or already-captured pointers) can throw — ignore.
    }
    const baseType = SCALE_CHORD_TYPES[index];
    const notes = audio.attackChord(index);
    active.current.set(e.pointerId, {
      index,
      startX: e.clientX,
      startY: e.clientY,
      voicing: baseType,
      notes,
    });
    audio.incrementHeld();
    setHeldIndex(index);
  };

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const entry = active.current.get(e.pointerId);
    if (!entry) return;
    e.preventDefault();
    const dx = e.clientX - entry.startX;
    const dy = e.clientY - entry.startY;
    if (Math.hypot(dx, dy) < THRESHOLD) return;

    const label = applyChordFX(dx, dy);
    setFX(label);
    audio.setCurrentFX(label);

    // X-axis: swap voicing on the fly if it's changed
    const baseType = SCALE_CHORD_TYPES[entry.index];
    const newVoicing = resolveVoicing(baseType, dx, dy);
    if (newVoicing !== entry.voicing) {
      // Release old notes, attack new ones — gives the live chord-morph effect.
      audio.releaseChord(entry.notes);
      const nextNotes = pickNotes(entry.index, newVoicing);
      engineAttackChord(nextNotes);
      entry.voicing = newVoicing;
      entry.notes = nextNotes;
    }
  };

  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const entry = active.current.get(e.pointerId);
    if (!entry) return;
    e.preventDefault();
    audio.releaseChord(entry.notes);
    active.current.delete(e.pointerId);
    audio.decrementHeld();
    if (active.current.size === 0) {
      setHeldIndex(null);
      setFX(null);
      audio.setCurrentFX(null);
      resetFXSmooth();
    }
  };

  return (
    <div className="play-zone play-zone--chord">
      <div className="play-zone__grid play-zone__grid--chord">
        {audio.chordButtons.map((btn) => (
          <KeyButton
            key={btn.index}
            label={btn.label}
            sublabel={btn.sublabel}
            held={heldIndex === btn.index}
            onPointerDown={onDown(btn.index)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
          />
        ))}
      </div>
      <FXOverlay fx={fx} visible={heldIndex !== null} />
    </div>
  );
}
