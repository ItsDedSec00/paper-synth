# Paper Mini Synth

Pocket-Synthesizer PWA — visuell inspiriert vom **Gamma Mini Synth** (this.is.NOISE inc.),
mit HiChord-artigem 4-Track-Looper, OLED-Phosphor-Display und einem lebenden Pixel-Pet.

Primär für Landscape-Mobile gebaut, läuft aber auch auf Desktop.

## Stack

- React 19 + TypeScript
- Vite 8
- Tone.js 15 (Audio-Engine + Looper)
- vite-plugin-pwa (installierbar, fullscreen, landscape)

## Develop

```sh
pnpm install
pnpm dev
```

Öffne den ausgegebenen `http://localhost:5173/` Link. Auf dem Smartphone gleiche IP
über die Network-URL.

## Build & Preview

```sh
pnpm build
pnpm preview
```

## Install (Android)

1. Im Chrome auf dem Smartphone öffnen
2. Menü → „App installieren" / „Zum Startbildschirm hinzufügen"
3. Beim Start aus dem Startbildschirm läuft sie Fullscreen-Landscape

## Bedienung

- **TOUCH TO START** beim ersten Laden (Browser-AudioContext)
- **Linke Hand:** 7 Chord-Buttons der aktuellen Tonart (I–VII)
- **Rechte Hand:** 7 Noten-Buttons (1–7)
- **Drag-Joystick** auf jedem Button:
  - **Chord** ↑ Reverb, ↓ Filter, → maj7/dom7/add9, ← min/dim
  - **Note** ↑ Vibrato, ↓ Oktave-1, → Release, ← Tremolo
- **Header-Encoder** KEY / OCT / WAVE / MODE
- **Looper** 4 Tracks: Tap = Record/Play/Mute, Long-Press = Clear,
  Track 1 setzt die Loop-Länge für alle anderen

## Stack-Notes

- Audio-Engine lebt als Singleton in `src/audio/engine.ts` (Tone.js Objekte sind
  mutable und überleben React-Renders)
- Chord-Logik komplett datengetrieben in `src/audio/chords.ts` — 12 Dur-Tonarten,
  9 Voicings, Drag-→-Voicing-Resolver
- Pet-State-Machine in `src/hooks/useGotchi.ts`, gerendert via Canvas in
  `src/components/GammaGotchi.tsx`
- Looper als modulares State-System in `src/audio/looper.ts` mit Subscribe-Pattern
  Richtung React
