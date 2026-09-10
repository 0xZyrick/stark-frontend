import type { ReactNode } from 'react';
import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';

const APP_ID = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() || '';

/**
 * Identity only — no embedded wallet creation on login.
 * Spire will use Argent/Braavos later; Privy is name + stable user id.
 */
export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) {
    return <>{children}</>;
  }

  return (
    <PrivyProviderBase
      appId={APP_ID}
      config={{
        loginMethods: ['google', 'email'],
        appearance: {
          theme: 'dark',
          accentColor: '#ff9f1c',
        },
        // Critical: do not init embedded wallets (causes /embedded_wallets/init timeouts)
        embeddedWallets: {
          createOnLogin: 'off',
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}

export function isPrivyConfigured(): boolean {
  return Boolean(APP_ID);
}
