import { useEffect, useState } from 'react';
import {
  getLooperSnapshot,
  subscribeLooper,
  type LooperSnapshot,
} from '../audio/looper';

/**
 * Read-only subscription to looper state — for components that only need
 * to display track state without the press-handler bookkeeping.
 */
export function useLooperSnapshot(): LooperSnapshot {
  const [snap, setSnap] = useState<LooperSnapshot>(getLooperSnapshot);
  useEffect(() => subscribeLooper(() => setSnap(getLooperSnapshot())), []);
  return snap;
}

/** How many tracks are actually producing audio right now. */
export function countPlayingTracks(snap: LooperSnapshot): number {
  return snap.trackStates.filter((s) => s === 'PLAYING' || s === 'RECORDING').length;
}
