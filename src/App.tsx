import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  Activity,
  Bomb,
  CircleDot,
  Coins,
  Crown,
  Dices,
  Flame,
  Plus,
  RotateCcw,
  Spade,
  Sparkles,
  Terminal,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  computeDirectorModifiers,
  createInitialDirectorState,
  recordRoundOutcome,
  type DirectorMode,
  type DirectorState,
} from './engine/mlDirector';
import {
  advanceRoguelikeRound,
  computeRelicBonuses,
  createInitialRoguelikeState,
  VIP_FLOORS,
  type RoguelikeState,
} from './engine/roguelikeLoop';
import { audioEngine } from './engine/audioEngine';
import type { GameId, WinCelebration } from './types/casino';
import { TitleBuyInScreen } from './components/TitleBuyInScreen';
import { ParticleOverlay } from './components/ParticleOverlay';
import { AnalyticsLab } from './components/AnalyticsLab';
import { VipRelicsPanel } from './components/VipRelicsPanel';
import { OfflineLauncherModal } from './components/OfflineLauncherModal';
import { ThunderfallSlots } from './games/ThunderfallSlots';
import { GravityPlinko } from './games/GravityPlinko';
import { VelocityCrash } from './games/VelocityCrash';
import { MonteCarloRoulette } from './games/MonteCarloRoulette';
import { VaultMines } from './games/VaultMines';
import { BlackjackTable } from './games/BlackjackTable';
import { HyperDice } from './games/HyperDice';
import { RoyalWheel } from './games/RoyalWheel';

const STORAGE_KEY = 'velvet_vault_offline_v1';

interface SavedSession {
  balance: number;
  director: DirectorState;
  roguelike: RoguelikeState;
}

function loadSavedSession(): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (typeof parsed.balance === 'number' && parsed.director && parsed.roguelike) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

const NAV_ITEMS: Array<{
  id: GameId;
  label: string;
  section: 'games' | 'systems';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'slots', label: 'Thunderfall Slots', section: 'games', icon: Sparkles },
  { id: 'plinko', label: 'Gravity Plinko', section: 'games', icon: Flame },
  { id: 'crash', label: 'Velocity Crash', section: 'games', icon: TrendingUp },
  { id: 'roulette', label: 'Roulette', section: 'games', icon: CircleDot },
  { id: 'mines', label: 'Vault Mines', section: 'games', icon: Bomb },
  { id: 'blackjack', label: 'Blackjack 21', section: 'games', icon: Spade },
  { id: 'dice', label: 'Hyper Dice', section: 'games', icon: Dices },
  { id: 'wheel', label: 'Royal Wheel', section: 'games', icon: Coins },
  { id: 'analytics', label: 'ML & Math Lab', section: 'systems', icon: Activity },
  { id: 'vault', label: 'VIP Floor & Relics', section: 'systems', icon: Crown },
];

export default function App() {
  const initialSaved = useMemo(() => loadSavedSession(), []);
  const autoStart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [appPhase, setAppPhase] = useState<'title' | 'playing'>(autoStart ? 'playing' : 'title');
  const [activeGame, setActiveGame] = useState<GameId>('slots');
  const [balance, setBalance] = useState<number>(initialSaved?.balance ?? 1000);
  const [displayBalance, setDisplayBalance] = useState<number>(initialSaved?.balance ?? 1000);
  const [directorState, setDirectorState] = useState<DirectorState>(
    () => initialSaved?.director ?? createInitialDirectorState(1000, 'adaptive_ml')
  );
  const [roguelike, setRoguelike] = useState<RoguelikeState>(
    () => initialSaved?.roguelike ?? createInitialRoguelikeState(1000)
  );

  const [muted, setMuted] = useState(false);
  const [shakeLevel, setShakeLevel] = useState<'none' | 'light' | 'heavy'>('none');
  const [burstSignal, setBurstSignal] = useState<{ id: number; intensity: 'light' | 'heavy' } | null>(null);
  const [celebration, setCelebration] = useState<WinCelebration | null>(null);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [rebuyModalOpen, setRebuyModalOpen] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState('1000');
  const [floorNotice, setFloorNotice] = useState<string | null>(null);

  const balanceRef = useRef(balance);
  const displayBalRef = useRef({ val: balance });

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Mirror state machine to document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = appPhase;
  }, [appPhase]);

  // Smooth GSAP rolling counter for bankroll display
  useEffect(() => {
    const tween = gsap.to(displayBalRef.current, {
      val: balance,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => setDisplayBalance(displayBalRef.current.val),
      onComplete: () => setDisplayBalance(balance),
    });
    return () => {
      tween.kill();
    };
  }, [balance]);

  // Persist offline state to localStorage
  useEffect(() => {
    if (appPhase !== 'playing') return;
    try {
      const payload: SavedSession = {
        balance,
        director: directorState,
        roguelike,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [appPhase, balance, directorState, roguelike]);

  const relicBonuses = useMemo(
    () => computeRelicBonuses(roguelike.unlockedRelics),
    [roguelike.unlockedRelics]
  );

  const { modifiers } = useMemo(
    () => computeDirectorModifiers(directorState, balance, Math.max(10, balance * 0.03), relicBonuses),
    [directorState, balance, relicBonuses]
  );

  const triggerShake = useCallback((intensity: 'light' | 'heavy') => {
    setShakeLevel(intensity);
    window.setTimeout(() => setShakeLevel('none'), intensity === 'heavy' ? 360 : 200);
  }, []);

  const triggerBurst = useCallback(
    (intensity: 'light' | 'heavy') => {
      setBurstSignal({ id: Date.now() + Math.random(), intensity });
      triggerShake(intensity);
    },
    [triggerShake]
  );

  const handleStartSession = useCallback(
    (buyIn: number, mode: DirectorMode, resumeSaved: boolean) => {
      audioEngine.playChipPlace();
      if (resumeSaved && initialSaved) {
        setBalance(initialSaved.balance);
        setDisplayBalance(initialSaved.balance);
        displayBalRef.current.val = initialSaved.balance;
        setDirectorState({ ...initialSaved.director, mode });
        setRoguelike(initialSaved.roguelike);
      } else {
        setBalance(buyIn);
        setDisplayBalance(buyIn);
        displayBalRef.current.val = buyIn;
        setDirectorState(createInitialDirectorState(buyIn, mode));
        setRoguelike(createInitialRoguelikeState(buyIn));
      }
      document.body.dataset.state = 'playing';
      setAppPhase('playing');
    },
    [initialSaved]
  );

  const handleWager = useCallback((amount: number): boolean => {
    const clean = Number(amount.toFixed(2));
    if (clean <= 0 || balanceRef.current < clean) return false;
    const next = Number((balanceRef.current - clean).toFixed(2));
    balanceRef.current = next;
    setBalance(next);
    return true;
  }, []);

  const handleSettleRound = useCallback(
    (params: {
      gameId: string;
      bet: number;
      payout: number;
      wasNearMiss?: boolean;
      celebrateTier?: 'BIG' | 'SUPER' | 'MEGA';
      celebrateLabel?: string;
    }) => {
      const cashback =
        params.payout === 0 && params.bet > 0 && relicBonuses.cashbackRate > 0
          ? Number((params.bet * relicBonuses.cashbackRate).toFixed(2))
          : 0;

      const totalCredit = Number((params.payout + cashback).toFixed(2));
      const balanceBefore = Number((balanceRef.current + params.bet).toFixed(2));
      const nextBalance = Number((balanceRef.current + totalCredit).toFixed(2));
      balanceRef.current = nextBalance;
      setBalance(nextBalance);

      // Update ML Director online
      setDirectorState((prev) =>
        recordRoundOutcome(prev, {
          gameId: params.gameId,
          bet: params.bet,
          payout: totalCredit,
          balanceBefore,
          balanceAfter: nextBalance,
          armUsed: modifiers.activeArm,
          wasNearMiss: params.wasNearMiss,
        })
      );

      // Advance Roguelike VIP Floor Loop
      setRoguelike((prev) => {
        const { nextState, bonusAwarded } = advanceRoguelikeRound(prev, nextBalance);
        if (bonusAwarded > 0) {
          const withBonus = Number((balanceRef.current + bonusAwarded).toFixed(2));
          balanceRef.current = withBonus;
          setBalance(withBonus);
          triggerBurst('heavy');
          audioEngine.playWinFanfare('SUPER');
        }
        if (nextState.lastFloorEvent) {
          setFloorNotice(nextState.lastFloorEvent.message);
          window.setTimeout(() => setFloorNotice(null), 5000);
        }
        return nextState;
      });

      if (params.celebrateTier && params.payout > 0 && params.bet > 0) {
        audioEngine.playWinFanfare(params.celebrateTier);
        setCelebration({
          id: Date.now(),
          amount: params.payout,
          multiplier: params.payout / params.bet,
          tier: params.celebrateTier,
          label: params.celebrateLabel ?? 'VELVET VAULT PAYOUT',
        });
      }
    },
    [modifiers.activeArm, relicBonuses.cashbackRate, triggerBurst]
  );

  const handleBuyRelic = useCallback((relicId: string, cost: number) => {
    if (balanceRef.current < cost) return;
    const next = Number((balanceRef.current - cost).toFixed(2));
    balanceRef.current = next;
    setBalance(next);
    setRoguelike((prev) =>
      prev.unlockedRelics.includes(relicId)
        ? prev
        : { ...prev, unlockedRelics: [...prev.unlockedRelics, relicId] }
    );
  }, []);

  const handleTopUp = () => {
    const amt = Math.max(10, Math.min(500000, Number(rebuyAmount) || 1000));
    const next = Number((balanceRef.current + amt).toFixed(2));
    balanceRef.current = next;
    setBalance(next);
    setRebuyModalOpen(false);
    audioEngine.playChipPlace();
  };

  const handleExportSave = () => {
    const blob = new Blob(
      [JSON.stringify({ balance, director: directorState, roguelike }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'velvet-vault-offline-save.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (appPhase === 'title') {
    return (
      <TitleBuyInScreen
        savedBalance={initialSaved ? initialSaved.balance : null}
        onStartSession={handleStartSession}
      />
    );
  }

  const currentFloor = VIP_FLOORS[Math.min(roguelike.floorIndex, VIP_FLOORS.length - 1)];
  const floorPct = Math.min(100, Math.round((balance / Math.max(1, roguelike.targetBalance)) * 100));

  const commonProps = {
    balance,
    modifiers,
    directorState,
    relicBonuses,
    onWager: handleWager,
    onSettleRound: handleSettleRound,
    onTriggerBurst: triggerBurst,
  };

  return (
    <div
      className={`min-h-screen bg-[#090C10] text-[#F3F4F6] ${
        shakeLevel === 'heavy' ? 'shake-heavy' : shakeLevel === 'light' ? 'shake-light' : ''
      }`}
    >
      <ParticleOverlay
        burstSignal={burstSignal}
        celebration={celebration}
        onDismissCelebration={() => setCelebration(null)}
      />

      {/* Compact Casino Floor HUD Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#0D1117]/95 px-3 py-2 sm:px-6 sm:py-2.5">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 sm:gap-4">
          {/* Brand Return Button */}
          <button
            type="button"
            onClick={() => setAppPhase('title')}
            className="flex items-center gap-2 text-left whitespace-nowrap shrink-0"
          >
            <svg width="26" height="26" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="shrink-0">
              <circle cx="32" cy="32" r="28" stroke="#D4AF37" strokeWidth="3" fill="#0E131A" />
              <path
                d="M20 22L32 45L44 22"
                stroke="#ECCB63"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-display text-lg font-bold tracking-wide text-[#F9E7A8] sm:text-xl">
              Velvet Vault
            </span>
          </button>

          {/* Center VIP Floor & Director Compact Status (Desktop) */}
          <div className="hidden items-center gap-6 text-xs lg:flex">
            <button
              type="button"
              onClick={() => setActiveGame('vault')}
              className="flex items-center gap-3 text-left hover:text-white"
            >
              <Crown className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
              <div>
                <div className="font-semibold text-slate-200">
                  Floor {currentFloor.floor}: {currentFloor.roomName}
                </div>
                <div className="font-mono-num text-[11px] text-slate-400">
                  Quota ${roguelike.targetBalance.toLocaleString()} ({floorPct}%) · Round{' '}
                  {roguelike.roundsInFloor}/{currentFloor.roundsLimit}
                </div>
              </div>
            </button>

            <span className="h-6 w-px bg-slate-800" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setActiveGame('analytics')}
              className="flex items-center gap-3 text-left hover:text-white"
            >
              <Activity className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <div>
                <div className="font-semibold text-slate-200">
                  ML Director · {directorState.mode === 'off' ? 'Strict RNG' : modifiers.activeArm.replace('_', ' ')}
                </div>
                <div className="font-mono-num text-[11px] text-slate-400">
                  Dopamine {directorState.dopamineIndex}/100 · {directorState.markovState}
                </div>
              </div>
            </button>
          </div>

          {/* Right Bankroll & Utility Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#121821] px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
              <span className="hidden text-[11px] text-slate-400 sm:inline">Bankroll</span>
              <span
                data-testid="bankroll-value"
                className="font-mono-num text-xs font-bold text-[#F9E7A8] sm:text-base"
              >
                ${displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button
                type="button"
                aria-label="Add chips to bankroll"
                onClick={() => setRebuyModalOpen(true)}
                className="ml-0.5 flex h-5 w-5 items-center justify-center rounded bg-[#D4AF37] text-[#090C10] hover:bg-[#ECCB63] sm:ml-1 sm:h-6 sm:w-6"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                audioEngine.setMuted(next);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#121821] text-slate-300 hover:border-slate-600 hover:text-white sm:h-9 sm:w-9"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              aria-label="Offline PowerShell, Terminal, and Termux launchers"
              onClick={() => setOfflineModalOpen(true)}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-[#121821] px-2 text-xs font-medium text-slate-200 hover:border-[#D4AF37]/60 sm:h-9 sm:px-3 whitespace-nowrap"
            >
              <Terminal className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" />
              <span className="hidden sm:inline">CLI / Termux</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Horizontal Game Strip (Termux / Android Friendly) */}
      <nav
        aria-label="Casino games mobile navigation"
        className="flex gap-1.5 overflow-x-auto border-b border-slate-800/80 bg-[#0B0F14] px-4 py-2 lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = activeGame === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                audioEngine.playClick();
                setActiveGame(item.id);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selected
                  ? 'bg-[#D4AF37] text-[#090C10] font-bold'
                  : 'bg-[#121821] text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Floor Event Notification Banner */}
      {floorNotice && (
        <div className="mx-auto mt-3 max-w-[1440px] px-4 sm:px-6">
          <div className="flex items-center justify-between rounded-lg border border-[#D4AF37]/60 bg-[#1E1A0E] px-4 py-2.5 text-xs font-medium text-[#F9E7A8]">
            <span>{floorNotice}</span>
            <button type="button" onClick={() => setFloorNotice(null)} className="text-slate-300 hover:text-white">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Desktop Shell: Sidebar Rail + Active Game Stage */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[232px_1fr]">
        {/* Desktop Sidebar */}
        <aside className="hidden flex-col gap-5 lg:flex">
          <nav aria-label="Casino floor games" className="rounded-xl border border-slate-800/90 bg-[#11161D] p-3">
            <div className="px-2.5 pb-2 text-[11px] font-semibold tracking-wider text-slate-400">
              CASINO FLOOR (8 GAMES)
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.filter((i) => i.section === 'games').map((item) => {
                const Icon = item.icon;
                const selected = activeGame === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playClick();
                      setActiveGame(item.id);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-[#D4AF37] text-[#090C10] font-bold shadow-sm'
                        : 'text-slate-300 hover:bg-[#171E28] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 border-t border-slate-800 px-2.5 pb-2 pt-3 text-[11px] font-semibold tracking-wider text-slate-400">
              ENGINE &amp; PROGRESSION
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.filter((i) => i.section === 'systems').map((item) => {
                const Icon = item.icon;
                const selected = activeGame === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playClick();
                      setActiveGame(item.id);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-[#D4AF37] text-[#090C10] font-bold shadow-sm'
                        : 'text-slate-300 hover:bg-[#171E28] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Compact Live Session Digest */}
          <div className="rounded-xl border border-slate-800/80 bg-[#11161D] p-4 text-xs">
            <div className="font-semibold text-slate-200">Session Telemetry</div>
            <div className="mt-3 space-y-2 font-mono-num">
              <div className="flex justify-between">
                <span className="text-slate-400">Rounds</span>
                <span className="text-slate-100">{directorState.roundsPlayed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Win Streak</span>
                <span className="text-emerald-400">{directorState.winStreak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pity Meter</span>
                <span className={modifiers.pityActive ? 'text-[#ECCB63] font-bold' : 'text-slate-200'}>
                  {directorState.dryStreak}/{directorState.pityThreshold}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dopamine</span>
                <span className="text-[#ECCB63]">{directorState.dopamineIndex}/100</span>
              </div>
            </div>

            {balance < 10 && (
              <button
                type="button"
                onClick={() => setRebuyModalOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#D4AF37]/60 bg-[#D4AF37]/15 py-2 text-xs font-bold text-[#F9E7A8] hover:bg-[#D4AF37]/25"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Instant Rebuy</span>
              </button>
            )}
          </div>
        </aside>

        {/* Active Game Stage */}
        <main className="min-w-0">
          {activeGame === 'slots' && <ThunderfallSlots {...commonProps} />}
          {activeGame === 'plinko' && <GravityPlinko {...commonProps} />}
          {activeGame === 'crash' && <VelocityCrash {...commonProps} />}
          {activeGame === 'roulette' && <MonteCarloRoulette {...commonProps} />}
          {activeGame === 'mines' && <VaultMines {...commonProps} />}
          {activeGame === 'blackjack' && <BlackjackTable {...commonProps} />}
          {activeGame === 'dice' && <HyperDice {...commonProps} />}
          {activeGame === 'wheel' && <RoyalWheel {...commonProps} />}
          {activeGame === 'analytics' && (
            <AnalyticsLab
              balance={balance}
              directorState={directorState}
              modifiers={modifiers}
              onUpdateDirectorConfig={(patch) =>
                setDirectorState((prev) => ({ ...prev, ...patch }))
              }
            />
          )}
          {activeGame === 'vault' && (
            <VipRelicsPanel
              balance={balance}
              roguelike={roguelike}
              onBuyRelic={handleBuyRelic}
            />
          )}
        </main>
      </div>

      {/* Offline Launchers Modal */}
      <OfflineLauncherModal
        open={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        onExportSave={handleExportSave}
      />

      {/* Quick Top-Up / Rebuy Modal */}
      {rebuyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add virtual chips"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-[#11161D] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Add Virtual Chips</h2>
            <p className="mt-1 text-xs text-slate-400">
              100% offline play money — adjust your bankroll anytime.
            </p>
            <div className="mt-4">
              <label htmlFor="topup-amount" className="text-xs text-slate-300">
                Top-Up Amount ($)
              </label>
              <input
                id="topup-amount"
                type="number"
                min={10}
                max={500000}
                step={100}
                value={rebuyAmount}
                onChange={(e) => setRebuyAmount(e.target.value)}
                className="font-mono-num mt-1.5 w-full rounded-lg border border-slate-700 bg-[#090C10] px-3 py-2.5 text-lg font-bold text-white outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[500, 1000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setRebuyAmount(String(amt))}
                  className="font-mono-num rounded-lg border border-slate-800 bg-[#0D1218] py-1.5 text-xs font-semibold text-slate-200 hover:border-[#D4AF37]"
                >
                  +${amt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRebuyModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTopUp}
                className="rounded-lg bg-[#D4AF37] px-5 py-2 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63]"
              >
                Add Chips
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
