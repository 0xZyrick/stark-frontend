/**
 * Shop domain — pure catalog + purchase eligibility.
 */
import { SHOP_BOOSTS, SHOP_SKINS } from './constants';
import type { ShopBoost, ShopSkin } from './types';

export function getBoost(id: string): ShopBoost | undefined {
  return SHOP_BOOSTS.find((b) => b.id === id);
}

export function getSkin(id: string): ShopSkin | undefined {
  return SHOP_SKINS.find((s) => s.id === id);
}

export function canAfford(cost: number, shards: number): boolean {
  return shards >= cost;
}

export function canBuyBoost(
  id: string,
  shards: number,
  owned: Set<string>
): { ok: boolean; reason?: string; item?: ShopBoost } {
  const item = getBoost(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (owned.has(id)) return { ok: false, reason: 'owned', item };
  if (!canAfford(item.cost, shards)) return { ok: false, reason: 'shards', item };
  return { ok: true, item };
}

export function canBuySkin(
  id: string,
  shards: number,
  owned: Set<string>
): { ok: boolean; reason?: string; item?: ShopSkin } {
  const item = getSkin(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (owned.has(id)) return { ok: false, reason: 'owned', item };
  if (!canAfford(item.cost, shards)) return { ok: false, reason: 'shards', item };
  return { ok: true, item };
}

/** Apply purchase: returns new shards + owned set (immutable). */
export function applyBoostPurchase(
  id: string,
  shards: number,
  owned: Set<string>
): { shards: number; owned: Set<string> } | null {
  const check = canBuyBoost(id, shards, owned);
  if (!check.ok || !check.item) return null;
  const next = new Set(owned);
  next.add(id);
  return { shards: shards - check.item.cost, owned: next };
}

export function applySkinPurchase(
  id: string,
  shards: number,
  owned: Set<string>
): { shards: number; owned: Set<string> } | null {
  const check = canBuySkin(id, shards, owned);
  if (!check.ok || !check.item) return null;
  const next = new Set(owned);
  next.add(id);
  return { shards: shards - check.item.cost, owned: next };
}

export { SHOP_BOOSTS, SHOP_SKINS };
