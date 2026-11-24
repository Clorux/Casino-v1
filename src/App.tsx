import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  Activity,
  ArrowUpDown,
  Bomb,
  CircleDollarSign,
  CircleDot,
  Club,
  Coins,
  Crosshair,
  Crown,
  Dices,
  Flame,
  Gem,
  Grid3X3,
  Layers,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  ShieldAlert,
  Spade,
  Sparkles,
  Terminal,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  computeDirectorModifiers,
  createInitialDirectorState,
  recordRoundOutcome,
  type DirectorMode,
  type DirectorState,
} from './engine/mlDirector';
import {
  createInitialBehavioralStore,
  recordBehavioralEvent,
  runComprehensiveAnalysis,
  type BehavioralStore,
} from './engine/behavioralAnalyzer';
import {
  advanceJackpotAndFever,
  createInitialJackpotFeverState,
  type JackpotFeverState,
} from './engine/jackpotEngine';
import {
  advanceRoguelikeRound,
  computeRelicBonuses,
  createInitialRoguelikeState,
  VIP_FLOORS,
  type RoguelikeState,
} from './engine/roguelikeLoop';
import {
  createInitialHouseMindState,
  HOUSE_PERSONALITY_META,
  HOUSE_PHASE_META,
  hydrateHouseMindState,
  recordHouseCashOut,
  recordHouseRitualSignal,
  setHousePersonality,
  updateHouseMindAfterRound,
  type CashOutRecord,
  type HouseMindState,
  type HousePersonality,
  type RitualSignalType,
  type SpinSpeedMultiplier,
} from './engine/houseMind';
import { audioEngine } from './engine/audioEngine';
import type { GameId, WinCelebration, WinFlare, WinTier } from './types/casino';
import { TitleBuyInScreen } from './components/TitleBuyInScreen';
import { ParticleOverlay } from './components/ParticleOverlay';
import { AnalyticsLab } from './components/AnalyticsLab';
import { VipRelicsPanel } from './components/VipRelicsPanel';
import { OfflineLauncherModal } from './components/OfflineLauncherModal';
import { ThunderfallSlots } from './games/ThunderfallSlots';
import { SovereignHoldWin } from './games/SovereignHoldWin';
import { GravityPlinko } from './games/GravityPlinko';
import { VelocityCrash } from './games/VelocityCrash';
import { MonteCarloRoulette } from './games/MonteCarloRoulette';
import { VaultMines } from './games/VaultMines';
import { DragonTower } from './games/DragonTower';
import { VaultLimbo } from './games/VaultLimbo';
import { BlackjackTable } from './games/BlackjackTable';
import { SovereignBaccarat } from './games/SovereignBaccarat';
import { RoyalVideoPoker } from './games/RoyalVideoPoker';
import { HiLoLadder } from './games/HiLoLadder';
import { EmeraldKeno } from './games/EmeraldKeno';
import { HyperDice } from './games/HyperDice';
import { ObsidianCoinFlip } from './games/ObsidianCoinFlip';
import { RoyalWheel } from './games/RoyalWheel';

const STORAGE_KEY = 'velvet_vault_offline_v1';

interface SavedSession {
  balance: number;
  director: DirectorState;
  roguelike: RoguelikeState;
  behavioral?: BehavioralStore;
  jackpotFever?: JackpotFeverState;
  houseMind?: HouseMindState;
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
  { id: 'holdwin', label: 'Vault Hold & Win', section: 'games', icon: Lock },
  { id: 'plinko', label: 'Gravity Plinko', section: 'games', icon: Flame },
  { id: 'crash', label: 'Velocity Crash', section: 'games', icon: TrendingUp },
  { id: 'roulette', label: 'Roulette', section: 'games', icon: CircleDot },
  { id: 'mines', label: 'Vault Mines', section: 'games', icon: Bomb },
  { id: 'tower', label: 'Dragon Tower', section: 'games', icon: Layers },
  { id: 'limbo', label: 'Vault Limbo', section: 'games', icon: Crosshair },
  { id: 'blackjack', label: 'Blackjack 21', section: 'games', icon: Spade },
  { id: 'baccarat', label: 'Sovereign Baccarat', section: 'games', icon: Gem },
  { id: 'poker', label: 'Royal Video Poker', section: 'games', icon: Club },
  { id: 'hilo', label: 'Crimson Hi-Lo', section: 'games', icon: ArrowUpDown },
  { id: 'keno', label: 'Emerald Keno', section: 'games', icon: Grid3X3 },
  { id: 'dice', label: 'Hyper Dice', section: 'games', icon: Dices },
  { id: 'coinflip', label: 'Obsidian Coin Flip', section: 'games', icon: CircleDollarSign },
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
    () => initialSaved?.director ?? createInitialDirectorState(1000, 'realistic_house')
  );
  const [roguelike, setRoguelike] = useState<RoguelikeState>(
    () => initialSaved?.roguelike ?? createInitialRoguelikeState(1000)
  );
  const [behavioralStore, setBehavioralStore] = useState<BehavioralStore>(
    () => initialSaved?.behavioral ?? createInitialBehavioralStore(initialSaved?.balance ?? 1000)
  );
  const [jackpotFever, setJackpotFever] = useState<JackpotFeverState>(
    () => initialSaved?.jackpotFever ?? createInitialJackpotFeverState()
  );
  const [houseMind, setHouseMind] = useState<HouseMindState>(
    () => hydrateHouseMindState(initialSaved?.houseMind, initialSaved?.balance ?? 1000)
  );

  const [muted, setMuted] = useState(false);
  const [shakeLevel, setShakeLevel] = useState<'none' | 'light' | 'heavy'>('none');
  const [burstSignal, setBurstSignal] = useState<{ id: number; intensity: 'light' | 'heavy' } | null>(null);
  const [celebration, setCelebration] = useState<WinCelebration | null>(null);
  const [winFlare, setWinFlare] = useState<WinFlare | null>(null);
  const [bankrollDelta, setBankrollDelta] = useState<{ id: number; delta: number } | null>(null);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [rebuyModalOpen, setRebuyModalOpen] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState('1000');
  const [floorNotice, setFloorNotice] = useState<string | null>(null);
  const [cashOutModal, setCashOutModal] = useState<CashOutRecord | null>(null);

  const balanceRef = useRef(balance);
  const displayBalRef = useRef({ val: balance });
  const flareTimerRef = useRef<number | null>(null);
  const deltaTimerRef = useRef<number | null>(null);
  const floorNoticeTimerRef = useRef<number | null>(null);
  const jackpotFeverRef = useRef(jackpotFever);
  const houseMindRef = useRef(houseMind);
  const directorStateRef = useRef(directorState);
  const behavioralStoreRef = useRef(behavioralStore);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    jackpotFeverRef.current = jackpotFever;
  }, [jackpotFever]);

  useEffect(() => {
    houseMindRef.current = houseMind;
  }, [houseMind]);

  useEffect(() => {
    directorStateRef.current = directorState;
  }, [directorState]);

  useEffect(() => {
    behavioralStoreRef.current = behavioralStore;
  }, [behavioralStore]);

  const showFloorNotice = useCallback((msg: string) => {
    setFloorNotice(msg);
    if (floorNoticeTimerRef.current) window.clearTimeout(floorNoticeTimerRef.current);
    floorNoticeTimerRef.current = window.setTimeout(() => setFloorNotice(null), 5000);
  }, []);

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

  // Persist offline state (including Dual Behavioral AI, Progressive Jackpot & House Mind) to localStorage
  useEffect(() => {
    if (appPhase !== 'playing') return;
    try {
      const payload: SavedSession = {
        balance,
        director: directorState,
        roguelike,
        behavioral: behavioralStore,
        jackpotFever,
        houseMind,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [appPhase, balance, directorState, roguelike, behavioralStore, jackpotFever, houseMind]);

  const relicBonuses = useMemo(
    () => computeRelicBonuses(roguelike.unlockedRelics),
    [roguelike.unlockedRelics]
  );

  // Stable seeded RNG per round so Thompson Sampling doesn't thrash on unrelated UI renders
  const { modifiers } = useMemo(() => {
    let s = ((directorState.roundsPlayed + 1) * 2654435761) >>> 0;
    const roundRng = () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
    return computeDirectorModifiers(
      directorState,
      balance,
      Math.max(10, balance * 0.03),
      relicBonuses,
      roundRng,
      {
        realtime: behavioralStore.realtime,
        comprehensive: behavioralStore.comprehensive,
        currentGameId: activeGame,
      },
      houseMind
    );
  }, [
    directorState,
    balance,
    relicBonuses,
    behavioralStore.realtime,
    behavioralStore.comprehensive,
    activeGame,
    houseMind,
  ]);

  const triggerShake = useCallback((intensity: 'light' | 'heavy') => {
    setShakeLevel(intensity);
    window.setTimeout(() => setShakeLevel('none'), intensity === 'heavy' ? 380 : 210);
  }, []);

  const triggerBurst = useCallback(
    (intensity: 'light' | 'heavy') => {
      setBurstSignal({ id: Date.now() + Math.random(), intensity });
      triggerShake(intensity);
    },
    [triggerShake]
  );

  const handleRitualSignal = useCallback(
    (
      type: RitualSignalType,
      detail: string,
      meta?: {
        turboActive?: boolean;
        autoSpinActive?: boolean;
        spinSpeedMultiplier?: SpinSpeedMultiplier;
      }
    ) => {
      const nextHouse = recordHouseRitualSignal(houseMindRef.current, {
        type,
        gameId: activeGame,
        detail,
        turboActive: meta?.turboActive,
        autoSpinActive: meta?.autoSpinActive,
        spinSpeedMultiplier: meta?.spinSpeedMultiplier,
      });
      houseMindRef.current = nextHouse;
      setHouseMind(nextHouse);
    },
    [activeGame]
  );

  const selectGame = useCallback(
    (nextGame: GameId) => {
      audioEngine.playClick();
      if (nextGame !== activeGame) {
        setActiveGame(nextGame);
        setBehavioralStore((prev) =>
          recordBehavioralEvent(prev, {
            type: 'GAME_SWITCH',
            gameId: nextGame,
            amount: 0,
            balanceBefore: balanceRef.current,
            balanceAfter: balanceRef.current,
            buyInReference: directorStateRef.current.buyIn,
          })
        );
        const nextHouse = recordHouseRitualSignal(houseMindRef.current, {
          type: 'GAME_SWITCH',
          gameId: nextGame,
          detail: `Switched table to ${nextGame}`,
        });
        houseMindRef.current = nextHouse;
        setHouseMind(nextHouse);
      }
    },
    [activeGame]
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
        setBehavioralStore(
          initialSaved.behavioral ?? createInitialBehavioralStore(initialSaved.balance)
        );
        const restoredJp = initialSaved.jackpotFever ?? createInitialJackpotFeverState();
        jackpotFeverRef.current = restoredJp;
        setJackpotFever(restoredJp);
        const restoredHm = hydrateHouseMindState(initialSaved.houseMind, initialSaved.balance);
        houseMindRef.current = restoredHm;
        setHouseMind(restoredHm);
      } else {
        setBalance(buyIn);
        setDisplayBalance(buyIn);
        displayBalRef.current.val = buyIn;
        const freshDir = createInitialDirectorState(buyIn, mode);
        directorStateRef.current = freshDir;
        setDirectorState(freshDir);
        setRoguelike(createInitialRoguelikeState(buyIn));
        const freshBeh = createInitialBehavioralStore(buyIn);
        behavioralStoreRef.current = freshBeh;
        setBehavioralStore(freshBeh);
        const freshJp = createInitialJackpotFeverState();
        jackpotFeverRef.current = freshJp;
        setJackpotFever(freshJp);
        const freshHm = createInitialHouseMindState(buyIn);
        houseMindRef.current = freshHm;
        setHouseMind(freshHm);
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
      celebrateTier?: WinTier;
      celebrateLabel?: string;
      turboActive?: boolean;
      autoSpinActive?: boolean;
      spinSpeedMultiplier?: SpinSpeedMultiplier;
    }) => {
      const cashback =
        params.payout === 0 && params.bet > 0 && relicBonuses.cashbackRate > 0
          ? Number((params.bet * relicBonuses.cashbackRate).toFixed(2))
          : 0;

      // Advance Progressive Sovereign Vault Jackpot & Fever Overdrive using ref to prevent stale concurrent overwrites
      const currentDir = directorStateRef.current;
      const currentBeh = behavioralStoreRef.current;
      const jpResult = advanceJackpotAndFever(jackpotFeverRef.current, {
        bet: params.bet,
        payout: params.payout,
        wasNearMiss: params.wasNearMiss,
        directorMode: currentDir.mode,
        microState: currentBeh.realtime.microState,
        dopamineResponsiveness: currentBeh.comprehensive.dopamineResponsiveness,
      });
      jackpotFeverRef.current = jpResult.nextState;
      setJackpotFever(jpResult.nextState);

      const extraProgressive = jpResult.jackpotHit ? jpResult.jackpotHit.amount : 0;
      const totalCredit = Number(
        (params.payout + cashback + jpResult.feverBonusPayout + extraProgressive).toFixed(2)
      );
      const balanceBefore = Number((balanceRef.current + params.bet).toFixed(2));
      const nextBalance = Number((balanceRef.current + totalCredit).toFixed(2));
      balanceRef.current = nextBalance;
      setBalance(nextBalance);

      const mult =
        params.bet > 0
          ? (params.payout + jpResult.feverBonusPayout) / params.bet
          : params.payout > 0
          ? Math.max(2, params.payout / 25)
          : 0;

      if (jpResult.feverJustTriggered) {
        showFloorNotice('FEVER OVERDRIVE ACTIVATED — +15% Bonus Multiplier on all wins for 5 rounds!');
        triggerBurst('heavy');
        audioEngine.playWinFanfare('SUPER');
      }

      const nowTs = Date.now();
      const reactionMs =
        currentBeh.lastActionAt > 0
          ? Math.max(150, Math.min(45000, nowTs - currentBeh.lastActionAt))
          : undefined;

      // Update ML Director online
      const nextDir = recordRoundOutcome(currentDir, {
        gameId: params.gameId,
        bet: params.bet,
        payout: totalCredit,
        balanceBefore,
        balanceAfter: nextBalance,
        armUsed: modifiers.activeArm,
        wasNearMiss: params.wasNearMiss,
        now: nowTs,
      });
      directorStateRef.current = nextDir;
      setDirectorState(nextDir);

      // Feed Dual-System Behavioral Intelligence (System 1 real-time + System 2 longitudinal)
      const nextBeh = recordBehavioralEvent(currentBeh, {
        type: 'ROUND_PLAYED',
        gameId: params.gameId,
        amount: params.bet,
        payout: totalCredit,
        multiplier: mult,
        balanceBefore,
        balanceAfter: nextBalance,
        wasNearMiss: params.wasNearMiss,
        buyInReference: currentDir.buyIn,
        now: nowTs,
      });
      behavioralStoreRef.current = nextBeh;
      setBehavioralStore(nextBeh);

      const netRoundDelta = Number((totalCredit - params.bet).toFixed(2));
      if (Math.abs(netRoundDelta) >= 0.01) {
        setBankrollDelta({ id: nowTs + Math.random(), delta: netRoundDelta });
        if (deltaTimerRef.current) window.clearTimeout(deltaTimerRef.current);
        deltaTimerRef.current = window.setTimeout(() => setBankrollDelta(null), 1150);
      }

      // Update Classical ML Adversarial House Mind (always learning patterns across ALL 14 games)
      const prevHouse = houseMindRef.current;
      const rollingAvgBet =
        nextDir.roundsPlayed > 0 ? nextDir.totalWagered / nextDir.roundsPlayed : Math.max(10, params.bet);
      const nextHouse = updateHouseMindAfterRound(prevHouse, {
        gameId: params.gameId,
        bet: params.bet,
        payout: totalCredit,
        balanceBefore,
        balanceAfter: nextBalance,
        reactionMs,
        dryStreak: nextDir.dryStreak,
        winStreak: nextDir.winStreak,
        avgBet: rollingAvgBet,
        wasNearMiss: params.wasNearMiss,
        turboActive: params.turboActive,
        autoSpinActive: params.autoSpinActive,
        spinSpeedMultiplier: params.spinSpeedMultiplier,
        now: nowTs,
      });
      houseMindRef.current = nextHouse;
      setHouseMind(nextHouse);

      // Distinct tactical battle audio cues when Realistic House shifts phases or inflicts near-miss sting
      if (currentDir.mode === 'realistic_house') {
        if (nextHouse.phase === 'PREDATOR_HARVEST' && prevHouse.phase !== 'PREDATOR_HARVEST') {
          audioEngine.playPredatorLock();
          showFloorNotice('HOUSE MIND SHIFT: Predator Harvest locked — House is actively squeezing your edge!');
        } else if (nextHouse.phase === 'LIFELINE_TEASE' && prevHouse.phase !== 'LIFELINE_TEASE') {
          audioEngine.playLifelinePulse();
        } else if (params.wasNearMiss && params.payout === 0) {
          audioEngine.playNearMissSting();
        }
      }

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
          showFloorNotice(nextState.lastFloorEvent.message);
        }
        return nextState;
      });

      if (jpResult.jackpotHit) {
        const jpTier: WinTier =
          jpResult.jackpotHit.tier === 'GRAND'
            ? 'JACKPOT'
            : jpResult.jackpotHit.tier === 'MAJOR'
            ? 'MEGA'
            : 'SUPER';
        audioEngine.playWinFanfare(jpTier);
        triggerShake('heavy');
        setCelebration({
          id: Date.now(),
          amount: jpResult.jackpotHit.amount,
          multiplier: params.bet > 0 ? jpResult.jackpotHit.amount / params.bet : 100,
          tier: jpTier,
          label: jpResult.jackpotHit.label,
        });
      } else if (params.celebrateTier && params.payout > 0) {
        // Fixed Bug #4: Also triggers celebratory overlays on Free Spins where params.bet === 0!
        audioEngine.playWinFanfare(params.celebrateTier);
        triggerShake(params.celebrateTier === 'JACKPOT' || params.celebrateTier === 'MEGA' ? 'heavy' : 'light');
        setCelebration({
          id: Date.now(),
          amount: Number((params.payout + jpResult.feverBonusPayout).toFixed(2)),
          multiplier: mult,
          tier: params.celebrateTier,
          label: params.celebrateLabel ?? 'VELVET VAULT PAYOUT',
        });
      } else if (params.payout > params.bet && params.payout > 0) {
        // Dramatic floating win flare for normal wins
        const flareId = Date.now() + Math.random();
        setWinFlare({
          id: flareId,
          amount: Number((params.payout + jpResult.feverBonusPayout).toFixed(2)),
          multiplier: mult,
        });
        if (flareTimerRef.current) window.clearTimeout(flareTimerRef.current);
        flareTimerRef.current = window.setTimeout(() => setWinFlare(null), 1450);
      }
    },
    [modifiers.activeArm, relicBonuses.cashbackRate, showFloorNotice, triggerBurst, triggerShake]
  );

  const handleBuyRelic = useCallback(
    (relicId: string, cost: number) => {
      if (balanceRef.current < cost) return;
      const before = balanceRef.current;
      const next = Number((before - cost).toFixed(2));
      balanceRef.current = next;
      setBalance(next);
      setRoguelike((prev) =>
        prev.unlockedRelics.includes(relicId)
          ? prev
          : { ...prev, unlockedRelics: [...prev.unlockedRelics, relicId] }
      );
      setBehavioralStore((prev) =>
        recordBehavioralEvent(prev, {
          type: 'RELIC_PURCHASED',
          gameId: 'vault',
          amount: cost,
          balanceBefore: before,
          balanceAfter: next,
          buyInReference: directorState.buyIn,
        })
      );
    },
    [directorState.buyIn]
  );

  const handleTopUp = () => {
    const amt = Math.max(10, Math.min(500000, Number(rebuyAmount) || 1000));
    const before = balanceRef.current;
    const next = Number((before + amt).toFixed(2));
    balanceRef.current = next;
    setBalance(next);
    setRebuyModalOpen(false);
    audioEngine.playChipPlace();

    // Record credit addition -> immediately triggers System 1 Reload Hook, System 2 & House Mind Reload Trap
    setBehavioralStore((prev) =>
      recordBehavioralEvent(prev, {
        type: 'CREDIT_ADDED',
        gameId: activeGame,
        amount: amt,
        balanceBefore: before,
        balanceAfter: next,
        buyInReference: directorStateRef.current.buyIn,
        forceComprehensive: true,
      })
    );
    const nextHouse = recordHouseRitualSignal(houseMindRef.current, {
      type: 'CREDIT_RELOAD',
      gameId: activeGame,
      detail: `Added +$${amt.toFixed(0)} credits`,
      creditAmount: amt,
    });
    houseMindRef.current = nextHouse;
    setHouseMind(nextHouse);
  };

  const handleCashOutBattle = useCallback(() => {
    const { nextState, record } = recordHouseCashOut(houseMindRef.current, balanceRef.current);
    houseMindRef.current = nextState;
    setHouseMind(nextState);
    setCashOutModal(record);
    audioEngine.playCashOutVault();
    if (record.outcome === 'PLAYER_ESCAPED_PROFIT') {
      triggerBurst('heavy');
    }
  }, [triggerBurst]);

  const handleRestartFreshBattle = useCallback(() => {
    const buyIn = 1000;
    balanceRef.current = buyIn;
    setBalance(buyIn);
    setDisplayBalance(buyIn);
    displayBalRef.current.val = buyIn;
    const freshDir = createInitialDirectorState(buyIn, 'realistic_house');
    directorStateRef.current = freshDir;
    setDirectorState(freshDir);
    setRoguelike(createInitialRoguelikeState(buyIn));
    const freshBeh = createInitialBehavioralStore(buyIn);
    behavioralStoreRef.current = freshBeh;
    setBehavioralStore(freshBeh);
    const prevHistory = houseMindRef.current.cashOutHistory;
    const prevMemory = houseMindRef.current.memory;
    const prevPersonality = houseMindRef.current.personality;
    const freshHm: HouseMindState = {
      ...createInitialHouseMindState(buyIn, Date.now(), prevMemory, prevPersonality),
      houseBankroll: houseMindRef.current.houseBankroll,
      cashOutHistory: prevHistory,
    };
    houseMindRef.current = freshHm;
    setHouseMind(freshHm);
    setCashOutModal(null);
    audioEngine.playChipPlace();
  }, []);

  const handleChangeHousePersonality = useCallback((personality: HousePersonality) => {
    audioEngine.playClick();
    const nextHouse = setHousePersonality(houseMindRef.current, personality);
    houseMindRef.current = nextHouse;
    setHouseMind(nextHouse);
  }, []);

  const handleRecomputeComprehensive = useCallback(() => {
    audioEngine.playClick();
    setBehavioralStore((prev) => ({
      ...prev,
      comprehensive: runComprehensiveAnalysis(prev.events, Date.now()),
    }));
  }, []);

  const handlePreviewCelebration = useCallback(
    (tier: WinTier) => {
      const sampleMap: Record<WinTier, { amount: number; mult: number; label: string }> = {
        BIG: { amount: 250, mult: 5, label: 'VELVET VAULT FX PREVIEW' },
        SUPER: { amount: 750, mult: 15, label: 'EMERALD SALON FX PREVIEW' },
        MEGA: { amount: 2400, mult: 48, label: 'ROYAL VAULT FX PREVIEW' },
        JACKPOT: { amount: jackpotFever.grandPool, mult: 250, label: 'SOVEREIGN GRAND VAULT PREVIEW' },
      };
      const sample = sampleMap[tier];
      audioEngine.playWinFanfare(tier);
      triggerShake(tier === 'JACKPOT' || tier === 'MEGA' ? 'heavy' : 'light');
      setCelebration({
        id: Date.now(),
        amount: sample.amount,
        multiplier: sample.mult,
        tier,
        label: sample.label,
      });
    },
    [jackpotFever.grandPool, triggerShake]
  );

  const handleExportSave = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            balance,
            director: directorState,
            roguelike,
            behavioral: behavioralStore,
            jackpotFever,
            houseMind,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'velvet-vault-offline-save.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSave = useCallback((jsonText: string): { ok: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonText) as SavedSession;
      if (typeof parsed.balance !== 'number' || !parsed.director || !parsed.roguelike) {
        return { ok: false, message: 'Invalid save file format. Expected Velvet Vault JSON export.' };
      }
      balanceRef.current = parsed.balance;
      setBalance(parsed.balance);
      setDisplayBalance(parsed.balance);
      displayBalRef.current.val = parsed.balance;
      directorStateRef.current = parsed.director;
      setDirectorState(parsed.director);
      setRoguelike(parsed.roguelike);
      const nextBeh = parsed.behavioral ?? createInitialBehavioralStore(parsed.balance);
      behavioralStoreRef.current = nextBeh;
      setBehavioralStore(nextBeh);
      const nextJp = parsed.jackpotFever ?? createInitialJackpotFeverState();
      jackpotFeverRef.current = nextJp;
      setJackpotFever(nextJp);
      const nextHm = hydrateHouseMindState(parsed.houseMind, parsed.balance);
      houseMindRef.current = nextHm;
      setHouseMind(nextHm);
      audioEngine.playChipPlace();
      return {
        ok: true,
        message: `Restored $${parsed.balance.toLocaleString()} bankroll and ${
          parsed.behavioral?.totalEventsRecorded ?? 1
        } recorded behavioral events.`,
      };
    } catch {
      return { ok: false, message: 'Could not parse JSON file. Check file integrity.' };
    }
  }, []);

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
    houseMind,
    onWager: handleWager,
    onSettleRound: handleSettleRound,
    onTriggerBurst: triggerBurst,
    onRitualSignal: handleRitualSignal,
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
        winFlare={winFlare}
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
              onClick={() => selectGame('vault')}
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
              onClick={() => selectGame('analytics')}
              className="flex items-center gap-3 text-left hover:text-white"
            >
              <Activity className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <div>
                <div className="font-semibold text-slate-200">
                  ML Director · {directorState.mode === 'off' ? 'Strict RNG' : modifiers.activeArm.replace('_', ' ')}
                </div>
                <div className="font-mono-num text-[11px] text-slate-400">
                  Dopamine {directorState.dopamineIndex}/100 · {behavioralStore.realtime.stateLabel}
                </div>
              </div>
            </button>
          </div>

          {/* Right Bankroll & Utility Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="relative flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#121821] px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
              <span className="hidden text-[11px] text-slate-400 sm:inline">Bankroll</span>
              <span
                data-testid="bankroll-value"
                className="font-mono-num text-xs font-bold text-[#F9E7A8] sm:text-base"
              >
                ${displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {bankrollDelta && (
                <span
                  key={bankrollDelta.id}
                  className={`animate-balance-delta pointer-events-none absolute -bottom-5 right-2 font-mono-num text-[11px] font-bold ${
                    bankrollDelta.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {bankrollDelta.delta >= 0 ? '+' : '-'}${Math.abs(bankrollDelta.delta).toFixed(2)}
                </span>
              )}
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
                handleRitualSignal('AUDIO_TOGGLE', `Audio ${next ? 'MUTED' : 'UNMUTED'}`);
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
              onClick={() => selectGame(item.id)}
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
              CASINO FLOOR (16 GAMES)
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.filter((i) => i.section === 'games').map((item) => {
                const Icon = item.icon;
                const selected = activeGame === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectGame(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
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
                    onClick={() => selectGame(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
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
              <div className="border-t border-slate-800/80 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">System 1 AI State</div>
                <div
                  data-testid="sidebar-rt-state"
                  className="mt-0.5 font-sans text-xs font-semibold text-emerald-400"
                >
                  {behavioralStore.realtime.stateLabel}
                </div>
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

        {/* Active Game Stage with Progressive Sovereign Vault & Fever Overdrive Strip */}
        <main className="min-w-0 space-y-4">
          {/* Live Progressive Vault Jackpots & Fever Overdrive Bar */}
          <div
            data-testid="progressive-vault-bar"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all duration-300 ${
              jackpotFever.feverRoundsLeft > 0
                ? 'border-[#ECCB63] bg-gradient-to-r from-[#281E09] via-[#1A1308] to-[#11161D] shadow-[0_0_28px_rgba(212,175,55,0.25)]'
                : 'border-slate-800/90 bg-[#11161D]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-4 text-xs sm:gap-6">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest text-amber-400/90">MINI</span>
                <span className="font-mono-num font-bold text-slate-100">
                  ${jackpotFever.miniPool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest text-emerald-400">MAJOR</span>
                <span className="font-mono-num font-bold text-slate-100">
                  ${jackpotFever.majorPool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest text-[#ECCB63]">SOVEREIGN GRAND</span>
                <span className="font-mono-num text-sm font-black text-[#FEF08A]">
                  ${jackpotFever.grandPool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Fever Overdrive Gauge */}
            <div className="flex min-w-[200px] items-center gap-2.5 text-xs">
              <Zap
                className={`h-4 w-4 shrink-0 ${
                  jackpotFever.feverRoundsLeft > 0 ? 'text-[#FEF08A]' : 'text-[#D4AF37]'
                }`}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span
                    className={`font-bold tracking-wider ${
                      jackpotFever.feverRoundsLeft > 0 ? 'text-[#FEF08A]' : 'text-slate-400'
                    }`}
                  >
                    {jackpotFever.feverRoundsLeft > 0
                      ? `FEVER OVERDRIVE +15% (${jackpotFever.feverRoundsLeft} RDS)`
                      : 'FEVER METER'}
                  </span>
                  <span className="font-mono-num font-bold text-[#ECCB63]">
                    {jackpotFever.feverCharge}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-[#090C10]">
                  <div
                    className={`h-full rounded transition-all duration-300 ${
                      jackpotFever.feverRoundsLeft > 0
                        ? 'bg-gradient-to-r from-[#D4AF37] via-[#FEF08A] to-emerald-400'
                        : 'bg-[#D4AF37]'
                    }`}
                    style={{ width: `${jackpotFever.feverCharge}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Adversarial House Battle Strip (Shown in Realistic House Mode) */}
          {directorState.mode === 'realistic_house' && (
            <div
              data-testid="house-battle-bar"
              className={`rounded-xl border px-4 py-2.5 transition-all ${
                houseMind.phase === 'PREDATOR_HARVEST'
                  ? 'border-rose-500/70 bg-gradient-to-r from-[#260D15] via-[#150E15] to-[#11161D] animate-predator-pulse'
                  : 'border-slate-800/90 bg-[#11161D]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => selectGame('analytics')}
                    className="flex items-center gap-2 text-left hover:opacity-90"
                  >
                    <ShieldAlert
                      className={`h-4 w-4 shrink-0 ${HOUSE_PHASE_META[houseMind.phase].colorClass}`}
                      aria-hidden="true"
                    />
                    <span className="font-bold text-slate-100">HOUSE MIND</span>
                    <span
                      className={`font-mono-num rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        HOUSE_PHASE_META[houseMind.phase].badgeBg
                      } ${HOUSE_PHASE_META[houseMind.phase].colorClass}`}
                    >
                      {HOUSE_PHASE_META[houseMind.phase].label}
                    </span>
                  </button>

                  <div className="font-mono-num">
                    <span className="text-slate-400">House Vault </span>
                    <strong className="text-[#F9E7A8]">
                      ${houseMind.houseBankroll.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </strong>
                    <span
                      className={`ml-1.5 text-[11px] font-bold ${
                        houseMind.houseSessionProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      ({houseMind.houseSessionProfit >= 0 ? '+' : '-'}$
                      {Math.abs(houseMind.houseSessionProfit).toFixed(0)})
                    </span>
                  </div>

                  {/* Active Theories Count Badge next to House Bankroll */}
                  <button
                    type="button"
                    data-testid="active-theories-badge"
                    onClick={() => selectGame('analytics')}
                    title="Active patterns detected by The House Mind across your betting & timing habits"
                    className={`font-mono-num flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                      houseMind.activeTheoriesCount >= 3
                        ? 'border-rose-500/65 bg-rose-950/55 text-rose-200 hover:bg-rose-900/60'
                        : houseMind.activeTheoriesCount >= 1
                        ? 'border-amber-500/55 bg-amber-950/45 text-amber-200 hover:bg-amber-900/50'
                        : 'border-slate-700/80 bg-[#0B0F15] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <Crosshair className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Active Theories</span>
                    <span
                      key={houseMind.activeTheoriesCount}
                      data-testid="active-theories-count"
                      className="animate-badge-bump inline-block text-[#FEF08A]"
                    >
                      {houseMind.activeTheoriesCount}
                    </span>
                  </button>

                  <div className="hidden font-mono-num xl:block">
                    <span className="text-slate-400">Entropy </span>
                    <strong className="text-sky-300">{houseMind.cadenceEntropy}%</strong>
                    <span className="mx-2 text-slate-700">|</span>
                    <span className="text-slate-400">Quit Risk </span>
                    <strong className="text-rose-300">{houseMind.quitRisk}%</strong>
                    <span className="mx-2 text-slate-700">|</span>
                    <span className="text-slate-400">
                      {HOUSE_PERSONALITY_META[houseMind.personality].shortLabel}
                    </span>
                    {houseMind.estimatedRoundsToRuin !== null && (
                      <>
                        <span className="mx-2 text-slate-700">|</span>
                        <span className="text-slate-400">Ruin ETA </span>
                        <strong className="text-amber-300">~{houseMind.estimatedRoundsToRuin}r</strong>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="cashout-battle-btn"
                  onClick={handleCashOutBattle}
                  className="flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63] whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cash Out (${balance.toFixed(0)})</span>
                </button>
              </div>

              {houseMind.thoughts.length > 0 && (
                <div className="mt-1.5 truncate border-t border-slate-800/70 pt-1.5 text-[11px] text-slate-400">
                  <span className="font-mono-num font-bold text-rose-300">
                    [{houseMind.thoughts[houseMind.thoughts.length - 1].tag}]{' '}
                  </span>
                  <span>{houseMind.thoughts[houseMind.thoughts.length - 1].message}</span>
                </div>
              )}
            </div>
          )}

          <div
            key={activeGame}
            className={`animate-stage-slide ${
              jackpotFever.feverRoundsLeft > 0 ? 'rounded-xl ring-1 ring-[#D4AF37]/40' : ''
            }`}
          >
            {activeGame === 'slots' && <ThunderfallSlots {...commonProps} />}
            {activeGame === 'holdwin' && <SovereignHoldWin {...commonProps} />}
            {activeGame === 'plinko' && <GravityPlinko {...commonProps} />}
            {activeGame === 'crash' && <VelocityCrash {...commonProps} />}
            {activeGame === 'roulette' && <MonteCarloRoulette {...commonProps} />}
            {activeGame === 'mines' && <VaultMines {...commonProps} />}
            {activeGame === 'tower' && <DragonTower {...commonProps} />}
            {activeGame === 'limbo' && <VaultLimbo {...commonProps} />}
            {activeGame === 'blackjack' && <BlackjackTable {...commonProps} />}
            {activeGame === 'baccarat' && <SovereignBaccarat {...commonProps} />}
            {activeGame === 'poker' && <RoyalVideoPoker {...commonProps} />}
            {activeGame === 'hilo' && <HiLoLadder {...commonProps} />}
            {activeGame === 'keno' && <EmeraldKeno {...commonProps} />}
            {activeGame === 'dice' && <HyperDice {...commonProps} />}
            {activeGame === 'coinflip' && <ObsidianCoinFlip {...commonProps} />}
            {activeGame === 'wheel' && <RoyalWheel {...commonProps} />}
            {activeGame === 'analytics' && (
              <AnalyticsLab
                balance={balance}
                directorState={directorState}
                modifiers={modifiers}
                behavioralStore={behavioralStore}
                houseMind={houseMind}
                onUpdateDirectorConfig={(patch) =>
                  setDirectorState((prev) => {
                    const next = { ...prev, ...patch };
                    directorStateRef.current = next;
                    return next;
                  })
                }
                onRecomputeComprehensive={handleRecomputeComprehensive}
                onPreviewCelebration={handlePreviewCelebration}
                onCashOut={handleCashOutBattle}
                onChangeHousePersonality={handleChangeHousePersonality}
              />
            )}
            {activeGame === 'vault' && (
              <VipRelicsPanel
                balance={balance}
                roguelike={roguelike}
                onBuyRelic={handleBuyRelic}
              />
            )}
          </div>
        </main>
      </div>

      {/* Offline Launchers Modal */}
      <OfflineLauncherModal
        open={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        onExportSave={handleExportSave}
        onImportSave={handleImportSave}
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
              100% offline play money — credit deposits are logged by both Behavioral AI engines to adapt future play.
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
      {/* Cash-Out vs House Mind Settlement Modal */}
      {cashOutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="House Battle Cash-Out Report"
          data-testid="cashout-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/60 bg-[#11161D] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-mono-num text-[11px] font-bold uppercase tracking-widest text-[#ECCB63]">
                {cashOutModal.outcome === 'PLAYER_ESCAPED_PROFIT'
                  ? 'VICTORY — YOU BEAT THE HOUSE'
                  : cashOutModal.outcome === 'HOUSE_WIPED_PLAYER'
                  ? 'CHECKMATE — HOUSE DRAINED VAULT'
                  : 'TACTICAL RETREAT — LOSSES CAPPED'}
              </span>
              <span className="font-mono-num text-xs text-slate-400">
                {cashOutModal.roundsSurvived} rds
              </span>
            </div>

            <h2 className="font-display mt-2 text-3xl font-bold text-[#F9E7A8]">
              {cashOutModal.netPlayerProfit >= 0 ? '+' : '-'}$
              {Math.abs(cashOutModal.netPlayerProfit).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Walked away with{' '}
              <strong className="font-mono-num text-white">
                ${cashOutModal.cashedOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>{' '}
              against total buy-in of{' '}
              <strong className="font-mono-num text-slate-200">
                ${cashOutModal.buyIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
              .
            </p>

            <div className="mt-4 rounded-lg border border-slate-800 bg-[#090C10] p-3 text-xs">
              <div className="flex justify-between font-mono-num">
                <span className="text-slate-400">House Vault Treasury</span>
                <span className="font-bold text-[#FEF08A]">
                  ${houseMind.houseBankroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between font-mono-num">
                <span className="text-slate-400">Tap Entropy / Superstition</span>
                <span className="text-sky-300">
                  {houseMind.cadenceEntropy}% · {houseMind.superstitionScore}/100
                </span>
              </div>
              {houseMind.detectedTheories[0] && (
                <div className="mt-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  House Assessment: <strong className="text-slate-200">{houseMind.detectedTheories[0].title}</strong>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCashOutModal(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={handleRestartFreshBattle}
                className="rounded-lg bg-[#D4AF37] px-5 py-2 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63]"
              >
                New $1,000 Battle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
