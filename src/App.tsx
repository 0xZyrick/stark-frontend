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
import { SettingsModal } from './components/SettingsModal';
import { PlayerCard } from './components/PlayerCard';
import { SpirePerksModal } from './components/SpirePerksModal';
import { SpireEntry } from './pages/SpireEntry';
import { SpireHub } from './pages/SpireHub';
import { SaveProgressModal } from './components/SaveProgressModal';
import {
  TRIAL_ACCOUNT_ID,
  isTrialLevel,
  mergeTrialIntoAccount,
} from './lib/trialSession';
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
      accountId={authenticated && userId ? userId : TRIAL_ACCOUNT_ID}
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
  return <AppShell accountId={TRIAL_ACCOUNT_ID} wallet={wallet} />;
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
    startSpireFloor,
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
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerCard, setShowPlayerCard] = useState(false);
  const [showSpirePerks, setShowSpirePerks] = useState(false);
  const [showSpireEntry, setShowSpireEntry] = useState(false);
  const [showSpireHub, setShowSpireHub] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [trialHome, setTrialHome] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
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
      setTrialHome(true);
      // Home-first: no login wall
      if (phase === 'splash' || phase === 'login') setPhase('home');
      return;
    }

    // Authenticated — restore account
    setSetupBusy(true);
    setTrialHome(false);
    const uid = wallet.userId || accountId;
    const savedName = readPlayerName(uid);

    void (async () => {
      try {
        // Optional wallet probe only — never block home
        if (savedName) {
          setPlayerName(savedName);
          setShowName(false);
          setShowWorldSelect(false);
          setShowAchv(false);
          setShowSigils(false);
          setShowLoginModal(false);
          setPhase('home');
        } else {
          setShowName(true);
          setPhase('home');
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
          depth: Math.max(1, tier),
          bestTile: engine.board.bestTile || 2,
          movesHash: '0x0',
          checksum: '0x0',
          seed: run.seed,
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

  // Trial: after clearing outer-2, prompt to save
  useEffect(() => {
    if (wallet.authenticated) return;
    if (phase !== 'depthclear' && phase !== 'gameover' && phase !== 'home') return;
    if (meta.guestClearedLevels?.includes('outer-2')) {
      setShowSavePrompt(true);
    }
  }, [phase, meta.guestClearedLevels, wallet.authenticated]);

  const afterAuth = (hint?: string) => {
    unlockAudio();
    sndUI();
    setSetupBusy(true);
    setShowSavePrompt(false);
    setShowLoginModal(false);
    const uid = wallet.userId || accountId;
    if (uid && uid !== TRIAL_ACCOUNT_ID) {
      mergeTrialIntoAccount(uid);
    }
    const progress = loadProgress(uid);
    const saved = progress?.playerName || null;
    void (async () => {
      try {
        await wallet.ensure().catch(() => null);
        if (saved && saved.toLowerCase() !== 'player') {
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
    speakNarrator(`Welcome, ${clean}.`, 2000);
    window.setTimeout(() => setWelcomeName(null), 2800);
  };

  const onGuest = () => {
    unlockAudio();
    sndUI();
    if (!wallet.authenticated) setTrialHome(true);
    setPhase('home');
    setShowWorldSelect(true);
    setShowAchv(false);
  };

  const onPlayLevel = (level: CampaignLevel) => {
    unlockAudio();
    sndUI();
    if (!wallet.authenticated && !isTrialLevel(level.id)) {
      setShowWorldSelect(false);
      setShowSavePrompt(true);
      return;
    }
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
      // Connect Argent/Braavos (opens extension if needed)
      try {
        await wallet.ensure();
      } catch (connErr) {
        setSpireError((connErr as Error).message || 'Connect Argent X or Braavos');
        return;
      }
      if (!wallet.address) {
        setSpireError('Wallet required — connect Argent X or Braavos');
        return;
      }
      const res = await wallet.startRunOnChain();
      activeRunRef.current = { runId: res.runId, seed: res.seed };
      setShowSpirePerks(false);
      setShowSpireEntry(true);
      speakNarrator('The Spire awaits.', 1600);
    } catch (e) {
      const msg = (e as Error).message || 'Could not start run';
      if (/fund|balance|insufficient|top up|not ready on-chain/i.test(msg)) {
        setSpireError('Insufficient balance — please top up');
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
    setTrialHome(true);
    setShowWorldSelect(false);
    setShowSavePrompt(false);
    setShowLoginModal(false);
    setShowName(false);
    setPhase('home');
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

      <LoginPage
        show={showLoginModal}
        asModal
        onContinue={afterAuth}
        onClose={() => setShowLoginModal(false)}
      />
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
        onEnterSpire={() => {
          sndUI();
          if (!wallet.authenticated) {
            setShowLoginModal(true);
            return;
          }
          setShowSpirePerks(true);
        }}
        onLogin={() => {
          sndUI();
          setShowLoginModal(true);
        }}
        isLoggedIn={wallet.authenticated}
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
          if (!wallet.authenticated) {
            setShowLoginModal(true);
            return;
          }
          setShowPlayerCard(true);
        }}
      />
      <WorldSelectPage
        show={showWorlds}
        onBack={() => setShowWorldSelect(false)}
        onPlayLevel={onPlayLevel}
        guestLevelBest={meta.guestLevelBest}
        guestClearedLevels={meta.guestClearedLevels}
        trialMode={isTrial}
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
        onLogout={() => {
          setShowSettings(false);
          void doLogout();
        }}
      />

      <PlayerCard
        open={showPlayerCard && wallet.authenticated}
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
        onClose={() => {
          setShowSpirePerks(false);
          setSpireError(null);
        }}
        canProceed={wallet.authenticated && !spireBusy}
        busy={spireBusy}
        walletReady={Boolean(wallet.address)}
        costLabel="Network gas · Argent/Braavos"
        error={spireError || wallet.error}
        onProceed={() => void enterSpireDirect()}
      />

      {showSpireEntry && (
        <SpireEntry
          onDone={() => {
            setShowSpireEntry(false);
            setShowSpireHub(true);
          }}
        />
      )}

      <SpireHub
        show={showSpireHub}
        cleared={meta.spireClearedFloors || []}
        onBack={() => {
          setShowSpireHub(false);
          setPhase('home');
          // active run settles when a Spire play ends (existing settle effect)
        }}
        onPlayFloor={(floor) => {
          if (!activeRunRef.current) {
            setSpireError('Wallet run not open — enter Spire again');
            setShowSpireHub(false);
            setShowSpirePerks(true);
            return;
          }
          startSpireFloor(floor);
          setShowSpireHub(false);
          setPhase('playing');
          speakNarrator(floor.name, 1200);
        }}
      />

      <SaveProgressModal
        open={showSavePrompt && isTrial}
        onLogin={() => {
          setShowSavePrompt(false);
          setShowLoginModal(true);
        }}
        onLater={() => setShowSavePrompt(false)}
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
