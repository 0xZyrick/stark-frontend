/** Short descent into the Spire wing */
import { useEffect } from 'react';

type Props = {
  onDone: () => void;
};

export function SpireEntry({ onDone }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1800);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="spire-entry-anim" aria-live="polite">
      <div className="spire-entry-shaft" />
      <div className="spire-entry-glow" />
      <div className="spire-entry-copy">
        <div className="spire-entry-kicker">Under the compound</div>
        <div className="spire-entry-title">Spire</div>
      </div>
    </div>
  );
}
