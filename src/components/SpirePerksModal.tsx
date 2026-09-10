
/**
 * Spire Mode intro — perks, cost, proceed or back.
 * Proceed later triggers wallet; for now can stay disabled / coming soon.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  onProceed?: () => void;
  canProceed?: boolean;
  costLabel?: string;
};

export function SpirePerksModal({
  open,
  onClose,
  onProceed,
  canProceed = false,
  costLabel = 'Network gas (your wallet)',
}: Props) {
  if (!open) return null;

  return (
    <div className="spire-entry-overlay" role="dialog" aria-modal="true">
      <div className="spire-entry-card spire-perks-card">
        <h2 className="spire-entry-title">Spire Mode</h2>
        <p className="spire-entry-body">
          Ranked climbs that can stick. Guest is practice — Spire is the permanent lane.
        </p>
        <ul className="spire-perks-list">
          <li>
            <b>Leaderboard</b>
            <span>Your Main Best can appear on the global board</span>
          </li>
          <li>
            <b>Season rank</b>
            <span>Title on your player card for this season</span>
          </li>
          <li>
            <b>Spire box</b>
            <span>Lucky opens as you climb — common → rare</span>
          </li>
          <li>
            <b>Payless pass / extra undo</b>
            <span>Soft perks from boxes</span>
          </li>
          <li>
            <b>Sigil (rare)</b>
            <span>Forever-ish mark — NFT path when mint is live</span>
          </li>
        </ul>
        <p className="spire-cost-line">
          Cost: <b>{costLabel}</b>
        </p>
        <div className="spire-entry-actions">
          <button
            type="button"
            className="game-btn game-btn-primary"
            disabled={!canProceed}
            onClick={onProceed}
          >
            {canProceed ? 'Connect & enter' : 'Coming soon'}
          </button>
          <button type="button" className="game-btn game-btn-secondary" onClick={onClose}>
            Back home
          </button>
        </div>
      </div>
    </div>
  );
}
