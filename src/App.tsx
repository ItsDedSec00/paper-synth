import { Device } from './components/Device';
import { Loading } from './components/Loading';
import { OrientationGate } from './components/OrientationGate';
import { useAudioEngine } from './hooks/useAudioEngine';
import { AudioProvider } from './hooks/AudioContext';

function App() {
  const audio = useAudioEngine();

  return (
    <>
      <OrientationGate />
      <AudioProvider value={audio}>
        <Device />
      </AudioProvider>
      <Loading />
    </>
  );
}

export default App;
