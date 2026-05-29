import { useCallback, useEffect, useState } from 'react';
import {
  clearTrack as engineClearTrack,
  getLooperSnapshot,
  subscribeLooper,
  toggleTrack as engineToggleTrack,
  type LooperSnapshot,
  type TrackState,
} from '../audio/looper';

const LONG_PRESS_MS = 500;

export type LooperHook = {
  trackStates: TrackState[];
  recordingIndex: number | null;
  loopLength: number | null;
  onTrackPointerDown: (index: number) => void;
  onTrackPointerUp: (index: number) => void;
};

export function useLooper(): LooperHook {
  const [snapshot, setSnapshot] = useState<LooperSnapshot>(getLooperSnapshot);

  useEffect(() => {
    return subscribeLooper(() => setSnapshot(getLooperSnapshot()));
  }, []);

  // Long-press tracking
  const [pressTimers, setPressTimers] = useState<Map<number, number>>(new Map());
  const [longPressed, setLongPressed] = useState<Set<number>>(new Set());

  const onTrackPointerDown = useCallback((index: number) => {
    const timerId = window.setTimeout(() => {
      engineClearTrack(index);
      setLongPressed((prev) => new Set(prev).add(index));
    }, LONG_PRESS_MS);
    setPressTimers((prev) => {
      const next = new Map(prev);
      next.set(index, timerId);
      return next;
    });
  }, []);

  const onTrackPointerUp = useCallback(
    (index: number) => {
      // Cancel the long-press timer
      const timer = pressTimers.get(index);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        setPressTimers((prev) => {
          const next = new Map(prev);
          next.delete(index);
          return next;
        });
      }

      // If long-press already fired we already cleared; skip the toggle.
      if (longPressed.has(index)) {
        setLongPressed((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        return;
      }

      engineToggleTrack(index).catch((err) => {
        console.error('toggleTrack failed', err);
      });
    },
    [pressTimers, longPressed],
  );

  return {
    trackStates: snapshot.trackStates,
    recordingIndex: snapshot.recordingIndex,
    loopLength: snapshot.loopLength,
    onTrackPointerDown,
    onTrackPointerUp,
  };
}
