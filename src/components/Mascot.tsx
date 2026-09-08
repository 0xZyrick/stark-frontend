/**
 * Stark orb mascot — board-anchored coach + home/leaderboard buddy.
 */
import { useEffect, useState } from 'react';

export type MascotMood =
  | 'idle'
  | 'cheer'
  | 'clear'
  | 'fail'
  | 'nudge'
  | 'hidden';

type Props = {
  mood?: MascotMood;
  size?: number;
  className?: string;
  caption?: string;
  speech?: string | null;
  onClick?: () => void;
  floating?: boolean;
  /** Soft roll/spin when cheering combo words */
  spin?: boolean;
};

const SRC = '/images/mascot/orb.png';

export function Mascot({
  mood = 'idle',
  size = 88,
  className = '',
  caption,
  speech,
  onClick,
  floating = false,
  spin = false,
}: Props) {
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    if (mood === 'cheer' || mood === 'clear') {
      setBounce(true);
      const t = window.setTimeout(() => setBounce(false), 900);
      return () => clearTimeout(t);
    }
  }, [mood]);

  if (mood === 'hidden') return null;

  return (
    <div
      className={`mascot mascot-${mood}${bounce ? ' mascot-bounce' : ''}${
        floating ? ' mascot-float' : ''
      }${spin ? ' mascot-spin' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {speech ? (
        <div className="mascot-speech" key={speech}>
          {speech}
        </div>
      ) : null}
      <img src={SRC} alt="" draggable={false} />
      {caption ? <span className="mascot-caption">{caption}</span> : null}
    </div>
  );
}

export function MascotClearOverlay({
  show,
  onDone,
}: {
  show: boolean;
  onDone?: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => onDone?.(), 1100);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="mascot-clear-overlay" aria-hidden="true">
      <Mascot mood="clear" size={140} floating speech="All clear!" />
      <div className="mascot-clear-spark">✦ ✧ ★</div>
    </div>
  );
}

/** Cycle idle tips when not in a chain flash */
const IDLE_LINES = [
  'Merge the orbs!',
  'Plan the next drop',
  'Hold if you need',
  'Stack pairs',
  'Watch the queue',
];

export function speechForChain(chain: number): string | null {
  if (chain >= 6) return 'PERFECT!';
  if (chain >= 5) return 'EXCELLENT!';
  if (chain >= 4) return 'WONDERFUL!';
  if (chain >= 3) return 'GREAT!';
  if (chain >= 2) return 'Nice!';
  return null;
}

export function idleTip(tick: number): string {
  return IDLE_LINES[tick % IDLE_LINES.length];
}
