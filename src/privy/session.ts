import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';
import { ensureStarkWallet, startChainRun, settleChainRun } from './api';

export function useSessionKey() {
  const { authenticated, login, logout, user, ready, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [starkAddress, setStarkAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureWallet = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No Privy access token');
      const res = await ensureStarkWallet(token);
      setStarkAddress(res.address);
      return res;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [getAccessToken]);

  const enterSpireOnChain = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (!starkAddress) await ensureWallet();
      const token = await getAccessToken();
      if (!token) throw new Error('No Privy access token');
      return await startChainRun(token);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [starkAddress, ensureWallet, getAccessToken]);

  const settleSpireOnChain = useCallback(
    async (payload: {
      runId: number;
      score: number;
      depth: number;
      bestTile: number;
      movesHash: string;
      checksum: string;
      name?: string;
      worldId?: string;
    }) => {
      setError(null);
      setBusy(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('No Privy access token');
        return await settleChainRun(token, payload);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [getAccessToken],
  );

  return {
    authenticated: !!authenticated,
    ready: !!ready,
    user,
    login,
    logout,
    busy,
    error,
    starkAddress,
    ethAddress: wallets[0]?.address ?? null,
    getEthAddress: async () => wallets[0]?.address ?? null,
    ensureWallet,
    enterSpireOnChain,
    settleSpireOnChain,
  };
}
