/**
 * Safe auth hook for UI. Falls back to guest when Privy is not configured
 * or the provider is not mounted.
 */
import { isPrivyConfigured } from './provider';

export type AuthSnapshot = {
  configured: boolean;
  authenticated: boolean;
  displayName: string | null;
  address: string | null;
  loginGoogle: () => Promise<void>;
  loginEmail: () => Promise<void>;
  loginWallet: () => Promise<void>;
  logout: () => Promise<void>;
};

/** Non-hook guest fallback for when Privy is off */
export function guestAuth(): AuthSnapshot {
  return {
    configured: false,
    authenticated: false,
    displayName: null,
    address: null,
    loginGoogle: async () => {
      console.warn('[privy] not configured');
    },
    loginEmail: async () => {
      console.warn('[privy] not configured');
    },
    loginWallet: async () => {
      console.warn('[privy] not configured');
    },
    logout: async () => {},
  };
}

export { isPrivyConfigured };
