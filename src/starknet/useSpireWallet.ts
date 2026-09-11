/**
 * Spire wallet — Argent X / Braavos (injected). Player signs and pays gas.
 * Privy remains identity only.
 */
import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  connectInjected,
  hasInjectedWallet,
  startRunInjected,
  settleRunInjected,
  readStrkBalance,
  type InjectedStark,
} from './injectedWallet';
import { computeChecksum } from '../chain';

function shortAddress(addr: string) {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function useSpireWallet() {
  const { authenticated, ready } = usePrivy();
  const [address, setAddress] = useState<string | null>(null);
  const [starknet, setStarknet] = useState<InjectedStark | null>(null);
  const [balanceHint, setBalanceHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalanceHint(null);
      return;
    }
    const b = await readStrkBalance(address);
    setBalanceHint(b);
  }, [address]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const ensure = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!authenticated) throw new Error('Log in first');
      if (!hasInjectedWallet()) {
        throw new Error('Install Argent X or Braavos, then try again');
      }
      const { address: addr, starknet: sn } = await connectInjected();
      setAddress(addr);
      setStarknet(sn);
      const b = await readStrkBalance(addr);
      setBalanceHint(b);
      return { address: addr };
    } catch (e) {
      const msg = (e as Error).message || 'Wallet connect failed';
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [authenticated]);

  const startRunOnChain = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      let sn = starknet;
      let addr = address;
      if (!sn || !addr) {
        const c = await connectInjected();
        sn = c.starknet;
        addr = c.address;
        setStarknet(sn);
        setAddress(addr);
      }
      const res = await startRunInjected(sn!);
      await refreshBalance();
      return res;
    } catch (e) {
      const msg = (e as Error).message || 'Could not start run';
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [starknet, address, refreshBalance]);

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
      seed?: string;
    }) => {
      setBusy(true);
      setError(null);
      try {
        if (!starknet) throw new Error('Wallet not connected');
        // Prefer client checksum if seed known
        let checksum = body.checksum;
        if (body.seed) {
          checksum = computeChecksum(
            body.seed,
            body.score,
            body.depth,
            body.bestTile,
            body.movesHash || '0x0',
          );
        }
        const res = await settleRunInjected(starknet, {
          ...body,
          checksum,
          movesHash: body.movesHash || '0x0',
        });
        await refreshBalance();
        return res;
      } catch (e) {
        setError((e as Error).message || 'Settle failed');
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [starknet, refreshBalance],
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
    connect: ensure,
    startRunOnChain,
    settleRunOnChain,
    refreshBalance,
    clearError: () => setError(null),
  };
}
