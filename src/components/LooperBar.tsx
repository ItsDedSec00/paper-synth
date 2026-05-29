import { KeyButton } from './Button';
import { useAudio } from '../hooks/AudioContext';
import { useLooper } from '../hooks/useLooper';
import { PLAY_MODES } from '../audio/types';
import '../styles/looper.css';

export function LooperBar() {
  const audio = useAudio();
  const looper = useLooper();

  return (
    <div className="looper-bar">
      <div className="looper-bar__tracks">
        {[0, 1, 2, 3].map((i) => {
          const state = looper.trackStates[i];
          const stateClass = `track--${state.toLowerCase()}`;
          return (
            <button
              key={i}
              type="button"
              className={`btn btn--track ${stateClass}`}
              onPointerDown={() => looper.onTrackPointerDown(i)}
              onPointerUp={() => looper.onTrackPointerUp(i)}
              onPointerCancel={() => looper.onTrackPointerUp(i)}
              aria-label={`Track ${i + 1}: ${state}`}
            >
              <span className="btn__label">T{i + 1}</span>
              <span className="track__dot" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="looper-bar__bpm">
        <span className="looper-bar__bpm-value">120</span>
        <span className="looper-bar__bpm-unit">BPM</span>
      </div>

      <div className="looper-bar__modes">
        {PLAY_MODES.map((m) => (
          <KeyButton
            key={m}
            label={m}
            variant="encoder"
            active={audio.mode === m}
            onClick={() => audio.setMode(m)}
          />
        ))}
      </div>
    </div>
  );
}
