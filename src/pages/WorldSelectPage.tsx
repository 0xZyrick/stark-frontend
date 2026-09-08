/**
 * Guest practice world → level.
 * Mobile: sequential. Desktop: worlds left; levels right only after a world is clicked.
 */
import { CAMPAIGN, type CampaignWorld, type CampaignLevel } from '../engine';
import { useState, useEffect } from 'react';

type Props = {
  show: boolean;
  onBack: () => void;
  onPlayLevel: (level: CampaignLevel) => void;
  guestLevelBest?: Record<string, number>;
};

export function WorldSelectPage({
  show,
  onBack,
  onPlayLevel,
  guestLevelBest = {},
}: Props) {
  const [world, setWorld] = useState<CampaignWorld | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

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
      {CAMPAIGN.map((w) => (
        <button
          key={w.id}
          type="button"
          className={`world-row${world?.id === w.id ? ' selected' : ''}`}
          onClick={() => setWorld(w)}
        >
          <img className="world-row-img" src={w.iconSrc} alt="" width={40} height={40} />
          <span className="world-row-body">
            <span className="world-row-name">{w.name}</span>
            <span className="world-row-tag">{w.tagline}</span>
          </span>
          <span className="world-row-meta">{w.levels.length}</span>
        </button>
      ))}
    </div>
  );

  const levelList = world ? (
    <div className="level-list">
      {world.levels.map((lv) => {
        const best = guestLevelBest[lv.id];
        return (
          <button
            key={lv.id}
            type="button"
            className="level-row"
            onClick={() => onPlayLevel(lv)}
          >
            <span className="level-row-num">L{lv.level}</span>
            <span className="level-row-body">
              <span className="level-row-name">{lv.name}</span>
              <span className="level-row-quest">{lv.objective.label}</span>
            </span>
            <span className="level-row-meta">
              {lv.cols}×{lv.rows}
              {best != null ? ` · best ${best}` : ''}
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
              <p className="select-sub">Pick a world to see its levels</p>
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
            <p className="select-sub">Offline only · beat your own best</p>
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
