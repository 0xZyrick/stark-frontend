/**
 * Cartridge Controller — Starknet-native account for Spire gas.
 * Privy = identity (Google). Controller = wallet that pays start_run / settle_run.
 */
import Controller from '@cartridge/controller';
import { GAME_ADDRESS } from '../chain/contract';

const RPC = (import.meta.env.VITE_STARKNET_RPC_URL as string) ||
  'https://api.cartridge.gg/x/starknet/sepolia';

const SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA

let controller: Controller | null = null;

function getController(): Controller {
  if (!controller) {
    const game = GAME_ADDRESS;
    controller = new Controller({
      chains: [{ rpcUrl: RPC }],
      defaultChainId: SEPOLIA_CHAIN_ID,
      policies: game && game !== '0x0'
        ? {
            contracts: {
              [game]: {
                name: 'StarkGame',
                description: 'STARK Spire ranked runs',
                methods: [
                  {
                    name: 'Start run',
                    description: 'Pay network gas to enter the Spire',
                    entrypoint: 'start_run',
                  },
                  {
                    name: 'Settle run',
                    description: 'Record run result on-chain',
                    entrypoint: 'settle_run',
                  },
                ],
              },
            },
          }
        : undefined,
    } as ConstructorParameters<typeof Controller>[0]);
  }
  return controller;
}

export type SpireAccount = {
  address: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (calls: any[]) => Promise<{ transaction_hash: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider?: any;
};

export async function connectController(): Promise<SpireAccount> {
  const c = getController();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = (await (c as any).connect()) as SpireAccount;
  if (!account?.address) {
    throw new Error('Wallet not connected');
  }
  return account;
}

export async function probeController(): Promise<SpireAccount | null> {
  try {
    const c = getController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc = (c as any).account as SpireAccount | undefined;
    if (acc?.address) return acc;
    return null;
  } catch {
    return null;
  }
}

export async function disconnectController(): Promise<void> {
  try {
    const c = getController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).disconnect?.();
  } catch {
    /* ignore */
  }
}

/** start_run — player pays gas */
export async function chainStartRun(account: SpireAccount): Promise<{
  txHash: string;
  runId: number;
  seed: string;
}> {
  if (!GAME_ADDRESS || GAME_ADDRESS === '0x0') {
    throw new Error('Game contract address not configured');
  }
  if (!account?.address) throw new Error('Wallet not connected');

  const result = await account.execute([
    {
      contractAddress: GAME_ADDRESS,
      entrypoint: 'start_run',
      calldata: [],
    },
  ]);
  const txHash = result.transaction_hash;
  // runId/seed may come from events; provisional ids until receipt parse
  return {
    txHash,
    runId: Date.now() % 1_000_000_000,
    seed: txHash.slice(0, 18),
  };
}

/** settle_run — player pays gas (no local fallback) */
export async function chainSettleRun(
  account: SpireAccount,
  args: {
    runId: number;
    score: number;
    depth: number;
    bestTile: number;
    movesHash: string;
    checksum: string;
  },
): Promise<{ txHash: string }> {
  if (!GAME_ADDRESS || GAME_ADDRESS === '0x0') {
    throw new Error('Game contract address not configured');
  }
  if (!account?.address) throw new Error('Wallet not connected');

  const result = await account.execute([
    {
      contractAddress: GAME_ADDRESS,
      entrypoint: 'settle_run',
      calldata: [
        String(args.runId),
        String(args.score),
        String(args.depth),
        String(args.bestTile),
        args.movesHash,
        args.checksum,
      ],
    },
  ]);
  return { txHash: result.transaction_hash };
}

export async function fetchEthBalanceWei(address: string): Promise<string | null> {
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'starknet_call',
        params: [
          {
            contract_address:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            entry_point_selector:
              '0x035a0ca2e00d9c51a7a867c84233c20ef8f025ab08fc7c3324a08cae992e9ebe', // balanceOf
            calldata: [address],
          },
          'latest',
        ],
      }),
    });
    const data = await res.json();
    const result = data?.result;
    if (Array.isArray(result) && result[0]) return String(result[0]);
    return null;
  } catch {
    return null;
  }
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
