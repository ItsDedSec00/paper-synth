import { useEffect, useRef } from 'react';
import type { FXLabel } from '../audio/fx';

/**
 * Monochrome LCD paper-plane sprite — two phosphor greens, no outline.
 * Silhouette is the iconic "send" arrowhead: a triangle pointing up with a
 * V-notch cut into its base so the two wing tips read at the bottom corners,
 * plus a darker fold line down the centre.
 */

const SIZE = 32;
const PIXEL = 3;

// Strict LCD-style palette — only two brightnesses of the same green.
const PAL: Record<string, string | null> = {
  '.': null,
  X: '#c8ffc8', // bright phosphor — wing surface
  d: '#3a6a3a', // dim phosphor — fold shadow
};

// 25×25 sprite, centred in 32×32 canvas at offset (3, 3).
// Iconic send-arrow paper-plane silhouette:
//   • sharp 1-px apex
//   • gradually widening leading edges
//   • shoulder (widest of the solid body) before the V-notch
//   • V-notch cut into the bottom with the two wing tips at the corners
//   • central fold (d) from apex to the top of the notch
const SPRITE: string[] = [
  '............X............', //  0  apex
  '............X............', //  1
  '...........XdX...........', //  2  fold starts
  '...........XdX...........', //  3
  '..........XXdXX..........', //  4
  '..........XXdXX..........', //  5
  '.........XXXdXXX.........', //  6
  '.........XXXdXXX.........', //  7
  '........XXXXdXXXX........', //  8
  '........XXXXdXXXX........', //  9
  '.......XXXXXdXXXXX.......', // 10
  '.......XXXXXdXXXXX.......', // 11
  '......XXXXXXdXXXXXX......', // 12
  '......XXXXXXdXXXXXX......', // 13
  '.....XXXXXXXdXXXXXXX.....', // 14
  '.....XXXXXXXdXXXXXXX.....', // 15  shoulder — last solid row, top of notch
  '....XXXXXXX...XXXXXXX....', // 16  notch begins
  '....XXXXXX.....XXXXXX....', // 17
  '...XXXXXX.......XXXXXX...', // 18
  '...XXXX...........XXXX...', // 19
  '..XXXX.............XXXX..', // 20
  '..XXX...............XXX..', // 21
  '.XXX.................XXX.', // 22
  '.X.....................X.', // 23
  'X.......................X', // 24  wing tips at the corners
];

type Props = {
  fx: FXLabel | null;
  active: boolean;
};

export function PaperPlane({ fx, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tiltRef = useRef(0);
  const liftRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const start = performance.now();
    let last = start;

    const tick = (t: number) => {
      const dt = Math.min(50, t - last) / 1000;
      last = t;

      let targetTilt = 0;
      let targetLift = 0;
      if (fx) {
        if (fx.label === 'BEND') {
          const cents = parseInt(fx.value, 10) || 0;
          targetTilt = (cents / 200) * 0.4;
        }
        if (fx.label === 'REVERB') {
          const wet = parseInt(fx.value, 10) || 0;
          targetLift = -(wet - 55) * 0.05;
        }
        if (fx.label === 'FILTER') {
          targetLift = 1.5;
        }
      }
      tiltRef.current += (targetTilt - tiltRef.current) * Math.min(1, dt * 6);
      liftRef.current += (targetLift - liftRef.current) * Math.min(1, dt * 7);

      const bob = Math.sin((t - start) / 700) * (active ? 0.9 : 0.4);

      drawPlane(ctx, tiltRef.current, liftRef.current + bob);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fx, active]);

  return (
    <canvas
      ref={canvasRef}
      className="paper-plane"
      width={SIZE}
      height={SIZE}
      style={{ width: SIZE * PIXEL, height: SIZE * PIXEL }}
      aria-label="paper plane"
    />
  );
}

function drawPlane(ctx: CanvasRenderingContext2D, tilt: number, liftPx: number) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  const liftPxSnap = Math.round(liftPx);

  // 25×25 sprite at offset (3, 3) → centre lands at canvas (15, 15).
  ctx.save();
  ctx.translate(15, 15 + liftPxSnap);
  ctx.rotate(tilt);
  ctx.translate(-15, -15);

  const offX = 3;
  const offY = 3;

  for (let y = 0; y < SPRITE.length; y++) {
    const row = SPRITE[y];
    for (let x = 0; x < row.length; x++) {
      const color = PAL[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(offX + x, offY + y, 1, 1);
    }
  }
  ctx.restore();
}
