import { useEffect, useState } from 'react';
import '../styles/splash.css';

type Props = {
  onStart: () => void | Promise<void>;
};

const LOGO = String.raw`
 ██████╗   █████╗
 ██╔══██╗ ██╔══██╗
 ██████╔╝ ███████║
 ██╔═══╝  ██╔══██║
 ██║      ██║  ██║
 ╚═╝      ╚═╝  ╚═╝
`;

export function Splash({ onStart }: Props) {
  const [pending, setPending] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor on the prompt
  useEffect(() => {
    const id = window.setInterval(() => setShowCursor((v) => !v), 530);
    return () => window.clearInterval(id);
  }, []);

  const handleStart = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onStart();
    } catch (err) {
      console.error('Failed to start audio context', err);
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className="splash"
      onPointerDown={handleStart}
      aria-label="Touch to start"
    >
      <div className="splash__scanlines" aria-hidden="true" />
      <div className="splash__content">
        <pre className="splash__logo" aria-hidden="true">
          {LOGO}
        </pre>
        <div className="splash__sub">paper mini synth&nbsp;&nbsp;v0.1</div>
        <div className="splash__prompt">
          [ {pending ? 'STARTING' : 'TOUCH TO START'}
          <span
            className="splash__cursor"
            style={{ opacity: showCursor ? 1 : 0 }}
          >
            _
          </span>
          ]
        </div>
      </div>
    </button>
  );
}
