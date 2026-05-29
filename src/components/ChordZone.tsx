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

/** Touch-input deadzone in px. Below this radius from the press origin we
 *  treat the touch as a clean tap and don't engage any FX modulation —
 *  prevents unintentional drag from finger jitter. */
const DEADZONE = 24;

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
    const dist = Math.hypot(dx, dy);

    // Inside the deadzone — clear any FX we might have engaged on a previous
    // move, but don't react to the small jitter.
    if (dist < DEADZONE) {
      if (fx) {
        setFX(null);
        audio.setCurrentFX(null);
      }
      // Snap voicing back to base while inside the deadzone so a clean tap
      // never accidentally morphs the chord.
      const baseType = SCALE_CHORD_TYPES[entry.index];
      if (entry.voicing !== baseType) {
        const baseNotes = pickNotes(entry.index, baseType);
        morphVoicing(entry, baseNotes, baseType);
      }
      return;
    }

    // Subtract the deadzone radially so the FX engages from zero past the
    // edge of the deadzone instead of snapping to whatever the formula
    // produces at threshold + 1 px.
    const scale = (dist - DEADZONE) / dist;
    const cleanDx = dx * scale;
    const cleanDy = dy * scale;

    const label = applyChordFX(cleanDx, cleanDy);
    setFX(label);
    audio.setCurrentFX(label);

    // X-axis: swap voicing on the fly if it's changed (using the cleaned
    // delta so the morph thresholds also respect the deadzone).
    const baseType = SCALE_CHORD_TYPES[entry.index];
    const newVoicing = resolveVoicing(baseType, cleanDx, cleanDy);
    if (newVoicing !== entry.voicing) {
      const nextNotes = pickNotes(entry.index, newVoicing);
      morphVoicing(entry, nextNotes, newVoicing);
    }
  };

  /** Voicing morph that only releases the notes that disappear and only
   *  attacks the notes that newly join — avoids the audible click that
   *  comes from release+attack-ing notes that exist in both voicings. */
  function morphVoicing(
    entry: { notes: string[]; voicing: string },
    nextNotes: string[],
    nextVoicing: string,
  ) {
    const toRelease = entry.notes.filter((n) => !nextNotes.includes(n));
    const toAttack = nextNotes.filter((n) => !entry.notes.includes(n));
    if (toRelease.length > 0) audio.releaseChord(toRelease);
    if (toAttack.length > 0) engineAttackChord(toAttack);
    entry.voicing = nextVoicing;
    entry.notes = nextNotes;
  }

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
