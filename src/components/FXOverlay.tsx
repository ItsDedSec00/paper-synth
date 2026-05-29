import type { FXLabel } from '../audio/fx';

type Props = {
  fx: FXLabel | null;
  visible: boolean;
};

export function FXOverlay({ fx, visible }: Props) {
  if (!visible || !fx) return null;
  return (
    <div className="fx-overlay" role="status" aria-live="polite">
      <span className="fx-overlay__label">{fx.label}</span>
      {fx.value && <span className="fx-overlay__value">{fx.value}</span>}
    </div>
  );
}
