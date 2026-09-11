/**
 * Guest practice world → level with sequential locks.
 * First-time: only Outer L1. Clear a level → unlock next. Clear a world → unlock next world L1.
 */
import {
  CAMPAIGN,
  isGuestLevelUnlocked,
  isGuestWorldUnlocked,
  isTrialLevelUnlocked,
  type CampaignWorld,
  type CampaignLevel,
} from '../engine';
import { useState, useEffect } from 'react';

type Props = {
  show: boolean;
  onBack: () => void;
  onPlayLevel: (level: CampaignLevel) => void;
  guestLevelBest?: Record<string, number>;
  guestClearedLevels?: string[];
  /** Logged-out trial: only Outer L1–L2 */
  trialMode?: boolean;
};

export function WorldSelectPage({
  show,
  onBack,
  onPlayLevel,
  guestLevelBest = {},
  guestClearedLevels = [],
  trialMode = false,
}: Props) {
  const [world, setWorld] = useState<CampaignWorld | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const cleared = guestClearedLevels;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!show) setWorld(null);
  }, [show]);

  if (!show) return null;

  const worldList = (
    <div className="world-list">
      {CAMPAIGN.map((w) => {
        const unlocked = trialMode
          ? w.id === 'outer'
          : isGuestWorldUnlocked(w.id, cleared);
        return (
          <button
            key={w.id}
            type="button"
            className={`world-row${world?.id === w.id ? ' selected' : ''}${
              unlocked ? '' : ' locked'
            }`}
            disabled={!unlocked}
            onClick={() => unlocked && setWorld(w)}
          >
            <img className="world-row-img" src={w.iconSrc} alt="" width={40} height={40} />
            <span className="world-row-body">
              <span className="world-row-name">
                {unlocked ? w.name : `🔒 ${w.name}`}
              </span>
              <span className="world-row-tag">
                {unlocked
                  ? trialMode
                    ? 'Trial · Levels 1–2'
                    : w.tagline
                  : trialMode
                    ? 'Log in to unlock'
                    : 'Clear previous world to unlock'}
              </span>
            </span>
            <span className="world-row-meta">{w.levels.length}</span>
          </button>
        );
      })}
    </div>
  );

  const levelList = world ? (
    <div className="level-list">
      {world.levels.map((lv) => {
        const best = guestLevelBest[lv.id];
        const unlocked = trialMode
          ? isTrialLevelUnlocked(lv.id) && isGuestLevelUnlocked(lv.id, cleared)
          : isGuestLevelUnlocked(lv.id, cleared);
        const clearedLv = cleared.includes(lv.id);
        return (
          <button
            key={lv.id}
            type="button"
            className={`level-row${unlocked ? '' : ' locked'}${
              clearedLv ? ' cleared' : ''
            }`}
            disabled={!unlocked}
            onClick={() => unlocked && onPlayLevel(lv)}
          >
            <span className="level-row-num">
              {unlocked ? `L${lv.level}` : '🔒'}
            </span>
            <span className="level-row-body">
              <span className="level-row-name">{lv.name}</span>
              <span className="level-row-quest">
                {unlocked ? lv.objective.label : 'Clear previous level'}
              </span>
            </span>
            <span className="level-row-meta">
              {unlocked
                ? `${lv.cols}×${lv.rows}${
                    best != null ? ` · best ${best}` : ''
                  }${clearedLv ? ' · ✓' : ''}`
                : 'Locked'}
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={`page hub-page game-hub show`} id="worldSelectPage">
      <div className="hub-header game-hub-header">
        <button
          className="game-btn-text"
          type="button"
          onClick={() => {
            if (world) setWorld(null);
            else onBack();
          }}
        >
          ← {world ? 'Worlds' : 'Home'}
        </button>
        <div className="season-tag">GUEST PRACTICE</div>
      </div>

      <div className="hub-content guest-select">
        {isDesktop ? (
          <div className="guest-split">
            <div className="guest-split-left">
              <h1 className="select-title">Worlds</h1>
              <p className="select-sub">Clear levels in order to open the path</p>
              {worldList}
            </div>
            <div className="guest-split-right">
              {world ? (
                <>
                  <h1 className="select-title" style={{ color: world.accent }}>
                    {world.name}
                  </h1>
                  <p className="select-sub">{world.tagline}</p>
                  {levelList}
                </>
              ) : (
                <div className="levels-empty">
                  <p className="select-sub">← Select a world</p>
                </div>
              )}
            </div>
          </div>
        ) : !world ? (
          <>
            <h1 className="select-title">Choose a world</h1>
            <p className="select-sub">Progress unlocks the next floor</p>
            {worldList}
          </>
        ) : (
          <>
            <h1 className="select-title">{world.name}</h1>
            <p className="select-sub">{world.tagline}</p>
            {levelList}
          </>
        )}
      </div>
    </div>
  );
}
