
import { isPrivyConfigured } from '../privy';
import { AuthButtons } from '../privy/AuthButtons';

type LoginPageProps = {
  show: boolean;
  onContinue: (name?: string) => void;
  onClose?: () => void;
  /** Modal over home vs full page */
  asModal?: boolean;
};

/**
 * Login — modal over home, or full page if needed.
 * No "try a run" here; home is always available for Guest trial.
 */
export function LoginPage({ show, onContinue, onClose, asModal }: LoginPageProps) {
  const privyOn = isPrivyConfigured();
  if (!show) return null;

  const card = (
    <div className={`login-card${asModal ? ' login-card-modal' : ''}`}>
      {asModal && onClose ? (
        <button type="button" className="login-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      ) : null}
      <img className="login-logo-img" src="/images/logo.png" alt="STARK" />
      <div className="login-tag">DESCEND THE SPIRE</div>
      <div className="login-season">SEASON 1</div>
      <p className="login-or-hint">Save your climb · unlock the compound</p>

      {privyOn ? (
        <AuthButtons onAuthed={(name) => onContinue(name)} />
      ) : (
        <div className="login-auth-stack">
          <p className="login-stub-hint" style={{ marginBottom: 12 }}>
            Set <code>VITE_PRIVY_APP_ID</code> to enable login.
          </p>
        </div>
      )}
    </div>
  );

  if (asModal) {
    return (
      <div className="spire-entry-overlay login-modal-overlay" role="dialog" aria-modal="true">
        {card}
      </div>
    );
  }

  return (
    <div className="page login-page game-login show" id="loginPage">
      <div className="splash-bg login-splash-bg" aria-hidden="true" />
      {card}
    </div>
  );
}
