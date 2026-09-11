/**
 * Exact data tables from legacy game.js — pure constants only.
 * Visuals (CSS class names, scene ids, icon glyphs) preserved as-is.
 */
import type {
  BoardSize,
  World,
  GuestQuest,
  RankTitle,
  SpirePower,
  ShopBoost,
  ShopSkin,
  Relic,
  Sigil,
  AchievementDef,
  MissionDef,
} from './types';

// ---------------------------------------------------------------------------
// Board pressure by campaign progress (world-aware)
// World 1 Outer: 6x4 → 5x4 → 4x4 → 3x4 (width narrows, height fixed)
// World 2 Mid:   6x6 → 6x5 → 6x4 → 6x3 (width fixed, height/rows shorten)
// World 3 Core:  6x6 → 5x5 → 4x4 → 3x3 (square, shrinks both)
// Endless: cycles tight boards forever
// ---------------------------------------------------------------------------
export const LEVEL_BOARD_SIZES: BoardSize[] = [
  { cols: 4, rows: 4 },
  { cols: 5, rows: 4 },
  { cols: 4, rows: 4 },
  { cols: 3, rows: 4 },
  { cols: 6, rows: 6 },
  { cols: 6, rows: 5 },
  { cols: 6, rows: 4 },
  { cols: 6, rows: 3 },
  { cols: 6, rows: 6 },
  { cols: 5, rows: 5 },
  { cols: 4, rows: 4 },
  { cols: 3, rows: 3 },
];

export const ENDLESS_BOARDS: BoardSize[] = [
  { cols: 4, rows: 5 },
  { cols: 3, rows: 5 },
  { cols: 3, rows: 4 },
  { cols: 4, rows: 4 },
];

export const GUEST_QUESTS: GuestQuest[] = [
  {
    name: 'Threshold Gate',
    description: 'Reach 1,000 score',
    type: 'score',
    target: 1000,
    cols: 4,
    rows: 4,
  },
  {
    name: 'Twin Stars',
    description: 'Collect 10 ★ and 10 ☀',
    type: 'shapes',
    target: 10,
    symbols: ['★', '☀'],
    cols: 5,
    rows: 4,
  },
  {
    name: 'Triad Forge',
    description: 'Collect 8 ✦ · 8 ✧ · 8 ◆',
    type: 'shapes',
    target: 8,
    symbols: ['✦', '✧', '◆'],
    cols: 4,
    rows: 5,
  },
  {
    name: 'Tight Circuit',
    description: 'Reach 2,500 score in 18 drops',
    type: 'limited-score',
    target: 2500,
    moves: 18,
    cols: 3,
    rows: 4,
  },
  {
    name: 'Solar Stack',
    description: 'Collect 12 ☀ · 12 ★ · 12 ☄',
    type: 'shapes',
    target: 12,
    symbols: ['☀', '★', '☄'],
    cols: 4,
    rows: 5,
  },
  {
    name: 'Chain Spark',
    description: 'Make a 3-step chain',
    type: 'chain',
    target: 3,
    cols: 4,
    rows: 4,
  },
  {
    name: 'Prism Run',
    description: 'Collect 10 ◆ · 10 ✹ · 10 ✺',
    type: 'shapes',
    target: 10,
    symbols: ['◆', '✹', '✺'],
    cols: 5,
    rows: 4,
  },
  {
    name: 'Sprint Gate',
    description: 'Reach 4,000 score in 25 drops',
    type: 'limited-score',
    target: 4000,
    moves: 25,
    cols: 4,
    rows: 4,
  },
  // Single-shape kept rare
  {
    name: 'Lone Star',
    description: 'Collect 20 ★ star orbs',
    type: 'shape',
    target: 20,
    symbol: '★',
    cols: 4,
    rows: 4,
  },
  {
    name: 'Quad Bloom',
    description: 'Collect 9 ★ · 9 ☀ · 9 ✧ · 9 ◆',
    type: 'shapes',
    target: 9,
    symbols: ['★', '☀', '✧', '◆'],
    cols: 5,
    rows: 5,
  },
];

export const CHOICE_MIN_GAP = 28;
export const CHOICE_CHANCE = 0.07;
export const REROLLS_START = 3;
export const POWERS_START = 0;
export const MAX_TIER = 99;

/** Level 1 = 1,000 then +5,000 each depth. */
export const SCORE_STAGE_THRESHOLDS = [
  1000, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000,
  55000,
] as const;

/** Soft cap so one mega-merge can't clear a whole depth alone. 256 * 3 */
export const MERGE_SCORE_CAP = 768;
export const SCORE_MULTIPLIER = 2;

export const WORLDS: World[] = [
  { id: 'outer', name: 'Outer Spire', icon: '🌑', scene: 'scene-outer', start: 0, end: 3 },
  { id: 'mid', name: 'Mid Spire', icon: '🌗', scene: 'scene-mid', start: 4, end: 7 },
  { id: 'core', name: 'Core', icon: '🔥', scene: 'scene-core', start: 8, end: 11 },
  { id: 'endless', name: 'Endless Spire', icon: '♾️', scene: 'scene-endless', start: 12, end: 999 },
];

export const SYMBOLS = ['✦', '✧', '◆', '★', '☀', '☄', '✺', '❂', '♦', '✹'] as const;

export const RELICS: Relic[] = [
  { name: 'Ember Shard', symbol: '✦', desc: 'First proof written in the Outer Spire.', unlock: 'Merge to 2' },
  { name: 'Glass Petal', symbol: '✧', desc: 'A fragile commitment, sealed in light.', unlock: 'Merge to 4' },
  { name: 'Iron Bloom', symbol: '◆', desc: 'Hard state — the shaft remembers.', unlock: 'Merge to 8' },
  { name: 'Auric Coil', symbol: '★', desc: 'Wound value, like a ledger of gold.', unlock: 'Merge to 16' },
  { name: 'Nova Seed', symbol: '☀', desc: 'A block waiting to finalize.', unlock: 'Merge to 32' },
  { name: 'Comet Vein', symbol: '☄', desc: 'Transit across the Mid Spire void.', unlock: 'Merge to 64' },
  { name: 'Nebula Core', symbol: '✺', desc: 'Many paths, one confirmed state.', unlock: 'Merge to 128' },
  { name: 'Zenith Prism', symbol: '❂', desc: 'Splits signal into pure truth.', unlock: 'Merge to 256' },
  { name: 'Eclipse Heart', symbol: '♦', desc: 'Dark finality in the Core.', unlock: 'Merge to 512' },
  { name: 'Genesis Key', symbol: '✹', desc: 'Root of the Codex. The Spire yields.', unlock: 'Merge to 1024' },
];

export const RELIC_NAMES = RELICS.map((r) => r.name);

export const DEPTH_NAMES = [
  // Outer
  'Threshold Gate',
  'Lantern Walk',
  'Fog Terrace',
  // Mid
  'Blue Shaft',
  'Null Bridge',
  'Echo Well',
  // Core
  'Crimson Vein',
  'Forge Heart',
  'Root Seal',
  // Endless
  'Star-Well',
  'Aurora Drift',
  'Codex Infinity',
] as const;

export const LORE_LINES = [
  'Outer Spire. The first proof is always the hardest.',
  'Merge carefully — every shape is a claim.',
  'The shaft deepens. Space is a scarce resource.',
  'Mid Spire listens. Chains become signal.',
  'Rerolls are mercy. Mercy is finite.',
  'A full column is a closed commitment.',
  'Core heat. Only clean merges survive.',
  'The Codex remembers every overflow.',
  'Endless Spire — rank is earned in depth.',
  'Starknet winds stir the Star-Well.',
  'Shapes stay simple. The world is the story.',
  'Daily descent. One board. One chance.',
] as const;

export const PALETTES: Record<string, string[]> = {
  classic: ['#ff6b6b', '#ffa94d', '#ffd43b', '#c0eb75', '#69db7c', '#38d9a9', '#3bc9db', '#4dabf7', '#748ffc', '#da77f2'],
  neon: ['#ff2e88', '#ff5e00', '#f4ff2e', '#39ff14', '#00ffd5', '#00c3ff', '#3d5cff', '#8a2eff', '#ff2ee0', '#ffffff'],
  sunset: ['#ff9a3c', '#ff6f3c', '#ff3c6e', '#ff3ca0', '#c93cff', '#8a3cff', '#3c6bff', '#3cb4ff', '#3cffe0', '#ffd93c'],
  aurora: ['#0fffa8', '#0fffd7', '#0fd7ff', '#0f9dff', '#4d6bff', '#8a4dff', '#c94dff', '#ff4dcf', '#ff4d8a', '#ffd74d'],
  codex: ['#ec796b', '#ff9f1c', '#f3e9d7', '#0cfae9', '#62b2fd', '#517fc9', '#8b9dc9', '#1b1f3b', '#0c0c0c', '#ffffff'],
};

/** Rank is a rare, persistent title earned by clearing whole worlds. */
export const RANK_TITLES: RankTitle[] = [
  { min: 0, name: 'SPARK DIVER', icon: '🌑', iconSrc: '/images/ranks/spark-diver.svg', color: '#8b95a8', line: 'First step into the Outer Spire.' },
  { min: 4, name: 'PROOF SEEKER', icon: '🔎', iconSrc: '/images/ranks/proof-seeker.svg', color: '#3bc9db', line: 'The Outer Spire is cleared.' },
  { min: 8, name: 'CHAIN ATTESTOR', icon: '⛏️', iconSrc: '/images/ranks/chain-attestor.svg', color: '#69db7c', line: 'The Mid Spire is cleared.' },
  { min: 12, name: 'SHAFT WARDEN', icon: '🛡️', iconSrc: '/images/ranks/shaft-warden.svg', color: '#4dabf7', line: 'The Core is cleared. Endless begins.' },
  { min: 17, name: 'CORE SIGNER', icon: '🌟', iconSrc: '/images/ranks/core-signer.svg', color: '#ff9f1c', line: "You've gone deep into Endless." },
  { min: 22, name: 'CODEX WALKER', icon: '📜', iconSrc: '/images/ranks/codex-walker.svg', color: '#62b2fd', line: 'Starknet winds know your name.' },
  { min: 27, name: 'GENESIS-BOUND', icon: '👑', iconSrc: '/images/ranks/genesis-bound.svg', color: '#ffbe4d', line: 'You hold the Key of the Spire.' },
];

export const WORLD_BG: Record<string, string> = {
  outer: '/images/worlds/outer-spire.jpg',
  mid: '/images/worlds/mid-spire.jpg',
  core: '/images/worlds/core.jpg',
  endless: '/images/worlds/endless-spire.jpg',
};

export const PLAYER_PORTRAIT = '/images/player/portrait.jpg';
export const PLAYER_AVATAR = '/images/player/avatar.svg';


export const SPIRE_POWERS: SpirePower[] = [
  { id: 'collapse', name: 'Collapse', icon: '⇩', tip: 'Column falls & re-merges' },
  { id: 'echo', name: 'Echo', icon: '◎', tip: 'Next merge counts twice' },
  { id: 'silence', name: 'Silence', icon: '🛡', tip: 'One column safe for 1 drop' },
  { id: 'forge', name: 'Forge', icon: '⚒', tip: 'Upgrade one tile one tier' },
];

export const SHOP_BOOSTS: ShopBoost[] = [
  {
    id: 'boost_rerolls',
    name: 'Reroll Master',
    desc: '+2 starting rerolls, every run.',
    cost: 120,
    icon: '⟲',
    color: 'linear-gradient(135deg,#3bc9db,#1fae7d)',
  },
  {
    id: 'boost_headstart',
    name: 'Head Start',
    desc: 'Begin each run with a bonus tile on the board.',
    cost: 150,
    icon: '🚀',
    color: 'linear-gradient(135deg,#4dabf7,#2ec4b6)',
  },
  {
    id: 'boost_secondchance',
    name: 'Second Wind',
    desc: 'Survive one overflow per run — the full column clears instead.',
    cost: 250,
    icon: '🌬️',
    color: 'linear-gradient(135deg,#ff9d3f,#ffb648)',
  },
  {
    id: 'boost_comboshield',
    name: 'Combo Shield',
    desc: 'Your combo survives one missed merge per run.',
    cost: 200,
    icon: '🛡️',
    color: 'linear-gradient(135deg,#ff6b6b,#ff8e53)',
  },
];

export const SHOP_SKINS: ShopSkin[] = [
  { id: 'classic', name: 'Classic', desc: 'Clean shapes. Pure readability.', cost: 0, icon: '◆' },
  { id: 'neon', name: 'Neon Pulse', desc: 'Electric high-contrast tones.', cost: 100, icon: '⚡' },
  { id: 'sunset', name: 'Sunset Glow', desc: 'Warm coral glow.', cost: 100, icon: '🌇' },
  { id: 'aurora', name: 'Aurora', desc: 'Teal-to-violet shimmer.', cost: 150, icon: '🌌' },
  { id: 'codex', name: 'Starknet Codex', desc: 'World layer — Starknet-inspired pack.', cost: 200, icon: '📜' },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'depth3', label: 'Reach Depth 3', icon: '🗼', cat: 'Progress', reward: 40, check: (ctx) => ctx.tier >= 2 },
  { id: 'depth5', label: 'Reach Depth 5', icon: '🏯', cat: 'Progress', reward: 70, check: (ctx) => ctx.tier >= 4 },
  { id: 'clearSpire', label: 'Clear the Spire', icon: '🏔️', cat: 'Progress', reward: 150, check: (ctx) => ctx.tier >= 6 },
  { id: 'score10k', label: 'Score 10,000', icon: '💰', cat: 'Scoring', reward: 40, check: (ctx) => ctx.score >= 10000 },
  { id: 'score50k', label: 'Score 50,000', icon: '👑', cat: 'Scoring', reward: 80, check: (ctx) => ctx.score >= 50000 },
  { id: 'score150k', label: 'Score 150,000', icon: '💠', cat: 'Scoring', reward: 120, check: (ctx) => ctx.score >= 150000 },
  { id: 'chain5', label: 'Chain 5 merges', icon: '⚡', cat: 'Combos', reward: 50, check: (ctx) => ctx.chain >= 5 },
  { id: 'chain8', label: 'Chain 8 merges', icon: '🌪️', cat: 'Combos', reward: 90, check: (ctx) => ctx.chain >= 8 },
  { id: 'vault5', label: 'Awaken 5 relics', icon: '💎', cat: 'Vault', reward: 60, check: (ctx) => ctx.vaultSize >= 5 },
  {
    id: 'vaultFull',
    label: 'Fill the Vault',
    icon: '🏆',
    cat: 'Vault',
    reward: 200,
    check: (ctx) => ctx.vaultSize >= RELIC_NAMES.length,
  },
  {
    id: 'merges100',
    label: 'Merge 100 times',
    icon: '🔗',
    cat: 'Collection',
    reward: 50,
    check: (ctx) => ctx.lifetimeMerges >= 100,
  },
  {
    id: 'merges500',
    label: 'Merge 500 times',
    icon: '⛓️',
    cat: 'Collection',
    reward: 150,
    check: (ctx) => ctx.lifetimeMerges >= 500,
  },
  {
    id: 'firstBuy',
    label: 'Make a Shop purchase',
    icon: '🛍️',
    cat: 'Shop',
    reward: 30,
    check: (ctx) => ctx.purchases >= 1,
  },
  {
    id: 'skinChange',
    label: 'Equip a new skin',
    icon: '🎨',
    cat: 'Shop',
    reward: 20,
    check: (ctx) => ctx.skinChanges >= 1,
  },
];

export const SIGILS: Sigil[] = [
  { id: 'sigil_ember', name: 'Ember Mark', icon: '✦', iconSrc: '/images/sigils/ember.png', desc: 'First seal.', minTier: 0 },
  { id: 'sigil_tide', name: 'Tide Mark', icon: '🌊', iconSrc: '/images/sigils/tide.png', desc: 'Under pressure.', minTier: 1 },
  { id: 'sigil_chain', name: 'Chain Mark', icon: '⛓', iconSrc: '/images/sigils/chain.png', desc: 'Links hold.', minTier: 3 },
  { id: 'sigil_core', name: 'Core Mark', icon: '🔥', iconSrc: '/images/sigils/core.png', desc: 'Shaft heat.', minTier: 6 },
  { id: 'sigil_void', name: 'Void Mark', icon: '🌑', iconSrc: '/images/sigils/void.png', desc: 'Deep quiet.', minTier: 10 },
  { id: 'sigil_genesis', name: 'Genesis Mark', icon: '👑', iconSrc: '/images/sigils/genesis.png', desc: 'Spire key.', minTier: 14 },
];

/** Guest / quest mode may hold at most this many sigils */
export const GUEST_SIGIL_LIMIT = 2;
/** Main Spire (ranked path) uses the full sigil set */
export const SPIRE_SIGIL_LIMIT = SIGILS.length;


export const SESSION_MISSIONS: MissionDef[] = [
  { id: 'm_depth2', label: 'Clear Depth 2', reward: 25, icon: '🗼' },
  { id: 'm_relic3', label: 'Unlock 3 relics (lifetime)', reward: 40, icon: '💎' },
  { id: 'm_chain4', label: 'Make a 4-chain', reward: 30, icon: '⚡' },
  { id: 'm_noreroll', label: 'Finish a run using 0 rerolls', reward: 35, icon: '🎯' },
  { id: 'm_danger', label: 'Survive a danger column', reward: 20, icon: '🌬️' },
  { id: 'm_score5k', label: 'Reach 5,000 in one run', reward: 25, icon: '💰' },
  { id: 'm_relicEarly', label: 'Unlock a relic before Depth 3', reward: 30, icon: '✨' },
  { id: 'm_runs3', label: 'Complete 3 runs', reward: 40, icon: '🔁' },
];

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'd_score3k', label: 'Score 3,000 in a run', reward: 20, icon: '💰' },
  { id: 'd_depth3', label: 'Reach Depth 3', reward: 20, icon: '🗼' },
  { id: 'd_chain3', label: 'Pull a 3-chain', reward: 15, icon: '⚡' },
];

export const HIDDEN_QUESTS: MissionDef[] = [
  { id: 'hq_silent', label: 'Silent Column', desc: 'Clear a full column without a drop miss', sigil: 'sigil_silent', reward: 0, icon: '🔇' },
  { id: 'hq_nohold', label: 'No-Hold Path', desc: 'Score 3,000 without using Hold', sigil: 'sigil_nohold', reward: 0, icon: '🚫' },
  { id: 'hq_double', label: 'Twin Stars', desc: 'Create two tiles ≥128 in one run', sigil: 'sigil_twin', reward: 0, icon: '✨' },
  { id: 'hq_edge', label: 'Edge of Overflow', desc: 'Survive with a column at max-1 then merge', sigil: 'sigil_edge', reward: 0, icon: '⚠️' },
  { id: 'hq_first', label: 'First Light', desc: 'Unlock any relic on Depth 1', sigil: 'sigil_first', reward: 0, icon: '🌅' },
];

export const CHAIN_WORDS: Record<number, string> = {
  2: 'GREAT',
  3: 'WONDERFUL',
  4: 'EXCELLENT',
  5: 'INSANE',
  6: 'LEGENDARY',
};

export const SEASON_ID = 1;
export const COMBO_HOLD_MS = 4200;
export const CROWN_TIER_IDX = RELIC_NAMES.length - 1;
