import { DREAMY, getEngine } from './engine';

/**
 * Touch-drag → live FX modulation.
 * Engage ramps are 120 ms (clearly audible as a fade-in instead of an
 * abrupt jump) and release ramps are 450 ms (smooth ease-out back to
 * baseline so the FX visibly fades when the finger lifts).
 */

const RAMP_UP = 0.12;
const RAMP_DOWN = 0.45;

export type FXLabel = { label: string; value: string };

/** Normalize a value to [0,1] with a soft top. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * Chord buttons (left hand):
 *   Y- (up)     → Reverb wet ↑
 *   Y+ (down)   → Filter cutoff ↓
 *   X+ (right)  → Pitch bend up + voicing snaps to maj7/dom7/add9
 *   X- (left)   → Pitch bend down + voicing snaps to min/dim/aug
 *   Diagonal ↗  → Chorus depth ↑
 *   Diagonal ↙  → Delay feedback ↑
 */
export function applyChordFX(deltaX: number, deltaY: number): FXLabel | null {
  const e = getEngine();
  if (!e) return null;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const now = 0; // immediate

  // Diagonal — chorus / delay (checked before axis-dominance to feel responsive)
  if (absX > 20 && absY > 20) {
    if (deltaX > 0 && deltaY < 0) {
      const depth = DREAMY.chorusDepth + clamp01((absX + absY) / 140) * (1 - DREAMY.chorusDepth);
      e.chorus.depth = clamp01(depth);
      return { label: 'CHORUS', value: pct(depth) };
    }
    if (deltaX < 0 && deltaY > 0) {
      const fb = DREAMY.delayFeedback + clamp01((absX + absY) / 140) * (0.85 - DREAMY.delayFeedback);
      e.delay.feedback.cancelScheduledValues(now);
      e.delay.feedback.rampTo(clamp01(fb), RAMP_UP);
      return { label: 'DELAY', value: pct(fb) };
    }
  }

  // Y-axis dominant — reverb / filter (full effect at ~80 px drag)
  if (absY > absX) {
    if (deltaY < 0) {
      const wet = DREAMY.reverbWet + clamp01(-deltaY / 80) * (1 - DREAMY.reverbWet);
      e.reverb.wet.cancelScheduledValues(now);
      e.reverb.wet.rampTo(clamp01(wet), RAMP_UP);
      return { label: 'REVERB', value: pct(wet) };
    } else {
      const min = 400;
      const max = DREAMY.filterFreq;
      const t = clamp01(deltaY / 90);
      const freq = max - (max - min) * t;
      e.filter.frequency.cancelScheduledValues(now);
      e.filter.frequency.rampTo(freq, RAMP_UP);
      return { label: 'FILTER', value: `${Math.round(freq)}Hz` };
    }
  }

  // X-axis dominant — pitch bend. Full ±200 cents reached at ~80 px drag.
  const cents = Math.round(clamp(deltaX * 2.5, -200, 200));
  e.synth.set({ detune: cents });
  const sign = cents >= 0 ? '+' : '';
  return { label: 'BEND', value: `${sign}${cents}¢` };
}

/**
 * Note buttons (right hand):
 *   Y- (up)     → Vibrato depth ↑
 *   Y+ (down)   → (octave handled by caller — no audio param)
 *   X+ (right)  → Release tail extends
 *   X- (left)   → Tremolo rate ↑
 */
export function applyNoteFX(deltaX: number, deltaY: number): FXLabel | null {
  const e = getEngine();
  if (!e) return null;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absY > absX) {
    if (deltaY < 0) {
      const depth = clamp01(-deltaY / 70);
      e.vibrato.depth.cancelScheduledValues(0);
      e.vibrato.depth.rampTo(depth, RAMP_UP);
      return { label: 'VIBRATO', value: pct(depth) };
    }
    return { label: 'OCT-1', value: '' };
  }

  if (deltaX > 0) {
    const release = 1.5 + clamp01(deltaX / 90) * 5;
    e.synth.set({ envelope: { release } });
    return { label: 'RELEASE', value: `${release.toFixed(1)}s` };
  }

  // left: tremolo rate + depth, full effect at ~80 px
  const rate = 4 + clamp01(absX / 70) * 16;
  e.tremolo.frequency.cancelScheduledValues(0);
  e.tremolo.frequency.rampTo(rate, RAMP_UP);
  const depth = clamp01(absX / 90);
  e.tremolo.depth.cancelScheduledValues(0);
  e.tremolo.depth.rampTo(depth, RAMP_UP);
  return { label: 'TREMOLO', value: `${rate.toFixed(1)}Hz` };
}

/** Ramp all modulated params back to the dreamy defaults. */
export function resetFXSmooth(): void {
  const e = getEngine();
  if (!e) return;
  e.reverb.wet.cancelScheduledValues(0);
  e.reverb.wet.rampTo(DREAMY.reverbWet, RAMP_DOWN);
  e.filter.frequency.cancelScheduledValues(0);
  e.filter.frequency.rampTo(DREAMY.filterFreq, RAMP_DOWN);
  e.chorus.depth = DREAMY.chorusDepth;
  e.delay.feedback.cancelScheduledValues(0);
  e.delay.feedback.rampTo(DREAMY.delayFeedback, RAMP_DOWN);
  e.vibrato.depth.cancelScheduledValues(0);
  e.vibrato.depth.rampTo(DREAMY.vibratoDepth, RAMP_DOWN);
  e.tremolo.depth.cancelScheduledValues(0);
  e.tremolo.depth.rampTo(DREAMY.tremoloDepth, RAMP_DOWN);
  e.tremolo.frequency.cancelScheduledValues(0);
  e.tremolo.frequency.rampTo(4, RAMP_DOWN);
  e.synth.set({ envelope: { release: DREAMY.envelope.release }, detune: 0 });
}
