/**
 * Browser Starknet wallet (Argent X / Braavos) — player pays gas.
 * No server keys.
 */
import { Contract, RpcProvider, num } from 'starknet';
import { GAME_ADDRESS, GAME_ABI } from '../chain/contract';

const RPC =
  (import.meta.env.VITE_STARKNET_RPC_URL as string) ||
  'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';

export type InjectedStark = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enable?: (opts?: any) => Promise<string[]>;
  isConnected?: boolean;
  selectedAddress?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off?: any;
};

function getInjected(): InjectedStark | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return (
    w.starknet_argentX ||
    w.starknet_braavos ||
    w.starknet ||
    null
  );
}

export function hasInjectedWallet(): boolean {
  return Boolean(getInjected());
}

export async function connectInjected(): Promise<{ address: string; starknet: InjectedStark }> {
  const starknet = getInjected();
  if (!starknet) {
    throw new Error('Install Argent X or Braavos (Starknet wallet)');
  }
  if (typeof starknet.enable === 'function') {
    await starknet.enable({ starknetVersion: 'v5' });
  }
  const address =
    starknet.selectedAddress ||
    starknet.account?.address ||
    (Array.isArray((starknet as { accounts?: string[] }).accounts)
      ? (starknet as { accounts?: string[] }).accounts?.[0]
      : null);
  if (!address) {
    throw new Error('Wallet connected but no address — unlock the extension');
  }
  return { address, starknet };
}

function provider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC });
}

function gameRead() {
  return new Contract([...GAME_ABI], GAME_ADDRESS, provider());
}

/** After start_run, read active run for this player */
export async function fetchActiveRun(player: string): Promise<{
  seed: string;
  runId: number;
  season: number;
} | null> {
  if (!GAME_ADDRESS || GAME_ADDRESS === '0x0') {
    throw new Error('VITE_GAME_CONTRACT_ADDRESS not set');
  }
  try {
    const c = gameRead();
    const r = await c.get_active_run(player);
    // tuple-like
    const seed = String(r[0] ?? r.seed ?? '0');
    const runId = Number(r[1] ?? r.run_id ?? 0);
    const season = Number(r[2] ?? r.season_id ?? 0);
    if (!runId) return null;
    return { seed, runId, season };
  } catch (e) {
    console.warn('[get_active_run]', e);
    return null;
  }
}

export async function startRunInjected(starknet: InjectedStark): Promise<{
  txHash: string;
  runId: number;
  seed: string;
}> {
  if (!GAME_ADDRESS || GAME_ADDRESS === '0x0') {
    throw new Error('VITE_GAME_CONTRACT_ADDRESS not set');
  }
  const account = starknet.account;
  if (!account?.execute) {
    throw new Error('Wallet account not ready — reconnect Argent/Braavos');
  }
  const tx = await account.execute([
    {
      contractAddress: GAME_ADDRESS,
      entrypoint: 'start_run',
      calldata: [],
    },
  ]);
  const txHash = tx.transaction_hash || tx.transactionHash || String(tx);
  try {
    await provider().waitForTransaction(txHash);
  } catch (e) {
    console.warn('[wait start_run]', e);
  }
  const address = starknet.selectedAddress || account.address;
  let active = await fetchActiveRun(address);
  // small retry — indexing lag
  if (!active?.runId) {
    await new Promise((r) => setTimeout(r, 1500));
    active = await fetchActiveRun(address);
  }
  return {
    txHash,
    runId: active?.runId ?? Date.now() % 1_000_000_000,
    seed: active?.seed && active.seed !== '0' ? active.seed : txHash.slice(0, 18),
  };
}

export async function settleRunInjected(
  starknet: InjectedStark,
  body: {
    runId: number;
    score: number;
    depth: number;
    bestTile: number;
    movesHash: string;
    checksum: string;
  },
): Promise<{ txHash: string }> {
  if (!GAME_ADDRESS || GAME_ADDRESS === '0x0') {
    throw new Error('VITE_GAME_CONTRACT_ADDRESS not set');
  }
  const account = starknet.account;
  if (!account?.execute) {
    throw new Error('Wallet account not ready');
  }
  const calldata = [
    num.toHex(body.runId),
    num.toHex(body.score),
    num.toHex(body.depth),
    num.toHex(body.bestTile),
    body.movesHash.startsWith('0x') ? body.movesHash : `0x${body.movesHash}`,
    body.checksum.startsWith('0x') ? body.checksum : `0x${body.checksum}`,
  ];
  const tx = await account.execute([
    {
      contractAddress: GAME_ADDRESS,
      entrypoint: 'settle_run',
      calldata,
    },
  ]);
  const txHash = tx.transaction_hash || tx.transactionHash || String(tx);
  try {
    await provider().waitForTransaction(txHash);
  } catch (e) {
    console.warn('[wait settle_run]', e);
  }
  return { txHash };
}

export async function readStrkBalance(address: string): Promise<string> {
  try {
    const STRK =
      '0x04718f5a0fc34cc1af66a1c2c49a2a95d37197c0b76526ad3f6a9c569f55f32';
    const p = provider();
    const result = await p.callContract({
      contractAddress: STRK,
      entrypoint: 'balanceOf',
      calldata: [address],
    });
    // u256 low/high
    const low = BigInt(result[0] ?? result.result?.[0] ?? 0);
    const high = BigInt(result[1] ?? result.result?.[1] ?? 0);
    const wei = low + (high << 128n);
    const n = Number(wei) / 1e18;
    if (n === 0) return '0 STRK';
    if (n < 0.001) return '<0.001 STRK';
    return `${n.toFixed(3)} STRK`;
  } catch {
    return '—';
  }
}
