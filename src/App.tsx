import { Device } from './components/Device';
import { Splash } from './components/Splash';
import { OrientationGate } from './components/OrientationGate';
import { useAudioEngine } from './hooks/useAudioEngine';
import { AudioProvider } from './hooks/AudioContext';

function App() {
  const audio = useAudioEngine();

  return (
    <>
      <OrientationGate />
      {audio.started ? (
        <AudioProvider value={audio}>
          <Device />
        </AudioProvider>
      ) : (
        <Splash onStart={audio.start} />
      )}
    </>
  );
}

export default App;
