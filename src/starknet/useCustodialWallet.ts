/**
 * Custodial Starknet wallet via backend.
 * Always has a server-side key for signing. User funds the address.
 */
import { useCallback, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  ensureStarkWallet,
  startChainRun,
  settleChainRun,
  fetchWalletBalance,
} from '../privy/api';

function shortAddress(addr: string) {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function useCustodialWallet() {
  const { authenticated, getAccessToken, ready } = usePrivy();
  const [address, setAddress] = useState<string | null>(null);
  const [balanceHint, setBalanceHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const bal = await fetchWalletBalance(token);
      setBalanceHint(bal.display);
      if (bal.address) setAddress(bal.address);
    } catch {
      /* ignore */
    }
  }, [getAccessToken]);

  const ensure = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!authenticated) throw new Error('Not logged in');
      const token = await getAccessToken();
      if (!token) throw new Error('Not logged in');
      const res = (await ensureStarkWallet(token)) as {
        address: string;
        created?: boolean;
        needsFunding?: boolean;
      };
      setAddress(res.address);
      await refreshBalance();
      return res;
    } catch (e) {
      const msg = (e as Error).message || 'Wallet setup failed';
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [authenticated, getAccessToken, refreshBalance]);

  const startRunOnChain = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!address) await ensure();
      const token = await getAccessToken();
      if (!token) throw new Error('Not logged in');
      const res = (await startChainRun(token)) as {
        txHash: string;
        runId?: number;
        seed?: string;
      };
      await refreshBalance();
      return {
        txHash: res.txHash,
        runId: res.runId ?? Date.now() % 1_000_000_000,
        seed: res.seed ?? res.txHash?.slice(0, 18) ?? String(Date.now()),
      };
    } catch (e) {
      const msg = (e as Error).message || 'Could not start run';
      if (/fund|balance|money|insufficient|key/i.test(msg)) {
        setError(
          /key/i.test(msg)
            ? 'Wallet key missing — tap Create game wallet again'
            : 'Insufficient funds — fund your wallet address first',
        );
      } else if (/login|auth|token/i.test(msg)) {
        setError('Not logged in');
      } else {
        setError(msg);
      }
      throw e;
    } finally {
      setBusy(false);
    }
  }, [address, ensure, getAccessToken, refreshBalance]);

  const settleRunOnChain = useCallback(
    async (body: {
      runId: number;
      score: number;
      depth: number;
      bestTile: number;
      movesHash: string;
      checksum: string;
      name?: string;
      worldId?: string;
    }) => {
      setBusy(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Not logged in');
        const res = await settleChainRun(token, body);
        await refreshBalance();
        return res;
      } catch (e) {
        setError((e as Error).message || 'Settle failed');
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken, refreshBalance],
  );

  return {
    ready,
    authenticated,
    connected: Boolean(address),
    address,
    short: address ? shortAddress(address) : null,
    balanceHint,
    busy,
    error,
    ensure,
    startRunOnChain,
    settleRunOnChain,
    refreshBalance,
    clearError: () => setError(null),
    connect: ensure,
  };
}
