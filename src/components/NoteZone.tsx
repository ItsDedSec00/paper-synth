import { useRef, useState, type PointerEvent } from 'react';
import { KeyButton } from './Button';
import { FXOverlay } from './FXOverlay';
import { useAudio } from '../hooks/AudioContext';
import { applyNoteFX, resetFXSmooth, type FXLabel } from '../audio/fx';
import { attackNote as engineAttackNote, releaseNote as engineReleaseNote } from '../audio/engine';
import { SCALE_ROOTS, transposeOctave } from '../audio/chords';

/** Touch-input deadzone in px. Prevents accidental FX engagement from
 *  unintentional finger jitter when you just want to tap a note. */
const DEADZONE = 24;

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
    const dist = Math.hypot(dx, dy);

    // Inside the deadzone — clear any engaged FX and snap any octave-shift
    // back to the base note so a clean tap doesn't bend pitch.
    if (dist < DEADZONE) {
      if (fx) {
        setFX(null);
        audio.setCurrentFX(null);
      }
      if (entry.octShifted) {
        engineReleaseNote(entry.note);
        const baseNote = noteFor(entry.index, 0);
        engineAttackNote(baseNote);
        entry.note = baseNote;
        entry.octShifted = false;
      }
      return;
    }

    // Soft engagement past the deadzone radius.
    const scale = (dist - DEADZONE) / dist;
    const cleanDx = dx * scale;
    const cleanDy = dy * scale;

    const label = applyNoteFX(cleanDx, cleanDy);
    setFX(label);
    audio.setCurrentFX(label);

    // Y+ (down) → temporary octave -1, using the cleaned delta so the
    // octave-snap also respects the deadzone.
    const wantOctShift = cleanDy > 30;
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
