/**
 * Real Privy provider — use after:
 *   npm install @privy-io/react-auth viem
 * Then rename/replace provider.tsx with this file's contents.
 */
import type { ReactNode } from 'react';
import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';

const APP_ID = (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() || '';

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;
  return (
    <PrivyProviderBase
      appId={APP_ID}
      config={{
        loginMethods: ['google', 'email', 'wallet'],
        appearance: { theme: 'dark', accentColor: '#ff9f1c' },
        embeddedWallets: { createOnLogin: 'off' },
        defaultChain: sepolia,
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}

export function isPrivyConfigured(): boolean {
  return Boolean(APP_ID);
}
