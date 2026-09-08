/**
 * Tile value → glyph / color — pure presentation math from legacy game.js.
 * (No DOM; components will apply the returned styles.)
 */
import { SYMBOLS, PALETTES, RELIC_NAMES, CROWN_TIER_IDX } from './constants';
import type { SkinId } from './types';

export function symbolFor(value: number): string {
  const idx = Math.log2(value) - 1;
  if (idx >= 0 && idx < SYMBOLS.length) return SYMBOLS[idx];
  return SYMBOLS[SYMBOLS.length - 1];
}

export function relicIdxFor(value: number): number {
  const idx = Math.log2(value) - 1;
  return Math.max(0, Math.min(idx, RELIC_NAMES.length - 1));
}

/** Uncapped tier index — high-value orbs never collapse into the same look. */
export function tierIndexFor(value: number): number {
  return Math.max(0, Math.log2(value) - 1);
}

export function isCrownValue(value: number): boolean {
  return tierIndexFor(value) >= CROWN_TIER_IDX;
}

export function glyphFor(value: number): string {
  return isCrownValue(value) ? '👑' : symbolFor(value);
}

/**
 * Palette colour for a tile value under the given skin.
 * Beyond the base palette: golden-angle HSL so deep endless tiles stay distinct.
 */
export function paletteFor(value: number, skin: SkinId = 'classic'): string {
  const pal = PALETTES[skin] || PALETTES.classic;
  const idx = tierIndexFor(value);
  if (idx < pal.length) return pal[Math.round(idx)];
  const hue = (idx * 137.508) % 360;
  return `hsl(${hue.toFixed(0)}, 78%, 58%)`;
}

/** CSS background string matching the original radial-gradient orb look. */
export function orbBackground(value: number, skin: SkinId = 'classic'): string {
  const base = paletteFor(value, skin);
  return `radial-gradient(circle at 32% 28%, #ffffff 0%, ${base} 42%, ${base} 100%)`;
}

/** CSS box-shadow matching the original solid thick orbs. */
export const ORB_BOX_SHADOW =
  'inset 0 -7px 12px rgba(0,0,0,0.4), inset 0 8px 10px rgba(255,255,255,0.55), 0 5px 14px rgba(0,0,0,0.5)';
