import { isPrivyConfigured } from '../privy';
import { AuthButtons } from '../privy/AuthButtons';

type LoginPageProps = {
  show: boolean;
  onContinue: (name?: string) => void;
};

/**
 * Privy is the onboarding layer. No "Skip for now".
 * Requires VITE_PRIVY_APP_ID.
 */
export function LoginPage({ show, onContinue }: LoginPageProps) {
  const privyOn = isPrivyConfigured();

  return (
    <div className={`page login-page game-login${show ? ' show' : ''}`} id="loginPage">
      <div className="splash-bg login-splash-bg" aria-hidden="true" />
      <div className="login-card">
        <img className="login-logo-img" src="/images/logo.png" alt="STARK" />
        <div className="login-tag">DESCEND THE SPIRE</div>
        <div className="login-season">SEASON 1</div>

        {privyOn ? (
          <AuthButtons onAuthed={(name) => onContinue(name)} />
        ) : (
          <div className="login-auth-stack">
            <p className="login-stub-hint" style={{ marginBottom: 12 }}>
              Set <code>VITE_PRIVY_APP_ID</code> in <code>.env</code> and restart
              the app to enable Google / email / wallet login.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
