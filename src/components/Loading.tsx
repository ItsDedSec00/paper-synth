import '../styles/loading.css';

const LOGO = String.raw`
 ██████╗   █████╗
 ██╔══██╗ ██╔══██╗
 ██████╔╝ ███████║
 ██╔═══╝  ██╔══██║
 ██║      ██║  ██║
 ╚═╝      ╚═╝  ╚═╝
`;

/**
 * Non-interactive loading overlay. Renders on top of the device for a
 * short moment after mount, then auto-fades. No tap-to-start gate — the
 * audio context is unlocked lazily on the first chord/note touch.
 */
export function Loading() {
  return (
    <div className="loading" aria-hidden="true">
      <div className="loading__scanlines" />
      <div className="loading__content">
        <pre className="loading__logo">{LOGO}</pre>
        <div className="loading__sub">paper mini synth&nbsp;&nbsp;v0.1</div>
        <div className="loading__bar">
          <div className="loading__bar-fill" />
        </div>
      </div>
    </div>
  );
}
