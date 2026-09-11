type Props = {
  open: boolean;
  onLogin: () => void;
  onLater: () => void;
};

export function SaveProgressModal({ open, onLogin, onLater }: Props) {
  if (!open) return null;
  return (
    <div className="spire-entry-overlay" role="dialog" aria-modal="true">
      <div className="spire-entry-card">
        <h2 className="spire-entry-title">Save this climb?</h2>
        <p className="spire-entry-body">
          Log in to keep scores and unlock the rest of the compound. Skip and this
          device may lose it.
        </p>
        <div className="spire-entry-actions">
          <button type="button" className="game-btn game-btn-primary" onClick={onLogin}>
            Log in to save
          </button>
          <button type="button" className="game-btn game-btn-secondary" onClick={onLater}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
