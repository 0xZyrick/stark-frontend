
/**
 * Player card — craft → sealed back → click anywhere to flip + reveal sound.
 */
import { useEffect, useState } from 'react';
import { sndCardReveal, sndCardTick, sndUI } from '../audio/sound';

type Props = {
  open: boolean;
  onClose: () => void;
  playerName: string;
  rankName: string;
  rankColor: string;
  rankIcon?: string;
  mainBest: number;
  guestBest: number;
  dailyBest?: number;
  shards: number;
  sigilCount: number;
  sigilLimit: number;
  achievementCount: number;
};

/** crafting → back (tap to open) → flipping → front */
type Phase = 'crafting' | 'back' | 'flipping' | 'front';

export function PlayerCard({
  open,
  onClose,
  playerName,
  rankName,
  rankColor,
  rankIcon,
  mainBest,
  guestBest,
  dailyBest = 0,
  shards,
  sigilCount,
  sigilLimit,
  achievementCount,
}: Props) {
  const [phase, setPhase] = useState<Phase>('crafting');

  useEffect(() => {
    if (!open) {
      setPhase('crafting');
      return;
    }
    setPhase('crafting');
    sndCardTick();
    const t = window.setTimeout(() => {
      setPhase('back');
      sndCardTick();
    }, 1100);
    return () => window.clearTimeout(t);
  }, [open]);

  const reveal = () => {
    if (phase !== 'back') return;
    setPhase('flipping');
    sndCardReveal();
    window.setTimeout(() => setPhase('front'), 620);
  };

  if (!open) return null;

  return (
    <div
      className="spire-entry-overlay player-card-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sndUI();
          onClose();
        }
      }}
    >
      {phase === 'crafting' ? (
        <div className="player-card-craft">
          <img
            className="player-card-mascot mascot-card-bounce"
            src="/images/mascot/orb.png"
            alt=""
          />
          <p className="player-card-craft-text">Creating player card…</p>
          <div className="player-card-craft-bar" aria-hidden>
            <span />
          </div>
        </div>
      ) : (
        <div
          className={`player-card-flip${
            phase === 'flipping' || phase === 'front' ? ' is-flipped' : ''
          }`}
          onClick={reveal}
          role={phase === 'back' ? 'button' : undefined}
          tabIndex={phase === 'back' ? 0 : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') reveal();
          }}
        >
          <div className="player-card-flip-inner">
            {/* BACK — sealed */}
            <div className="player-card-face player-card-back">
              <div className="player-card-chroma" aria-hidden />
              <img
                className="player-card-mascot mascot-card-bounce"
                src="/images/mascot/orb.png"
                alt=""
              />
              <p className="player-card-hint">Tap to reveal</p>
            </div>

            {/* FRONT — stats */}
            <div className="player-card-face player-card-front">
              <div className="player-card-chroma" aria-hidden />
              <img
                className="player-card-mascot mascot-card-bounce"
                src="/images/mascot/orb.png"
                alt=""
              />
              <h2 className="player-card-name">{playerName}</h2>
              <div className="player-card-rank" style={{ color: rankColor }}>
                {rankIcon ? (
                  <img src={rankIcon} alt="" width={18} height={18} />
                ) : null}
                {rankName}
              </div>
              <div className="player-card-stats">
                <div>
                  <span>Main Best</span>
                  <b>{mainBest.toLocaleString()}</b>
                </div>
                <div>
                  <span>Guest Best</span>
                  <b>{guestBest.toLocaleString()}</b>
                </div>
                <div>
                  <span>Today</span>
                  <b>{dailyBest.toLocaleString()}</b>
                </div>
                <div>
                  <span>Shards</span>
                  <b>{shards}</b>
                </div>
                <div>
                  <span>Sigils</span>
                  <b>
                    {sigilCount}/{sigilLimit}
                  </b>
                </div>
                <div>
                  <span>Achievements</span>
                  <b>{achievementCount}</b>
                </div>
              </div>
              <p className="player-card-tagline">Climb the Spire · etch your name</p>
              <div className="player-card-actions">
                <button
                  type="button"
                  className="game-btn game-btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    sndUI();
                    onClose();
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
