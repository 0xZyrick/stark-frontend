import {
    logDrop, logMerge, logHold, resetMoveLog, getMoveLog, compressMoves, hashMoves
} from './game-logic.js';

import {
    isAuthenticated, loginWithPrivy, checkSeasonPass, activateSeasonPass, getWalletAddress
} from './privy.js';

import { startRun, settleRun, computeChecksum, connectWallet } from './chain.js';

(function(){
  let COLS, ROWS;
  // Board pressure by campaign progress (world-aware)
  // World 1 Outer: 6x4 → 5x4 → 4x4 → 3x4 (width narrows, height fixed)
  // World 2 Mid:   6x6 → 6x5 → 6x4 → 6x3 (width fixed, height/rows shorten)
  // World 3 Core:  6x6 → 5x5 → 4x4 → 3x3 (square, shrinks both)
  // Endless: cycles tight boards forever
  const LEVEL_BOARD_SIZES = [
    { cols:4, rows:4 }, { cols:5, rows:4 }, { cols:4, rows:4 }, { cols:3, rows:4 },
    { cols:6, rows:6 }, { cols:6, rows:5 }, { cols:6, rows:4 }, { cols:6, rows:3 },
    { cols:6, rows:6 }, { cols:5, rows:5 }, { cols:4, rows:4 }, { cols:3, rows:3 },
  ];
  const ENDLESS_BOARDS = [
    { cols:4, rows:5 }, { cols:3, rows:5 }, { cols:3, rows:4 }, { cols:4, rows:4 },
  ];
  const GUEST_QUESTS = [
    { name:'Threshold Gate', description:'Reach 1,000 score', type:'score', target:1000, cols:4, rows:4 },
    { name:'Star Forge', description:'Make 5 merges', type:'merges', target:5, cols:5, rows:4 },
    { name:'High Orbit', description:'Create a 1,200+ orb', type:'tile', target:1200, cols:4, rows:5 },
    { name:'Tight Circuit', description:'Reach 2,500 score in 18 drops', type:'limited-score', target:2500, moves:18, cols:3, rows:4 },
    { name:'Deep Charge', description:'Create a 4,096+ orb', type:'tile', target:4096, cols:4, rows:5 },
    { name:'Chain Spark', description:'Make a 3-step chain', type:'chain', target:3, cols:5, rows:4 },
  ];
  function boardSizeForTier(tier){
    if (tier < LEVEL_BOARD_SIZES.length) return LEVEL_BOARD_SIZES[tier];
    return ENDLESS_BOARDS[(tier - LEVEL_BOARD_SIZES.length) % ENDLESS_BOARDS.length];
  }
  const CHOICE_MIN_GAP = 28;
  const CHOICE_CHANCE = 0.07;
  const REROLLS_START = 3;
  const POWERS_START = 0;
  const MAX_TIER = 99; // endless — no hard end
  /* Level 1 = 1,000 then +5,000 each depth. Per-merge score is value-based + capped. */
  const SCORE_STAGE_THRESHOLDS = [
    1000, 5000, 10000, 15000,
    20000, 25000, 30000, 35000,
    40000, 45000, 50000, 55000,
  ];
  /* Hierarchy scoring ×3: merge value drives points, then ×3.
     Soft cap so one mega-merge can't clear a whole depth alone. */
  const MERGE_SCORE_CAP = 768; // 256 * 3
  const SCORE_MULTIPLIER = 3;
  function scoreMultiplierForTier(tier){ return 3; }
  function pointsForMerge(newValue, chain){
    // Base = merged tile value (4→4, 8→8, 16→16 …) then ×3 hierarchy multiplier
    let pts = Math.max(2, newValue) * SCORE_MULTIPLIER;
    // Chain spice: +25% per extra step after the first (still soft-capped)
    if (chain >= 2) pts = Math.floor(pts * (1 + 0.25 * Math.min(chain - 1, 4)));
    return Math.min(MERGE_SCORE_CAP, pts);
  }

  const WORLDS = [
    { id:'outer', name:'Outer Spire', icon:'🌑', scene:'scene-outer', start:0, end:3 },
    { id:'mid', name:'Mid Spire', icon:'🌗', scene:'scene-mid', start:4, end:7 },
    { id:'core', name:'Core', icon:'🔥', scene:'scene-core', start:8, end:11 },
    { id:'endless', name:'Endless Spire', icon:'♾️', scene:'scene-endless', start:12, end:999 },
  ];
  function worldForTier(tier){
    if (tier <= 3) return WORLDS[0];
    if (tier <= 7) return WORLDS[1];
    if (tier <= 11) return WORLDS[2];
    return WORLDS[3];
  }
  function depthInWorld(tier){
    if (tier <= 3) return tier + 1;
    if (tier <= 7) return tier - 3;
    if (tier <= 11) return tier - 7;
    return tier - 11;
  }

  const LEVEL_OBJECTIVES = SCORE_STAGE_THRESHOLDS.map((t, i) => ({
    type: 'score',
    target: t,
    label: `Reach ${t.toLocaleString()}`,
  }));
  function objectiveForTier(tier){
    if (tier < LEVEL_OBJECTIVES.length) return LEVEL_OBJECTIVES[tier];
    // Endless: steady climb
    const last = SCORE_STAGE_THRESHOLDS[SCORE_STAGE_THRESHOLDS.length - 1] || 55000;
    const target = last + (tier - SCORE_STAGE_THRESHOLDS.length + 1) * 5000;
    return { type:'score', target, label:`Reach ${target.toLocaleString()}` };
  }

  // Shapes stay pure gameplay readability
  const SYMBOLS = ['✦','✧','◆','★','☀','☄','✺','❂','♦','✹'];
  // Starknet / chain flavor in lore only
  const RELICS = [
    { name:'Ember Shard', symbol:'✦', desc:'First proof written in the Outer Spire.', unlock:'Merge to 2' },
    { name:'Glass Petal', symbol:'✧', desc:'A fragile commitment, sealed in light.', unlock:'Merge to 4' },
    { name:'Iron Bloom', symbol:'◆', desc:'Hard state — the shaft remembers.', unlock:'Merge to 8' },
    { name:'Auric Coil', symbol:'★', desc:'Wound value, like a ledger of gold.', unlock:'Merge to 16' },
    { name:'Nova Seed', symbol:'☀', desc:'A block waiting to finalize.', unlock:'Merge to 32' },
    { name:'Comet Vein', symbol:'☄', desc:'Transit across the Mid Spire void.', unlock:'Merge to 64' },
    { name:'Nebula Core', symbol:'✺', desc:'Many paths, one confirmed state.', unlock:'Merge to 128' },
    { name:'Zenith Prism', symbol:'❂', desc:'Splits signal into pure truth.', unlock:'Merge to 256' },
    { name:'Eclipse Heart', symbol:'♦', desc:'Dark finality in the Core.', unlock:'Merge to 512' },
    { name:'Genesis Key', symbol:'✹', desc:'Root of the Codex. The Spire yields.', unlock:'Merge to 1024' },
  ];
  const RELIC_NAMES = RELICS.map(r => r.name);

  const DEPTH_NAMES = [
    // Outer
    'Threshold Gate', 'Lantern Walk', 'Fog Terrace',
    // Mid
    'Blue Shaft', 'Null Bridge', 'Echo Well',
    // Core
    'Crimson Vein', 'Forge Heart', 'Root Seal',
    // Endless
    'Star-Well', 'Aurora Drift', 'Codex Infinity',
  ];
  const LORE_LINES = [
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
  ];

  const PALETTES = {
    classic: ['#ff6b6b','#ffa94d','#ffd43b','#c0eb75','#69db7c','#38d9a9','#3bc9db','#4dabf7','#748ffc','#da77f2'],
    neon:    ['#ff2e88','#ff5e00','#f4ff2e','#39ff14','#00ffd5','#00c3ff','#3d5cff','#8a2eff','#ff2ee0','#ffffff'],
    sunset:  ['#ff9a3c','#ff6f3c','#ff3c6e','#ff3ca0','#c93cff','#8a3cff','#3c6bff','#3cb4ff','#3cffe0','#ffd93c'],
    aurora:  ['#0fffa8','#0fffd7','#0fd7ff','#0f9dff','#4d6bff','#8a4dff','#c94dff','#ff4dcf','#ff4d8a','#ffd74d'],
    // Optional world layer — not default tile identity
    codex:   ['#ec796b','#ff9f1c','#f3e9d7','#0cfae9','#62b2fd','#517fc9','#8b9dc9','#1b1f3b','#0c0c0c','#ffffff'],
  };

  // Rank is now a rare, persistent title earned by clearing whole worlds —
  // not by collecting things. "min" is the lifetime-best depth tier reached.
  const RANK_TITLES = [
    { min:0,  name:'SPARK DIVER',    icon:'🌑', color:'#8b95a8', line:'First step into the Outer Spire.' },
    { min:4,  name:'PROOF SEEKER',   icon:'🔎', color:'#3bc9db', line:'The Outer Spire is cleared.' },
    { min:8,  name:'CHAIN ATTESTOR', icon:'⛏️', color:'#69db7c', line:'The Mid Spire is cleared.' },
    { min:12, name:'SHAFT WARDEN',   icon:'🛡️', color:'#4dabf7', line:'The Core is cleared. Endless begins.' },
    { min:17, name:'CORE SIGNER',    icon:'🌟', color:'#ff9f1c', line:'You\u2019ve gone deep into Endless.' },
    { min:22, name:'CODEX WALKER',   icon:'📜', color:'#62b2fd', line:'Starknet winds know your name.' },
    { min:27, name:'GENESIS-BOUND',  icon:'👑', color:'#ffbe4d', line:'You hold the Key of the Spire.' },
  ];

  // Spire powers — not candy bombs
  const SPIRE_POWERS = [
    { id:'collapse', name:'Collapse', icon:'⇩', tip:'Column falls & re-merges' },
    { id:'echo', name:'Echo', icon:'◎', tip:'Next merge counts twice' },
    { id:'silence', name:'Silence', icon:'🛡', tip:'One column safe for 1 drop' },
    { id:'forge', name:'Forge', icon:'⚒', tip:'Upgrade one tile one tier' },
  ];
  function rankInfoFor(bestTier){
    let r = RANK_TITLES[0];
    for (const cand of RANK_TITLES){ if (bestTier >= cand.min) r = cand; }
    return r;
  }
  function rankFor(bestTier){ return rankInfoFor(bestTier).name; }

  const CHAIN_WORDS = { 2:'GREAT', 3:'WONDERFUL', 4:'EXCELLENT', 5:'INSANE', 6:'LEGENDARY' };
  function chainWord(chain){
    if (chain >= 6) return 'LEGENDARY';
    if (chain >= 5) return 'INSANE';
    return CHAIN_WORDS[chain] || 'LEGENDARY';
  }

  const SHOP_BOOSTS = [
    { id:'boost_rerolls', name:'Reroll Master', desc:'+2 starting rerolls, every run.', cost:120, icon:'⟲', color:'linear-gradient(135deg,#3bc9db,#1fae7d)' },
    { id:'boost_headstart', name:'Head Start', desc:'Begin each run with a bonus tile on the board.', cost:150, icon:'🚀', color:'linear-gradient(135deg,#4dabf7,#2ec4b6)' },
    { id:'boost_secondchance', name:'Second Wind', desc:'Survive one overflow per run — the full column clears instead.', cost:250, icon:'🌬️', color:'linear-gradient(135deg,#ff9d3f,#ffb648)' },
    { id:'boost_comboshield', name:'Combo Shield', desc:'Your combo survives one missed merge per run.', cost:200, icon:'🛡️', color:'linear-gradient(135deg,#ff6b6b,#ff8e53)' },
  ];
  const SHOP_SKINS = [
    { id:'classic', name:'Classic', desc:'Clean shapes. Pure readability.', cost:0, icon:'◆' },
    { id:'neon', name:'Neon Pulse', desc:'Electric high-contrast tones.', cost:100, icon:'⚡' },
    { id:'sunset', name:'Sunset Glow', desc:'Warm coral glow.', cost:100, icon:'🌇' },
    { id:'aurora', name:'Aurora', desc:'Teal-to-violet shimmer.', cost:150, icon:'🌌' },
    { id:'codex', name:'Starknet Codex', desc:'World layer — Starknet-inspired pack.', cost:200, icon:'📜' },
  ];

  const ACHIEVEMENTS = [
    { id:'depth3', label:'Reach Depth 3', icon:'🗼', cat:'Progress', reward:40, check: ctx => ctx.tier >= 2 },
    { id:'depth5', label:'Reach Depth 5', icon:'🏯', cat:'Progress', reward:70, check: ctx => ctx.tier >= 4 },
    { id:'clearSpire', label:'Clear the Spire', icon:'🏔️', cat:'Progress', reward:150, check: ctx => ctx.tier >= 6 },
    { id:'score10k', label:'Score 10,000', icon:'💰', cat:'Scoring', reward:40, check: ctx => ctx.score >= 10000 },
    { id:'score50k', label:'Score 50,000', icon:'👑', cat:'Scoring', reward:80, check: ctx => ctx.score >= 50000 },
    { id:'score150k', label:'Score 150,000', icon:'💠', cat:'Scoring', reward:120, check: ctx => ctx.score >= 150000 },
    { id:'chain5', label:'Chain 5 merges', icon:'⚡', cat:'Combos', reward:50, check: ctx => ctx.chain >= 5 },
    { id:'chain8', label:'Chain 8 merges', icon:'🌪️', cat:'Combos', reward:90, check: ctx => ctx.chain >= 8 },
    { id:'vault5', label:'Awaken 5 relics', icon:'💎', cat:'Vault', reward:60, check: ctx => ctx.vaultSize >= 5 },
    { id:'vaultFull', label:'Fill the Vault', icon:'🏆', cat:'Vault', reward:200, check: ctx => ctx.vaultSize >= RELIC_NAMES.length },
    { id:'merges100', label:'Merge 100 times', icon:'🔗', cat:'Collection', reward:50, check: ctx => ctx.lifetimeMerges >= 100 },
    { id:'merges500', label:'Merge 500 times', icon:'⛓️', cat:'Collection', reward:150, check: ctx => ctx.lifetimeMerges >= 500 },
    { id:'firstBuy', label:'Make a Shop purchase', icon:'🛍️', cat:'Shop', reward:30, check: ctx => ctx.purchases >= 1 },
    { id:'skinChange', label:'Equip a new skin', icon:'🎨', cat:'Shop', reward:20, check: ctx => ctx.skinChanges >= 1 },
  ];

  // ---------- DOM refs ----------
  const columnsEl = document.getElementById('columns');
  const scoreEl = document.getElementById('scoreEl');
  const highScoreEl = document.getElementById('highScoreEl');
  const vaultCountEl = document.getElementById('vaultCountEl');
  const rankPillEl = document.getElementById('rankPill');
  const heroShardsEl = document.getElementById('heroShardsEl');
  const depthEl = document.getElementById('depthEl');
  const levelProgressBarEl = document.getElementById('levelProgressBar');
  const questBarIconEl = document.getElementById('questBarIcon');
  const questBarNameEl = document.getElementById('questBarName');
  const questBarPctEl = document.getElementById('questBarPct');
  const questBarMetaEl = document.getElementById('questBarMeta');
  const questBarCardEl = document.getElementById('levelBarRow');
  const homeBtn = document.getElementById('homeBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const vaultQuickBtn = document.getElementById('vaultQuickBtn');
  const boardWrapEl = document.getElementById('boardWrap');

  const overlayEl = document.getElementById('overlay');
  const overlayTitleEl = document.getElementById('overlayTitle');
  const finalScoreEl = document.getElementById('finalScore');
  const finalBestEl = document.getElementById('finalBest');
  const finalShardsEl = document.getElementById('finalShards');
  const restartBtn = document.getElementById('restartBtn');
  const settleRunBtn = document.getElementById('settleRunBtn');
  const finalLevelEl = document.getElementById('finalLevel');
  const gameOverLbListEl = document.getElementById('gameOverLbList');
  const overCoinfettiEl = document.getElementById('overCoinfetti');
  const failTipEl = document.getElementById('failTip');

  const activeOrbEl = document.getElementById('activeOrb');
  const nextOrbEl = document.getElementById('nextOrb');
  const heldOrbEl = document.getElementById('heldOrb');
  const heldLaneEl = document.getElementById('heldLane');
  const rerollBtn = null;
  const rerollCountEl = null;
  const undoBtn = document.getElementById('undoBtn');
  const undoCountEl = document.getElementById('undoCount');
  const powerBtn = document.getElementById('powerBtn');
  const powerCountEl = document.getElementById('powerCount');
  const powerTagEl = document.getElementById('powerTag');
  const powerLaneEl = document.getElementById('powerLane');
  const chainRewardEl = document.getElementById('chainRewardEl');
  const comboRewardEl = document.getElementById('comboRewardEl');
  const comboBadgeEl = document.getElementById('comboBadge');
  const comboBadgeNEl = document.getElementById('comboBadgeN');
  const comboMeterFillEl = document.getElementById('comboMeterFill');
  const flashOverlayEl = document.getElementById('flashOverlay');

  const homeShardsEl = document.getElementById('homeShardsEl');
  const homeRankPillEl = document.getElementById('homeRankPill');
  const homeHighScoreEl = document.getElementById('homeHighScore');
  const playerNameEl = document.getElementById('playerNameEl');
  const homeVaultBarEl = document.getElementById('homeVaultBar');
  const lbListEl = document.getElementById('lbList');
  const playBtn = document.getElementById('playBtn');
  const viewLbBtn = document.getElementById('viewLbBtn');
  const dailyBtn = document.getElementById('dailyBtn');
  const splashEl = document.getElementById('splash');
  const loginSeasonChip = document.getElementById('loginSeasonChip');
  const loginRankedBtn = document.getElementById('loginRankedBtn');
  const loginGuestBtn = document.getElementById('loginGuestBtn');
  const loginAuthNote = document.getElementById('loginAuthNote');

  const vaultListEl = document.getElementById('vaultList');
  const vaultShardsEl = document.getElementById('vaultShardsEl');

  const shopShardsEl = document.getElementById('shopShardsEl');
  const shopBoostsGridEl = document.getElementById('shopBoostsGrid');
  const shopSkinsGridEl = document.getElementById('shopSkinsGrid');
  const boostsOwnedTagEl = document.getElementById('boostsOwnedTag');
  const skinsOwnedTagEl = document.getElementById('skinsOwnedTag');

  const achvShardsEl = document.getElementById('achvShardsEl');
  const missionsListEl = document.getElementById('missionsList');
  const missionsDoneTagEl = document.getElementById('missionsDoneTag');
  const achvListEl = document.getElementById('achvList');
  const achvDoneTagEl = document.getElementById('achvDoneTag');

  const nameInputEl = document.getElementById('nameInput');
  const nameSaveBtn = document.getElementById('nameSaveBtn');
  const equippedSkinLabelEl = document.getElementById('equippedSkinLabel');
  const settingsSwatchEl = document.getElementById('settingsSwatch');
  const resetBtn = document.getElementById('resetBtn');

  const choiceOverlayEl = document.getElementById('choiceOverlay');
  const choiceOptionsEl = document.getElementById('choiceOptions');

  const depthClearOverlayEl = document.getElementById('depthClearOverlay');
  const depthClearTitleEl = document.getElementById('depthClearTitle');
  const depthClearScoreEl = document.getElementById('depthClearScore');
  const depthClearShardsEl = document.getElementById('depthClearShards');
  const depthContinueBtn = document.getElementById('depthContinueBtn');
  const depthConfettiEl = document.getElementById('depthConfetti');

  const relicPopEl = document.getElementById('relicPop');
  const relicPopGlyphEl = document.getElementById('relicPopGlyph');
  const relicPopNameEl = document.getElementById('relicPopName');
  const toastPopEl = document.getElementById('toastPop');
  const toastIcEl = document.getElementById('toastIc');
  const toastTagEl = document.getElementById('toastTag');
  const toastNameEl = document.getElementById('toastName');

  const objectivesOverlayEl = document.getElementById('objectivesOverlay');
  const objRankPillEl = document.getElementById('objRankPill');
  const objCurrentScoreEl = document.getElementById('objCurrentScore');
  const objBestScoreEl = document.getElementById('objBestScore');
  const levelObjTitleEl = document.getElementById('levelObjTitle');
  const objMissionsListEl = document.getElementById('objMissionsList');
  const objBackBtn = document.getElementById('objBackBtn');
  const levelObjBodyEl = document.getElementById('levelObjBody');

  const levelStartOverlayEl = document.getElementById('levelStartOverlay');
  const levelStartTitleEl = document.getElementById('levelStartTitle');
  const levelStartObjEl = document.getElementById('levelStartObj');
  const levelStartBtn = document.getElementById('levelStartBtn');

  const climbOverlayEl = document.getElementById('climbOverlay');
  const climbTrackEl = document.getElementById('climbTrack');
  const climbWalkerEl = document.getElementById('climbWalker');
  const climbLabelEl = document.getElementById('climbLabel');

  const pauseOverlayEl = document.getElementById('pauseOverlay');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseHomeBtn = document.getElementById('pauseHomeBtn');

  const pbOverlayEl = document.getElementById('pbOverlay');
  const pbScoreEl = document.getElementById('pbScore');
  const pbOkBtn = document.getElementById('pbOkBtn');
  const pbConfettiEl = document.getElementById('pbConfetti');

  // Placeholder world-background art — drop real files in at these paths later.
  const WORLD_BG_IMAGES = {
    outer: 'images/worlds/outer-spire.jpg',
    mid: 'images/worlds/mid-spire.jpg',
    core: 'images/worlds/core.jpg',
    endless: 'images/worlds/endless-spire.jpg',
  };
  function setWorldBg(worldId){
    const img = document.getElementById('gameBgImg');
    if (!img) return;
    const src = WORLD_BG_IMAGES[worldId] || WORLD_BG_IMAGES.outer;
    if (img.getAttribute('src') !== src){
      img.style.opacity = '0';
      img.setAttribute('src', src);
      img.onerror = () => { img.style.opacity = '0'; };
      img.onload = () => { img.style.opacity = '0.55'; };
    }
  }

  function applyBoardSize(tier){
    const size = boardSizeForTier(tier);
    COLS = size.cols;
    ROWS = size.rows;
    document.documentElement.style.setProperty('--cols', COLS);
    document.documentElement.style.setProperty('--rows', ROWS);
    const world = worldForTier(tier);
    boardWrapEl.className = 'board-wrap ' + (world.scene || 'scene-outer');
    document.getElementById('gamePage').className = `page game-page world-${world.id}`;
    setWorldBg(world.id);
    fitGameLayout();
  }

  function isGuestMode(){ return !currentRunId && !isDaily; }
  function guestQuest(){ return GUEST_QUESTS[guestQuestIndex % GUEST_QUESTS.length]; }
  function guestQuestComplete(){
    const quest = guestQuest();
    if (quest.type === 'score') return score - guestQuestStartScore >= quest.target;
    if (quest.type === 'merges') return mergesThisRun - guestQuestStartMerges >= quest.target;
    if (quest.type === 'tile') return guestQuestTileHit;
    if (quest.type === 'chain') return maxChainThisRun - guestQuestStartChain >= quest.target;
    if (quest.type === 'limited-score') return dropsThisLevel <= quest.moves && score - guestQuestStartScore >= quest.target;
    return false;
  }
  function applyGuestQuest(){
    const quest = guestQuest();
    COLS = quest.cols; ROWS = quest.rows;
    document.documentElement.style.setProperty('--cols', COLS);
    document.documentElement.style.setProperty('--rows', ROWS);
    boardWrapEl.className = `board-wrap guest-board guest-quest-${guestQuestIndex % GUEST_QUESTS.length}`;
    document.getElementById('gamePage').className = 'page game-page guest-mode';
    const img = document.getElementById('gameBgImg');
    if (img) img.style.opacity = '0';
    fitGameLayout();
  }

  // Dynamically size --cell so the whole game page (header, depth chip,
  // quest bar, board, launcher) always fits inside the real viewport height —
  // instead of relying on a fixed vw/vh guess that can overflow on some
  // screens. Measures the actual rendered chrome, then fits the board into
  // whatever space is left.
  let fitLayoutRAF = null;
  function fitGameLayout(){
    const page = document.getElementById('gamePage');
    const header = document.getElementById('gameHeader');
    const rankBanner = document.getElementById('rankBanner');
    const depth = document.getElementById('depthEl');
    const questRow = document.getElementById('levelBarRow');
    const boardWrap = document.getElementById('boardWrap');
    const launcher = document.querySelector('.launcher');
    if (!page || !header || !depth || !questRow || !boardWrap) return;
    if (!document.body.classList.contains('in-game')) return;

    const pageStyles = getComputedStyle(page);
    const padTop = parseFloat(pageStyles.paddingTop) || 0;
    const padBottom = parseFloat(pageStyles.paddingBottom) || 0;
    const padLeft = parseFloat(pageStyles.paddingLeft) || 0;
    const padRight = parseFloat(pageStyles.paddingRight) || 0;
    const rowGap = parseFloat(pageStyles.rowGap) || parseFloat(pageStyles.gap) || 4;

    const boardStyles = getComputedStyle(boardWrap);
    const boardBorderV = (parseFloat(boardStyles.borderTopWidth) || 0) + (parseFloat(boardStyles.borderBottomWidth) || 0);
    const boardBorderH = (parseFloat(boardStyles.borderLeftWidth) || 0) + (parseFloat(boardStyles.borderRightWidth) || 0);

    // Mobile: controls are fixed to the bottom edge. Desktop: fixed side docks.
    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    const launcherH = 0;
    const SAFETY = 6;

    const rankH = rankBanner ? rankBanner.offsetHeight : 0;
    const chromeH = header.offsetHeight + rankH + depth.offsetHeight + questRow.offsetHeight
      + launcherH + rowGap * (isMobile ? 5 : 4) + boardBorderV + SAFETY;
    const availH = page.clientHeight - padTop - padBottom - chromeH;
    const availW = page.clientWidth - padLeft - padRight - boardBorderH;

    const gapPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 6;
    const boardPad = gapPx;
    const rows = ROWS || 5;
    const cols = COLS || 6;

    const cellFromHeight = (availH - boardPad * 2 - (rows - 1) * gapPx) / rows;
    const cellFromWidth = (availW - boardPad * 2 - (cols - 1) * gapPx) / cols;

    let cell = Math.min(cellFromHeight, cellFromWidth);
    if (!isFinite(cell) || cell <= 0) return;
    cell = Math.max(28, Math.min(cell, 120));
    document.documentElement.style.setProperty('--cell', `${cell}px`);
  }
  function scheduleFitGameLayout(){
    if (fitLayoutRAF) cancelAnimationFrame(fitLayoutRAF);
    fitLayoutRAF = requestAnimationFrame(() => { fitLayoutRAF = null; fitGameLayout(); });
  }
  window.addEventListener('resize', scheduleFitGameLayout);
  window.addEventListener('orientationchange', scheduleFitGameLayout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFitGameLayout);
  window.addEventListener('load', scheduleFitGameLayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFitGameLayout).catch(()=>{});

  applyBoardSize(0);

  let tiles = [];
  let nextId = 1;
  let score = 0;
  let highScore = 0;
  let bestTierReached = 0; // lifetime-best depth tier — drives rank (rarer, world-based)
  let guestQuestIndex = 0;
  let guestQuestStartScore = 0;
  let guestQuestStartMerges = 0;
  let guestQuestTileHit = false;
  let guestQuestStartChain = 0;
  let guestQuestTransitioning = false;
  let bestTile = 2;
  let merges = 0;
  let chainCount = 0;
  let maxChainThisRun = 0;
  let combo = 0;
  let comboResetTimer = null;
  const COMBO_HOLD_MS = 4200;
  let dropHadMerge = false;
  let dropMergeScore = 0;
  let lastMergeCol = 0;
  let lastMergeRow = 0;
  let busy = false;
  let gameOver = false;
  let transitioning = false;
  let menuOpen = true;
  let lastAnnouncedTier = 0;
  let paused = false;
  let isDaily = false;
  let levelRelicsThisLevel = 0;
  let levelMaxChainThisLevel = 0;

  let queue = [];
  let held = null;
  let holdLocked = false;
  let rerollsLeft = 0; // reroll removed — undo only
  let undosLeft = 1;   // one undo per run
  let powersLeft = POWERS_START;
  let activePower = null; // SPIRE_POWERS entry when arming
  let echoArmed = false;
  let silenceCol = null;
  let silenceDropsLeft = 0;
  let lastDropSnapshot = null;
  let pendingChoice = null;
  let dropsSinceChoice = 0;

  let playerName = null;
  let vaultSet = new Set();
  let achvSet = new Set();

  let shards = 0;
  let shardsEarnedThisRun = 0;
  let ownedBoosts = new Set();
  let ownedSkins = new Set(['classic']);
  let equippedSkin = 'classic';
  let lifetimeMerges = 0;
  let purchasesMade = 0;
  let skinChangesMade = 0;
  let playStreak = 0;
  let lastPlayDate = '';

  let mergesThisRun = 0;
  let maxComboThisRun = 0;
  let relicsThisRun = 0;
  let sessionMissionsClaimed = new Set();
  let secondWindUsedThisRun = false;
  let comboShieldUsedThisRun = false;

  const SESSION_MISSIONS = [
    { id:'m_depth2', label:'Clear Depth 2', reward:25, icon:'🗼', check: () => currentTier() >= 1 },
    { id:'m_relic3', label:'Unlock 3 relics (lifetime)', reward:40, icon:'💎', check: () => vaultSet.size >= 3 },
    { id:'m_chain4', label:'Make a 4-chain', reward:30, icon:'⚡', check: () => maxChainThisRun >= 4 },
    { id:'m_noreroll', label:'Finish a run using 0 rerolls', reward:35, icon:'🎯', check: () => gameOver && rerollsUsedThisRun === 0 },
    { id:'m_danger', label:'Survive a danger column', reward:20, icon:'🌬️', check: () => survivedDangerThisRun },
    { id:'m_score5k', label:'Reach 5,000 in one run', reward:25, icon:'💰', check: () => score >= 5000 },
    { id:'m_relicEarly', label:'Unlock a relic before Depth 3', reward:30, icon:'✨', check: () => relicsThisRun >= 1 && currentTier() < 2 },
    { id:'m_runs3', label:'Complete 3 runs', reward:40, icon:'🔁', check: () => lifetimeRuns >= 3 },
  ];
  // Daily Missions — placeholder pool. Your spec wants these built around
  // specific merge types ("5 star-orb merges", "6 shaper merges"), which
  // needs merge-type counters that don't exist yet (roadmap item 7). These
  // use stats that already exist so the streak/mission shell is real and
  // working today; swap `check` (and add counters) once that instrumentation
  // lands — the shell (streak, daily reset, claiming) doesn't need to change.
  const DAILY_MISSIONS = [
    { id:'d_score3k', label:'Score 3,000 in a run', reward:20, icon:'💰', check: () => score >= 3000 },
    { id:'d_depth3', label:'Reach Depth 3', reward:20, icon:'🗼', check: () => currentTier() >= 2 },
    { id:'d_chain3', label:'Pull a 3-chain', reward:15, icon:'⚡', check: () => maxChainThisRun >= 3 },
  ];
  const HIDDEN_QUESTS = [
    { id:'hq_silent', label:'Silent Column', desc:'Clear a full column without a drop miss', sigil:'sigil_silent', check: () => false },
    { id:'hq_nohold', label:'No-Hold Path', desc:'Score 3,000 without using Hold', sigil:'sigil_nohold', check: () => score >= 3000 && !usedHoldThisRun },
    { id:'hq_double', label:'Twin Stars', desc:'Create two tiles ≥128 in one run', sigil:'sigil_twin', check: () => highTilesThisRun >= 2 },
    { id:'hq_edge', label:'Edge of Overflow', desc:'Survive with a column at max-1 then merge', sigil:'sigil_edge', check: () => survivedDangerThisRun },
    { id:'hq_first', label:'First Light', desc:'Unlock any relic on Depth 1', sigil:'sigil_first', check: () => relicsThisRun >= 1 && currentTier() === 0 },
  ];
  const SIGILS = [
    { id:'sigil_silent', name:'Silent Column', icon:'🔇', desc:'Cleared under pressure without noise.' },
    { id:'sigil_nohold', name:'No-Hold Path', icon:'🚫', desc:'Refused the easy pocket.' },
    { id:'sigil_twin', name:'Twin Stars', icon:'✨', desc:'Two high lights in one descent.' },
    { id:'sigil_edge', name:'Edge Walker', icon:'⚠️', desc:'Danced on the brim of overflow.' },
    { id:'sigil_first', name:'First Light', icon:'🌅', desc:'A relic before the second depth.' },
  ];
  let sigilSet = new Set();
  let lifetimeRuns = 0;
  let rerollsUsedThisRun = 0;
  let usedHoldThisRun = false;
  let survivedDangerThisRun = false;
  let highTilesThisRun = 0;
  let hiddenClaimed = new Set();
  let dailyBest = 0;
  let dailyMissionsDoneToday = new Set();
  let dailyMissionsDate = null; // 'YYYY-MM-DD' the doneToday set currently belongs to
  let dailyStreakCount = 0;
  let dailyStreakLastDate = null; // 'YYYY-MM-DD', local

  function todayStr(){
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const SEASON_ID = 1;
  // Ranked-run state — null whenever the run is local/guest practice.
  // Set by the "Ranked Run" home CTA, read by endGame()'s "Settle on
  // Starknet" button, cleared on restart(). See js/chain.js.
  let currentRunId = null;
  let currentRunSettled = false;
  let checkpointFiredThisLevel = false;
  let modifierUsedThisLevel = false;
  let modifierArmDropIndex = 0;
  let dropsThisLevel = 0;
  let modifierActive = false;
  let friendsList = [];
  function rollModifierArmIndex(){ return 3 + Math.floor(Math.random() * 7); } // 3rd–9th drop of the level

  const colEls = [];

  // ---------- Sound engine ----------
  let audioCtx = null;
  let soundOn = true;
  let hapticOn = true;
  function ensureAudio(){
    if (!soundOn) return null;
    if (!audioCtx){
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function beep({freq=440, dur=0.12, type='sine', gain=0.18, delay=0, slideTo=null}={}){
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function sndDrop(){ beep({freq:220, dur:0.07, type:'triangle', gain:0.12}); }
  function sndMerge(chain){
    const note = 440 * Math.pow(2, Math.min(chain,10) * 0.12);
    beep({freq:note, dur:0.16, type:'sine', gain:0.2, slideTo: note*1.5});
  }
  function sndCombo(n){
    const base = 300 + Math.min(n,10) * 40;
    beep({freq:base, dur:0.1, type:'square', gain:0.12});
    beep({freq:base*1.5, dur:0.14, type:'square', gain:0.12, delay:0.06});
  }
  function sndRelic(){ [660, 880, 1100].forEach((f,i) => beep({freq:f, dur:0.18, type:'sine', gain:0.16, delay:i*0.07})); }
  function sndAchievement(){ [523, 659, 784, 1046].forEach((f,i) => beep({freq:f, dur:0.16, type:'triangle', gain:0.15, delay:i*0.08})); }
  function sndOverflow(){ beep({freq:200, dur:0.5, type:'sawtooth', gain:0.15, slideTo:60}); }
  function sndLevelUp(){
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f,i) => beep({freq:f, dur:0.22, type:'triangle', gain:0.17, delay:i*0.09}));
    beep({freq:1568, dur:0.35, type:'sine', gain:0.13, delay:notes.length*0.09});
  }
  function sndShard(){ beep({freq:1200, dur:0.09, type:'sine', gain:0.12}); }
  function sndBuy(){ [700, 1000, 1300].forEach((f,i) => beep({freq:f, dur:0.1, type:'triangle', gain:0.14, delay:i*0.05})); }
  function sndClick(){ beep({freq:480, dur:0.04, type:'sine', gain:0.08}); }
  function sndUI(){ beep({freq:620, dur:0.05, type:'triangle', gain:0.07}); }

  // Soft ambient bed music (procedural, no external files)
  let musicOn = true;
  let musicNodes = null;
  let musicGain = null;
  function startMusic(){
    if (!soundOn || !musicOn) return;
    const ctx = ensureAudio();
    if (!ctx || musicNodes) return;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.035;
    musicGain.connect(ctx.destination);
    const notes = [110, 138.59, 164.81, 207.65]; // soft minor drone
    musicNodes = notes.map((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      g.gain.value = 0.25 - i * 0.04;
      // slow pulse
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.08 + i * 0.03;
      lfoG.gain.value = 0.08;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      osc.connect(g);
      g.connect(musicGain);
      osc.start();
      lfo.start();
      return { osc, g, lfo };
    });
  }
  function stopMusic(){
    if (!musicNodes) return;
    try {
      musicNodes.forEach(n => { n.osc.stop(); n.lfo.stop(); });
    } catch(e){}
    musicNodes = null;
    if (musicGain){ try { musicGain.disconnect(); } catch(e){} musicGain = null; }
  }
  function setMusicIntensity(tier){
    if (!musicGain) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const target = 0.028 + Math.min(tier, 6) * 0.008;
    musicGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.8);
  }

  function vibrate(ms){
    if (!hapticOn) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e){}
  }

  async function loadSoundPref(){
    try {
      const res = await window.storage.get('sound-on');
      soundOn = res ? res.value !== 'false' : true;
    } catch(e){ soundOn = true; }
    try {
      const res2 = await window.storage.get('haptic-on');
      hapticOn = res2 ? res2.value !== 'false' : true;
    } catch(e){ hapticOn = true; }
    try {
      const res3 = await window.storage.get('music-on');
      musicOn = res3 ? res3.value !== 'false' : true;
    } catch(e){ musicOn = true; }
    updateSoundSwitch();
    updateHapticSwitch();
    updateMusicSwitch();
  }
  // .sound-switch/.haptic-switch/.music-switch may appear more than once
  // (Settings page + the Pause menu's compact copy) — keep every instance
  // in sync instead of just one by id.
  function updateSoundSwitch(){ document.querySelectorAll('.sound-switch').forEach(el => el.classList.toggle('on', soundOn)); }
  function updateHapticSwitch(){ document.querySelectorAll('.haptic-switch').forEach(el => el.classList.toggle('on', hapticOn)); }
  function updateMusicSwitch(){ document.querySelectorAll('.music-switch').forEach(el => el.classList.toggle('on', musicOn)); }
  function toggleSound(){
    soundOn = !soundOn;
    updateSoundSwitch();
    try { window.storage.set('sound-on', String(soundOn)); } catch(e){}
    if (soundOn){
      beep({freq:660, dur:0.08, gain:0.15});
      startMusic();
    } else {
      stopMusic();
    }
  }
  function toggleMusic(){
    musicOn = !musicOn;
    updateMusicSwitch();
    try { window.storage.set('music-on', String(musicOn)); } catch(e){}
    if (musicOn && soundOn) startMusic(); else stopMusic();
  }
  function toggleHaptic(){
    hapticOn = !hapticOn;
    updateHapticSwitch();
    try { window.storage.set('haptic-on', String(hapticOn)); } catch(e){}
    if (hapticOn) vibrate(30);
  }

  function symbolFor(value){
    const idx = Math.log2(value) - 1;
    if (idx >= 0 && idx < SYMBOLS.length) return SYMBOLS[idx];
    return SYMBOLS[SYMBOLS.length - 1];
  }
  function relicIdxFor(value){
    const idx = Math.log2(value) - 1;
    return Math.max(0, Math.min(idx, RELIC_NAMES.length - 1));
  }
  // Uncapped tier index — used for color so high-value orbs never all collapse
  // into the same look. relicIdxFor (above) stays capped for vault/relic bookkeeping.
  function tierIndexFor(value){ return Math.max(0, Math.log2(value) - 1); }
  const CROWN_TIER_IDX = RELIC_NAMES.length - 1; // highest defined relic tier (value 1024)
  function paletteFor(value){
    const pal = PALETTES[equippedSkin] || PALETTES.classic;
    const idx = tierIndexFor(value);
    if (idx < pal.length) return pal[Math.round(idx)];
    // Beyond the base palette (deep endless play): keep generating a fresh,
    // clearly distinct hue per tier instead of clamping to the last color.
    const hue = (idx * 137.508) % 360; // golden-angle step — never repeats nearby
    return `hsl(${hue.toFixed(0)}, 78%, 58%)`;
  }
  function renderOrbEl(el, value){
    const idx = tierIndexFor(value);
    const isCrown = idx >= CROWN_TIER_IDX;
    el.classList.toggle('orb-crown', isCrown);
    const glyph = isCrown ? '👑' : symbolFor(value);
    el.innerHTML = `<span class="glyph">${glyph}</span><span class="num">${value}</span>`;
    const base = paletteFor(value);
    // Solid thick orbs — no transparency
    el.style.opacity = '1';
    el.style.background = `radial-gradient(circle at 32% 28%, #ffffff 0%, ${base} 42%, ${base} 100%)`;
    el.style.boxShadow = `inset 0 -7px 12px rgba(0,0,0,0.4), inset 0 8px 10px rgba(255,255,255,0.55), 0 5px 14px rgba(0,0,0,0.5)`;
  }

  function currentTier(){
    let t = 0;
    for (const threshold of SCORE_STAGE_THRESHOLDS){
      if (score >= threshold) t++; else break;
    }
    // Endless: keep climbing past campaign thresholds
    if (t >= SCORE_STAGE_THRESHOLDS.length){
      let last = SCORE_STAGE_THRESHOLDS[SCORE_STAGE_THRESHOLDS.length - 1];
      let extra = score - last;
      let step = 2200;
      while (extra >= step && t < MAX_TIER){
        t++;
        extra -= step;
        step = Math.floor(step * 1.15);
      }
    }
    return t;
  }

  function currentObjective(){
    return objectiveForTier(currentTier());
  }

  function boardMinValue(){
    if (tiles.length === 0) return null;
    let min = Infinity;
    for (const t of tiles) if (t.value < min) min = t.value;
    return min;
  }

  function spawnValue(){
    const tier = currentTier();
    const base = Math.pow(2, tier + 1);
    const minOnBoard = boardMinValue();
    // Early game: generous assists so merges come fast and feel good.
    // Later: assists fade, heavier spawns add pressure.
    const assistChance = tier <= 1 ? 0.48 : tier <= 3 ? 0.32 : Math.max(0.06, 0.28 - tier * 0.035);
    if (minOnBoard !== null && minOnBoard < base && Math.random() < assistChance){
      return minOnBoard;
    }
    const r = Math.random();
    if (tier <= 1){
      // Mostly base + base*2 — easy chain fuel
      if (r < 0.62) return base;
      if (r < 0.92) return base * 2;
      return base * 4;
    }
    const pressure = Math.min(0.26, tier * 0.02);
    if (r < 0.50 - pressure) return base;
    if (r < 0.84 - pressure * 0.5) return base * 2;
    return base * 4;
  }

  function distinctChoiceValues(){
    const vals = new Set();
    let guard = 0;
    while (vals.size < 3 && guard < 30){ vals.add(spawnValue()); guard++; }
    const arr = Array.from(vals);
    while (arr.length < 3) arr.push(arr[arr.length - 1] * 2);
    return arr.slice(0, 3);
  }

  function showChoiceOverlay(){
    if (busy || gameOver || paused) return;
    choiceOptionsEl.innerHTML = '';
    const RANK_META = [
      { label:'SAFE', border:'#2ec4b6' },
      { label:'MID', border:'#ff9f1c' },
      { label:'BOLD', border:'#ff6b6b' },
    ];
    const sorted = [...pendingChoice].sort((a,b) => a - b);
    pendingChoice.forEach((val, i) => {
      const rank = sorted.indexOf(val);
      const meta = RANK_META[Math.min(rank, 2)] || RANK_META[1];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = `background:#151c28; border:2px solid ${meta.border}; border-radius:16px; padding:10px 12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px; min-width:78px;`;
      const orb = document.createElement('div');
      orb.className = 'orb mini';
      renderOrbEl(orb, val);
      const label = document.createElement('span');
      label.style.cssText = 'font-family: var(--font-display); font-weight:800; font-size:10px; letter-spacing:0.06em; color: var(--ink-dim);';
      label.textContent = meta.label;
      btn.appendChild(orb);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        queue[0] = pendingChoice[i];
        pendingChoice = null;
        choiceOverlayEl.classList.remove('show');
        menuOpen = false;
        updateLauncher();
        sndUI();
      });
      choiceOptionsEl.appendChild(btn);
    });
    menuOpen = true; // block drops while choosing
    choiceOverlayEl.classList.add('show');
  }

  let choiceUsedThisLevel = false;

  function refillOnDeck(){ queue[1] = spawnValue(); }

  function maybeTriggerLoadedChoice(){
    dropsSinceChoice += 1;
    if (busy || gameOver || paused || menuOpen || pendingChoice) return;
    if (!choiceUsedThisLevel && dropsSinceChoice >= CHOICE_MIN_GAP && Math.random() < CHOICE_CHANCE){
      pendingChoice = distinctChoiceValues();
      dropsSinceChoice = 0;
      choiceUsedThisLevel = true;
      // Brief beat so it doesn't slam the player mid-flow
      setTimeout(() => {
        if (!gameOver && !paused && pendingChoice) showChoiceOverlay();
      }, 350);
    }
  }

  function initQueue(){
    queue = [spawnValue(), null];
    refillOnDeck();
  }

  function buildColumns(){
    columnsEl.innerHTML = '';
    colEls.length = 0;
    for (let c=0; c<COLS; c++){
      const col = document.createElement('div');
      col.className = 'col';
      col.tabIndex = 0;
      col.setAttribute('role','button');
      col.setAttribute('aria-label', `Drop tile in column ${c+1}`);
      col.addEventListener('click', () => dropTile(c));
      col.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') dropTile(c); });
      columnsEl.appendChild(col);
      colEls.push(col);
    }
    setupSwipe();
  }

  // (power system removed)

  function tilesInColumn(c){ return tiles.filter(t => t.col === c).sort((a,b) => a.row - b.row); }
  function lowestEmptyRow(c){ return tilesInColumn(c).length; }
  function getTileAt(c, r){ return tiles.find(t => t.col === c && t.row === r) || null; }

  function positionEl(el, col, row){
    // Tiles live inside their column — only vertical position
    el.style.left = '0';
    el.style.right = '0';
    el.style.width = '100%';
    el.style.bottom = `calc(${row} * (var(--cell) + var(--gap)))`;
  }

  function createTileEl(tile, animateIn){
    const el = document.createElement('div');
    el.className = 'tile';
    renderOrbEl(el, tile.value);
    if (tile.isModifier){
      el.classList.add('modifier-orb');
      const badge = document.createElement('span');
      badge.className = 'modifier-badge';
      badge.textContent = '✨';
      el.appendChild(badge);
    }
    el.style.position = 'absolute';
    const parent = colEls[tile.col] || columnsEl;
    positionEl(el, tile.col, animateIn ? ROWS + 1 : tile.row);
    parent.appendChild(el);
    tile.el = el;
    if (animateIn){
      requestAnimationFrame(() => requestAnimationFrame(() => {
        positionEl(el, tile.col, tile.row);
        el.classList.add('land');
        setTimeout(() => el.classList.remove('land'), 300);
      }));
    }
    return el;
  }

  function applyGravity(){
    for (let c=0; c<COLS; c++){
      const col = tilesInColumn(c);
      col.forEach((t, i) => {
        if (t.row !== i){ t.row = i; positionEl(t.el, t.col, t.row); }
      });
    }
  }

  function findAdjacentPair(){
    for (const t of tiles){
      const right = getTileAt(t.col + 1, t.row);
      if (right && right.value === t.value) return [t, right];
      const up = getTileAt(t.col, t.row + 1);
      if (up && up.value === t.value) return [t, up];
    }
    return null;
  }

  function spawnRing(col, row, chain){
    const ring = document.createElement('div');
    ring.className = 'ring';
    const scale = Math.min(1.1 + chain * 0.4, 3.5);
    ring.style.setProperty('--ringScale', scale);
    if (chain >= 5) ring.classList.add('ring-insane');
    else if (chain >= 3) ring.classList.add('ring-hot');
    ring.style.left = '0';
    ring.style.width = '100%';
    ring.style.height = 'var(--cell)';
    ring.style.bottom = `calc(${row} * (var(--cell) + var(--gap)))`;
    const parent = colEls[col] || columnsEl;
    parent.appendChild(ring);
    setTimeout(() => ring.remove(), 580);
  }

  function spawnSparkles(col, row, chain){
    const count = Math.min(5 + chain * 3, 16);
    const parent = colEls[col] || columnsEl;
    for (let i=0; i<count; i++){
      const p = document.createElement('div');
      p.className = 'spark';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 18 + Math.random() * 22 + chain * 3;
      p.style.left = '50%';
      p.style.bottom = `calc(${row} * (var(--cell) + var(--gap)) + var(--cell)/2)`;
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      p.style.background = chain >= 5 ? '#9df24d' : chain >= 3 ? 'var(--coral)' : '#ffffff';
      p.style.width = '6px';
      p.style.height = '6px';
      parent.appendChild(p);
      setTimeout(() => p.remove(), 560);
    }
  }

  const CHAIN_COLORS = { GREAT:'#ffb648', WONDERFUL:'#ff9d3f', EXCELLENT:'#ff6b6b', INSANE:'#9df24d', LEGENDARY:'#ffd27a' };
  function showChainReward(chain){
    if (chain < 2) return;
    const word = chainWord(chain);
    chainRewardEl.textContent = `${word}!`;
    chainRewardEl.style.color = CHAIN_COLORS[word] || 'var(--gold)';
    const duration = chain >= 6 ? 1600 : chain >= 4 ? 1350 : 1100;
    chainRewardEl.style.animationDuration = `${duration}ms`;
    showExclusiveBanner(chainRewardEl, duration);
    if (chain >= 3) vibrate(chain >= 5 ? [40, 30, 60] : 40);
  }

  function spawnFloatScore(col, row, amount, isBonus){
    const el = document.createElement('div');
    el.className = 'float-score';
    el.textContent = isBonus ? `+${amount.toLocaleString()} COMBO` : `+${amount.toLocaleString()}`;
    if (isBonus) el.style.color = '#ffb648';
    el.style.left = '50%';
    el.style.bottom = `calc(${row} * (var(--cell) + var(--gap)) + var(--cell) + 4px)`;
    const parent = colEls[col] || columnsEl;
    parent.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  const COMBO_COLORS = ['#ffb23f','#ff9a3f','#ff8040','#ff6248','#ff4d5a'];
  function comboColor(n){ return COMBO_COLORS[Math.min(n - 2, COMBO_COLORS.length - 1)]; }

  function showComboReward(n){
    // Prefer chain banner over combo text if both fire; combo badge already shows on HUD
    if (toastPlaying || bannerBusy) return;
    comboRewardEl.textContent = `COMBO x${n}!`;
    comboRewardEl.style.color = comboColor(n);
    showExclusiveBanner(comboRewardEl, 1000);
  }

  function showComboBadge(n){
    comboBadgeNEl.textContent = `x${n}`;
    comboBadgeEl.style.background = `linear-gradient(135deg, ${comboColor(n)}, #ff4d5a)`;
    comboBadgeEl.classList.remove('show');
    void comboBadgeEl.offsetWidth;
    comboBadgeEl.classList.add('show');
    comboMeterFillEl.style.transition = 'none';
    comboMeterFillEl.style.transform = 'scaleX(1)';
    void comboMeterFillEl.offsetWidth;
    comboMeterFillEl.style.transition = `transform ${COMBO_HOLD_MS}ms linear`;
    comboMeterFillEl.style.transform = 'scaleX(0)';
  }

  function hideComboBadge(){ comboBadgeEl.classList.remove('show'); }

  function updateCombo(hadMerge, mergeScore, col, row){
    if (!hadMerge){
      if (ownedBoosts.has('boost_comboshield') && !comboShieldUsedThisRun && combo > 0){
        comboShieldUsedThisRun = true;
        showToast('🛡️', 'BOOST', 'Combo Shield — streak saved!');
        clearTimeout(comboResetTimer);
        comboResetTimer = setTimeout(() => { combo = 0; hideComboBadge(); }, COMBO_HOLD_MS);
        return;
      }
      combo = 0;
      clearTimeout(comboResetTimer);
      hideComboBadge();
      return;
    }
    combo += 1;
    maxComboThisRun = Math.max(maxComboThisRun, combo);
    clearTimeout(comboResetTimer);
    comboResetTimer = setTimeout(() => { combo = 0; hideComboBadge(); }, COMBO_HOLD_MS);
    if (combo >= 2){
      const mult = Math.min(1 + (combo - 1) * 0.25, 3);
      const bonus = Math.round(mergeScore * (mult - 1));
      if (bonus > 0){
        score += bonus;
        updateHud();
        spawnFloatScore(col, row, bonus, true);
      }
      showComboBadge(combo);
      showComboReward(combo);
      sndCombo(combo);
    } else {
      hideComboBadge();
    }
    checkSessionMissions();
  }

  function flashScreen(chain){
    flashOverlayEl.classList.remove('flash', 'flash-hot', 'flash-insane', 'flash-legendary');
    void flashOverlayEl.offsetWidth;
    if (chain >= 7) flashOverlayEl.classList.add('flash-legendary');
    else if (chain >= 5) flashOverlayEl.classList.add('flash-insane');
    else if (chain >= 3) flashOverlayEl.classList.add('flash-hot');
    flashOverlayEl.classList.add('flash');
  }

  function shakeBoard(big){
    boardWrapEl.classList.remove('shake', 'shake-big');
    void boardWrapEl.offsetWidth;
    boardWrapEl.classList.add(big ? 'shake-big' : 'shake');
    setTimeout(() => boardWrapEl.classList.remove('shake', 'shake-big'), big ? 440 : 340);
  }

  function shakeTube(col){
    const el = colEls[col];
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 260);
  }

  function updateDangerColumns(){
    for (let c = 0; c < COLS; c++){
      const len = tilesInColumn(c).length;
      colEls[c]?.classList.toggle('danger', len >= ROWS - 1 && len < ROWS);
    }
  }

  // ---------- Currency / shards ----------
  function spawnShardFloat(text, x, y){
    const el = document.createElement('div');
    el.className = 'shard-float';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }
  async function awardShards(n, originEl){
    if (n <= 0) return;
    shards += n;
    shardsEarnedThisRun += n;
    try { await window.storage.set('shards', String(shards)); } catch(e){}
    updateAllShardDisplays();
    sndShard();
    const ref = originEl || heroShardsEl;
    if (ref && ref.getBoundingClientRect){
      const r = ref.getBoundingClientRect();
      spawnShardFloat(`+${n}`, r.left, r.top - 6);
    }
  }
  function updateAllShardDisplays(){
    const v = shards.toLocaleString();
    [heroShardsEl, homeShardsEl, vaultShardsEl, shopShardsEl, achvShardsEl].forEach(el => { if (el) el.textContent = v; });
  }

  let lastKnownRankName = null;
  function updateHud(){
    scoreEl.textContent = score.toLocaleString();
    if (score > highScore){
      highScore = score;
      highScoreEl.textContent = highScore.toLocaleString();
      scoreEl.classList.remove('newhigh');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('newhigh');
      try { window.storage.set('high-score', String(highScore)); } catch(e){}
    }
    const d = currentTier();
    if (!isGuestMode()) maybeAdvanceBestTier(d);
    const ri = rankInfoFor(bestTierReached);
    if (rankPillEl) rankPillEl.textContent = ri.name;
    const rankBadgeEl = document.getElementById('headerRankBadge');
    if (rankBadgeEl) rankBadgeEl.textContent = ri.icon;
    if (lastKnownRankName === null) lastKnownRankName = ri.name;
    else if (ri.name !== lastKnownRankName){
      const prev = lastKnownRankName;
      lastKnownRankName = ri.name;
      showRankUp(prev, ri);
    }
    // Guest and Daily runs are local practice; only a contract-backed run
    // participates in live standings.
    if (currentRunId) maybeRefreshLiveLbRank();
    const world = worldForTier(d);
    const dName = DEPTH_NAMES[Math.min(d, DEPTH_NAMES.length - 1)] || `Depth ${d + 1}`;
    depthEl.textContent = world.id === 'endless' ? `ENDLESS` : `DEPTH ${depthInWorld(d)}`;
    depthEl.title = `${world.name} · ${dName}`;

    const guest = isGuestMode() ? guestQuest() : null;
    const obj = guest ? { target: guest.target, label: guest.description } : currentObjective();
    const tier = currentTier();
    const target = obj.target;
    let prevThreshold = 0;
    if (!guest && tier > 0 && tier <= SCORE_STAGE_THRESHOLDS.length){
      prevThreshold = SCORE_STAGE_THRESHOLDS[tier - 1] || 0;
    } else if (tier > SCORE_STAGE_THRESHOLDS.length){
      const prevObj = objectiveForTier(tier - 1);
      prevThreshold = prevObj.target;
    }
    const span = Math.max(1, target - prevThreshold);
    let progressValue = score;
    if (guest && guest.type === 'merges') progressValue = mergesThisRun - guestQuestStartMerges;
    if (guest && guest.type === 'tile') progressValue = bestTile;
    if (guest && guest.type === 'chain') progressValue = maxChainThisRun - guestQuestStartChain;
    if (guest && guest.type === 'limited-score') progressValue = score - guestQuestStartScore;
    const raw = ((progressValue - prevThreshold) / span) * 100;
    const pct = Math.max(0, Math.min(100, raw));
    if (levelProgressBarEl){
      const w = pct.toFixed(2) + '%';
      levelProgressBarEl.style.width = w;
      levelProgressBarEl.style.minWidth = pct > 0 && pct < 3 ? '6px' : '';
      levelProgressBarEl.setAttribute('data-pct', String(Math.round(pct)));
      const track = levelProgressBarEl.parentElement;
      if (track) track.style.setProperty('--progress', w);
    }
    const worldIcon = { outer:'🗺️', mid:'⛓️', core:'🔥', endless:'♾️' }[world.id] || '🗺️';
    if (questBarIconEl) questBarIconEl.textContent = guest ? '🎯' : worldIcon;
    if (questBarNameEl) questBarNameEl.textContent = guest ? guest.name : dName;
    if (questBarPctEl) questBarPctEl.textContent = `${Math.round(pct)}%`;
    if (questBarMetaEl){
      if (guest && guest.moves) questBarMetaEl.textContent = `${Math.min(dropsThisLevel, guest.moves)} / ${guest.moves} moves · ${Math.max(0, score - guestQuestStartScore).toLocaleString()} / ${guest.target.toLocaleString()}`;
      else if (guest && guest.type === 'merges') questBarMetaEl.textContent = `${Math.max(0, mergesThisRun - guestQuestStartMerges)} / ${guest.target} merges`;
      else if (guest && guest.type === 'tile') questBarMetaEl.textContent = `Best orb ${bestTile.toLocaleString()} / ${guest.target}`;
      else if (guest && guest.type === 'chain') questBarMetaEl.textContent = `${Math.max(0, maxChainThisRun - guestQuestStartChain)} / ${guest.target} chain`;
      else if (guest) questBarMetaEl.textContent = `${Math.max(0, score - guestQuestStartScore).toLocaleString()} / ${guest.target.toLocaleString()} score`;
      else questBarMetaEl.textContent = `${score.toLocaleString()} / ${target.toLocaleString()} score`;
    }
    if (questBarCardEl) questBarCardEl.classList.toggle('near-complete', pct >= 85);
    if (levelObjBodyEl) levelObjBodyEl.textContent = obj.label;
    if (isGuestMode() && guestQuestComplete()) completeGuestQuest();
    if (!checkpointFiredThisLevel && !gameOver && pct >= 50 && pct < 100){
      checkpointFiredThisLevel = true;
      showLevelCheckpoint();
    }
    updateDangerColumns();
  }

  function showLevelCheckpoint(){
    showToast('🔥', 'CHECKPOINT', 'Halfway to the next depth!');
    flashScreen(1);
    vibrate(25);
  }

  function refreshHomeScreen(){
    const ri = rankInfoFor(bestTierReached);
    homeRankPillEl.textContent = `${ri.icon} ${ri.name}`;
    homeHighScoreEl.textContent = highScore.toLocaleString();
    const homeRunsEl = document.getElementById('homeRunsPlayed');
    if (homeRunsEl) homeRunsEl.textContent = lifetimeRuns.toLocaleString();
    if (playerNameEl) playerNameEl.textContent = playerName || 'Player';
    const homePlayerNameEl = document.getElementById('homePlayerNameEl');
    if (homePlayerNameEl) homePlayerNameEl.textContent = playerName || 'Player';

    // Depth / world progress on hub (core loop reminder)
    const depthChip = document.getElementById('homeDepthChip');
    if (depthChip){
      if (lifetimeRuns === 0 && bestTierReached === 0){
        depthChip.textContent = 'Your first descent awaits';
        depthChip.classList.add('first-run');
      } else {
        const world = worldForTier(bestTierReached);
        const depth = depthInWorld(bestTierReached);
        depthChip.textContent = `Best: ${world.name} · Depth ${depth}`;
        depthChip.classList.remove('first-run');
      }
    }

    updateAllShardDisplays();
    refreshHomeLeaderboardPreview();
    renderLevelsGrid();
  }

  let selectedStartTier = 0;
  const PATH_NODE_COUNT = 16; // nodes shown on the map
  const PATH_STEP_Y = 78;     // vertical spacing between nodes

  function pathNodeXY(i, total){
    // Zigzag left-right up the map (Candy Crush style)
    const y = (total - 1 - i) * PATH_STEP_Y + 40;
    const side = i % 2 === 0 ? 0.28 : 0.72;
    // slight organic sway
    const sway = Math.sin(i * 1.7) * 0.04;
    const xPct = Math.max(0.18, Math.min(0.82, side + sway));
    return { xPct, y };
  }

  function renderPathMap(canvasEl, opts){
    if (!canvasEl) return;
    const {
      highlightTier = null,      // just-unlocked tier to animate
      selectable = false,        // allow picking a start depth
      focusTier = null,          // scroll this node into view
    } = opts || {};

    const unlockedUpTo = Math.min(bestTierReached + 1, PATH_NODE_COUNT - 1);
    const total = PATH_NODE_COUNT;
    const height = (total - 1) * PATH_STEP_Y + 80;
    canvasEl.style.height = height + 'px';
    canvasEl.innerHTML = '';

    // Positions
    const pts = [];
    for (let i = 0; i < total; i++){
      const p = pathNodeXY(i, total);
      pts.push({ i, x: p.xPct * 100, y: p.y });
    }

    // SVG path line
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'path-svg');
    svg.setAttribute('viewBox', `0 0 100 ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const makePath = (upTo) => {
      let d = '';
      for (let i = 0; i <= upTo && i < pts.length; i++){
        const p = pts[i];
        d += (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`;
      }
      return d;
    };

    const lineBg = document.createElementNS(svgNS, 'path');
    lineBg.setAttribute('class', 'path-line');
    lineBg.setAttribute('d', makePath(total - 1));
    svg.appendChild(lineBg);

    const lineGlow = document.createElementNS(svgNS, 'path');
    lineGlow.setAttribute('class', 'path-line-glow');
    lineGlow.setAttribute('d', makePath(Math.max(0, unlockedUpTo)));
    svg.appendChild(lineGlow);
    canvasEl.appendChild(svg);

    // World banners at world starts
    const worldStarts = [
      { tier: 0, label: 'Outer Spire' },
      { tier: 4, label: 'Mid Spire' },
      { tier: 8, label: 'Core' },
      { tier: 12, label: 'Endless' },
    ];
    worldStarts.forEach(w => {
      if (w.tier >= total) return;
      const ban = document.createElement('div');
      ban.className = 'path-banner';
      ban.textContent = w.label;
      ban.style.top = (pts[w.tier].y - 36) + 'px';
      canvasEl.appendChild(ban);
    });

    // Nodes: cleared (stars) → frontier (pulse) → locked
    for (let i = 0; i < total; i++){
      const p = pts[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      const cleared = i < bestTierReached;           // fully beaten
      const unlocked = i <= unlockedUpTo;            // can play / next
      const isFrontier = i === unlockedUpTo;         // next challenge
      const isSelected = selectable && i === selectedStartTier && unlocked;

      let cls = 'path-node';
      if (!unlocked) cls += ' locked';
      else if (cleared) cls += ' done';
      else cls += ' current'; // frontier or selected playable
      if (selectable && unlocked) cls += ' selectable';
      if (highlightTier !== null && i === highlightTier) cls += ' just-unlocked current';
      if (isSelected) cls += ' current';
      btn.className = cls;
      btn.style.left = p.x + '%';
      btn.style.top = p.y + 'px';

      if (!unlocked){
        btn.innerHTML = `<span class="pn-lock">🔒</span>`;
      } else if (cleared){
        btn.innerHTML = `<span class="pn-stars">★★★</span><span class="pn-num">${i + 1}</span>`;
      } else {
        btn.innerHTML = `<span class="pn-num">${i + 1}</span>`;
      }

      if (selectable && unlocked){
        btn.addEventListener('click', () => {
          selectedStartTier = i;
          renderPathMap(canvasEl, { selectable: true, focusTier: i });
          sndUI();
        });
      }
      canvasEl.appendChild(btn);
    }

    // Walker icon — moves from completed level to the next
    const {
      walkFrom = null,
      walkTo = null,
    } = opts || {};
    const walkerStart = walkFrom !== null ? walkFrom : (highlightTier !== null ? Math.max(0, highlightTier - 1) : null);
    const walkerEnd = walkTo !== null ? walkTo : (highlightTier !== null ? highlightTier : unlockedUpTo);
    if (walkerEnd !== null && pts[walkerEnd]){
      const walker = document.createElement('div');
      walker.className = 'path-walker';
      walker.id = 'pathWalker';
      const ri = rankInfoFor(bestTierReached);
      walker.textContent = ri.icon || '🌑';
      const startPt = pts[walkerStart !== null && pts[walkerStart] ? walkerStart : walkerEnd];
      walker.style.left = startPt.x + '%';
      walker.style.top = startPt.y + 'px';
      walker.style.transition = 'none';
      canvasEl.appendChild(walker);
      if (walkerStart !== null && walkerStart !== walkerEnd && pts[walkerStart]){
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            walker.style.transition = 'left 1.15s cubic-bezier(.2,.85,.3,1), top 1.15s cubic-bezier(.2,.85,.3,1)';
            walker.style.left = pts[walkerEnd].x + '%';
            walker.style.top = pts[walkerEnd].y + 'px';
          });
        });
      }
    }

    // Scroll focus into view
    const scrollParent = canvasEl.parentElement;
    const focus = focusTier !== null ? focusTier : (highlightTier !== null ? highlightTier : unlockedUpTo);
    if (scrollParent && pts[focus]){
      requestAnimationFrame(() => {
        const targetY = pts[focus].y - scrollParent.clientHeight * 0.45;
        scrollParent.scrollTop = Math.max(0, targetY);
      });
    }
  }

  function renderLevelsGrid(){
    // Pause menu path
    const canvas = document.getElementById('pausePathCanvas');
    renderPathMap(canvas, { selectable: true, focusTier: selectedStartTier });
  }

  function updateLauncher(){
    renderOrbEl(activeOrbEl, queue[0]);
    activeOrbEl.classList.toggle('modifier-armed', modifierActive);

    const heldBtn = document.getElementById('heldBtn');
    if (held === null){
      if (heldOrbEl){ heldOrbEl.style.display = 'none'; heldOrbEl.className = 'orb empty'; }
      if (heldBtn){ heldBtn.style.display = ''; heldBtn.textContent = '✋'; }
    } else {
      if (heldBtn) heldBtn.style.display = 'none';
      if (heldOrbEl){
        heldOrbEl.style.display = '';
        heldOrbEl.className = 'orb mini';
        renderOrbEl(heldOrbEl, held);
      }
    }
    heldLaneEl.classList.toggle('locked', holdLocked || busy || gameOver || paused);

    if (undoCountEl) undoCountEl.textContent = undosLeft;
    if (undoBtn) undoBtn.disabled = undosLeft <= 0 || !lastDropSnapshot || busy || gameOver || paused;

    if (queue[1] === null){
      nextOrbEl.textContent = '–';
      nextOrbEl.className = 'orb mini empty';
      nextOrbEl.style.background = '';
    } else {
      nextOrbEl.className = 'orb mini';
      renderOrbEl(nextOrbEl, queue[1]);
    }
  }

  function setNotifDot(id, on){
    const el = document.getElementById(id);
    if (el) el.classList.toggle('show', !!on);
  }
  function clearQuestNotif(){ setNotifDot('questNotifDot', false); }
  function clearVaultNotif(){ setNotifDot('vaultNotifDot', false); }

  async function unlockRelic(value){
    if (isGuestMode()) return;
    const idx = relicIdxFor(value);
    if (vaultSet.has(idx)) return;
    vaultSet.add(idx);
    relicsThisRun += 1;
    levelRelicsThisLevel += 1;
    try { await window.storage.set('vault', JSON.stringify([...vaultSet])); } catch(e){}
    const relic = RELICS[idx];
    // Quiet pickup — red dot on Sigils so player knows something new landed
    setNotifDot('vaultNotifDot', true);
    sndRelic();
    vibrate(50);
    awardShards(15);
    updateLauncher();
    updateHud();
    checkAchievements();
    checkSessionMissions();
    checkHiddenQuests();
  }

  const toastQueue = [];
  let toastPlaying = false;
  let bannerBusy = false;
  function showToast(icon, tag, name){
    // Only the LIVE LEADERBOARD toaster is allowed — everything else is silent.
    if (!tag || !String(tag).toUpperCase().includes('LIVE')) return;
    toastQueue.push({ icon, tag, name });
    if (!toastPlaying) playNextToast();
  }
  function showLbToast(icon, tag, name){
    toastQueue.push({ icon: icon || '🏆', tag: tag || 'LIVE BOARD', name });
    if (!toastPlaying) playNextToast();
  }
  function playNextToast(){
    if (toastQueue.length === 0){ toastPlaying = false; return; }
    toastPlaying = true;
    // Hide competing banners so only one notification shows
    chainRewardEl.classList.remove('show');
    comboRewardEl.classList.remove('show');
    relicPopEl.classList.remove('show');
    const t = toastQueue.shift();
    toastIcEl.textContent = t.icon;
    toastTagEl.textContent = t.tag;
    toastNameEl.textContent = t.name;
    toastPopEl.classList.remove('show');
    void toastPopEl.offsetWidth;
    toastPopEl.classList.add('show');
    setTimeout(playNextToast, 2400);
  }
  function showExclusiveBanner(el, durationMs){
    if (toastPlaying || bannerBusy) return false;
    bannerBusy = true;
    chainRewardEl.classList.remove('show');
    comboRewardEl.classList.remove('show');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => { bannerBusy = false; }, durationMs || 1100);
    return true;
  }

  let lastLiveLbPos = null;
  let liveLbCooldown = 0;
  let lastRivalToastAt = 0;
  let rivalToastCursor = 0;
  async function maybeRefreshLiveLbRank(){
    if (!currentRunId) return;
    const now = Date.now();
    if (now < liveLbCooldown) return;
    liveLbCooldown = now + 3500;
    try {
      const list = await fetchLeaderboard('global');
      const posEl = document.getElementById('liveLbPos');
      const me = (playerName || '').toLowerCase();

      if (!list || list.length === 0){
        if (posEl) posEl.textContent = score > 0 ? '#1' : '—';
        if (score > 0 && lastLiveLbPos !== 1){
          lastLiveLbPos = 1;
          showLbToast('🏆', 'LIVE BOARD', "You're #1 — board is yours");
        }
        return;
      }

      const above = list.filter(e => (e.score || 0) > score).length;
      const rank = above + 1;
      if (posEl) posEl.textContent = '#' + rank;

      // You climbed
      if (lastLiveLbPos === null){
        lastLiveLbPos = rank;
        if (score > 0) showLbToast('🏆', 'LIVE BOARD', `You're #${rank} on the board`);
        return;
      }
      if (rank < lastLiveLbPos){
        const passed = list[rank];
        const name = (passed && passed.name) ? passed.name : 'a rival';
        showLbToast('🏆', 'LIVE BOARD', `Passed ${name} · now #${rank}`);
        lastLiveLbPos = rank;
        lastRivalToastAt = now;
        return;
      }
      if (rank > lastLiveLbPos) lastLiveLbPos = rank;

      // Other players too (not only you)
      if (now - lastRivalToastAt < 9000) return;
      const others = list.filter(e => (e.name || '').toLowerCase() !== me);
      if (others.length === 0) return;

      const near = others.filter(e => Math.abs((e.score || 0) - score) < Math.max(800, score * 0.35));
      const pool = near.length ? near : others.slice(0, 8);
      const entry = pool[rivalToastCursor % pool.length];
      rivalToastCursor += 1;
      const sortedRank = list.filter(e => (e.score || 0) > (entry.score || 0)).length + 1;
      const nm = entry.name || 'Player';
      const pts = (entry.score || 0).toLocaleString();
      const flavors = [
        `${nm} sits at #${sortedRank} · ${pts}`,
        `${nm} just posted ${pts} · #${sortedRank}`,
        `#${sortedRank} ${nm} · ${pts} pts`,
        `Board pulse: ${nm} holding #${sortedRank}`,
      ];
      showLbToast('📡', 'LIVE BOARD', flavors[rivalToastCursor % flavors.length]);
      lastRivalToastAt = now;
    } catch(e){}
  }

  async function checkAchievements(){
    const ctx = { score, tier: currentTier(), chain: maxChainThisRun, vaultSize: vaultSet.size, lifetimeMerges, purchases: purchasesMade, skinChanges: skinChangesMade };
    let changed = false;
    for (const a of ACHIEVEMENTS){
      if (!achvSet.has(a.id) && a.check(ctx)){
        achvSet.add(a.id);
        changed = true;
        awardShards(a.reward);
        setNotifDot('questNotifDot', true);
      }
    }
    if (changed){
      try { await window.storage.set('achievements', JSON.stringify([...achvSet])); } catch(e){}
      try { renderAchvList(); } catch(e){}
    }
  }

  function checkSessionMissions(){
    // Quiet early-game: claim rewards silently, no toast spam
    for (const m of SESSION_MISSIONS){
      if (!sessionMissionsClaimed.has(m.id) && m.check()){
        sessionMissionsClaimed.add(m.id);
        awardShards(m.reward);
        setNotifDot('questNotifDot', true);
      }
    }
  }

  // Resets dailyMissionsDoneToday when the calendar day has rolled over
  // since it was last loaded/checked. Safe to call often — no-ops if the
  // date hasn't changed.
  function rolloverDailyMissionsIfNeeded(){
    const t = todayStr();
    if (dailyMissionsDate === t) return;
    dailyMissionsDate = t;
    dailyMissionsDoneToday = new Set();
  }

  async function persistDailyMissions(){
    try {
      await window.storage.set('daily-missions-state', JSON.stringify({
        date: dailyMissionsDate, doneIds: Array.from(dailyMissionsDoneToday),
      }));
    } catch(e){}
  }
  async function persistDailyStreak(){
    try {
      await window.storage.set('daily-streak', JSON.stringify({
        count: dailyStreakCount, lastDate: dailyStreakLastDate,
      }));
    } catch(e){}
  }

  // Called once per completed run (any run type — see endGame()). Advances
  // the streak by 1 if the player's last counted day was yesterday, resets
  // to 1 if they missed a day, and no-ops if today's already counted.
  function maybeAdvanceDailyStreak(){
    const t = todayStr();
    if (dailyStreakLastDate === t) return;
    if (dailyStreakLastDate){
      const prev = new Date(dailyStreakLastDate + 'T00:00:00');
      const cur = new Date(t + 'T00:00:00');
      const diffDays = Math.round((cur - prev) / 86400000);
      dailyStreakCount = diffDays === 1 ? dailyStreakCount + 1 : 1;
    } else {
      dailyStreakCount = 1;
    }
    dailyStreakLastDate = t;
    persistDailyStreak();
    const streakEl = document.getElementById('dailyStreakCount');
    if (streakEl) streakEl.textContent = dailyStreakCount;
  }

  // Called on every endGame() — daily missions can be completed by any run,
  // not just the fixed Daily Descent board (see roadmap discussion).
  function checkDailyMissions(){
    rolloverDailyMissionsIfNeeded();
    let any = false;
    for (const m of DAILY_MISSIONS){
      if (!dailyMissionsDoneToday.has(m.id) && m.check()){
        dailyMissionsDoneToday.add(m.id);
        awardShards(m.reward);
        any = true;
      }
    }
    if (any) persistDailyMissions();
    renderDailyMissionsList();
  }

  function renderDailyMissionsList(){
    const listEl = document.getElementById('dailyMissionsList');
    const tagEl = document.getElementById('dailyMissionsCountTag');
    if (tagEl) tagEl.textContent = `${dailyMissionsDoneToday.size}/${DAILY_MISSIONS.length}`;
    if (!listEl) return;
    listEl.innerHTML = DAILY_MISSIONS.map((m, i) => {
      const done = dailyMissionsDoneToday.has(m.id);
      return `<div class="quest-card c${i % 5} ${done ? 'done' : ''}">
        <span class="qc-icon">${m.icon}</span>
        <div class="qc-cat">Today</div>
        <div class="qc-title">${m.label}</div>
        <div class="qc-reward">+${m.reward} shards</div>
        <div class="qc-actions">
          <button class="qc-btn ${done ? 'status-done' : 'status-open'}" type="button">${done ? 'Done ✓' : 'In progress'}</button>
        </div>
      </div>`;
    }).join('');
  }

  function checkHiddenQuests(){
    if (isGuestMode()) return;
    // Sigils stay late-game / quiet — unlock without interrupting play
    for (const hq of HIDDEN_QUESTS){
      if (hiddenClaimed.has(hq.id)) continue;
      let ok = false;
      try { ok = hq.check(); } catch(e){ ok = false; }
      if (!ok) continue;
      hiddenClaimed.add(hq.id);
      if (hq.sigil && !sigilSet.has(hq.sigil)){
        sigilSet.add(hq.sigil);
        try { window.storage.set('sigils', JSON.stringify([...sigilSet])); } catch(e){}
        setNotifDot('vaultNotifDot', true);
      }
      setNotifDot('questNotifDot', true);
    }
  }

  function snapshotBoard(){
    return {
      tiles: tiles.map(t => ({ col: t.col, row: t.row, value: t.value })),
      queue: [...queue],
      held,
      score,
      rerollsLeft,
      bestTile,
    };
  }

  function clearPowerTargets(){
    colEls.forEach(el => el.classList.remove('power-target'));
    tiles.forEach(t => t.el && t.el.classList.remove('power-pick'));
  }

  function armPower(){
    if (busy || gameOver || powersLeft <= 0 || pendingChoice || menuOpen || paused) return;
    if (activePower){
      activePower = null;
      clearPowerTargets();
      updateLauncher();
      return;
    }
    // Cycle through available powers; player taps board to use
    const idx = Math.floor(Math.random() * SPIRE_POWERS.length);
    activePower = SPIRE_POWERS[idx];
    speakNarrator(`${activePower.name}: ${activePower.tip}`, 2000);
    if (activePower.id === 'echo'){
      // Copy/echo effect disabled — skip and pick another power
      activePower = null;
      updateLauncher();
      return;
    }
    // Highlight columns for column-target powers; tiles for forge
    if (activePower.id === 'forge'){
      tiles.forEach(t => t.el && t.el.classList.add('power-pick'));
    } else {
      colEls.forEach(el => el.classList.add('power-target'));
    }
    updateLauncher();
    sndUI();
  }

  function usePowerOnColumn(col){
    if (!activePower) return false;
    const id = activePower.id;
    if (id === 'collapse'){
      const colTiles = tilesInColumn(col);
      if (colTiles.length === 0) return true;
      // Drop all tiles in column and re-resolve
      powersLeft -= 1;
      activePower = null;
      clearPowerTargets();
      busy = true;
      applyGravity();
      setTimeout(() => {
        chainCount = 0;
        dropHadMerge = false;
        dropMergeScore = 0;
        resolveStep();
      }, 100);
      showToast('⇩', 'COLLAPSE', `Column ${col + 1}`);
      updateLauncher();
      return true;
    }
    if (id === 'silence'){
      silenceCol = col;
      silenceDropsLeft = 1;
      powersLeft -= 1;
      activePower = null;
      clearPowerTargets();
      showToast('🛡', 'SILENCE', `Column ${col + 1} protected`);
      updateLauncher();
      return true;
    }
    return false;
  }

  function usePowerOnTile(tile){
    if (!activePower || activePower.id !== 'forge') return false;
    powersLeft -= 1;
    activePower = null;
    clearPowerTargets();
    tile.value = tile.value * 2;
    renderOrbEl(tile.el, tile.value);
    tile.el.classList.add('pop');
    unlockRelic(tile.value);
    showToast('⚒', 'FORGE', `→ ${tile.value}`);
    updateLauncher();
    updateHud();
    sndMerge(2);
    return true;
  }

  function dropTile(col){
    if (busy || gameOver || pendingChoice || transitioning || menuOpen || paused) return;
    const row = lowestEmptyRow(col);
    if (row >= ROWS) return;

    lastDropSnapshot = snapshotBoard();
    busy = true;
    const value = queue[0];
    const droppedModifier = modifierActive;
    const tile = { id: nextId++, col, row, value, isModifier: droppedModifier };
    if (droppedModifier){ modifierActive = false; modifierUsedThisLevel = true; }
    tiles.push(tile);
    createTileEl(tile, true);
    sndDrop();
    setTimeout(() => shakeTube(col), 110);

    queue[0] = queue[1];
    refillOnDeck();
    dropsThisLevel += 1;
    if (!modifierUsedThisLevel && dropsThisLevel === modifierArmDropIndex){
      modifierActive = true;
    }
    updateLauncher();
    maybeTriggerLoadedChoice();

    chainCount = 0;
    dropHadMerge = false;
    dropMergeScore = 0;
    lastMergeCol = col;
    lastMergeRow = row;
    setTimeout(() => resolveStep(), 140);
  }

  function resolveStep(){
    if (guestQuestTransitioning) return;
    const pair = findAdjacentPair();
    if (!pair){
      busy = false;
      holdLocked = false;
      chainCount = 0;
      updateLauncher();
      if (isGuestMode() && guestQuestComplete()) return completeGuestQuest();
      checkOverflowAfterSettle();
      updateHud();
      if (!gameOver){
        updateCombo(dropHadMerge, dropMergeScore, lastMergeCol, lastMergeRow);
        const tier = currentTier();
        if (!isGuestMode() && tier > lastAnnouncedTier){
          const fromTier = lastAnnouncedTier;
          lastAnnouncedTier = tier;
          playDepthClearSequence(tier, fromTier);
        }
        checkAchievements();
        checkSessionMissions();
      }
      return;
    }
    const [a, b] = pair;
    const hadModifier = !!(a.isModifier || b.isModifier);
    const newValue = a.value + b.value;
    a.value = newValue;
    a.isModifier = false;
    renderOrbEl(a.el, newValue);
    a.el.classList.remove('pop', 'pop-big', 'pop-insane', 'modifier-orb');
    const popBadge = a.el.querySelector('.modifier-badge');
    if (popBadge) popBadge.remove();
    void a.el.offsetWidth;
    a.el.classList.add(chainCount >= 4 ? 'pop-insane' : chainCount >= 2 ? 'pop-big' : 'pop');

    chainCount += 1;
    maxChainThisRun = Math.max(maxChainThisRun, chainCount);
    levelMaxChainThisLevel = Math.max(levelMaxChainThisLevel, chainCount);
    spawnRing(a.col, a.row, chainCount);
    spawnSparkles(a.col, a.row, chainCount);
    flashScreen(chainCount);
    shakeBoard(chainCount >= 3);
    shakeTube(a.col);
    unlockRelic(newValue);
    sndMerge(chainCount);

    lifetimeMerges += 1;
    mergesThisRun += 1;
    try { window.storage.set('lifetime-merges', String(lifetimeMerges)); } catch(e){}

    b.el.classList.add('leaving');
    tiles = tiles.filter(t => t.id !== b.id);
    setTimeout(() => b.el.remove(), 180);

    // Value-based points: small merges low, big merges higher, hard-capped
    let gained = pointsForMerge(newValue, chainCount);
    if (hadModifier){
      gained = Math.min(MERGE_SCORE_CAP, Math.floor(gained * 1.5));
      awardShards(15);
      vibrate([20, 30, 20]);
    }
    // Echo / copy scoring disabled — echoArmed is ignored for points
    if (echoArmed){ echoArmed = false; }
    score += gained;
    dropHadMerge = true;
    dropMergeScore += gained;
    lastMergeCol = a.col;
    lastMergeRow = a.row;
    spawnFloatScore(a.col, a.row, gained, false);
    merges += 1;
    if (newValue > bestTile) bestTile = newValue;
    if (isGuestMode() && guestQuest().type === 'tile' && newValue >= guestQuest().target){
      guestQuestTileHit = true;
    }
    if (isGuestMode() && guestQuestComplete()) return completeGuestQuest();
    if (newValue >= 128) highTilesThisRun += 1;
    // Very rare undo reward from a merge (~2.5% base; slightly higher on long chains). Cap at 3.
    {
      const undoChance = chainCount >= 5 ? 0.06 : chainCount >= 3 ? 0.04 : 0.025;
      if (undosLeft < 3 && Math.random() < undoChance){
        undosLeft += 1;
        updateLauncher();
        showToast('↩', 'UNDO +1', chainCount >= 3 ? 'Chain bonus!' : 'Lucky merge!');
        vibrate(30);
      }
    }
    // Survived danger: had a near-full column and still merged
    for (let c = 0; c < COLS; c++){
      if (tilesInColumn(c).length >= ROWS - 1) survivedDangerThisRun = true;
    }
    updateHud();

    if (chainCount >= 2) showChainReward(chainCount);
    checkHiddenQuests();

    const crownValue = Math.pow(2, RELIC_NAMES.length);
    if (newValue >= crownValue){
      ascendTile(a);
    }

    setTimeout(() => {
      if (guestQuestTransitioning) return;
      applyGravity();
      setTimeout(() => resolveStep(), 120);
    }, 120);
  }

  // A tile that reaches the top tier doesn't just sit there forever —
  // it ascends: a brief crown-glow beat, then it dissolves off the board,
  // banking a bonus and freeing the space it held. Keeps the board from
  // being able to "solve itself" into a permanent safe stack late-game.
  function ascendTile(tile){
    // Flat ascend bonus — keeps scoring simple and low
    const bonus = 25;
    setTimeout(() => {
      if (!tile.el || !tiles.some(t => t.id === tile.id)) return;
      tile.el.classList.add('ascending');
      spawnSparkles(tile.col, tile.row, 6);
      spawnFloatScore(tile.col, tile.row, bonus, false);
      showToast('👑', 'ASCENDED', `+${bonus}`);
      score += bonus;
      vibrate([20, 40, 20]);
      updateHud();
      setTimeout(() => {
        tiles = tiles.filter(t => t.id !== tile.id);
        if (tile.el) tile.el.remove();
        applyGravity();
        updateDangerColumns();
      }, 420);
    }, 550);
  }

  let pendingFromTier = 0;
  let pendingToTier = 0;

  function confettiBurst(container, count, colors){
    container.innerHTML = '';
    for (let i=0; i<count; i++){
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const w = 6 + Math.random()*6;
      p.style.width = `${w}px`;
      p.style.height = `${w*1.6}px`;
      p.style.left = `${Math.random()*100}%`;
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      const dur = 1.4 + Math.random()*1.3;
      p.style.animationDuration = `${dur}s`;
      p.style.animationDelay = `${Math.random()*0.5}s`;
      container.appendChild(p);
    }
    setTimeout(() => { container.innerHTML = ''; }, 3200);
  }

  // Runs before showDepthClear's overlay — gives the depth a real ending
  // instead of cutting from "half-full board" straight to the ladder.
  // Every tile currently on the board merges away together (regardless of
  // value — this isn't a real merge, just the closing beat), the board
  // flashes, then a sparkle burst pops before the ladder overlay opens.
  function playDepthClearSequence(tier, fromTier){
    busy = true; // block input during the closing beat
    const liveTiles = tiles.slice();
    const centerCol = (COLS - 1) / 2;

    if (liveTiles.length === 0){
      // Nothing on the board to close out — skip straight to the flash/pop.
      lightUpAndPop(tier, fromTier);
      return;
    }

    liveTiles.forEach(t => {
      if (!t.el) return;
      const dist = Math.abs(t.col - centerCol);
      t.el.style.transitionDelay = ''; // clear any prior inline delay
      t.el.style.animationDelay = (dist * 40) + 'ms';
      t.el.classList.add('depth-merge-out');
    });
    sndMerge(3);

    setTimeout(() => {
      tiles.forEach(t => t.el && t.el.remove());
      tiles = [];
      lightUpAndPop(tier, fromTier);
    }, 480);
  }

  function lightUpAndPop(tier, fromTier){
    boardWrapEl.classList.add('level-clear');
    flashOverlayEl.classList.remove('flash', 'flash-hot', 'flash-insane', 'flash-legendary', 'flash-depth-clear');
    void flashOverlayEl.offsetWidth;
    flashOverlayEl.classList.add('flash-depth-clear');
    sndLevelUp();
    vibrate([20, 30, 20]);
    for (let c = 0; c < COLS; c++) spawnSparkles(c, Math.floor(ROWS / 2), 5);

    // Small pause here lets the flash/sparkle beat land before the
    // progression modal pops up, instead of cutting straight to it.
    setTimeout(() => {
      showDepthClear(tier, fromTier);
    }, 1350);
  }

  function showDepthClear(tier, fromTier){
    pendingFromTier = fromTier;
    pendingToTier = tier;
    const world = worldForTier(tier);
    const dName = DEPTH_NAMES[Math.min(tier, DEPTH_NAMES.length - 1)] || `Depth ${tier + 1}`;
    if (depthClearTitleEl) depthClearTitleEl.textContent = `${dName} Cleared!`;
    const subEl = document.getElementById('depthClearSub');
    if (subEl) subEl.textContent = world.name + ' · path unlocked';
    powersLeft = 0;
    if (depthClearScoreEl) depthClearScoreEl.textContent = score.toLocaleString();
    const reward = 30 + tier * 15;
    const rewardEl = document.getElementById('depthClearReward');
    if (rewardEl) rewardEl.innerHTML = `✨ +${reward} shards · Score <span id="depthClearScore">${score.toLocaleString()}</span>`;
    awardShards(reward);
    // Reveal path + walk icon from cleared depth to the new one
    const canvas = document.getElementById('depthPathCanvas');
    renderPathMap(canvas, {
      highlightTier: tier,
      focusTier: tier,
      walkFrom: fromTier,
      walkTo: tier,
    });
    depthClearOverlayEl.classList.add('show');
    confettiBurst(depthConfettiEl, 40, ['#ffb648','#2ec4b6','#ff6b6b','#ffd27a','#5eead4']);
    sndLevelUp();
    vibrate([30, 50, 30]);
    setMusicIntensity(tier);
  }

  function playClimbAnimation(fromTier, toTier, onDone){
    const total = LEVEL_BOARD_SIZES.length;
    const climbSubEl = document.getElementById('climbSub');
    climbTrackEl.querySelectorAll('.climb-node').forEach(n => n.remove());
    // Vertical spire: bottom = level 1, top = final
    for (let i = 0; i < total; i++){
      const node = document.createElement('div');
      const done = i <= fromTier;
      node.className = 'climb-node' + (done ? ' done' : '') + (i === fromTier ? ' current' : '');
      node.style.bottom = `${(i / (total - 1)) * 130 + 4}px`;
      climbTrackEl.appendChild(node);
    }
    climbWalkerEl.textContent = rankInfoFor(bestTierReached).icon;
    climbWalkerEl.style.transition = 'none';
    climbWalkerEl.style.bottom = `${(fromTier / (total - 1)) * 130 + 8}px`;
    const fromName = DEPTH_NAMES[Math.min(fromTier, DEPTH_NAMES.length - 1)] || `Depth ${fromTier + 1}`;
    const toName = DEPTH_NAMES[Math.min(toTier, DEPTH_NAMES.length - 1)] || `Depth ${toTier + 1}`;
    climbLabelEl.textContent = `${fromName} → ${toName}`;
    if (climbSubEl) climbSubEl.textContent = toTier >= 5 ? 'The summit is near…' : 'Deeper chambers await…';
    climbOverlayEl.classList.add('show');
    sndLevelUp();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        climbWalkerEl.style.transition = 'bottom 1.4s cubic-bezier(.2,.85,.3,1)';
        climbWalkerEl.style.bottom = `${(toTier / (total - 1)) * 130 + 8}px`;
        // Light up destination node mid-climb
        setTimeout(() => {
          climbTrackEl.querySelectorAll('.climb-node').forEach((n, i) => {
            n.classList.toggle('done', i <= toTier);
            n.classList.toggle('current', i === toTier);
          });
        }, 700);
      });
    });
    setTimeout(() => {
      climbOverlayEl.classList.remove('show');
      onDone();
    }, 1700);
  }

  function showRankUp(fromName, rankInfo){
    // Overlay/modal intentionally disabled — rank changes no longer interrupt play.
    // Feedback is now a quiet, non-blocking toast instead of a full-screen popup.
    showToast(rankInfo.icon || '🌟', 'RANK UP', rankInfo.name);
    sndAchievement();
    vibrate([40, 50, 60]);
  }

  // ---------- Narrator (type then fade) ----------
  let narratorTimer = null;
  let narratorHideTimer = null;
  function speakNarrator(){ /* disabled */ }

  function transitionToLevel(tier){
    busy = false; // playDepthClearSequence sets this true for the closing beat — clear it for the new depth
    applyBoardSize(tier);
    tiles.forEach(t => t.el && t.el.remove());
    tiles = [];
    dropsSinceChoice = 0;
    choiceUsedThisLevel = false;
    levelRelicsThisLevel = 0;
    levelMaxChainThisLevel = 0;
    lastDropSnapshot = null;
    checkpointFiredThisLevel = false;
    modifierUsedThisLevel = false;
    modifierActive = false;
    dropsThisLevel = 0;
    modifierArmDropIndex = rollModifierArmIndex();
    buildColumns();
    updateHud();
    updateLauncher();
    showLevelStartCard(tier);
  }

  function showLevelStartCard(tier, forceMain = false){
    if (isGuestMode() && !forceMain){
      const quest = guestQuest();
      levelStartTitleEl.textContent = 'NEXT QUEST';
      levelStartObjEl.textContent = `${quest.name} · ${quest.description}`;
      levelStartOverlayEl.classList.remove('show');
      void levelStartOverlayEl.offsetWidth;
      levelStartOverlayEl.classList.add('show');
      menuOpen = true;
      return;
    }
    const obj = objectiveForTier(tier);
    const world = worldForTier(tier);
    const dName = DEPTH_NAMES[Math.min(tier, DEPTH_NAMES.length - 1)] || `Depth ${depthInWorld(tier)}`;
    levelStartTitleEl.textContent = world.name.toUpperCase();
    levelStartObjEl.textContent = `${dName} · ${obj.label}`;
    levelStartOverlayEl.classList.add('show');
    menuOpen = true;
  }

  function playGuestQuestSequence(){
    busy = true;
    boardWrapEl.classList.add('level-clear');
    tiles.forEach((tile, index) => {
      if (!tile.el) return;
      tile.el.style.animationDelay = `${index * 35}ms`;
      tile.el.classList.add('depth-merge-out');
    });
    sndLevelUp();
    setTimeout(() => {
      tiles.forEach(tile => tile.el && tile.el.remove());
      tiles = [];
      guestQuestIndex += 1;
      guestQuestStartScore = score;
      guestQuestStartMerges = mergesThisRun;
      guestQuestStartChain = maxChainThisRun;
      guestQuestTileHit = false;
      dropsThisLevel = 0;
      modifierActive = false;
      modifierUsedThisLevel = false;
      initQueue();
      applyGuestQuest();
      buildColumns();
      updateHud();
      updateLauncher();
      busy = false;
      guestQuestTransitioning = false;
      levelStartOverlayEl.style.display = 'flex';
      showLevelStartCard(0);
    }, 1500);
  }

  function completeGuestQuest(){
    if (guestQuestTransitioning || !isGuestMode()) return;
    guestQuestTransitioning = true;
    gameOver = false;
    playGuestQuestSequence();
  }

  function checkOverflowAfterSettle(){
    if (guestQuestTransitioning) return;
    // Silence: ignore protected column for one settle
    let fullCols = Array.from({length: COLS}, (_, c) => c).filter(c => tilesInColumn(c).length >= ROWS);
    if (silenceCol !== null && silenceDropsLeft > 0){
      fullCols = fullCols.filter(c => c !== silenceCol);
      silenceDropsLeft -= 1;
      if (silenceDropsLeft <= 0) silenceCol = null;
    }
    if (fullCols.length === 0) return;
    if (ownedBoosts.has('boost_secondchance') && !secondWindUsedThisRun){
      secondWindUsedThisRun = true;
      survivedDangerThisRun = true;
      const c = fullCols[0];
      tilesInColumn(c).forEach(t => t.el && t.el.remove());
      tiles = tiles.filter(t => t.col !== c);
      showToast('🌬️', 'BOOST', 'Second Wind — column cleared!');
      shakeBoard(true);
      updateDangerColumns();
      checkSessionMissions();
      checkHiddenQuests();
      return;
    }
    endGame();
  }

  function swapHold(){
    if (busy || gameOver || holdLocked || pendingChoice || transitioning || menuOpen || paused) return;
    usedHoldThisRun = true;
    if (held === null){
      held = queue[0];
      queue[0] = queue[1];
      refillOnDeck();
    } else {
      const tmp = queue[0];
      queue[0] = held;
      held = tmp;
    }
    holdLocked = true;
    updateLauncher();
    sndClick();
  }

  function reroll(){
    if (busy || gameOver || rerollsLeft <= 0 || pendingChoice || transitioning || menuOpen || paused) return;
    rerollsLeft -= 1;
    rerollsUsedThisRun += 1;
    queue[0] = spawnValue();
    updateLauncher();
    sndClick();
  }

  function undoDrop(){
    if (busy || gameOver || undosLeft <= 0 || !lastDropSnapshot || pendingChoice || transitioning || menuOpen || paused) return;
    undosLeft -= 1;
    tiles.forEach(t => t.el && t.el.remove());
    tiles = [];
    const snap = lastDropSnapshot;
    score = snap.score;
    queue = [...snap.queue];
    held = snap.held;
    rerollsLeft = snap.rerollsLeft;
    bestTile = snap.bestTile;
    snap.tiles.forEach(st => {
      const tile = { id: nextId++, col: st.col, row: st.row, value: st.value };
      tiles.push(tile);
      createTileEl(tile, false);
    });
    lastDropSnapshot = null;
    updateHud();
    updateLauncher();
    updateDangerColumns();
    sndClick();
  }

  // Swipe to column
  let swipeStartX = null;
  function setupSwipe(){
    const wrap = boardWrapEl;
    wrap.ontouchstart = (e) => {
      if (busy || gameOver || menuOpen || paused) return;
      swipeStartX = e.touches[0].clientX;
      const rect = wrap.getBoundingClientRect();
      const rel = (e.touches[0].clientX - rect.left - parseFloat(getComputedStyle(wrap).paddingLeft) || 0);
      const colW = rect.width / COLS;
      const c = Math.max(0, Math.min(COLS - 1, Math.floor((e.touches[0].clientX - rect.left) / (rect.width / COLS))));
      colEls.forEach((el, i) => el.classList.toggle('col-target', i === c));
    };
    wrap.ontouchmove = (e) => {
      if (swipeStartX === null) return;
      const rect = wrap.getBoundingClientRect();
      const c = Math.max(0, Math.min(COLS - 1, Math.floor((e.touches[0].clientX - rect.left) / (rect.width / COLS))));
      colEls.forEach((el, i) => el.classList.toggle('col-target', i === c));
    };
    wrap.ontouchend = (e) => {
      if (swipeStartX === null) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.changedTouches[0].clientX;
      const c = Math.max(0, Math.min(COLS - 1, Math.floor((x - rect.left) / (rect.width / COLS))));
      colEls.forEach(el => el.classList.remove('col-target'));
      swipeStartX = null;
      dropTile(c);
    };
    wrap.ontouchcancel = () => {
      swipeStartX = null;
      colEls.forEach(el => el.classList.remove('col-target'));
    };
  }

  // ---------- Persistence ----------
  async function loadVault(){
    try {
      const res = await window.storage.get('vault');
      vaultSet = new Set(res ? JSON.parse(res.value) : []);
    } catch (e) { vaultSet = new Set(); }
    lastKnownRankName = rankInfoFor(bestTierReached).name;
    updateHud();
    refreshHomeScreen();
  }

  async function loadAchievements(){
    try {
      const res = await window.storage.get('achievements');
      achvSet = new Set(res ? JSON.parse(res.value) : []);
    } catch (e) { achvSet = new Set(); }
    renderAchvList();
  }

  async function loadHighScore(){
    try {
      const res = await window.storage.get('high-score');
      highScore = res ? parseInt(res.value, 10) || 0 : 0;
    } catch (e) { highScore = 0; }
    highScoreEl.textContent = highScore.toLocaleString();
    refreshHomeScreen();
  }

  async function loadBestTier(){
    try {
      const res = await window.storage.get('best-tier');
      bestTierReached = res ? parseInt(res.value, 10) || 0 : 0;
    } catch (e) { bestTierReached = 0; }
    refreshHomeScreen();
  }
  async function maybeAdvanceBestTier(tier){
    if (tier > bestTierReached){
      bestTierReached = tier;
      try { await window.storage.set('best-tier', String(bestTierReached)); } catch(e){}
    }
  }

  async function loadShards(){
    try {
      const res = await window.storage.get('shards');
      shards = res ? parseInt(res.value, 10) || 0 : 0;
    } catch (e) { shards = 0; }
    updateAllShardDisplays();
  }

  async function loadLifetimeMerges(){
    try {
      const res = await window.storage.get('lifetime-merges');
      lifetimeMerges = res ? parseInt(res.value, 10) || 0 : 0;
    } catch(e){ lifetimeMerges = 0; }
  }

  async function loadStreak(){
    try {
      const res = await window.storage.get('play-streak');
      playStreak = res ? parseInt(res.value, 10) || 0 : 0;
      const res2 = await window.storage.get('last-play-date');
      lastPlayDate = res2 ? res2.value : '';
    } catch(e){ playStreak = 0; lastPlayDate = ''; }
  }

  async function updatePlayStreak(){
    const today = new Date().toISOString().slice(0, 10);
    if (lastPlayDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastPlayDate === yesterday) playStreak += 1;
    else playStreak = 1;
    lastPlayDate = today;
    try {
      await window.storage.set('play-streak', String(playStreak));
      await window.storage.set('last-play-date', today);
    } catch(e){}
  }

  async function loadShop(){
    try {
      const res = await window.storage.get('owned-boosts');
      ownedBoosts = new Set(res ? JSON.parse(res.value) : []);
    } catch(e){ ownedBoosts = new Set(); }
    try {
      const res2 = await window.storage.get('owned-skins');
      ownedSkins = new Set(res2 ? JSON.parse(res2.value) : ['classic']);
    } catch(e){ ownedSkins = new Set(['classic']); }
    try {
      const res3 = await window.storage.get('equipped-skin');
      equippedSkin = res3 ? res3.value : 'classic';
    } catch(e){ equippedSkin = 'classic'; }
    try {
      const res4 = await window.storage.get('purchases-made');
      purchasesMade = res4 ? parseInt(res4.value, 10) || 0 : 0;
    } catch(e){ purchasesMade = 0; }
    try {
      const res5 = await window.storage.get('skin-changes');
      skinChangesMade = res5 ? parseInt(res5.value, 10) || 0 : 0;
    } catch(e){ skinChangesMade = 0; }
    renderShop();
    renderSettingsSwatch();
  }

  // Sigils used to live on their own page — now it's a tab inside the
  // merged Sigils & Quests page (achvPage). This is the one entry point
  // every former "open vault" call site should use.
  function openSigilsPage(){
    clearVaultNotif();
    showPage('achvPage');
    activateQuestTab('sigils');
  }

  function renderVaultList(){
    const sigilListEl = document.getElementById('sigilList');
    const sigilsCountTag = document.getElementById('sigilsCountTag');
    if (sigilListEl){
      sigilListEl.innerHTML = SIGILS.map(s => {
        const unlocked = sigilSet.has(s.id);
        return `<div class="vault-card ${unlocked ? 'unlocked' : 'locked'}">
          <div class="idx">SIGIL</div>
          <div class="glyph">${unlocked ? s.icon : '?'}</div>
          <div class="name">${unlocked ? s.name : 'Hidden'}</div>
          ${unlocked ? `<div style="font-size:10px;color:var(--ink-dim);line-height:1.35;">${s.desc}</div>` : ''}
        </div>`;
      }).join('');
    }
    if (sigilsCountTag) sigilsCountTag.textContent = `${sigilSet.size}/${SIGILS.length}`;
  }

  function achvGroupsHtml(){
    const order = [];
    ACHIEVEMENTS.forEach(a => { if (!order.includes(a.cat)) order.push(a.cat); });
    return order.map(cat => {
      const items = ACHIEVEMENTS.filter(a => a.cat === cat);
      const tiles = items.map(a => {
        const done = achvSet.has(a.id);
        return `<div class="achv-tile ${done ? 'done' : ''}">
          <span class="ic">${done ? a.icon : '🔒'}</span>
          <span class="t-label">${a.label}</span>
          <span class="rw">+${a.reward}</span>
        </div>`;
      }).join('');
      return `<div class="section-label" style="margin-top:16px;">${cat}</div><div class="achv-grid">${tiles}</div>`;
    }).join('');
  }

  function renderAchvList(){
    if (!achvListEl) return;
    achvListEl.innerHTML = ACHIEVEMENTS.map((a, i) => {
      const done = achvSet.has(a.id);
      return `<div class="achievement-row ${done ? 'done' : ''}">
        <span class="achievement-icon">${done ? (a.icon || '🏅') : '🔒'}</span>
        <div class="achievement-copy">
          <div class="achievement-title">${a.label}</div>
          <div class="achievement-category">${a.cat || 'Achievement'} · ${done ? 'Complete' : 'Locked'}</div>
        </div>
        <span class="achievement-reward">+${a.reward || 0}</span>
      </div>`;
    }).join('');
    if (achvDoneTagEl) achvDoneTagEl.textContent = `${ACHIEVEMENTS.filter(a => achvSet.has(a.id)).length}/${ACHIEVEMENTS.length}`;
  }

  function renderMissionsList(){
    if (!missionsListEl) return;
    missionsListEl.innerHTML = SESSION_MISSIONS.map((m, i) => {
      const done = sessionMissionsClaimed.has(m.id);
      return `<div class="quest-card c${i % 5} ${done ? 'done' : ''}">
        <span class="qc-icon">${m.icon}</span>
        <div class="qc-cat">This run</div>
        <div class="qc-title">${m.label}</div>
        <div class="qc-reward">+${m.reward} shards</div>
        <div class="qc-actions">
          <button class="qc-btn ${done ? 'status-done' : 'status-open'}" type="button">${done ? 'Done ✓' : 'Open'}</button>
          <button class="qc-btn" type="button" data-qinfo="${m.id}">Info</button>
        </div>
      </div>`;
    }).join('');
    if (missionsDoneTagEl) missionsDoneTagEl.textContent = `${sessionMissionsClaimed.size}/${SESSION_MISSIONS.length}`;
    missionsListEl.querySelectorAll('[data-qinfo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = SESSION_MISSIONS.find(x => x.id === btn.getAttribute('data-qinfo'));
        if (m) showLbToast(m.icon, 'QUEST', m.label + ' · +' + m.reward + ' shards');
      });
    });
  }

  function renderObjectivesOverlay(){
    const rank = rankInfoFor(bestTierReached);
    objRankPillEl.textContent = `${rank.icon} ${rank.name}`;
    objCurrentScoreEl.textContent = score.toLocaleString();
    objBestScoreEl.textContent = highScore.toLocaleString();
    const tier = currentTier();
    const dName = DEPTH_NAMES[Math.min(tier, DEPTH_NAMES.length - 1)] || `Depth ${tier + 1}`;
    if (levelObjTitleEl) levelObjTitleEl.textContent = dName;
    const obj = currentObjective();
    levelObjBodyEl.textContent = obj.label;
    objMissionsListEl.innerHTML = SESSION_MISSIONS.map(m => {
      const done = sessionMissionsClaimed.has(m.id);
      return `<div class="mission-card ${done ? 'done' : ''}">
        <span class="ic">${m.icon}</span>
        <div class="txt"><div class="t1">${m.label}</div><div class="t2">+${m.reward} shards</div></div>
        <span class="check">${done ? '✓' : ''}</span>
      </div>`;
    }).join('');
  }

  async function persistShop(){
    try { await window.storage.set('owned-boosts', JSON.stringify([...ownedBoosts])); } catch(e){}
    try { await window.storage.set('owned-skins', JSON.stringify([...ownedSkins])); } catch(e){}
    try { await window.storage.set('equipped-skin', equippedSkin); } catch(e){}
    try { await window.storage.set('purchases-made', String(purchasesMade)); } catch(e){}
    try { await window.storage.set('skin-changes', String(skinChangesMade)); } catch(e){}
  }

  function renderShop(){
    shopBoostsGridEl.innerHTML = SHOP_BOOSTS.map(b => {
      const owned = ownedBoosts.has(b.id);
      const canAfford = shards >= b.cost;
      return `<div class="shop-card">
        <div class="ic" style="background:${b.color};">${b.icon}</div>
        <div class="t1">${b.name}</div>
        <div class="t2">${b.desc}</div>
        ${owned ? `<button class="shop-buy-btn owned" disabled>Owned</button>`
          : `<div class="price"><svg class="gem" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L20 9 L12 22 L4 9 Z"/></svg>${b.cost}</div>
             <button class="shop-buy-btn" data-boost="${b.id}" ${canAfford ? '' : 'disabled'}>${canAfford ? 'Buy' : 'Need more'}</button>`}
      </div>`;
    }).join('');
    boostsOwnedTagEl.textContent = `${ownedBoosts.size}/${SHOP_BOOSTS.length}`;

    shopSkinsGridEl.innerHTML = SHOP_SKINS.map(s => {
      const owned = ownedSkins.has(s.id);
      const equipped = equippedSkin === s.id;
      const canAfford = shards >= s.cost;
      const swatches = PALETTES[s.id].slice(0,4).map(c => `<span style="background:${c}"></span>`).join('');
      let btn;
      if (equipped) btn = `<button class="shop-buy-btn equipped" disabled>Equipped</button>`;
      else if (owned) btn = `<button class="shop-buy-btn" data-equip="${s.id}">Equip</button>`;
      else btn = `<button class="shop-buy-btn" data-skin="${s.id}" ${canAfford ? '' : 'disabled'}>${canAfford ? `Buy · ${s.cost}` : 'Need more'}</button>`;
      return `<div class="shop-card">
        <div class="ic" style="background:var(--surface-2); font-size:20px;">${s.icon}</div>
        <div class="t1">${s.name}</div>
        <div class="shop-swatches">${swatches}</div>
        ${btn}
      </div>`;
    }).join('');
    skinsOwnedTagEl.textContent = `${ownedSkins.size}/${SHOP_SKINS.length}`;

    shopBoostsGridEl.querySelectorAll('[data-boost]').forEach(btn => {
      btn.addEventListener('click', () => buyBoost(btn.getAttribute('data-boost')));
    });
    shopSkinsGridEl.querySelectorAll('[data-skin]').forEach(btn => {
      btn.addEventListener('click', () => buySkin(btn.getAttribute('data-skin')));
    });
    shopSkinsGridEl.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => equipSkin(btn.getAttribute('data-equip')));
    });
  }

  async function buyBoost(id){
    const item = SHOP_BOOSTS.find(b => b.id === id);
    if (!item || ownedBoosts.has(id) || shards < item.cost) return;
    shards -= item.cost;
    ownedBoosts.add(id);
    purchasesMade += 1;
    try { await window.storage.set('shards', String(shards)); } catch(e){}
    await persistShop();
    updateAllShardDisplays();
    renderShop();
    sndBuy();
    showToast(item.icon, 'BOOST UNLOCKED', item.name);
    checkAchievements();
  }

  async function buySkin(id){
    const item = SHOP_SKINS.find(s => s.id === id);
    if (!item || ownedSkins.has(id) || shards < item.cost) return;
    shards -= item.cost;
    ownedSkins.add(id);
    purchasesMade += 1;
    try { await window.storage.set('shards', String(shards)); } catch(e){}
    await persistShop();
    updateAllShardDisplays();
    renderShop();
    sndBuy();
    showToast(item.icon, 'SKIN UNLOCKED', item.name);
    checkAchievements();
  }

  async function equipSkin(id){
    if (equippedSkin === id) return;
    equippedSkin = id;
    skinChangesMade += 1;
    await persistShop();
    renderShop();
    renderSettingsSwatch();
    updateLauncher();
    tiles.forEach(t => renderOrbEl(t.el, t.value));
    sndBuy();
    checkAchievements();
  }

  function renderSettingsSwatch(){
    const item = SHOP_SKINS.find(s => s.id === equippedSkin) || SHOP_SKINS[0];
    equippedSkinLabelEl.textContent = item.name;
    settingsSwatchEl.innerHTML = PALETTES[equippedSkin].slice(0,4).map(c => `<span style="background:${c}"></span>`).join('');
  }

  async function getPlayerName(){
    if (playerName) return playerName;
    try {
      const res = await window.storage.get('player-name');
      if (res && res.value){ playerName = res.value; return playerName; }
    } catch (e) {}
    playerName = 'Player';
    return playerName;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // worldFilter: optional world id ('outer'/'mid'/'core'/'endless') — used
  // by the Contest page's per-world tabs. Leaderboard (lbPage) calls this
  // with no filter and shows every entry's world symbol instead, so a
  // player can see how deep a given score actually reached.
  function renderLeaderboardList(el, list, worldFilter){
    if (!el) return;
    let rows = list || [];
    if (worldFilter) rows = rows.filter(e => worldForTier(Math.max(0, (e.level || 1) - 1)).id === worldFilter);
    if (rows.length === 0){
      el.innerHTML = worldFilter
        ? '<div class="lb-empty">No settled runs in this world yet — be the first.</div>'
        : '<div class="lb-empty">No runs yet — be the first.</div>';
      return;
    }
    const depthNames = DEPTH_NAMES || [];
    el.innerHTML = rows.slice(0, 12).map((entry, i) => {
      const rank = i + 1;
      const colorClass = 'c' + (i % 5);
      const depthIdx = Math.max(0, (entry.level || 1) - 1);
      const depthLabel = depthNames[Math.min(depthIdx, depthNames.length - 1)] || `Depth ${entry.level || 1}`;
      const worldIcon = worldForTier(depthIdx).icon || '';
      return `<div class="contest-card ${colorClass}">
        <div class="cc-author">${escapeHtml(entry.name || 'Player')}</div>
        <div class="cc-title">${worldIcon} ${escapeHtml(depthLabel)}</div>
        <div class="cc-score">${(entry.score || 0).toLocaleString()} pts</div>
        <div class="cc-meta">Depth ${entry.level || 1}</div>
        <div class="cc-rank">#${rank}</div>
      </div>`;
    }).join('');
  }

  async function refreshHomeLeaderboardPreview(){
    const top5El = document.getElementById('homeLbTop5');
    if (!top5El) return;
    updateHomePosition([]);
    // Guest mode has no on-chain contest. Keep this surface motivational,
    // but point it at the free daily board instead of implying standings.
    top5El.innerHTML = `
      <div class="daily-home-lead">One offline board. A fresh target every day.</div>
      <div class="daily-home-target"><span>🎯</span><strong>Build your best run</strong><span>Free to play</span></div>`;
  }

  // The stored leaderboard only keeps its top 20 (see submitScore), so a
  // player outside that window has no real position to show yet — that's
  // a real gap the future indexer (see js/chain.js discussion) fixes properly.
  function updateHomePosition(list){
    const posEl = document.getElementById('homePosition');
    if (!posEl) return;
    if (!currentRunId){
      posEl.textContent = 'Local';
      return;
    }
    const me = (playerName || '').toLowerCase();
    const idx = (list || []).findIndex(e => (e.name || '').toLowerCase() === me);
    posEl.textContent = idx === -1 ? 'Unranked' : `#${idx + 1}`;
  }

  async function fetchLeaderboard(kind){
    if (kind === 'friends'){
      try {
        const res = await window.storage.get('leaderboard', true);
        const all = res ? JSON.parse(res.value) : [];
        const me = (playerName || '').toLowerCase();
        const friendNames = new Set(friendsList.map(f => f.toLowerCase()));
        return all.filter(e => friendNames.has((e.name || '').toLowerCase()) || (e.name || '').toLowerCase() === me);
      } catch (e) { return []; }
    }
    const key = kind === 'weekly' ? 'leaderboard-weekly' : kind === 'daily' ? 'leaderboard-daily' : 'leaderboard';
    try {
      const res = await window.storage.get(key, true);
      return res ? JSON.parse(res.value) : [];
    } catch (e) { return []; }
  }

  async function loadFriends(){
    try {
      const res = await window.storage.get('friends-list');
      friendsList = res ? JSON.parse(res.value) : [];
    } catch(e){ friendsList = []; }
  }
  async function saveFriends(){
    try { await window.storage.set('friends-list', JSON.stringify(friendsList)); } catch(e){}
  }

  async function submitScore(finalScore, finalBest, finalLevel){
    // Never publish Guest or Daily results to the local leaderboard. Once the
    // on-chain start_run flow exists, currentRunId will identify main runs.
    if (!currentRunId || isDaily) return;
    try {
      const name = await getPlayerName();
      const entry = { name, score: finalScore, best: finalBest, level: finalLevel, ts: Date.now(), season: SEASON_ID };
      for (const key of ['leaderboard', 'leaderboard-weekly', 'leaderboard-daily']){
        try {
          const res = await window.storage.get(key, true);
          const list = res ? JSON.parse(res.value) : [];
          list.push(entry);
          list.sort((a,b) => b.score - a.score);
          await window.storage.set(key, JSON.stringify(list.slice(0, 20)), true);
        } catch(e){}
      }
      const list = await fetchLeaderboard('global');
      renderLeaderboardList(gameOverLbListEl, list);
    } catch (e) {}
  }

  // Result-screen "Settle on Starknet" — only shown for a run that was
  // actually opened with start_run (currentRunId set) and not yet settled.
  function updateSettleRunButton(){
    if (!settleRunBtn) return;
    if (currentRunId && !currentRunSettled){
      settleRunBtn.style.display = '';
      settleRunBtn.disabled = false;
      settleRunBtn.textContent = '⛓️ Settle on Starknet';
    } else {
      settleRunBtn.style.display = 'none';
    }
  }

  if (settleRunBtn) settleRunBtn.addEventListener('click', () => {
    if (!window.Chain || !currentRunId || currentRunSettled) return;
    settleRunBtn.disabled = true;
    settleRunBtn.textContent = 'Settling…';
    (async () => {
      const checksum = window.Chain.computeRunChecksum({
        score, depth: currentTier() + 1, bestTile,
        merges, maxChain: maxChainThisRun,
      });
      const res = await window.Chain.settleRun(currentRunId, score, currentTier() + 1, bestTile, checksum);
      if (res && res.ok){
        currentRunSettled = true;
        settleRunBtn.textContent = '✅ Settled';
        showToast('⛓️', 'SETTLED', 'Run written to Starknet');
      } else {
        settleRunBtn.disabled = false;
        settleRunBtn.textContent = '⛓️ Settle on Starknet';
        showToast('⚠️', 'ERROR', 'Settle failed — try again');
      }
    })();
  });

  function endGame(){
    if (guestQuestTransitioning) return;
    gameOver = true;
    busy = false;
    transitioning = false;
    menuOpen = true;
    levelStartOverlayEl.classList.remove('show');
    depthClearOverlayEl.classList.remove('show');
    boardWrapEl.classList.remove('level-clear');
    lifetimeRuns += 1;
    try { window.storage.set('lifetime-runs', String(lifetimeRuns)); } catch(e){}
    const wasPB = score >= highScore && score > 0;
    const dName = isGuestMode() ? 'Practice run' : (DEPTH_NAMES[Math.min(currentTier(), DEPTH_NAMES.length - 1)] || `Depth ${currentTier() + 1}`);
    overlayTitleEl.textContent = 'OVERFLOW';
    finalScoreEl.textContent = score.toLocaleString();
    finalLevelEl.textContent = isGuestMode() ? 'Guest practice' : `Reached ${dName}`;
    finalBestEl.textContent = highScore.toLocaleString();
    finalShardsEl.textContent = `+${shardsEarnedThisRun}`;
    if (gameOverLbListEl) gameOverLbListEl.innerHTML = isGuestMode() ? '' : '<div class="lb-empty">Submitting…</div>';
    overlayEl.classList.add('show');
    confettiBurst(overCoinfettiEl, 26, ['#ff6b6b','#2ec4b6','#ffb648']);
    updateLauncher();
    sndOverflow();
    vibrate(80);
    speakNarrator('A full column is a closed door.', 2800);
    combo = 0;
    clearTimeout(comboResetTimer);
    hideComboBadge();
    if (currentRunId && !isDaily) submitScore(score, bestTile, currentTier() + 1);
    checkAchievements();
    checkSessionMissions();
    checkHiddenQuests();
    maybeAdvanceDailyStreak();
    checkDailyMissions();
    updateSettleRunButton();
    if (isDaily && score > dailyBest){
      dailyBest = score;
      try { window.storage.set('daily-best', String(dailyBest)); } catch(e){}
    }
    refreshHomeScreen();
    if (wasPB && score > 0){
      setTimeout(() => {
        pbScoreEl.textContent = score.toLocaleString();
        pbOverlayEl.classList.add('show');
        confettiBurst(pbConfettiEl, 36, ['#ffb648','#ffd27a','#2ec4b6']);
      }, 600);
    }
  }

  function restart(startTier){
    if (typeof startTier !== 'number') startTier = selectedStartTier || 0;
    startTier = Math.max(0, Math.min(startTier, bestTierReached + 1));
    guestQuestIndex = 0;
    guestQuestStartScore = 0;
    guestQuestStartMerges = 0;
    guestQuestTileHit = false;
    guestQuestStartChain = 0;
    guestQuestTransitioning = false;
    if (isGuestMode()) applyGuestQuest();
    else applyBoardSize(0);
    tiles.forEach(t => t.el && t.el.remove());
    tiles = [];
    score = startTier > 0 ? (SCORE_STAGE_THRESHOLDS[startTier - 1] || 0) : 0;
    bestTile = 2; merges = 0; chainCount = 0; maxChainThisRun = 0;
    busy = false; gameOver = false; menuOpen = false; paused = false;
    held = null; holdLocked = false;
    rerollsLeft = 0;
    undosLeft = 1; // one undo per run
    currentRunId = null; currentRunSettled = false; // ranked handler sets currentRunId right after calling restart()
    lastLiveLbPos = null; liveLbCooldown = 0; lastRivalToastAt = 0; rivalToastCursor = 0;
    powersLeft = POWERS_START;
    activePower = null;
    echoArmed = false;
    silenceCol = null;
    silenceDropsLeft = 0;
    dropsSinceChoice = 0;
    choiceUsedThisLevel = false;
    pendingChoice = null;
    lastAnnouncedTier = 0;
    lastDropSnapshot = null;
    checkpointFiredThisLevel = false;
    modifierUsedThisLevel = false;
    modifierActive = false;
    dropsThisLevel = 0;
    modifierArmDropIndex = rollModifierArmIndex();
    combo = 0; dropHadMerge = false; dropMergeScore = 0;
    shardsEarnedThisRun = 0;
    mergesThisRun = 0; maxComboThisRun = 0; relicsThisRun = 0;
    levelRelicsThisLevel = 0; levelMaxChainThisLevel = 0;
    sessionMissionsClaimed = new Set();
    secondWindUsedThisRun = false; comboShieldUsedThisRun = false;
    rerollsUsedThisRun = 0; usedHoldThisRun = false;
    survivedDangerThisRun = false; highTilesThisRun = 0;
    clearTimeout(comboResetTimer);
    hideComboBadge();
    buildColumns();
    initQueue();
    overlayEl.classList.remove('show');
    pauseOverlayEl.classList.remove('show');
    pbOverlayEl.classList.remove('show');
    updateHud();
    updateLauncher();
    refreshHomeScreen();
    renderMissionsList();
    updatePlayStreak();

    if (ownedBoosts.has('boost_headstart')){
      const base = Math.pow(2, currentTier() + 1);
      const tile = { id: nextId++, col: 0, row: 0, value: base };
      tiles.push(tile);
      createTileEl(tile, false);
    }
    // Level-start modal is deferred: shown after tutorial (if any), or right away if already seen
  }

  document.addEventListener('keydown', (e) => {
    if (menuOpen || paused) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= COLS) dropTile(n - 1);
    if (e.key.toLowerCase() === 'h') swapHold();
    if (e.key.toLowerCase() === 'u') undoDrop();
    if (e.key === 'Escape') { pauseBtn.click(); }
  });

  heldLaneEl.addEventListener('click', swapHold);
  const heldBtnEl = document.getElementById('heldBtn');
  if (heldBtnEl) heldBtnEl.addEventListener('click', (e) => { e.stopPropagation(); swapHold(); });
  if (undoBtn) undoBtn.addEventListener('click', undoDrop);
  // power system removed
  restartBtn.addEventListener('click', () => {
    const wasGuest = isGuestMode();
    isDaily = false;
    if (wasGuest) document.body.classList.add('guest-play');
    else document.body.classList.remove('guest-play');
    restart();
    showPage('gamePage');
    startMusic();
    setMusicIntensity(0);
    showLevelStartCard(currentTier(), !wasGuest);
  });
  depthContinueBtn.addEventListener('click', () => {
    depthClearOverlayEl.classList.remove('show');
    boardWrapEl.classList.remove('level-clear');
    transitioning = true;
    // Path map already showed the unlock — jump straight into next depth
    transitionToLevel(pendingToTier);
    transitioning = false;
  });

  levelStartBtn.addEventListener('click', () => {
    levelStartOverlayEl.classList.remove('show');
    if (isGuestMode()){
      boardWrapEl.classList.remove('level-clear');
      gameOver = false;
      paused = false;
      transitioning = false;
      busy = false;
      if (document.querySelectorAll('#columns .col').length !== COLS) buildColumns();
      fitGameLayout();
      updateHud();
      updateLauncher();
    }
    menuOpen = false;
    sndUI();
  });

  function openPauseMenu(){
    if (gameOver || menuOpen) return;
    paused = true;
    menuOpen = true;
    renderLevelsGrid();
    pauseOverlayEl.classList.add('show');
    sndUI();
  }
  pauseBtn.addEventListener('click', openPauseMenu);
  resumeBtn.addEventListener('click', () => {
    paused = false;
    menuOpen = false;
    pauseOverlayEl.classList.remove('show');
    sndUI();
  });
  const pauseStartDepthBtn = document.getElementById('pauseStartDepthBtn');
  if (pauseStartDepthBtn) pauseStartDepthBtn.addEventListener('click', () => {
    pauseOverlayEl.classList.remove('show');
    paused = false;
    menuOpen = false;
    restart(selectedStartTier);
    showLevelStartCard(currentTier());
    sndUI();
  });
  pauseHomeBtn.addEventListener('click', () => {
    paused = false;
    menuOpen = true;
    pauseOverlayEl.classList.remove('show');
    refreshHomeScreen();
    showPage('homePage');
  });
  pbOkBtn.addEventListener('click', () => pbOverlayEl.classList.remove('show'));
  const rankUpOkBtn = document.getElementById('rankUpOkBtn');
  if (rankUpOkBtn) rankUpOkBtn.addEventListener('click', () => {
    document.getElementById('rankUpOverlay').classList.remove('show');
  });

  // ---------- Login page (first gate after splash) ----------
  // Guest Mode -> free/local home. Ranked is intentionally disabled
  // until sign-in (Privy) is wired — see js/chain.js notes.
  if (loginSeasonChip) loginSeasonChip.textContent = `Season ${SEASON_ID}`;
  if (loginGuestBtn) loginGuestBtn.addEventListener('click', () => {
    document.body.classList.add('guest-account');
    showPage('homePage');
  });
  if (loginRankedBtn) {
    loginRankedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('🔒', 'COMING SOON', 'Ranked sign-in isn\u2019t ready yet — play Guest Mode');
    });
  }

  // ---------- Page / nav switching ----------
  function showPage(id){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
    document.getElementById(id).classList.add('show');
    document.body.classList.toggle('in-game', id === 'gamePage');
    if (id === 'gamePage') fitGameLayout();
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-nav') === id.replace('Page','')));
    sndUI();
  }

  // Shared by both the local-practice ("Enter the Spire") and Ranked Run
  // CTAs: fires the first-play tutorial once, otherwise drops straight
  // into the level-start card. Ranked-vs-guest is decided by the caller
  // (currentRunId set or not) before this runs.
  async function enterGameAfterRestart(){
    let seenDemo = false;
    try {
      const res = await window.storage.get('seen-intro-demo');
      seenDemo = !!(res && String(res.value) === '1');
    } catch(e){ seenDemo = false; }
    try {
      if (!seenDemo && typeof localStorage !== 'undefined' && localStorage.getItem('seen-intro-demo') === '1'){
        seenDemo = true;
      }
    } catch(e){}
    if (!seenDemo){
      menuOpen = true; // block play until tutorial ends
      setTimeout(() => startHandsOnTutorial(), 350);
    } else {
      showLevelStartCard(currentTier());
    }
  }

  playBtn.addEventListener('click', () => {
    isDaily = false;
    document.body.classList.add('guest-play');
    restart(); // currentRunId stays null — local practice, no contract calls
    showPage('gamePage');
    startMusic();
    setMusicIntensity(0);
    enterGameAfterRestart();
  });

  // homeBtn/vaultQuickBtn no longer exist — Home is reached via Pause
  // (pauseHomeBtn) since the left dock was removed; Sigils moved into the
  // merged Sigils & Quests page (see openSigilsPage below). Guarded rather
  // than deleted in case a future layout brings a quick-access icon back.
  if (homeBtn) homeBtn.addEventListener('click', () => {
    menuOpen = true;
    refreshHomeScreen();
    showPage('homePage');
    // Keep soft bed at low intensity on hub
    setMusicIntensity(0);
  });
  if (vaultQuickBtn) vaultQuickBtn.addEventListener('click', () => { openSigilsPage(); menuOpen = true; });
  const lbBackBtn = document.getElementById('lbBackBtn');
  if (lbBackBtn) lbBackBtn.addEventListener('click', () => { refreshHomeScreen(); showPage('homePage'); });
  const homeLbMoreBtn = document.getElementById('homeLbMoreBtn');
  if (homeLbMoreBtn) homeLbMoreBtn.addEventListener('click', () => {
    dailyBtn.click();
  });

  // ---------- Contest page (per-world standings, feeds the Leaderboard) ----------
  const contestListEl = document.getElementById('contestList');
  const contestBackBtn = document.getElementById('contestBackBtn');
  const contestToLbLink = document.getElementById('contestToLbLink');
  if (contestBackBtn) contestBackBtn.addEventListener('click', () => { refreshHomeScreen(); showPage('homePage'); });
  if (contestToLbLink) contestToLbLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (lbListEl) lbListEl.innerHTML = '<div class="lb-empty">Loading…</div>';
    showPage('lbPage');
    const list = await fetchLeaderboard('global');
    renderLeaderboardList(lbListEl, list);
  });
  async function loadContestWorld(worldId){
    if (!contestListEl) return;
    contestListEl.innerHTML = '<div class="lb-empty">Loading…</div>';
    const list = await fetchLeaderboard('global');
    renderLeaderboardList(contestListEl, list, worldId);
  }
  document.querySelectorAll('#contestWorldTabs .contest-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#contestWorldTabs .contest-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadContestWorld(tab.getAttribute('data-world'));
      sndUI();
    });
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      if (target === 'home') { refreshHomeScreen(); showPage('homePage'); }
      else if (target === 'vault') { openSigilsPage(); }
      else if (target === 'shop') { renderShop(); showPage('shopPage'); }
      else if (target === 'achv') { renderMissionsList(); renderAchvList(); showPage('achvPage'); }
      else if (target === 'settings') { showPage('settingsPage'); }
    });
  });

  if (viewLbBtn) viewLbBtn.addEventListener('click', async () => {
    lbListEl.innerHTML = '<li class="lb-empty">Loading…</li>';
    showPage('lbPage');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#lbPage .contest-tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-lb') === 'global'));
    const friendsAddRowEl = document.getElementById('friendsAddRow');
    if (friendsAddRowEl) friendsAddRowEl.classList.remove('show');
    const list = await fetchLeaderboard('global');
    renderLeaderboardList(lbListEl, list);
  });

  // Home's "Daily" button now opens the mission hub instead of launching
  // straight into a run — the actual Daily Descent launcher lives inside
  // dailyPage as dailyDescendBtn.
  dailyBtn.addEventListener('click', () => {
    rolloverDailyMissionsIfNeeded();
    renderDailyMissionsList();
    const streakEl = document.getElementById('dailyStreakCount');
    if (streakEl) streakEl.textContent = dailyStreakCount;
    showPage('dailyPage');
  });
  const dailyBackBtn = document.getElementById('dailyBackBtn');
  if (dailyBackBtn) dailyBackBtn.addEventListener('click', () => { refreshHomeScreen(); showPage('homePage'); });
  const dailyDescendBtn = document.getElementById('dailyDescendBtn');
  if (dailyDescendBtn) dailyDescendBtn.addEventListener('click', () => {
    isDaily = true;
    document.body.classList.remove('guest-play');
    restart(0); // always depth 1, fixed board — a checkpoint shortcut would break the "one board" fairness
    showPage('gamePage');
    startMusic();
    showLevelStartCard(currentTier());
    speakNarrator('Daily descent. One board. One chance.', 2800);
  });

  const friendsAddRowEl = document.getElementById('friendsAddRow');
  const friendNameInputEl = document.getElementById('friendNameInput');
  const friendAddBtnEl = document.getElementById('friendAddBtn');
  // Scoped to #lbPage so the Contest page's world tabs (#contestWorldTabs,
  // bound separately above) don't get double-handled by this one too —
  // both reuse the .contest-tab class for shared styling only.
  document.querySelectorAll('#lbPage .contest-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('#lbPage .contest-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const kind = tab.getAttribute('data-lb');
      if (friendsAddRowEl) friendsAddRowEl.classList.toggle('show', kind === 'friends');
      lbListEl.innerHTML = '<div class="lb-empty">Loading…</div>';
      const list = await fetchLeaderboard(kind);
      renderLeaderboardList(lbListEl, list);
      sndUI();
    });
  });
  if (friendAddBtnEl) friendAddBtnEl.addEventListener('click', async () => {
    const v = (friendNameInputEl.value || '').trim().slice(0, 12);
    if (!v) return;
    if (!friendsList.some(f => f.toLowerCase() === v.toLowerCase())){
      friendsList.push(v);
      await saveFriends();
    }
    friendNameInputEl.value = '';
    sndUI();
    lbListEl.innerHTML = '<li class="lb-empty">Loading…</li>';
    const list = await fetchLeaderboard('friends');
    renderLeaderboardList(lbListEl, list);
  });

  const homeVaultBtn = document.getElementById('homeVaultBtn');
  if (homeVaultBtn) homeVaultBtn.addEventListener('click', () => {
    openSigilsPage();
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-nav')==='vault'));
  });
  const settingsShopBtn = document.getElementById('settingsShopBtn');
  const settingsQuestsBtn = document.getElementById('settingsQuestsBtn');
  if (settingsShopBtn) settingsShopBtn.addEventListener('click', () => { renderShop(); showPage('shopPage'); });
  if (settingsQuestsBtn) settingsQuestsBtn.addEventListener('click', () => {
    renderMissionsList();
    renderAchvList();
    showPage('achvPage');
    // Settings' "Quests" link should land on the missions tab, not the
    // Sigils tab that's the page's default when opened from elsewhere.
    activateQuestTab('run');
  });

  let questOpenedFromGame = false;
  // objectivesBtn (left-dock icon) was removed — the quest bar itself is
  // now the trigger, since it's already visible in the header at all times.
  if (questBarCardEl) questBarCardEl.style.cursor = 'pointer';
  if (questBarCardEl) questBarCardEl.addEventListener('click', () => {
    menuOpen = true;
    paused = true;
    questOpenedFromGame = true;
    clearQuestNotif();
    renderMissionsList();
    renderAchvList();
    showPage('achvPage');
    // The quest bar opens the readable achievement progress view.
    activateQuestTab('achv');
  });
  if (objBackBtn) objBackBtn.addEventListener('click', () => { objectivesOverlayEl.classList.remove('show'); menuOpen = false; });
  const questBackBtn = document.getElementById('questBackBtn');
  if (questBackBtn) questBackBtn.addEventListener('click', () => {
    if (questOpenedFromGame && !gameOver) {
      questOpenedFromGame = false;
      menuOpen = false;
      paused = false;
      showPage('gamePage');
    } else {
      questOpenedFromGame = false;
      refreshHomeScreen();
      showPage('homePage');
    }
  });
  // Shared by every entry point into the merged Sigils & Quests page —
  // keeps tab-activation + panel show/hide in exactly one place instead of
  // copy-pasted at each call site (openSigilsPage, the quest bar, Settings'
  // Quests link, and the tab buttons themselves all use this).
  function activateQuestTab(kind){
    document.querySelectorAll('.quest-tab').forEach(t => t.classList.remove('active'));
    const tabEl = document.querySelector(`.quest-tab[data-qtab="${kind}"]`);
    if (tabEl) tabEl.classList.add('active');
    const sigilsPanelEl = document.getElementById('sigilsPanel');
    if (sigilsPanelEl) sigilsPanelEl.style.display = kind === 'sigils' ? '' : 'none';
    if (missionsListEl) missionsListEl.style.display = 'none';
    if (achvListEl) achvListEl.style.display = kind === 'achv' ? '' : 'none';
    if (kind === 'sigils') renderVaultList();
  }

  document.querySelectorAll('.quest-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activateQuestTab(tab.getAttribute('data-qtab'));
      sndUI();
    });
  });

  document.querySelectorAll('.sound-switch').forEach(el => el.addEventListener('click', toggleSound));
  document.querySelectorAll('.haptic-switch').forEach(el => el.addEventListener('click', toggleHaptic));
  document.querySelectorAll('.music-switch').forEach(el => el.addEventListener('click', toggleMusic));
  nameSaveBtn.addEventListener('click', async () => {
    const v = (nameInputEl.value || '').trim().slice(0, 12) || 'Player';
    playerName = v;
    try { await window.storage.set('player-name', v); } catch(e){}
    nameInputEl.value = v;
    showToast('✅', 'SAVED', 'Name updated');
  });
  resetBtn.addEventListener('click', async () => {
    if (!window.confirm('Reset all progress? This clears your vault, achievements, shards and shop purchases.')) return;
    vaultSet = new Set(); achvSet = new Set(); shards = 0; highScore = 0;
    ownedBoosts = new Set(); ownedSkins = new Set(['classic']); equippedSkin = 'classic';
    lifetimeMerges = 0; purchasesMade = 0; skinChangesMade = 0; playStreak = 0;
    try {
      await window.storage.set('vault', JSON.stringify([]));
      await window.storage.set('achievements', JSON.stringify([]));
      await window.storage.set('shards', '0');
      await window.storage.set('high-score', '0');
      await window.storage.set('owned-boosts', JSON.stringify([]));
      await window.storage.set('owned-skins', JSON.stringify(['classic']));
      await window.storage.set('equipped-skin', 'classic');
      await window.storage.set('lifetime-merges', '0');
      await window.storage.set('purchases-made', '0');
      await window.storage.set('skin-changes', '0');
      await window.storage.set('play-streak', '0');
    } catch(e){}
    renderShop(); renderSettingsSwatch(); renderVaultList(); renderAchvList();
    updateHud(); refreshHomeScreen(); updateAllShardDisplays();
    showToast('🔄', 'RESET', 'Progress cleared');
  });

  // Hands-on tutorial: real coach-marks over the actual game UI, triggered
  // the first time the player taps "Enter the Spire" (not on the splash).
  const TUTORIAL_STEPS = [
    {
      target: '#boardWrap',
      clickTarget: '#columns',
      text: 'Tap a column to drop your orb in. Give it a try — tap any column now.',
      action: 'click',
    },
    {
      target: '.loaded-lane',
      text: 'This is Loaded — the orb about to drop. Tap a column and this is what falls in.',
      action: 'next',
    },
    {
      target: '.next-lane',
      text: 'Next shows what\u2019s coming after Loaded, so you can plan your merge ahead of time.',
      action: 'next',
    },
    {
      target: '#heldLane',
      clickTarget: '#heldBtn',
      text: 'Held lets you park the Loaded orb for later and swap in a fresh one. Try it now — tap Hold.',
      action: 'click',
    },
    {
      target: '#undoLane',
      clickTarget: '#undoBtn',
      text: 'Undo reverts your last drop if it didn\u2019t go the way you planned — you get a limited number per run. Try it now.',
      action: 'click',
    },
    {
      target: '#levelBarRow',
      text: 'This is your quest for this depth — fill it to descend further, boards get tighter the deeper you go. Tap it anytime to check your quest and rank in full.',
      action: 'next',
    },
    {
      target: '.player-card',
      text: 'Reach the top tier and that orb ascends — a big bonus, and it frees the space. Don\u2019t let the board fill to the ceiling, or the run ends.',
      action: 'finish',
    },
  ];

  function startHandsOnTutorial(){
    const overlay = document.getElementById('coachOverlay');
    const spotEl = document.getElementById('coachSpot');
    const hintEl = document.getElementById('coachHintTap');
    const bubbleEl = document.getElementById('coachBubble');
    const textEl = document.getElementById('coachText');
    const nextBtn = document.getElementById('coachNextBtn');
    const skipBtn = document.getElementById('coachSkipBtn');
    if (!overlay) return;

    let stepIdx = 0;
    let active = true;
    let currentClickHandler = null;
    let currentClickEl = null;
    let wasMenuOpen = menuOpen;

    function positionFor(el){
      const r = el.getBoundingClientRect();
      const pad = 8;
      return { top: r.top - pad, left: r.left - pad, width: r.width + pad*2, height: r.height + pad*2, rect: r };
    }

    function detachClickListener(){
      if (currentClickEl && currentClickHandler){
        currentClickEl.removeEventListener('click', currentClickHandler, true);
        currentClickEl.removeEventListener('pointerup', currentClickHandler, true);
      }
      currentClickEl = null;
      currentClickHandler = null;
    }

    function renderStep(){
      const step = TUTORIAL_STEPS[stepIdx];
      const targetEl = document.querySelector(step.target);
      if (!targetEl){ nextStep(); return; }
      const pos = positionFor(targetEl);
      spotEl.style.top = pos.top + 'px';
      spotEl.style.left = pos.left + 'px';
      spotEl.style.width = pos.width + 'px';
      spotEl.style.height = pos.height + 'px';

      // Allow real interaction under the spotlight for click steps.
      // Overlay itself does not capture; only the bubble does.
      if (step.action === 'click'){
        overlay.style.pointerEvents = 'none';
        bubbleEl.style.pointerEvents = 'auto';
        // Temporarily allow drops / holds / undos so the required action can succeed
        menuOpen = false;
      } else {
        overlay.style.pointerEvents = 'auto';
        bubbleEl.style.pointerEvents = 'auto';
        menuOpen = true;
      }

      detachClickListener();
      if (step.action === 'click'){
        hintEl.style.display = 'block';
        hintEl.style.top = (pos.rect.top + pos.rect.height * 0.35) + 'px';
        hintEl.style.left = (pos.rect.left + pos.rect.width * 0.5) + 'px';
        const clickEl = document.querySelector(step.clickTarget || step.target);
        if (clickEl){
          currentClickEl = clickEl;
          // Capture phase so we still see the event even if game handlers stopPropagation
          currentClickHandler = (e) => {
            if (!active) return;
            // Advance after the real action has a chance to run
            setTimeout(() => { if (active) nextStep(); }, 80);
          };
          clickEl.addEventListener('click', currentClickHandler, true);
          clickEl.addEventListener('pointerup', currentClickHandler, true);
        }
      } else {
        hintEl.style.display = 'none';
      }

      textEl.textContent = step.text;
      nextBtn.style.display = step.action === 'click' ? 'none' : '';
      nextBtn.textContent = stepIdx === TUTORIAL_STEPS.length - 1 ? "Let's play" : 'Next';

      const bubbleH = 110;
      const spaceBelow = window.innerHeight - (pos.top + pos.height);
      let bubbleTop;
      if (spaceBelow > bubbleH + 16){
        bubbleTop = pos.top + pos.height + 14;
      } else {
        bubbleTop = Math.max(10, pos.top - bubbleH - 14);
      }
      bubbleEl.style.top = bubbleTop + 'px';
      let bubbleLeft = pos.left + pos.width/2 - 125;
      bubbleLeft = Math.max(12, Math.min(bubbleLeft, window.innerWidth - 262));
      bubbleEl.style.left = bubbleLeft + 'px';
    }

    function nextStep(){
      if (!active) return;
      sndUI();
      if (stepIdx < TUTORIAL_STEPS.length - 1){
        stepIdx += 1;
        renderStep();
      } else {
        finish();
      }
    }

    function finish(){
      if (!active) return;
      active = false;
      detachClickListener();
      overlay.style.display = 'none';
      overlay.style.pointerEvents = '';
      nextBtn.onclick = null;
      skipBtn.onclick = null;
      menuOpen = false;
      try { window.storage.set('seen-intro-demo', '1'); } catch(e){}
      try { localStorage.setItem('seen-intro-demo', '1'); } catch(e){}
      showLevelStartCard(currentTier());
    }

    nextBtn.onclick = nextStep;
    skipBtn.onclick = finish;
    window.addEventListener('resize', () => { if (active) renderStep(); });

    overlay.style.display = 'block';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
    menuOpen = true;
    renderStep();
  }

  buildColumns();
  initQueue();
  updateHud();
  updateLauncher();
  renderMissionsList();

  (async () => {
    await Promise.all([loadVault(), loadAchievements(), loadHighScore(), loadBestTier(), loadSoundPref(), loadShards(), loadLifetimeMerges(), loadShop(), loadStreak(), loadFriends()]);
    try {
      const res = await window.storage.get('player-name');
      if (res && res.value){ playerName = res.value; nameInputEl.value = res.value; }
    } catch(e){}
    try {
      const res = await window.storage.get('sigils');
      sigilSet = new Set(res ? JSON.parse(res.value) : []);
    } catch(e){ sigilSet = new Set(); }
    try {
      const res = await window.storage.get('lifetime-runs');
      lifetimeRuns = res ? parseInt(res.value, 10) || 0 : 0;
    } catch(e){ lifetimeRuns = 0; }
    try {
      const res = await window.storage.get('daily-best');
      dailyBest = res ? parseInt(res.value, 10) || 0 : 0;
    } catch(e){ dailyBest = 0; }
    try {
      const res = await window.storage.get('daily-missions-state');
      const parsed = res ? JSON.parse(res.value) : null;
      dailyMissionsDate = parsed && parsed.date ? parsed.date : todayStr();
      dailyMissionsDoneToday = new Set(parsed && Array.isArray(parsed.doneIds) ? parsed.doneIds : []);
      rolloverDailyMissionsIfNeeded(); // in case the app was closed across midnight
    } catch(e){ dailyMissionsDate = todayStr(); dailyMissionsDoneToday = new Set(); }
    try {
      const res = await window.storage.get('daily-streak');
      const parsed = res ? JSON.parse(res.value) : null;
      dailyStreakCount = parsed && typeof parsed.count === 'number' ? parsed.count : 0;
      dailyStreakLastDate = parsed && parsed.lastDate ? parsed.lastDate : null;
      // A missed day (gap > 1) breaks the streak even before the player's
      // next run — reflect that immediately rather than waiting.
      if (dailyStreakLastDate && dailyStreakLastDate !== todayStr()){
        const prev = new Date(dailyStreakLastDate + 'T00:00:00');
        const cur = new Date(todayStr() + 'T00:00:00');
        const diffDays = Math.round((cur - prev) / 86400000);
        if (diffDays > 1) dailyStreakCount = 0;
      }
    } catch(e){ dailyStreakCount = 0; dailyStreakLastDate = null; }
    refreshHomeScreen();
    // Splash: short, real load-tied. No fake progress bar padding.
    // Min ~450ms so logo is readable; hide as soon as init finishes after that.
    const splashMinMs = 450;
    const started = performance.now();
    const hideSplash = () => {
      const elapsed = performance.now() - started;
      const wait = Math.max(0, splashMinMs - elapsed);
      setTimeout(() => {
        if (splashEl) splashEl.classList.add('hide');
        showPage('loginPage');
        speakNarrator('Recover relics. Survive the Spire.', 2800);
      }, wait);
    };
    hideSplash();
  })();
})();

// =============================================
// NEW STATE
// =============================================

let currentRunId = null;
let currentSeed = null;
let isRankedMode = false;
let moveLoggingEnabled = false;

// =============================================
// MODIFY dropTile() — ADD LOGGING
// =============================================

// Find your existing dropTile function and add this at the beginning
// If you can't find it, paste this whole function (it's in your game.js)
const originalDropTile = window.dropTile || function() {};

window.dropTile = function(col) {
    // --- ADD THIS LOGGING ---
    if (moveLoggingEnabled) {
        const value = queue[0];      // Your existing queue
        const nextValue = queue[1];
        const isModifier = modifierActive || false;
        logDrop(col, value, nextValue, isModifier);
    }
    // --- END ADDED CODE ---
    
    // --- YOUR EXISTING dropTile CODE ---
    // (The rest of your drop function stays exactly the same)
    originalDropTile.call(this, col);
};

// =============================================
// MODIFY resolveStep() — ADD LOGGING FOR MERGES
// =============================================

const originalResolveStep = window.resolveStep || function() {};

window.resolveStep = function() {
    // --- ADD THIS LOGGING ---
    if (moveLoggingEnabled) {
        // Find the pair that merged
        const pair = findAdjacentPair(); // Your existing function
        if (pair) {
            const newValue = pair[0].value + pair[1].value;
            const chainCount = window.chainCount || 1;
            logMerge(pair[0].col, pair[0].row, newValue, chainCount);
        }
    }
    // --- END ADDED CODE ---
    
    // --- YOUR EXISTING resolveStep CODE ---
    originalResolveStep.call(this);
};

// =============================================
// MODIFY swapHold() — ADD LOGGING
// =============================================

const originalSwapHold = window.swapHold || function() {};

window.swapHold = function() {
    // --- ADD THIS LOGGING ---
    if (moveLoggingEnabled) {
        const loadedValue = queue[0];  // Your existing queue
        const heldValue = held || 0;   // Your existing held variable
        logHold(0, loadedValue, heldValue);
    }
    // --- END ADDED CODE ---
    
    // --- YOUR EXISTING swapHold CODE ---
    originalSwapHold.call(this);
};

// =============================================
// NEW FUNCTION: Start Ranked Run
// =============================================

async function startRankedRun() {
    // 1. Check if authenticated with Privy
    const authed = await isAuthenticated();
    if (!authed) {
        await loginWithPrivy();
        // After login, try again
        if (!await isAuthenticated()) {
            showToast('❌', 'AUTH', 'Login failed');
            return;
        }
    }
    
    // 2. Check Season Pass
    const hasPass = await checkSeasonPass();
    if (!hasPass) {
        showSeasonPassModal();
        return;
    }
    
    // 3. Connect wallet
    const address = await getWalletAddress();
    if (!address) {
        showToast('❌', 'WALLET', 'No wallet found');
        return;
    }
    
    // 4. Start run on Starknet
    const result = await startRun();
    if (!result) {
        showToast('❌', 'ERROR', 'Failed to start ranked run');
        return;
    }
    
    currentRunId = result.runId;
    currentSeed = result.seed;
    isRankedMode = true;
    moveLoggingEnabled = true;
    resetMoveLog();
    
    // 5. Start the game
    restart(); // Your existing restart function
    showLevelStartCard(currentTier()); // Your existing function
    showToast('⛓️', 'RANKED', `Run #${currentRunId} started`);
}

// =============================================
// NEW FUNCTION: Settle Ranked Run
// =============================================

async function settleRankedRun() {
    if (!isRankedMode || !currentRunId) return;
    
    // Get game state from your existing variables
    const score = window.score || 0;
    const depth = (window.currentTier ? window.currentTier() : 0) + 1;
    const bestTile = window.bestTile || 2;
    const moves = getMoveLog();
    
    if (moves.length === 0) {
        showToast('⚠️', 'WARNING', 'No moves recorded');
        return;
    }
    
    // Compress and hash moves
    const compressed = compressMoves(moves);
    const movesHash = hashMoves(moves);
    
    // Compute checksum
    const checksum = computeChecksum(
        currentSeed,
        score,
        depth,
        bestTile,
        movesHash
    );
    
    // Settle on Starknet
    const result = await settleRun(
        currentRunId,
        score,
        depth,
        bestTile,
        movesHash,
        checksum
    );
    
    if (result.success) {
        showToast('⛓️', 'SETTLED', `Run #${currentRunId} on Starknet`);
        isRankedMode = false;
        moveLoggingEnabled = false;
        resetMoveLog();
    } else {
        showToast('❌', 'ERROR', 'Settlement failed');
    }
}

// =============================================
// NEW FUNCTION: Season Pass Modal
// =============================================

function showSeasonPassModal() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay show';
    overlay.id = 'seasonPassModal';
    overlay.innerHTML = `
        <div class="panel">
            <h2>🎟️ Season Pass</h2>
            <p style="color: var(--ink-dim);">Get 90 days of Ranked play for $5</p>
            <div style="text-align:left;padding:10px 0;line-height:2;">
                <div>✅ Unlimited ranked runs</div>
                <div>✅ Global leaderboard</div>
                <div>✅ Permanent onchain records</div>
                <div>✅ Exclusive skins & rewards</div>
            </div>
            <div class="btn-row" style="flex-direction:column;gap:8px;">
                <button class="primary" id="buyPassBtn">Buy $5</button>
                <button class="secondary" id="skipPassBtn">Continue as Guest</button>
            </div>
            <p style="font-size:10px;color:var(--ink-faint);margin-top:10px;">
                You'll be redirected to payment. No wallet needed.
            </p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('buyPassBtn').onclick = async () => {
        // In production, this would trigger Stripe
        // For now, simulate purchase
        await activateSeasonPass(90);
        overlay.remove();
        showToast('✅', 'PURCHASED', 'Season Pass activated!');
        startRankedRun();
    };
    
    document.getElementById('skipPassBtn').onclick = () => {
        overlay.remove();
        isRankedMode = false;
        moveLoggingEnabled = false;
        restart(); // Your existing restart function
        showLevelStartCard(currentTier()); // Your existing function
    };
}

// =============================================
// MODIFY PLAY BUTTON
// =============================================

// Find your existing playBtn click handler and replace it
// Or add this if you don't have one
const playBtn = document.getElementById('playBtn');
if (playBtn) {
    const originalClick = playBtn.onclick;
    playBtn.onclick = async function(e) {
        if (originalClick) originalClick.call(this, e);
        
        // Check if authenticated
        const authed = await isAuthenticated();
        if (!authed) {
            await loginWithPrivy();
            if (await isAuthenticated()) {
                startRankedRun();
            }
            return;
        }
        startRankedRun();
    };
}

// =============================================
// MODIFY endGame() — Auto-settle ranked runs
// =============================================

// Find your existing endGame function and add this at the end
const originalEndGame = window.endGame || function() {};

window.endGame = function() {
    // Call original endGame
    originalEndGame.call(this);
    
    // If ranked mode, settle
    if (isRankedMode && currentRunId) {
        setTimeout(() => settleRankedRun(), 1500);
    }
};

// =============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// =============================================

window.startRankedRun = startRankedRun;
window.settleRankedRun = settleRankedRun;
window.showSeasonPassModal = showSeasonPassModal;