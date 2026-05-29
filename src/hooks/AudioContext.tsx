import { createContext, useContext, type ReactNode } from 'react';
import type { AudioEngineState } from './useAudioEngine';

const Ctx = createContext<AudioEngineState | null>(null);

export function AudioProvider({
  value,
  children,
}: {
  value: AudioEngineState;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioEngineState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio must be used inside <AudioProvider>');
  return v;
}
