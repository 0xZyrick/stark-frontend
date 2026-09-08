import { usePrivy } from '@privy-io/react-auth';
import { useSessionKey } from './session';

export function useWallet() {
  const { user } = usePrivy();
  const session = useSessionKey();
  return {
    isConnected: !!user,
    ethAddress: session.ethAddress || user?.wallet?.address || null,
    starkAddress: session.starkAddress,
    ensureWallet: session.ensureWallet,
    enterSpireOnChain: session.enterSpireOnChain,
    settleSpireOnChain: session.settleSpireOnChain,
    busy: session.busy,
    error: session.error,
  };
}
