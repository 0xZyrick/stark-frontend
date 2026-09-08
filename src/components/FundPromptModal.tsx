type Props = {
  open: boolean;
  address?: string | null;
  balanceHint?: string | null;
  busy?: boolean;
  onPrepareWallet: () => void;
  onRefreshBalance?: () => void;
  onSkip: () => void;
};

export function FundPromptModal({
  open,
  address,
  balanceHint,
  busy,
  onPrepareWallet,
  onRefreshBalance,
  onSkip,
}: Props) {
  if (!open) return null;

  const short =
    address && address.length > 12
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : address;

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
        <h2 className="spire-entry-title">Top up</h2>
        <p className="spire-entry-body">Copy your address to fund it.</p>
        {address ? (
          <>
            <div className="spire-wallet-chip">
              <span className="sw-addr">{short}</span>
              <button
                type="button"
                className="sw-copy"
                onClick={() => void navigator.clipboard?.writeText(address)}
              >
                Copy
              </button>
            </div>
            <p className="acct-balance" style={{ marginTop: 8 }}>
              {balanceHint ?? '…'}{' '}
              {onRefreshBalance && (
                <button type="button" className="sw-copy" onClick={onRefreshBalance}>
                  ↻
                </button>
              )}
            </p>
          </>
        ) : (
          <button
            type="button"
            className="game-btn game-btn-secondary"
            disabled={busy}
            onClick={onPrepareWallet}
            style={{ width: '100%' }}
          >
            {busy ? 'Creating…' : 'Create game wallet'}
          </button>
        )}
        <div className="spire-entry-actions">
          <button type="button" className="game-btn-text" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
