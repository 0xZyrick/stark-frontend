
/**
 * Shareable player card — opens from profile avatar.
 */
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
  if (!open) return null;

  const share = async () => {
    const text = `${playerName} · ${rankName}\nMain Best ${mainBest.toLocaleString()} · Guest Best ${guestBest.toLocaleString()}\nPlay STARK — climb the Spire`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'STARK', text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="spire-entry-overlay player-card-overlay" role="dialog" aria-modal="true">
      <div className="player-card-sheet">
        <div className="player-card-glow" />
        <img className="player-card-mascot" src="/images/mascot/orb.png" alt="" />
        <h2 className="player-card-name">{playerName}</h2>
        <div className="player-card-rank" style={{ color: rankColor }}>
          {rankIcon ? <img src={rankIcon} alt="" width={18} height={18} /> : null}
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
          <button type="button" className="game-btn game-btn-primary" onClick={share}>
            Share card
          </button>
          <button type="button" className="game-btn game-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
