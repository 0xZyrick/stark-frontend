/**
 * Vault (relics) + Sigils — pure unlock rules from legacy game.js.
 */
import { RELICS, RELIC_NAMES, SIGILS } from './constants';
import type { Relic, Sigil } from './types';

/** Relic unlocked when the player first creates a tile of value 2^(index+1). */
export function relicUnlockValue(index: number): number {
  return Math.pow(2, index + 1); // 2, 4, 8, … 1024
}

export function relicForValue(value: number): Relic | null {
  const idx = Math.log2(value) - 1;
  if (idx < 0 || idx >= RELICS.length) return null;
  return RELICS[Math.floor(idx)];
}

/**
 * Given current vault set and a newly created tile value,
 * returns the relic name to award (or null if already owned / out of range).
 */
export function relicToAward(
  value: number,
  vault: Set<string>
): string | null {
  const idx = Math.log2(value) - 1;
  if (idx < 0 || idx >= RELIC_NAMES.length) return null;
  const name = RELIC_NAMES[Math.floor(idx)];
  if (vault.has(name)) return null;
  return name;
}

export function awardRelic(
  name: string,
  vault: Set<string>
): Set<string> {
  if (vault.has(name)) return vault;
  const next = new Set(vault);
  next.add(name);
  return next;
}

export function getSigil(id: string): Sigil | undefined {
  return SIGILS.find((s) => s.id === id);
}

export function awardSigil(id: string, owned: Set<string>): Set<string> {
  if (owned.has(id)) return owned;
  const next = new Set(owned);
  next.add(id);
  return next;
}

export { RELICS, RELIC_NAMES, SIGILS };
