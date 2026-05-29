import { useRef, useState, type PointerEvent } from 'react';
import { KeyButton } from './Button';
import { FXOverlay } from './FXOverlay';
import { useAudio } from '../hooks/AudioContext';
import { applyNoteFX, resetFXSmooth, type FXLabel } from '../audio/fx';
import { attackNote as engineAttackNote, releaseNote as engineReleaseNote } from '../audio/engine';
import { SCALE_ROOTS, transposeOctave } from '../audio/chords';

const THRESHOLD = 8;

export function NoteZone() {
  const audio = useAudio();
  const active = useRef<
    Map<
      number,
      {
        index: number;
        startX: number;
        startY: number;
        note: string;
        octShifted: boolean;
      }
    >
  >(new Map());
  const [heldIndex, setHeldIndex] = useState<number | null>(null);
  const [fx, setFX] = useState<FXLabel | null>(null);

  const noteFor = (index: number, octShift: number) => {
    const base = SCALE_ROOTS[audio.key][index];
    return transposeOctave(base, audio.octave + octShift);
  };

  const onDown = (index: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic events can throw */
    }
    const note = audio.attackNote(index);
    active.current.set(e.pointerId, {
      index,
      startX: e.clientX,
      startY: e.clientY,
      note,
      octShifted: false,
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

    const label = applyNoteFX(dx, dy);
    setFX(label);
    audio.setCurrentFX(label);

    // Y+ (down) → temporary octave -1: swap the playing note.
    const wantOctShift = dy > 30;
    if (wantOctShift !== entry.octShifted) {
      engineReleaseNote(entry.note);
      const nextNote = noteFor(entry.index, wantOctShift ? -1 : 0);
      engineAttackNote(nextNote);
      entry.note = nextNote;
      entry.octShifted = wantOctShift;
    }
  };

  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    const entry = active.current.get(e.pointerId);
    if (!entry) return;
    e.preventDefault();
    audio.releaseNote(entry.note);
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
    <div className="play-zone play-zone--note">
      <div className="play-zone__grid play-zone__grid--note">
        {audio.noteButtons.map((btn) => (
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
