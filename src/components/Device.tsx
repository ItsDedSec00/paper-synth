import { Screw } from './Screw';
import { ChordZone } from './ChordZone';
import { NoteZone } from './NoteZone';
import { HeaderControls } from './HeaderControls';
import { LooperBar } from './LooperBar';
import { Display } from './Display';
import '../styles/device.css';
import '../styles/buttons.css';
import '../styles/layout.css';

export function Device() {
  return (
    <div className="device-stage">
      <div className="device-body">
        <Screw position="tl" />
        <Screw position="tr" />
        <Screw position="bl" />
        <Screw position="br" />

        <div className="device-grid">
          <header className="zone zone--header" aria-label="Encoder row">
            <HeaderControls />
          </header>
          <main className="zone zone--play">
            <section className="zone zone--chord" aria-label="Chord buttons">
              <ChordZone />
            </section>
            <section className="zone zone--display" aria-label="Display">
              <Display />
            </section>
            <section className="zone zone--note" aria-label="Note buttons">
              <NoteZone />
            </section>
          </main>
          <footer className="zone zone--looper" aria-label="Looper bar">
            <LooperBar />
          </footer>
        </div>
      </div>
    </div>
  );
}
