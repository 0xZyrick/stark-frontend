
/**
 * Player card with a calm staged reveal — soft sound trail, no heavy flash.
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

type Step = 0 | 1 | 2 | 3 | 4;

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
  const [step, setStep] = useState<Step>(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }
    setStep(0);
    sndCardReveal();
    const t1 = window.setTimeout(() => {
      setStep(1);
      sndCardTick();
    }, 280);
    const t2 = window.setTimeout(() => {
      setStep(2);
      sndCardTick();
    }, 560);
    const t3 = window.setTimeout(() => {
      setStep(3);
      sndCardTick();
    }, 900);
    const t4 = window.setTimeout(() => setStep(4), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="spire-entry-overlay player-card-overlay player-card-reveal"
      role="dialog"
      aria-modal="true"
    >
      <div className={`player-card-sheet pc-step-${step}`}>
        <div className="player-card-trail" aria-hidden />
        <div className="player-card-glow" />

        <div className={`pc-layer pc-mascot-layer${step >= 0 ? ' pc-in' : ''}`}>
          <img
            className="player-card-mascot mascot-card-bounce"
            src="/images/mascot/orb.png"
            alt=""
          />
        </div>

        <div className={`pc-layer pc-identity${step >= 1 ? ' pc-in' : ''}`}>
          <h2 className="player-card-name">{playerName}</h2>
          <div className="player-card-rank" style={{ color: rankColor }}>
            {rankIcon ? <img src={rankIcon} alt="" width={18} height={18} /> : null}
            {rankName}
          </div>
        </div>

        <div className={`pc-layer pc-stats-layer${step >= 2 ? ' pc-in' : ''}`}>
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
        </div>

        <div className={`pc-layer pc-footer-layer${step >= 3 ? ' pc-in' : ''}`}>
          <p className="player-card-tagline">Climb the Spire · etch your name</p>
        </div>

        <div className={`pc-layer pc-actions-layer${step >= 4 ? ' pc-in' : ''}`}>
          <div className="player-card-actions">
            <button
              type="button"
              className="game-btn game-btn-secondary"
              onClick={() => {
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
  );
}
