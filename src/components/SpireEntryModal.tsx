/**
 * Minimal Spire entry — custodial address + balance.
 */
type Props = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  address?: string | null;
  balanceHint?: string | null;
  onEnsureWallet: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRefreshBalance?: () => void;
};

export function SpireEntryModal({
  open,
  busy,
  error,
  address,
  balanceHint,
  onEnsureWallet,
  onConfirm,
  onCancel,
  onRefreshBalance,
}: Props) {
  if (!open) return null;

  return (
    <div className="spire-entry-overlay" role="dialog" aria-modal="true">
      <div className="spire-entry-card">
        <img
          className="spire-entry-mascot"
          src="/images/mascot/orb.png"
          alt=""
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <h2 className="spire-entry-title">Enter the Spire</h2>
        <p className="spire-entry-body">Ranked · gas on start &amp; settle</p>

        {address ? (
          <div className="spire-wallet-chip">
            <span className="sw-dot" />
            <span className="sw-addr">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            {balanceHint && <span className="sw-bal">{balanceHint}</span>}
            <button
              type="button"
              className="sw-copy"
              onClick={() => void navigator.clipboard?.writeText(address)}
            >
              Copy
            </button>
            {onRefreshBalance && (
              <button type="button" className="sw-copy" onClick={onRefreshBalance}>
                ↻
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="game-btn game-btn-secondary"
            disabled={busy}
            onClick={onEnsureWallet}
            style={{ width: '100%', marginTop: 8 }}
          >
            {busy ? 'Creating wallet…' : 'Create game wallet'}
          </button>
        )}

        {error && <p className="spire-entry-error">{error}</p>}

        <div className="spire-entry-actions">
          <button
            type="button"
            className="game-btn game-btn-primary"
            disabled={busy || !address}
            onClick={onConfirm}
          >
            {busy ? 'Starting…' : 'Pay gas & play'}
          </button>
          <button type="button" className="game-btn-text" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
