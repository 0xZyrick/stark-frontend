/**
 * Hud — header + depth + quest.
 * Shape quests: visual orb counters (no progress bar).
 */
import type { RankTitle, Objective } from '../engine';
import {
  PLAYER_PORTRAIT,
  glyphFor,
  orbBackground,
  ORB_BOX_SHADOW,
  SYMBOLS,
} from '../engine';

type HudProps = {
  highScore: number;
  score: number;
  playerName: string;
  rank: RankTitle;
  depthLabel: string;
  questName: string;
  questPct: number;
  questMeta: string;
  objective?: Objective;
  shapeCounts?: Record<string, number>;
  combo: number;
  showCombo?: boolean;
  portraitSrc?: string;
};

/** Representative tile value for a glyph so orb paint matches board orbs */
function valueForSymbol(sym: string): number {
  if (sym === '👑') return 1024;
  const idx = (SYMBOLS as readonly string[]).indexOf(sym);
  if (idx >= 0) return Math.pow(2, idx + 1);
  return 4;
}

export function Hud({
  highScore,
  score,
  playerName,
  rank,
  depthLabel,
  questName,
  questPct,
  questMeta,
  objective,
  shapeCounts = {},
  combo,
  showCombo = false,
  portraitSrc = '/images/mascot/orb.png',
}: HudProps) {
  const isShapeQuest =
    objective?.type === 'shape' || objective?.type === 'shapes';
  const shapeList: string[] =
    objective?.type === 'shapes'
      ? objective.symbols || []
      : objective?.type === 'shape' && objective.symbol
        ? [objective.symbol]
        : [];
  const shapeTarget = objective?.target ?? 0;

  return (
    <>
      <div className="game-header" id="gameHeader">
        <div className="header-best-box">
          <span className="hb-lbl">Best</span>
          <span className="hb-val" id="highScoreEl">
            {highScore}
          </span>
        </div>

        <div className="player-card">
          <div className="player-portrait" id="playerPortraitWrap">
            <img
              className="player-portrait-img"
              id="playerPortraitImg"
              src={portraitSrc}
              alt=""
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="player-portrait-fallback">🙂</span>
            <span className="header-rank-badge" id="headerRankBadge" title={rank.name}>
              {rank.iconSrc ? (
                <img src={rank.iconSrc} alt={rank.name} width={18} height={18} />
              ) : (
                rank.icon
              )}
            </span>
          </div>
          <div className="player-id">
            <div className="player-name" id="playerNameEl">
              {playerName}
            </div>
            <div className="header-rank-name" id="rankPill" style={{ color: rank.color }}>
              {rank.name}
            </div>
          </div>
        </div>

        <div className="score-block">
          <div className="score" id="scoreEl">
            {score}
          </div>
          <div
            className={`combo-badge${showCombo && combo >= 2 ? ' show' : ''}`}
            id="comboBadge"
          >
            <span className="combo-x">COMBO</span>
            <span className="combo-n" id="comboBadgeN">
              x{combo}
            </span>
          </div>
        </div>
      </div>

      <div className="depth-chip" id="depthEl">
        {depthLabel}
      </div>

      <div className="quest-bar-card" id="levelBarRow">
        <div className="quest-bar-icon" id="questBarIcon">
          {isShapeQuest ? '🔮' : '📖'}
        </div>
        <div className="quest-bar-body">
          <div className="quest-bar-name" id="questBarName">
            {questName}
          </div>
          {isShapeQuest && shapeList.length > 0 ? (
            <div className="shape-counters">
              {shapeList.map((sym) => {
                const cur = shapeCounts[sym] || 0;
                const done = cur >= shapeTarget;
                const val = valueForSymbol(sym);
                return (
                  <div
                    key={sym}
                    className={`shape-counter${done ? ' done' : ''}`}
                  >
                    <div
                      className="shape-counter-orb"
                      style={{
                        background: orbBackground(val),
                        boxShadow: ORB_BOX_SHADOW,
                      }}
                    >
                      <span className="glyph">{sym === '👑' ? '👑' : sym}</span>
                    </div>
                    <div className="shape-counter-nums">
                      <b>{Math.min(cur, shapeTarget)}</b>
                      <span>/{shapeTarget}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="quest-bar-track">
                <div
                  className="quest-bar-fill"
                  id="questBarFill"
                  style={{ width: `${Math.min(100, questPct)}%` }}
                />
              </div>
              <div className="quest-bar-meta" id="questBarMeta">
                {questMeta}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
