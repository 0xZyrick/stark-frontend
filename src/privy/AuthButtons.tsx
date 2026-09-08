/**
 * Privy login — prefer direct OAuth to avoid double modal (our button → Privy modal → Google).
 */
import { usePrivy, useLoginWithOAuth } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

type Props = {
  onAuthed: (name?: string) => void;
};

export function AuthButtons({ onAuthed }: Props) {
  const { authenticated, user, ready, getAccessToken, login } = usePrivy();
  const { initOAuth } = useLoginWithOAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // After Google redirect, auto-continue once
  useEffect(() => {
    if (!authenticated || !user) return;
    const name =
      user.google?.name ||
      user.email?.address?.split('@')[0] ||
      user.wallet?.address?.slice(0, 8) ||
      undefined;
    onAuthed(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      await getAccessToken().catch(() => null);
      const name =
        user?.google?.name ||
        user?.email?.address?.split('@')[0] ||
        user?.wallet?.address?.slice(0, 8) ||
        undefined;
      onAuthed(name);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startGoogle() {
    setErr(null);
    setBusy(true);
    try {
      // Goes straight to Google when allowed in Privy dashboard
      await initOAuth({ provider: 'google' });
    } catch (e) {
      const msg = (e as Error).message || 'Google login failed';
      setErr(
        /not allowed|403/i.test(msg)
          ? 'Google login not enabled in Privy Dashboard (Login methods + Allowed origins).'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function startEmail() {
    setErr(null);
    try {
      // Email uses Privy’s UI (one modal only)
      login({ loginMethods: ['email'] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function startWallet() {
    setErr(null);
    try {
      login({ loginMethods: ['wallet'] });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (authenticated) {
    return (
      <div className="login-auth-stack">
        <button
          className="game-btn game-btn-secondary"
          type="button"
          disabled={busy}
          onClick={() => void finish()}
        >
          {busy ? 'Loading…' : 'Continue'}
        </button>
        {err && <p className="login-stub-hint">{err}</p>}
      </div>
    );
  }

  return (
    <div className="login-auth-stack">
      <button
        className="game-btn game-btn-auth"
        type="button"
        disabled={!ready || busy}
        onClick={() => void startGoogle()}
      >
        <span className="auth-ic">G</span> Continue with Google
      </button>
      <button
        className="game-btn game-btn-auth"
        type="button"
        disabled={!ready || busy}
        onClick={() => void startEmail()}
      >
        <span className="auth-ic">✉</span> Continue with Email
      </button>
      <button
        className="game-btn game-btn-auth game-btn-wallet"
        type="button"
        disabled={!ready || busy}
        onClick={() => void startWallet()}
      >
        <span className="auth-ic">⬡</span> Connect Wallet
      </button>
      {!ready && <p className="login-stub-hint">Loading auth…</p>}
      {err && <p className="login-stub-hint">{err}</p>}
    </div>
  );
}
