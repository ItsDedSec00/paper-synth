import * as Tone from 'tone';
import { getEngine } from './engine';

export type TrackState = 'EMPTY' | 'WAITING' | 'RECORDING' | 'PLAYING' | 'MUTED';

export const NUM_TRACKS = 4;

type Track = {
  state: TrackState;
  player: Tone.Player | null;
  url: string | null;
};

type LooperState = {
  tracks: Track[];
  recorder: Tone.Recorder | null;
  /** Recording track index, or null if not currently recording. */
  recordingIndex: number | null;
  /** Set once Track 1 finishes recording — anchors loop length for the others. */
  loopLength: number | null;
  /** Subscribers that get the public {state, recordingIndex} snapshot. */
  listeners: Set<() => void>;
  /** Latches the async startRecording so a quick second tap can await it. */
  startPromise: Promise<void> | null;
};

const state: LooperState = {
  tracks: Array.from({ length: NUM_TRACKS }, () => ({
    state: 'EMPTY' as TrackState,
    player: null,
    url: null,
  })),
  recorder: null,
  recordingIndex: null,
  loopLength: null,
  listeners: new Set(),
  startPromise: null,
};

export type LooperSnapshot = {
  trackStates: TrackState[];
  recordingIndex: number | null;
  loopLength: number | null;
};

export function getLooperSnapshot(): LooperSnapshot {
  return {
    trackStates: state.tracks.map((t) => t.state),
    recordingIndex: state.recordingIndex,
    loopLength: state.loopLength,
  };
}

export function subscribeLooper(fn: () => void): () => void {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function notify() {
  for (const fn of state.listeners) fn();
}

function ensureRecorder(): Tone.Recorder | null {
  if (state.recorder) return state.recorder;
  const engine = getEngine();
  if (!engine) return null;
  state.recorder = new Tone.Recorder();
  // Record after the FX chain — taps in front of Destination.
  engine.recorderTap.connect(state.recorder);
  return state.recorder;
}

async function startRecording(index: number): Promise<void> {
  const rec = ensureRecorder();
  if (!rec) return;
  state.tracks[index].state = 'RECORDING';
  state.recordingIndex = index;
  notify();
  state.startPromise = rec.start().then(() => undefined);
  await state.startPromise;
}

async function stopRecording(index: number): Promise<void> {
  const rec = state.recorder;
  if (!rec) return;

  if (state.startPromise) {
    try {
      await Promise.race([
        state.startPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('startPromise timeout')), 500),
        ),
      ]);
    } catch (e) {
      console.warn('looper start did not settle in time', e);
    }
    state.startPromise = null;
  }

  let blob: Blob;
  try {
    blob = await rec.stop();
  } catch (e) {
    console.error('[looper] rec.stop failed', e);
    state.tracks[index].state = 'EMPTY';
    state.recordingIndex = null;
    notify();
    return;
  }

  const track = state.tracks[index];
  if (track.player) {
    track.player.stop();
    track.player.dispose();
  }
  if (track.url) URL.revokeObjectURL(track.url);

  // If the blob is empty (no audio captured) reset to EMPTY.
  if (blob.size < 200) {
    track.state = 'EMPTY';
    state.recordingIndex = null;
    notify();
    return;
  }

  const url = URL.createObjectURL(blob);
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = Tone.getContext();
    const audioBuffer = await (ctx.rawContext as unknown as AudioContext).decodeAudioData(
      arrayBuffer,
    );
    const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);
    const player = new Tone.Player(toneBuffer).toDestination();
    player.loop = true;
    track.player = player;
    track.url = url;

    if (index === 0) {
      state.loopLength = toneBuffer.duration;
    }
    if (state.loopLength != null) {
      player.loopEnd = state.loopLength;
    }
    player.start();
    track.state = 'PLAYING';
  } catch (e) {
    console.error('[looper] decode failed', e);
    URL.revokeObjectURL(url);
    track.state = 'EMPTY';
  }
  state.recordingIndex = null;
  notify();
}

/**
 * Toggle a track through its state machine.
 * EMPTY → RECORDING (or WAITING if track 0 is the one anchoring loopLength)
 * RECORDING → PLAYING (and bakes the buffer)
 * PLAYING → MUTED, MUTED → PLAYING
 */
export async function toggleTrack(index: number): Promise<void> {
  const track = state.tracks[index];
  switch (track.state) {
    case 'EMPTY':
      await startRecording(index);
      return;

    case 'RECORDING':
      await stopRecording(index);
      return;

    case 'PLAYING':
      if (track.player) track.player.mute = true;
      track.state = 'MUTED';
      notify();
      return;

    case 'MUTED':
      if (track.player) track.player.mute = false;
      track.state = 'PLAYING';
      notify();
      return;

    case 'WAITING':
      // No-op for now — Phase 7 keeps state minimal.
      return;
  }
}

/** Long-press → clear a single track. */
export function clearTrack(index: number): void {
  const track = state.tracks[index];
  if (track.player) {
    track.player.stop();
    track.player.dispose();
    track.player = null;
  }
  if (track.url) {
    URL.revokeObjectURL(track.url);
    track.url = null;
  }
  track.state = 'EMPTY';
  // Track 1 stop → all tracks clear (spec).
  if (index === 0) {
    state.loopLength = null;
    for (let i = 1; i < state.tracks.length; i++) clearTrack(i);
  }
  notify();
}
