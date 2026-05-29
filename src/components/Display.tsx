import { PaperPlane } from './PaperPlane';
import { StarField } from './StarField';
import { useAudio } from '../hooks/AudioContext';
import {
  countPlayingTracks,
  useLooperSnapshot,
} from '../hooks/useLooperSnapshot';
import '../styles/display.css';

export function Display() {
  const audio = useAudio();
  const looperSnap = useLooperSnapshot();
  const activeTracks = countPlayingTracks(looperSnap);

  return (
    <div className="display">
      <StarField
        playPulse={audio.playPulse}
        fx={audio.currentFX}
        activeTracks={activeTracks}
        notesHeld={audio.heldCount}
      />
      <div className="display__scanlines" aria-hidden="true" />
      <div className="display__content">
        <div className="display__header">
          <span className="display__mode">{audio.mode}</span>
          <span className="display__tracks" aria-label={`${activeTracks} tracks`}>
            {'■'.repeat(activeTracks) + '□'.repeat(Math.max(0, 4 - activeTracks))}
          </span>
        </div>

        <div className="display__pet">
          <PaperPlane
            fx={audio.currentFX}
            active={audio.currentFX !== null || activeTracks > 0}
          />
        </div>

        <div className="display__logo">Paper</div>
      </div>
    </div>
  );
}
