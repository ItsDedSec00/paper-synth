type Props = {
  position: 'tl' | 'tr' | 'bl' | 'br';
};

export function Screw({ position }: Props) {
  return <div className={`screw screw--${position}`} aria-hidden="true" />;
}
