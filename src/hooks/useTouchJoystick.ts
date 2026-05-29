import { useCallback, useRef, useState, type PointerEvent } from 'react';

const THRESHOLD = 8; // px — ignore micro-jitter

export type JoystickDelta = {
  x: number;
  y: number;
  dist: number;
};

export type JoystickHandlers = {
  held: boolean;
  delta: JoystickDelta;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (e: PointerEvent<HTMLButtonElement>) => void;
};

type Callbacks = {
  onDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onMove?: (delta: JoystickDelta, e: PointerEvent<HTMLButtonElement>) => void;
  onUp?: (e: PointerEvent<HTMLButtonElement>) => void;
};

/**
 * Turns any button into a touch-joystick.
 * Reports {x, y, dist} relative to where the press started.
 * Threshold filters micro-jitter so a clean tap doesn't trigger FX.
 */
export function useTouchJoystick(cb: Callbacks): JoystickHandlers {
  const [held, setHeld] = useState(false);
  const [delta, setDelta] = useState<JoystickDelta>({ x: 0, y: 0, dist: 0 });
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      setHeld(true);
      setDelta({ x: 0, y: 0, dist: 0 });
      cb.onDown?.(e);
    },
    [cb],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < THRESHOLD) {
        if (delta.dist !== 0) setDelta({ x: 0, y: 0, dist: 0 });
        return;
      }
      const d: JoystickDelta = { x: dx, y: dy, dist };
      setDelta(d);
      cb.onMove?.(d, e);
    },
    [cb, delta.dist],
  );

  const endPointer = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      e.preventDefault();
      start.current = null;
      setHeld(false);
      setDelta({ x: 0, y: 0, dist: 0 });
      cb.onUp?.(e);
    },
    [cb],
  );

  return {
    held,
    delta,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    onPointerLeave: endPointer,
  };
}
