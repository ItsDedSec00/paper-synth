import { useEffect, useState } from 'react';
import '../styles/orientation.css';

const ROTATE_ICON = '↻';

/**
 * Shows a full-screen "rotate to landscape" hint when the device is in
 * portrait mode on a small screen. Desktop sizes are never blocked.
 */
export function OrientationGate() {
  const [portrait, setPortrait] = useState(() => isPortraitMobile());

  useEffect(() => {
    const update = () => setPortrait(isPortraitMobile());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!portrait) return null;

  return (
    <div className="orientation-gate" role="dialog" aria-modal="true">
      <div className="orientation-gate__inner">
        <div className="orientation-gate__icon" aria-hidden="true">
          {ROTATE_ICON}
        </div>
        <div className="orientation-gate__text">PLEASE ROTATE</div>
        <div className="orientation-gate__sub">landscape only</div>
      </div>
    </div>
  );
}

function isPortraitMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const isMobile = window.innerWidth < 720;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  return isMobile && isPortrait;
}
