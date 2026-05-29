import { useEffect, useRef } from 'react';
import type { FXLabel } from '../audio/fx';

/**
 * Continuous top→bottom pixel star field for the LCD display.
 *
 * Activity model:
 *   • idle (nothing held, no looper tracks, no FX) → spawn rate = 0 AND
 *     existing stars freeze in place
 *   • notes/chords held → continuous flow as long as a finger stays down
 *   • each looper track adds a steady trickle
 *   • a played note also bumps the rate for ~700 ms with smooth decay
 *
 * FX modulation runs through a spring-eased FXValues vector so the visual
 * effect *fades in* as the joystick moves out and *fades out* after release.
 * Every effect's intensity is proportional to the joystick value (e.g.
 * REVERB at 90 % gives much longer trails than REVERB at 30 %).
 */

type Star = {
  x: number;
  y: number;
  vy: number;
  size: 1 | 2;
  bornAt: number;
  phase: number;
  hue: 0 | 1;
};

type Props = {
  playPulse: number;
  fx: FXLabel | null;
  activeTracks: number;
  notesHeld: number;
};

const COLORS_BRIGHT = ['#c8ffc8', '#a8e8a8'];
const COLORS_DIM = ['#3a6a3a', '#2a4a2a'];

const BASE_VY = 26;
const GRAVITY = 32;
const BASE_RATE = 5.0;
const HOLD_RATE = 7.0;            // extra stars/sec while any finger is down
const TRACK_RATE = 3.2;
const NOTE_BURST_DURATION = 700;

/** Continuous-valued FX state — all components in 0..1 (bend in -1..1). */
type FXValues = {
  reverb: number;
  filter: number;
  bend: number;
  chorus: number;
  delay: number;
  vibrato: number;
  tremolo: number;
  release: number;
  octDown: number;
};

const ZERO_FX: FXValues = {
  reverb: 0, filter: 0, bend: 0, chorus: 0, delay: 0,
  vibrato: 0, tremolo: 0, release: 0, octDown: 0,
};

const DREAMY_REVERB_BASELINE = 0.55;
const DREAMY_FILTER_FREQ = 6000;

export function StarField({ playPulse, fx, activeTracks, notesHeld }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const rafRef = useRef<number | null>(null);
  const fxRef = useRef<FXLabel | null>(fx);
  const tracksRef = useRef(activeTracks);
  const heldRef = useRef(notesHeld);
  const lastPulseRef = useRef(playPulse);
  const lastNoteAt = useRef(0);
  const spawnAcc = useRef(0);
  const lastTickRef = useRef(performance.now());
  /** Smoothed FX values — spring-ease toward the joystick target. */
  const fxValuesRef = useRef<FXValues>({ ...ZERO_FX });
  /** 0..1 envelope — drives the coast-down "stop animation" after release. */
  const activityRef = useRef(0);

  useEffect(() => { fxRef.current = fx; }, [fx]);
  useEffect(() => { tracksRef.current = activeTracks; }, [activeTracks]);
  useEffect(() => { heldRef.current = notesHeld; }, [notesHeld]);

  useEffect(() => {
    if (playPulse === lastPulseRef.current) return;
    lastPulseRef.current = playPulse;
    lastNoteAt.current = performance.now();
  }, [playPulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const chunk = 3;
      canvas.width = Math.max(1, Math.round(rect.width / chunk));
      canvas.height = Math.max(1, Math.round(rect.height / chunk));
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    lastTickRef.current = performance.now();

    const tick = (t: number) => {
      const dtSec = Math.min(0.08, (t - lastTickRef.current) / 1000);
      lastTickRef.current = t;

      const w = canvas.width;
      const h = canvas.height;
      const currentFX = fxRef.current;
      const tracks = tracksRef.current;
      const held = heldRef.current;
      const noteAge = t - lastNoteAt.current;
      const noteBoost = noteAge < NOTE_BURST_DURATION
        ? 1 - easeOutCubic(noteAge / NOTE_BURST_DURATION)
        : 0;

      // ── Spring-ease the FX vector toward the joystick target. ─────────
      const target = decodeFXTarget(currentFX);
      const fxv = fxValuesRef.current;
      // Different attack/release time constants for that "lifts in, fades out"
      // feel. Attack is snappier than release.
      const attack = 14;
      const release = 5;
      for (const k of Object.keys(target) as (keyof FXValues)[]) {
        const tgt = target[k];
        const cur = fxv[k];
        const speed = Math.abs(tgt) > Math.abs(cur) ? attack : release;
        fxv[k] = cur + (tgt - cur) * Math.min(1, dtSec * speed);
      }

      // ── Activity gate — hold tracks the finger, FX residual keeps motion
      //    alive briefly even after release while the spring decays. ───
      const fxResidual =
        fxv.reverb + Math.abs(fxv.bend) + fxv.chorus + fxv.delay +
        fxv.vibrato + fxv.tremolo + fxv.release + fxv.octDown + fxv.filter;
      const isActive =
        tracks > 0 || held > 0 || noteBoost > 0.01 || fxResidual > 0.02;

      // Activity envelope — quick attack so motion starts crisply, slow
      // release so the stars coast to a halt instead of snapping frozen.
      // Tuned for ~1 s of visible deceleration, then frozen.
      const targetAct = isActive ? 1 : 0;
      const actSpeed = targetAct > activityRef.current ? 18 : 3.5;
      activityRef.current += (targetAct - activityRef.current) * Math.min(1, dtSec * actSpeed);
      const activity = activityRef.current;

      // Spawn rate scales with both what's playing AND the activity envelope,
      // so new stars taper away during the coast-down.
      let rate =
        BASE_RATE + held * HOLD_RATE + tracks * TRACK_RATE + noteBoost * 10;
      rate *= 1 + fxv.delay * 0.5 - fxv.release * 0.45;
      rate *= activity;
      spawnAcc.current += Math.max(0, rate) * dtSec;
      while (spawnAcc.current >= 1) {
        spawnStar(starsRef.current, w);
        spawnAcc.current -= 1;
      }

      // ── Render. ──────────────────────────────────────────────────────
      // Trail fading: more reverb → less clearing per frame.
      const trailAlpha = 0.92 - fxv.reverb * 0.78; // 0.92 → 0.14
      ctx.fillStyle = `rgba(10, 15, 8, ${trailAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);

      const speedScale = 1 - fxv.release * 0.55 - fxv.octDown * 0.4;
      const sideDrift = fxv.bend * 60;          // px/sec
      const wobbleAmp = fxv.vibrato * 3.5;
      const stars = starsRef.current;
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];

        // Coast-down: motion is multiplied by the activity envelope so the
        // stars visibly decelerate over ~1 s after release rather than
        // freezing the instant the gate flips.
        if (activity > 0.005) {
          s.vy = (BASE_VY + GRAVITY * Math.min(2, (t - s.bornAt) / 1000)) * speedScale;
          s.y += s.vy * dtSec * activity;
          s.x += sideDrift * dtSec * activity;
        }

        if (s.y > h + 2 || s.x < -2 || s.x > w + 2) {
          stars.splice(i, 1);
          continue;
        }

        const ageT = clamp((t - s.bornAt) / 4000, 0, 1);
        let alpha = ageT < 0.06
          ? easeOutCubic(ageT / 0.06)
          : 0.85 + 0.15 * Math.sin((t + s.phase * 1000) / 380);
        // Tremolo flicker — intensity scales with vibrato/tremolo joystick value.
        if (fxv.tremolo > 0.02) {
          const flick = 0.5 + 0.5 * Math.sin((t + s.phase * 2000) / 55);
          alpha *= 1 - fxv.tremolo * (1 - flick);
        }
        // Filter dims everything proportionally.
        alpha *= 1 - fxv.filter * 0.55;
        // Coast-down fade: stars stay at full brightness while the envelope
        // is healthy, then fade as the activity drops below ~33 %. Together
        // with the velocity scaling above this produces a graceful stop
        // animation when the finger lifts.
        alpha *= clamp(activity * 3, 0, 1);
        alpha = clamp(alpha, 0, 1);

        const wobbleX = wobbleAmp !== 0
          ? Math.sin((t / 130) + s.phase * Math.PI * 2) * wobbleAmp
          : 0;

        const drawX = Math.round(s.x + wobbleX);
        const drawY = Math.round(s.y);

        const palette = fxv.filter > 0.4 ? COLORS_DIM : COLORS_BRIGHT;
        ctx.fillStyle = withAlpha(palette[s.hue], alpha);
        ctx.fillRect(drawX, drawY, 1, 1);
        if (s.size === 2) {
          ctx.fillRect(drawX - 1, drawY, 1, 1);
          ctx.fillRect(drawX + 1, drawY, 1, 1);
          ctx.fillRect(drawX, drawY - 1, 1, 1);
          ctx.fillRect(drawX, drawY + 1, 1, 1);
        }

        // Chorus ghost intensity scales with chorus joystick value.
        if (fxv.chorus > 0.05) {
          ctx.fillStyle = withAlpha(palette[s.hue ^ 1], alpha * fxv.chorus * 0.6);
          ctx.fillRect(drawX + 2, drawY - 1, 1, 1);
          ctx.fillRect(drawX - 2, drawY + 1, 1, 1);
        }
        // Delay echo, scales with delay value.
        if (fxv.delay > 0.05) {
          ctx.fillStyle = withAlpha(palette[s.hue], alpha * fxv.delay * 0.5);
          ctx.fillRect(drawX, drawY - 3, 1, 1);
          ctx.fillRect(drawX, drawY - 6, 1, 1);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="star-field" aria-hidden="true" />;
}

function spawnStar(stars: Star[], w: number): void {
  stars.push({
    x: Math.floor(Math.random() * w),
    y: -1,
    vy: BASE_VY,
    size: Math.random() < 0.18 ? 2 : 1,
    bornAt: performance.now(),
    phase: Math.random(),
    hue: Math.random() < 0.7 ? 0 : 1,
  });
}

/**
 * Map the joystick FXLabel onto continuous 0..1 (or -1..1 for BEND) intensities.
 * Values come from parsing the label's display string — REVERB "67%" → 0.67,
 * BEND "+50¢" → +0.25, FILTER "1200Hz" → inverse based on dreamy baseline, etc.
 */
function decodeFXTarget(fx: FXLabel | null): FXValues {
  if (!fx) return { ...ZERO_FX };
  const out = { ...ZERO_FX };
  const num = parseFloat(fx.value);
  switch (fx.label) {
    case 'REVERB': {
      // value like "67%" — map above baseline to 0..1.
      const pct = (Number.isFinite(num) ? num : 0) / 100;
      out.reverb = clamp((pct - DREAMY_REVERB_BASELINE) / (1 - DREAMY_REVERB_BASELINE), 0, 1);
      break;
    }
    case 'FILTER': {
      // value like "1200Hz" — closed filter = more intense effect.
      const hz = Number.isFinite(num) ? num : DREAMY_FILTER_FREQ;
      out.filter = clamp(1 - hz / DREAMY_FILTER_FREQ, 0, 1);
      break;
    }
    case 'BEND': {
      // value like "+50¢" — ±200¢ range.
      const cents = Number.isFinite(num) ? num : 0;
      out.bend = clamp(cents / 200, -1, 1);
      break;
    }
    case 'CHORUS': {
      const pct = (Number.isFinite(num) ? num : 0) / 100;
      out.chorus = clamp(pct, 0, 1);
      break;
    }
    case 'DELAY': {
      const pct = (Number.isFinite(num) ? num : 0) / 100;
      out.delay = clamp(pct, 0, 1);
      break;
    }
    case 'VIBRATO': {
      const pct = (Number.isFinite(num) ? num : 0) / 100;
      out.vibrato = clamp(pct, 0, 1);
      break;
    }
    case 'TREMOLO': {
      // value like "8.5Hz" — map 4..20Hz → 0..1.
      const hz = Number.isFinite(num) ? num : 4;
      out.tremolo = clamp((hz - 4) / 16, 0, 1);
      break;
    }
    case 'RELEASE': {
      // value like "3.2s" — baseline 1.5s, max ~6.5s.
      const sec = Number.isFinite(num) ? num : 1.5;
      out.release = clamp((sec - 1.5) / 5, 0, 1);
      break;
    }
    case 'OCT-1': {
      out.octDown = 1;
      break;
    }
  }
  return out;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
