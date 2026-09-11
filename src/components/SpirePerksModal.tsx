
/**
 * Spire Mode — wallet required. No offline shaft.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  onProceed?: () => void;
  canProceed?: boolean;
  busy?: boolean;
  costLabel?: string;
  error?: string | null;
  walletReady?: boolean;
};

export function SpirePerksModal({
  open,
  onClose,
  onProceed,
  canProceed = false,
  busy = false,
  costLabel = 'Network gas (your wallet)',
  error = null,
  walletReady = false,
}: Props) {
  if (!open) return null;

  return (
    <div className="spire-entry-overlay" role="dialog" aria-modal="true">
      <div className="spire-entry-card spire-perks-card">
        <h2 className="spire-entry-title">Spire Mode</h2>
        <p className="spire-entry-body">
          Underground shaft. Wallet required — no offline path.
        </p>
        <ul className="spire-perks-list">
          <li>
            <b>Shaft floors</b>
            <span>Vertical climb under the compound</span>
          </li>
          <li>
            <b>On-chain run</b>
            <span>start_run when you enter · settle when you finish</span>
          </li>
          <li>
            <b>Full sigils</b>
            <span>Spire can hold the whole set</span>
          </li>
        </ul>
        <p className="spire-cost-line">
          Cost: <b>{costLabel}</b>
        </p>
        {!walletReady && (
          <p className="spire-inline-error">
            Install Argent X or Braavos, connect, fund Sepolia, then Descend
          </p>
        )}
        {error ? <p className="spire-inline-error">{error}</p> : null}
        <div className="spire-entry-actions">
          <button
            type="button"
            className="game-btn game-btn-primary"
            disabled={!canProceed || busy}
            onClick={onProceed}
          >
            {busy ? 'Opening…' : canProceed ? 'Descend' : 'Wallet required'}
          </button>
          <button type="button" className="game-btn game-btn-secondary" onClick={onClose}>
            Back home
          </button>
        </div>
      </div>
    </div>
  );
}
