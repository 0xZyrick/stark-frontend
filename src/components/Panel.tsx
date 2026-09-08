/**
 * Generic overlay panel shell — matches legacy .overlay > .panel structure.
 * Specific overlays (pause, game-over, depth-clear, etc.) will compose this.
 */
import type { ReactNode } from 'react';

type PanelProps = {
  id?: string;
  open: boolean;
  win?: boolean;
  children: ReactNode;
  maxWidth?: number | string;
};

export function Panel({ id, open, win, children, maxWidth }: PanelProps) {
  return (
    <div
      className={`overlay${open ? ' show' : ''}`}
      id={id}
      aria-hidden={!open}
    >
      <div
        className={`panel${win ? ' win' : ''}`}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
