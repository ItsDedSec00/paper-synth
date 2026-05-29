import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  sublabel?: string;
  active?: boolean;
  held?: boolean;
  variant?: 'keycap' | 'encoder' | 'track';
  children?: ReactNode;
};

export const KeyButton = forwardRef<HTMLButtonElement, Props>(function KeyButton(
  {
    label,
    sublabel,
    active = false,
    held = false,
    variant = 'keycap',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    'btn',
    `btn--${variant}`,
    active ? 'btn--active' : '',
    held ? 'btn--held' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type="button" className={classes} {...rest}>
      <span className="btn__label">{label}</span>
      {sublabel && <span className="btn__sublabel">{sublabel}</span>}
      {children}
    </button>
  );
});
