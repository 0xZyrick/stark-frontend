/**
 * Hands-on coach marks — first run tutorial (mascot on the bubble edge).
 */
import { useEffect, useState } from 'react';
import { Mascot } from './Mascot';

type Step = {
  target: string;
  text: string;
  action: 'next' | 'click' | 'finish';
};

const STEPS: Step[] = [
  {
    target: '#boardWrap',
    text: 'Tap a column to drop your orb. Give it a try — tap any column now.',
    action: 'click',
  },
  {
    target: '.loaded-lane',
    text: 'This is Loaded — the orb about to drop.',
    action: 'next',
  },
  {
    target: '.next-lane',
    text: 'Next shows what’s coming after Loaded, so you can plan merges.',
    action: 'next',
  },
  {
    target: '#heldLane',
    text: 'Hold parks the Loaded orb for later. Tap Hold to try it.',
    action: 'click',
  },
  {
    target: '#undoLane',
    text: 'Undo reverts your last drop — limited uses per run.',
    action: 'next',
  },
  {
    target: '#levelBarRow',
    text: 'This is your quest for this run — fill it to clear the level.',
    action: 'finish',
  },
];

type Props = {
  active: boolean;
  onDone: () => void;
};

export function Tutorial({ active, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [spot, setSpot] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!active) return;
    const step = STEPS[idx];
    if (!step) {
      onDone();
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setIdx((i) => i + 1);
      return;
    }
    const r = el.getBoundingClientRect();
    setSpot({
      top: r.top - 8,
      left: r.left - 8,
      width: r.width + 16,
      height: r.height + 16,
    });
  }, [active, idx, onDone]);

  useEffect(() => {
    if (!active) return;
    const step = STEPS[idx];
    if (!step || step.action !== 'click') return;
    const handler = (e: Event) => {
      const el = document.querySelector(step.target);
      if (el && e.target instanceof Node && el.contains(e.target)) {
        setIdx((i) => i + 1);
      }
    };
    document.addEventListener('pointerup', handler, true);
    return () => document.removeEventListener('pointerup', handler, true);
  }, [active, idx]);

  if (!active) return null;
  const step = STEPS[idx];
  if (!step) return null;

  const next = () => {
    if (step.action === 'finish' || idx >= STEPS.length - 1) onDone();
    else setIdx((i) => i + 1);
  };

  return (
    <div className="coach-overlay" id="coachOverlay">
      <div
        className="coach-spot"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
        }}
      />
      <div
        className="coach-bubble coach-bubble-mascot"
        style={{
          position: 'fixed',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -50%)',
          bottom: 'auto',
          zIndex: 13001,
          width: 'min(92vw, 360px)',
        }}
      >
        <div className="coach-mascot-edge">
          <Mascot mood="idle" size={56} speech={null} />
        </div>
        <p>{step.text}</p>
        <div className="coach-actions">
          <button type="button" className="game-btn-text" onClick={onDone}>
            Skip
          </button>
          {step.action !== 'click' && (
            <button
              type="button"
              className="game-btn game-btn-secondary"
              onClick={next}
            >
              {step.action === 'finish' ? 'Got it' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
