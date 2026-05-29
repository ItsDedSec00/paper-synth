import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/variables.css';
import './styles/global.css';
import App from './App.tsx';

// PWA: attempt to lock landscape on supported platforms (Android Chrome in
// fullscreen). iOS Safari ignores this — covered by the OrientationGate.
function tryLockLandscape() {
  const orient = (screen as Screen & { orientation?: ScreenOrientation }).orientation;
  if (orient && 'lock' in orient && typeof orient.lock === 'function') {
    (orient.lock as (o: string) => Promise<void>)('landscape').catch(() => {
      /* expected on iOS / non-fullscreen — ignore */
    });
  }
}

// Lock after the first user gesture (some browsers require it).
window.addEventListener('pointerdown', tryLockLandscape, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
