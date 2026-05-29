import { KeyButton } from './Button';
import { useAudio } from '../hooks/AudioContext';
import {
  KEYS,
  WAVE_TYPES,
  PLAY_MODES,
  type Key,
  type Octave,
  type WaveType,
  type PlayMode,
} from '../audio/types';

const WAVE_TAG: Record<WaveType, string> = {
  triangle: 'TRI',
  sine: 'SIN',
  sawtooth: 'SAW',
  square: 'SQR',
};

function cycle<T>(arr: readonly T[], current: T): T {
  const i = arr.indexOf(current);
  return arr[(i + 1) % arr.length];
}

const NEXT_OCT: Record<Octave, Octave> = { [-1]: 0, 0: 1, 1: -1 };

export function HeaderControls() {
  const audio = useAudio();

  return (
    <div className="header-controls">
      <div className="header-controls__group header-controls__group--left">
        <KeyButton
          label={audio.key}
          sublabel="KEY"
          variant="encoder"
          onClick={() => audio.setKey(cycle<Key>(KEYS, audio.key))}
        />
        <KeyButton
          label={audio.octave === 0 ? '0' : audio.octave > 0 ? '+1' : '-1'}
          sublabel="OCT"
          variant="encoder"
          active={audio.octave !== 0}
          onClick={() => audio.setOctave(NEXT_OCT[audio.octave])}
        />
      </div>

      <div className="header-controls__spacer" aria-hidden="true" />

      <div className="header-controls__group header-controls__group--right">
        <KeyButton
          label={WAVE_TAG[audio.wave]}
          sublabel="WAVE"
          variant="encoder"
          onClick={() => audio.setWave(cycle<WaveType>(WAVE_TYPES, audio.wave))}
        />
        <KeyButton
          label={audio.mode}
          sublabel="MODE"
          variant="encoder"
          onClick={() => audio.setMode(cycle<PlayMode>(PLAY_MODES, audio.mode))}
        />
      </div>
    </div>
  );
}
