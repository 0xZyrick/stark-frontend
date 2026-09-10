/**
 * Session gate: splash → (setting up) → login OR restore → name if needed → home only with account.
 * Guest scores persist per Privy user id.
 */
import { useEffect, useRef, useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { Splash } from './pages/Splash';
import { LoginPage } from './pages/LoginPage';
import { NamePage } from './pages/NamePage';
import { HomePage } from './pages/HomePage';
import { WorldSelectPage } from './pages/WorldSelectPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SigilsPage } from './pages/SigilsPage';
import { GamePage } from './pages/GamePage';
import { FundPromptModal } from './components/FundPromptModal';
import { SettingsModal } from './components/SettingsModal';
import { PlayerCard } from './components/PlayerCard';
import { SpirePerksModal } from './components/SpirePerksModal';
import { Mascot } from './components/Mascot';
import { sndUI, unlockAudio, pauseMusic, resumeMusic } from './audio/sound';
import {
  speakNarrator,
  setNarratorListener,
  clearNarrator,
} from './audio/narrator';
import type { CampaignLevel } from './engine';
import { SPIRE_SIGIL_LIMIT } from './engine';
import { fetchLeaderboard } from './privy/api';
import { isPrivyConfigured } from './privy';
import { usePrivy } from '@privy-io/react-auth';
import { useSpireWallet } from './starknet/useSpireWallet';
import { loadProgress, readPlayerName, savePlayerName } from './lib/accountStore';
import { Analytics } from '@vercel/analytics/react';

type WalletApi = {
  ready: boolean;
  authenticated: boolean;
  connected: boolean;
  address: string | null;
  short: string | null;
  balanceHint: string | null;
  busy: boolean;
  error: string | null;
  ensure: () => Promise<unknown>;
  connect: () => Promise<unknown>;
  startRunOnChain: () => Promise<{ runId: number; seed: string; txHash?: string }>;
  settleRunOnChain: (body: {
    runId: number;
    score: number;
    depth: number;
    bestTile: number;
    movesHash: string;
    checksum: string;
    name?: string;
    worldId?: string;
  }) => Promise<unknown>;
  clearError: () => void;
  refreshBalance?: () => Promise<void>;
  logout?: () => Promise<void>;
  userId?: string | null;
};

function AppWithWallet() {
  const wallet = useSpireWallet();
  const { logout, user, ready, authenticated } = usePrivy();
  const userId = user?.id ?? null;
  return (
    <AppShell
      accountId={userId}
      wallet={{
        ...wallet,
        authenticated: Boolean(authenticated),
        ready: Boolean(ready),
        userId,
        logout: async () => {
          await logout();
        },
      }}
    />
  );
}

function AppWithoutWallet() {
  const wallet: WalletApi = {
    ready: true,
    authenticated: false,
    connected: false,
    address: null,
    short: null,
    balanceHint: null,
    busy: false,
    error: null,
    ensure: async () => {
      throw new Error('Login required');
    },
    connect: async () => {
      throw new Error('Login required');
    },
    startRunOnChain: async () => {
      throw new Error('Login required');
    },
    settleRunOnChain: async () => {
      throw new Error('Login required');
    },
    clearError: () => {},
    userId: null,
  };
  return <AppShell accountId={null} wallet={wallet} />;
}

function AppShell({
  wallet,
  accountId,
}: {
  wallet: WalletApi;
  accountId: string | null;
}) {
  const engine = useGameEngine(accountId);
  const {
    phase,
    setPhase,
    startCampaignLevel,
    startRun,
    meta,
    rank,
    setPlayerName,
    score,
    tier,
  } = engine;

  const [splashGone, setSplashGone] = useState(false);
  const [showName, setShowName] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [narratorText, setNarratorText] = useState('');
  const [narratorOn, setNarratorOn] = useState(false);
  const [showAchv, setShowAchv] = useState(false);
  const [showSigils, setShowSigils] = useState(false);
  const [showWorldSelect, setShowWorldSelect] = useState(false);
  const [showFundPrompt, setShowFundPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerCard, setShowPlayerCard] = useState(false);
  const [showSpirePerks, setShowSpirePerks] = useState(false);
  const [spireBusy, setSpireBusy] = useState(false);
  const [spireError, setSpireError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [remoteLb, setRemoteLb] = useState<
    Array<{
      name: string;
      worldId: string;
      rating: number;
      score: number;
      rank?: number;
      isYou?: boolean;
    }>
  >([]);

  const activeRunRef = useRef<{ runId: number; seed: string } | null>(null);
  const settlingRef = useRef(false);

  useEffect(() => {
    const boot = window.setTimeout(() => setSplashGone(true), 900);
    return () => window.clearTimeout(boot);
  }, []);

  /**
   * Session gate:
   * - While Privy not ready → setup overlay, stay off home
   * - Not authenticated → login only
   * - Authenticated → restore name/progress → home (or name once)
   */
  useEffect(() => {
    if (!splashGone) return;

    if (isPrivyConfigured() && !wallet.ready) {
      setSetupBusy(true);
      return;
    }

    if (!wallet.authenticated) {
      setSetupBusy(false);
      setShowName(false);
      if (phase === 'home' || phase === 'splash') setPhase('login');
      return;
    }

    // Authenticated — restore account
    setSetupBusy(true);
    const uid = wallet.userId || accountId;
    const savedName = readPlayerName(uid);

    void (async () => {
      try {
        await wallet.ensure().catch(() => null);
        if (savedName) {
          setPlayerName(savedName);
          setShowName(false);
          setShowWorldSelect(false);
          setShowAchv(false);
          setShowSigils(false);
          setPhase('home'); // always hub after refresh — never a stuck board
        } else {
          setShowName(true);
          setPhase('login');
        }
      } finally {
        setSetupBusy(false);
      }
    })();
  }, [
    splashGone,
    wallet.ready,
    wallet.authenticated,
    wallet.userId,
    accountId,
    setPhase,
    setPlayerName,
  ]);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((data) => {
        if (cancelled) return;
        setRemoteLb(
          data.rows.map((r) => ({
            name: r.name,
            worldId: r.worldId,
            rating: r.rating,
            score: r.bestScore,
            rank: r.rank,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    setNarratorListener({
      onText: (text, visible) => {
        setNarratorText(text);
        setNarratorOn(visible);
      },
    });
    return () => clearNarrator();
  }, []);

  useEffect(() => {
    const inGame =
      phase === 'playing' ||
      phase === 'paused' ||
      phase === 'gameover' ||
      phase === 'depthclear';
    document.body.classList.toggle('in-game', inGame);
    document.body.classList.toggle('guest-account', meta.isGuest);
    // Extra safety: if a hub nav node exists, hide while in-run
    const nav = document.getElementById('bottomNav');
    if (nav) nav.style.display = inGame ? 'none' : '';
    // Soft bed: pause in gameplay, resume on hub
    if (inGame) pauseMusic();
    else resumeMusic();
  }, [phase, meta.isGuest]);

  useEffect(() => {
    if (phase !== 'gameover' && phase !== 'depthclear') return;
    if (meta.isGuest) return;
    if (!activeRunRef.current) return;
    if (settlingRef.current) return;

    settlingRef.current = true;
    const run = activeRunRef.current;
    const worldId =
      tier >= 12 ? 'endless' : tier >= 8 ? 'core' : tier >= 4 ? 'mid' : 'outer';

    void (async () => {
      try {
        await wallet.settleRunOnChain({
          runId: run.runId,
          score,
          depth: tier,
          bestTile: engine.board.bestTile || 2,
          movesHash: '0',
          checksum: '0',
          name: meta.playerName,
          worldId,
        });
        speakNarrator('Run settled on-chain.', 1800);
        try {
          const data = await fetchLeaderboard();
          setRemoteLb(
            data.rows.map((r) => ({
              name: r.name,
              worldId: r.worldId,
              rating: r.rating,
              score: r.bestScore,
              rank: r.rank,
            })),
          );
        } catch {
          /* optional */
        }
      } catch (e) {
        console.warn('[spire] settle failed', e);
        speakNarrator('Settle failed — fund wallet or try again.', 2200);
      } finally {
        activeRunRef.current = null;
        settlingRef.current = false;
      }
    })();
  }, [phase, meta.isGuest, meta.playerName, score, tier, engine.board.bestTile, wallet]);

  const afterAuth = (hint?: string) => {
    unlockAudio();
    sndUI();
    setSetupBusy(true);
    const uid = wallet.userId || accountId;
    const progress = loadProgress(uid);
    const saved = progress?.playerName || null;
    void (async () => {
      try {
        await wallet.ensure().catch(() => null);
        if (saved) {
          setPlayerName(saved);
          setShowName(false);
          setPhase('home');
        } else {
          if (hint) setPlayerName(hint.slice(0, 12));
          setShowName(true);
        }
      } finally {
        setSetupBusy(false);
      }
    })();
  };

  const onNameSubmit = (name: string) => {
    const clean = name.slice(0, 12);
    setPlayerName(clean);
    setShowName(false);
    setPhase('home');
    setWelcomeName(clean);
    speakNarrator(`Welcome, ${clean}. The Spire awaits.`, 2400);
    window.setTimeout(() => setWelcomeName(null), 2800);
    window.setTimeout(() => setShowFundPrompt(true), 900);
    void wallet.ensure().catch(() => {});
  };

  const onGuest = () => {
    unlockAudio();
    sndUI();
    setShowWorldSelect(true);
    setShowAchv(false);
  };

  const onPlayLevel = (level: CampaignLevel) => {
    unlockAudio();
    sndUI();
    setShowWorldSelect(false);
    startCampaignLevel(level);
  };

  const enterSpireDirect = async () => {
    unlockAudio();
    sndUI();
    setSpireError(null);
    setSpireBusy(true);
    try {
      if (!wallet.authenticated) {
        setSpireError('Log in first');
        return;
      }
      if (!wallet.address) await wallet.ensure();
      const res = await wallet.startRunOnChain();
      activeRunRef.current = { runId: res.runId, seed: res.seed };
      startRun({ guest: false, daily: false, startTier: 0 });
      speakNarrator('The Spire awaits.', 1600);
    } catch (e) {
      const msg = (e as Error).message || 'Could not start run';
      if (/fund|balance|insufficient|top up|not ready on-chain/i.test(msg)) {
        setSpireError('Insufficient balance — please top up');
        setShowFundPrompt(true);
        speakNarrator('Copy your address to fund it.', 2400);
      } else if (/login|auth/i.test(msg)) {
        setSpireError('Not logged in');
      } else {
        setSpireError(msg);
      }
    } finally {
      setSpireBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      await wallet.logout?.();
    } catch {
      /* ignore */
    }
    setShowName(false);
    setShowFundPrompt(false);
    setPhase('login');
    speakNarrator('Logged out.', 1400);
  };

  // Home only when authenticated and not mid-setup
  const hasAccount = wallet.authenticated && !setupBusy;
  const showLogin = phase === 'login' && !showName && !setupBusy;
  const showHome =
    hasAccount &&
    phase === 'home' &&
    !showAchv &&
    !showWorldSelect &&
    !showSigils;
  const showAchievements = hasAccount && phase === 'home' && showAchv;
  const showWorlds = hasAccount && phase === 'home' && showWorldSelect;
  const showGame =
    hasAccount &&
    (phase === 'playing' ||
      phase === 'paused' ||
      phase === 'gameover' ||
      phase === 'depthclear');

  return (
    <>
      <Splash hidden={splashGone} />

      {setupBusy && (
        <div className="setup-overlay" role="status" aria-live="polite">
          <div className="setup-card">
            <Mascot mood="idle" size={88} speech="Setting up your account…" />
            <p className="setup-text">Restoring your progress</p>
          </div>
        </div>
      )}

      <LoginPage show={showLogin} onContinue={afterAuth} />
      <NamePage
        show={showName && wallet.authenticated && !setupBusy}
        initial={meta.playerName}
        onSubmit={onNameSubmit}
      />
      <HomePage
        show={showHome}
        playerName={meta.playerName}
        rank={rank}
        mainHighScore={meta.mainHighScore}
        dailyBest={meta.dailyBest}
        guestHighScore={Object.values(meta.guestLevelBest).reduce(
          (a, b) => Math.max(a, b),
          0,
        )}
        shards={meta.shards}
        achievementCount={meta.achievements.size}
        sigilCount={meta.ownedSigils.size}
        sigilLimit={SPIRE_SIGIL_LIMIT}
        walletShort={wallet.short}
        walletBalance={wallet.balanceHint}
        onCopyWallet={() => {
          if (wallet.address) void navigator.clipboard?.writeText(wallet.address);
        }}
        onRefreshBalance={() => {
          void wallet.refreshBalance?.();
        }}
        walletAddress={wallet.address}
        onLogout={() => void doLogout()}
        leaderboard={remoteLb}
        onEnterSpire={() => { sndUI(); setShowSpirePerks(true); }}
        spireBusy={spireBusy}
        spireError={spireError}
        onGuest={onGuest}
        onAchievements={() => {
          sndUI();
          setShowSigils(false);
          setShowAchv(true);
        }}
        onSigils={() => {
          sndUI();
          setShowAchv(false);
          setShowSigils(true);
        }}
        onOpenSettings={() => {
          sndUI();
          setShowSettings(true);
        }}
        onOpenProfile={() => {
          sndUI();
          setShowPlayerCard(true);
        }}
      />
      <WorldSelectPage
        show={showWorlds}
        onBack={() => setShowWorldSelect(false)}
        onPlayLevel={onPlayLevel}
        guestLevelBest={meta.guestLevelBest}
        guestClearedLevels={meta.guestClearedLevels}
      />
      <AchievementsPage
        show={showAchievements}
        owned={meta.achievements}
        redeemed={meta.redeemedAchievements}
        onBack={() => setShowAchv(false)}
        onRedeem={(id) => engine.redeemAchievement(id)}
      />
      <SigilsPage
        show={hasAccount && phase === 'home' && showSigils}
        owned={meta.ownedSigils}
        isGuest={meta.isGuest}
        onBack={() => setShowSigils(false)}
      />
      <GamePage engine={engine} show={showGame} />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        playerName={meta.playerName}
        onSaveName={(name) => {
          setPlayerName(name);
          speakNarrator(`You're ${name} now.`, 1400);
        }}
      />

      <PlayerCard
        open={showPlayerCard}
        onClose={() => setShowPlayerCard(false)}
        playerName={meta.playerName}
        rankName={rank.name}
        rankColor={rank.color}
        rankIcon={rank.iconSrc}
        mainBest={meta.mainHighScore}
        guestBest={Math.max(
          meta.highScore,
          ...Object.values(meta.guestLevelBest || { 0: 0 }),
        )}
        dailyBest={meta.dailyBest}
        shards={meta.shards}
        sigilCount={meta.ownedSigils?.size ?? 0}
        sigilLimit={meta.isGuest ? 2 : 6}
        achievementCount={meta.achievements?.size ?? 0}
      />

      <SpirePerksModal
        open={showSpirePerks}
        onClose={() => setShowSpirePerks(false)}
        canProceed={false}
        onProceed={() => {
          setShowSpirePerks(false);
          void enterSpireDirect();
        }}
      />

      <FundPromptModal
        open={showFundPrompt && hasAccount}
        address={wallet.address}
        balanceHint={wallet.balanceHint}
        busy={wallet.busy}
        onPrepareWallet={() => {
          void wallet.ensure().catch(() => {});
        }}
        onRefreshBalance={() => {
          void wallet.refreshBalance?.();
        }}
        onSkip={() => setShowFundPrompt(false)}
      />

      {welcomeName && (
        <div className="welcome-mascot-overlay" aria-live="polite">
          <Mascot mood="cheer" size={120} speech={`Welcome, ${welcomeName}!`} />
        </div>
      )}

      {showHome && phase === 'home' && (
        <nav className="bottom-nav game-bottom-nav" id="bottomNav">
          <div className="bottom-nav-inner">
            <button className="nav-btn active" type="button">
              <span className="nav-ic">🎮</span>Home
            </button>
            <button className="nav-btn" type="button" onClick={onGuest}>
              <span className="nav-ic">🧭</span>Practice
            </button>
            <button
              className="nav-btn"
              type="button"
              onClick={() => {
                sndUI();
                setShowAchv(true);
              }}
            >
              <span className="nav-ic">🏅</span>Achv
            </button>
          </div>
        </nav>
      )}

      <div className="narrator" style={{ opacity: narratorOn ? 1 : 0 }}>
        <span>{narratorText}</span>
      </div>
    </>
  );
}

export default function App() {
  return (
    <>
      {isPrivyConfigured() ? <AppWithWallet /> : <AppWithoutWallet />}
      <Analytics />
    </>
  );
}
