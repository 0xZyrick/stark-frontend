/**
 * Home — identity header, scores, CTAs, main-only leaderboard.
 */
import { useState } from 'react';
import type { RankTitle } from '../engine';
import { CAMPAIGN } from '../engine';
import { Mascot } from '../components/Mascot';

export type LeaderboardRow = {
  name: string;
  worldId: string;
  rating: number;
  score: number;
  rank?: number;
  isYou?: boolean;
};

type HomePageProps = {
  show: boolean;
  playerName: string;
  rank: RankTitle;
  mainHighScore: number;
  guestHighScore: number;
  shards: number;
  achievementCount?: number;
  sigilCount?: number;
  sigilLimit?: number;
  leaderboard?: LeaderboardRow[];
  onEnterSpire?: () => void;
  walletShort?: string | null;
  walletBalance?: string | null;
  onCopyWallet?: () => void;
  onLogout?: () => void;
  walletAddress?: string | null;
  spireBusy?: boolean;
  spireError?: string | null;
  onGuest: () => void;
  onAchievements?: () => void;
  onSigils?: () => void;
};

function worldMeta(id: string) {
  return CAMPAIGN.find((w) => w.id === id);
}

export function HomePage({
  show,
  playerName,
  rank,
  mainHighScore,
  guestHighScore,
  shards,
  achievementCount = 0,
  sigilCount = 0,
  sigilLimit = 6,
  leaderboard = [],
  onEnterSpire,
  walletShort,
  walletBalance,
  onCopyWallet,
  onLogout,
  walletAddress,
  spireBusy,
  spireError,
  onGuest,
  onAchievements,
  onSigils,
}: HomePageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`page hub-page game-hub${show ? ' show' : ''}`} id="homePage">
      <div className="hub-header game-hub-header home-topbar">
        <div className="hub-player-chip">
          <img
            className="hub-avatar"
            src="/images/mascot/orb.png"
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div>
            <div className="hub-player-name">{playerName}</div>
            <div className="hub-rank" style={{ color: rank.color }}>
              {rank.iconSrc ? (
                <img src={rank.iconSrc} alt="" width={14} height={14} />
              ) : (
                rank.icon
              )}{' '}
              {rank.name}
            </div>
          </div>
        </div>
        <div className="home-header-right">
          <div className="hub-currency game-currency">
            <span className="gem">◆</span>
            <span>{shards}</span>
          </div>
        </div>
      </div>

      <div className="hub-content game-hub-content">
        <div className="home-hero-card game-panel home-main-card">
          <div className="score-tracks">
            <div className="score-track score-track-main">
              <div className="st-label">⚔️ Main Best</div>
              <div className="st-value">{mainHighScore.toLocaleString()}</div>
              <div className="st-hint">Leaderboard · beat others</div>
            </div>
            <div className="score-track score-track-guest">
              <div className="st-label">🧭 Guest Best</div>
              <div className="st-value">{guestHighScore.toLocaleString()}</div>
              <div className="st-hint">Practice · beat yourself</div>
            </div>
          </div>

          <div className="home-stats game-stat-row">
            <div className="home-stat" onClick={onSigils} role="button" tabIndex={0}>
              <span className="home-stat-ic">✦</span>
              <span className="home-stat-lbl">Sigils</span>
              <b>
                {sigilCount}/{sigilLimit}
              </b>
            </div>
            <div
              className="home-stat"
              onClick={onAchievements}
              role="button"
              tabIndex={0}
            >
              <span className="home-stat-ic">🏅</span>
              <span className="home-stat-lbl">Achv</span>
              <b>{achievementCount}</b>
            </div>
          </div>

          <div className="home-cta-block">
            <button
              className="game-btn game-btn-primary"
              type="button"
              onClick={onEnterSpire}
            >
              Enter the Spire
              <span className="game-btn-sub">~gas · ranked</span>
            </button>
            <button className="game-btn game-btn-secondary" type="button" onClick={onGuest}>
              Guest Mode
              <span className="game-btn-sub">Free to play</span>
            </button>
          </div>
        </div>

        <div className="home-account-under-lb">
          {walletShort ? (
            <>
              <div className="acct-row">
                <button
                  type="button"
                  className="wallet-chip acct-chip"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span className="wallet-chip-dot" />
                  <span>{walletShort}</span>
                  <span className="wallet-chip-caret">▾</span>
                </button>
                <span className="acct-balance">{walletBalance ?? '…'}</span>
              </div>


        <div className="home-lb-card game-panel" style={{ marginTop: 14 }}>
          <div className="home-lb-header">
            <span className="home-lb-title">Leaderboard</span>
            <span className="st-hint">Main Best only</span>
          </div>
          <div className="lb-rows">
            {leaderboard.map((row, i) => {
              const w = worldMeta(row.worldId);
              const isYou = row.isYou;
              return (
                <div
                  key={`${row.name}-${i}`}
                  className={`lb-row${isYou ? ' lb-you' : ''}`}
                >
                  <span className="lb-pos">#{row.rank ?? i + 1}</span>
                  <span className="lb-name">
                    {row.name}
                    {isYou ? ' · you' : ''}
                  </span>
                  <span className="lb-world">
                    {w?.iconSrc ? (
                      <img src={w.iconSrc} alt={w.name} width={22} height={22} />
                    ) : (
                      w?.name?.[0] || '?'
                    )}
                  </span>
                  <span className="lb-rating">{row.rating.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          {leaderboard.length === 0 && (
            <div className="lb-locked-hint">
              No ranked runs yet — settle a Spire run on-chain to appear here
            </div>
          )}
          <div className="home-lb-mascot">
            <Mascot
              mood={mainHighScore <= 0 ? 'nudge' : 'idle'}
              size={64}
              speech={
                mainHighScore <= 0
                  ? 'Climb the Spire!'
                  : 'See you on the board'
              }
            />
          </div>
        </div>
              {menuOpen && (
                <div className="wallet-menu wallet-menu-inline">
                  <button
                    type="button"
                    className="wallet-menu-item"
                    onClick={() => {
                      onCopyWallet?.();
                      setMenuOpen(false);
                    }}
                  >
                    Copy address
                  </button>
                  <button
                    type="button"
                    className="wallet-menu-item wallet-menu-logout"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout?.();
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
              {spireError && <p className="spire-inline-error">{spireError}</p>}
            </>
          ) : (
            <p className="acct-hint">Log in to get a game wallet</p>
          )}
        </div>

      </div>
    </div>
  );
}
