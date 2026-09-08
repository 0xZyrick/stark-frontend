const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:3000';

async function authFetch(path: string, token: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}

export async function ensureStarkWallet(accessToken: string) {
  return authFetch('/api/wallet/ensure', accessToken, { method: 'POST', body: '{}' });
}

export async function startChainRun(accessToken: string) {
  return authFetch('/api/chain/start', accessToken, { method: 'POST', body: '{}' });
}

export async function settleChainRun(
  accessToken: string,
  body: {
    runId: number;
    score: number;
    depth: number;
    bestTile: number;
    movesHash: string;
    checksum: string;
    name?: string;
    worldId?: string;
  },
) {
  return authFetch('/api/chain/settle', accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchWalletBalance(accessToken: string) {
  return authFetch('/api/wallet/balance', accessToken, {
    method: 'GET',
  }) as Promise<{ address: string; display: string; wei: string | null }>;
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API}/api/leaderboard`);
  if (!res.ok) throw new Error('leaderboard failed');
  return res.json() as Promise<{
    rows: Array<{
      rank: number;
      name: string;
      worldId: string;
      rating: number;
      bestScore: number;
      score?: number;
    }>;
  }>;
}

export { API as BACKEND_URL };
