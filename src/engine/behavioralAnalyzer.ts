/**
 * Dual-System Behavioral Intelligence Engine (100% Offline)
 *
 * System 1: Real-Time Behavioral Analyzer
 *   - Processes live micro-interactions (reaction latency, credit top-ups, bet sizing jumps,
 *     loss chasing, game hopping) over a sliding window to detect immediate psychological states
 *     (Tilt, Reload Hook, Fatigue, Euphoria, Bailout Risk) and emit instant dopamine modifiers.
 *
 * System 2: Comprehensive Longitudinal Analyzer & Future Optimizer
 *   - Processes the complete accumulated user history (all rounds, credit deposit logs, time-of-day
 *     patterns, game affinity, risk elasticity, and dopamine response curves) to classify the
 *     player archetype and synthesize a persistent FutureAdaptationProfile applied to future
 *     rounds and sessions.
 */

export type BehavioralEventType =
  | 'SESSION_START'
  | 'CREDIT_ADDED'
  | 'ROUND_PLAYED'
  | 'GAME_SWITCH'
  | 'RELIC_PURCHASED';

export interface BehavioralEvent {
  id: string;
  timestamp: number;
  type: BehavioralEventType;
  gameId?: string;
  amount: number; // credit added, bet size, or relic cost
  payout?: number;
  multiplier?: number;
  balanceBefore: number;
  balanceAfter: number;
  reactionMs?: number; // ms since previous round/action
  wasNearMiss?: boolean;
  hourOfDay: number;
}

export type RealTimeMicroState =
  | 'CALIBRATING'
  | 'RELOAD_WELCOME'
  | 'TILT_CHASE'
  | 'FATIGUE_DRIFT'
  | 'EUPHORIA_FLOW'
  | 'BAILOUT_RISK'
  | 'STEADY_ENGAGED';

export interface RealTimeAnalysis {
  microState: RealTimeMicroState;
  stateLabel: string;
  rationale: string;
  tiltScore: number; // 0..100
  fatigueScore: number; // 0..100
  euphoriaScore: number; // 0..100
  avgReactionMs: number;
  recentDepositBoostActive: boolean;
  betEscalationRatio: number; // latest bet vs rolling avg bet
  /** Live additive adjustments fed into ML Director */
  winBiasDelta: number;
  teaseDelta: number;
  bonusDelta: number;
  dopamineTarget: number;
}

export type PlayerArchetype =
  | 'Adaptive Explorer'
  | 'High-Roller Volatility Hunter'
  | 'Methodical Strategist'
  | 'Streak & Cascade Chaser'
  | 'Reload Thrill-Seeker';

export interface GameAffinityStat {
  gameId: string;
  rounds: number;
  totalWagered: number;
  totalReturned: number;
  avgBet: number;
  sharePct: number;
}

export interface FutureAdaptationProfile {
  archetype: PlayerArchetype;
  archetypeSummary: string;
  favoriteGameId: string | null;
  peakPlayHour: number | null;
  totalCreditsAdded: number;
  creditDepositCount: number;
  avgDepositSize: number;
  riskAppetiteScore: number; // 0..100
  lossChaseIndex: number; // 0..100 (how much bets grow after losses)
  dopamineResponsiveness: number; // 0..100
  /** Computed adaptive parameters automatically applied to future play */
  adaptedRtpFloor: number; // e.g., 101.5 .. 108.0
  adaptedPityThreshold: number; // 3 .. 6
  adaptedTeaseMultiplier: number; // 0.85 .. 1.35
  adaptedCascadeMultiplier: number; // 0.9 .. 1.4
  favoriteGameBonusBias: number; // +0.02 .. +0.08 extra boost on preferred game
  futureStrategyNote: string;
  lastProcessedAt: number;
  samplesProcessed: number;
}

export interface BehavioralStore {
  events: BehavioralEvent[]; // capped at 600 latest events for fast offline persistence
  totalEventsRecorded: number;
  lastActionAt: number;
  realtime: RealTimeAnalysis;
  comprehensive: FutureAdaptationProfile;
}

export function createInitialBehavioralStore(initialBuyIn = 1000, now = Date.now()): BehavioralStore {
  const startEvent: BehavioralEvent = {
    id: `evt-init-${now}`,
    timestamp: now,
    type: 'SESSION_START',
    amount: initialBuyIn,
    balanceBefore: 0,
    balanceAfter: initialBuyIn,
    hourOfDay: new Date(now).getHours(),
  };

  const realtime: RealTimeAnalysis = {
    microState: 'CALIBRATING',
    stateLabel: 'Calibrating Rhythm',
    rationale: 'Observing opening wagers and reaction cadence.',
    tiltScore: 12,
    fatigueScore: 15,
    euphoriaScore: 45,
    avgReactionMs: 3200,
    recentDepositBoostActive: true,
    betEscalationRatio: 1.0,
    winBiasDelta: 0.03,
    teaseDelta: 0.04,
    bonusDelta: 0.1,
    dopamineTarget: 72,
  };

  const comprehensive: FutureAdaptationProfile = {
    archetype: 'Adaptive Explorer',
    archetypeSummary: 'Gathering baseline credit, wager, and game preference signals.',
    favoriteGameId: null,
    peakPlayHour: new Date(now).getHours(),
    totalCreditsAdded: initialBuyIn,
    creditDepositCount: 1,
    avgDepositSize: initialBuyIn,
    riskAppetiteScore: 50,
    lossChaseIndex: 25,
    dopamineResponsiveness: 60,
    adaptedRtpFloor: 102.5,
    adaptedPityThreshold: 5,
    adaptedTeaseMultiplier: 1.0,
    adaptedCascadeMultiplier: 1.05,
    favoriteGameBonusBias: 0.03,
    futureStrategyNote: 'Balanced variable-ratio pacing with warm initial onboarding window.',
    lastProcessedAt: now,
    samplesProcessed: 1,
  };

  return {
    events: [startEvent],
    totalEventsRecorded: 1,
    lastActionAt: now,
    realtime,
    comprehensive,
  };
}

/**
 * SYSTEM 1: Real-Time Micro-Behavioral Analyzer
 * Evaluates the last 12 events immediately after any click/deposit/round.
 */
export function analyzeRealTimeBehavior(
  events: BehavioralEvent[],
  currentBalance: number,
  buyInReference: number,
  now = Date.now()
): RealTimeAnalysis {
  const recentRounds = events.filter((e) => e.type === 'ROUND_PLAYED').slice(-12);
  const recentDeposits = events
    .filter((e) => e.type === 'CREDIT_ADDED' || e.type === 'SESSION_START')
    .slice(-3);

  const lastDeposit = recentDeposits[recentDeposits.length - 1];
  const roundsSinceLastDeposit = lastDeposit
    ? events.filter((e) => e.type === 'ROUND_PLAYED' && e.timestamp >= lastDeposit.timestamp).length
    : 99;
  const recentDepositBoostActive =
    Boolean(lastDeposit) && roundsSinceLastDeposit < 4 && now - lastDeposit.timestamp < 1000 * 60 * 15;

  if (recentRounds.length === 0) {
    return {
      microState: recentDepositBoostActive ? 'RELOAD_WELCOME' : 'CALIBRATING',
      stateLabel: recentDepositBoostActive ? 'Fresh Credit Surge' : 'Calibrating Rhythm',
      rationale: recentDepositBoostActive
        ? 'New credits loaded — priming early positive reinforcement hits.'
        : 'Monitoring initial wager size and spin latency.',
      tiltScore: 10,
      fatigueScore: 12,
      euphoriaScore: 52,
      avgReactionMs: 3000,
      recentDepositBoostActive,
      betEscalationRatio: 1.0,
      winBiasDelta: recentDepositBoostActive ? 0.06 : 0.02,
      teaseDelta: 0.06,
      bonusDelta: recentDepositBoostActive ? 0.2 : 0.08,
      dopamineTarget: 76,
    };
  }

  // Reaction latency analysis
  const latencies = recentRounds
    .map((r) => r.reactionMs)
    .filter((ms): ms is number => typeof ms === 'number' && ms > 120 && ms < 45000);
  const avgReactionMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 3200;

  // Bet escalation ratio (last 2 bets vs prior bets)
  const avgBet =
    recentRounds.reduce((sum, r) => sum + r.amount, 0) / Math.max(1, recentRounds.length);
  const lastBet = recentRounds[recentRounds.length - 1].amount;
  const betEscalationRatio = Number((lastBet / Math.max(1, avgBet)).toFixed(2));

  // Consecutive trailing losses & wins
  let trailingLosses = 0;
  for (let i = recentRounds.length - 1; i >= 0; i--) {
    if ((recentRounds[i].payout ?? 0) <= 0) trailingLosses++;
    else break;
  }
  let trailingWins = 0;
  for (let i = recentRounds.length - 1; i >= 0; i--) {
    if ((recentRounds[i].payout ?? 0) > recentRounds[i].amount) trailingWins++;
    else break;
  }

  const bigRecentWin = recentRounds.slice(-3).some((r) => (r.multiplier ?? 0) >= 3);
  const recentSwitches = events.slice(-8).filter((e) => e.type === 'GAME_SWITCH').length;

  // Score calculation (0..100)
  const speedTilt = avgReactionMs < 1700 ? 28 : avgReactionMs < 2600 ? 14 : 0;
  const escalationTilt = betEscalationRatio > 1.5 && trailingLosses >= 1 ? 35 : betEscalationRatio > 1.25 ? 15 : 0;
  const tiltScore = Math.min(99, Math.max(5, Math.round(speedTilt + escalationTilt + trailingLosses * 11)));

  const slowFatigue = avgReactionMs > 7500 ? 36 : avgReactionMs > 5000 ? 18 : 0;
  const hopFatigue = recentSwitches >= 3 ? 28 : recentSwitches * 8;
  const fatigueScore = Math.min(99, Math.max(8, Math.round(slowFatigue + hopFatigue + (trailingLosses >= 3 ? 16 : 0))));

  const euphoriaScore = Math.min(
    99,
    Math.max(12, Math.round(38 + trailingWins * 16 + (bigRecentWin ? 26 : 0) - trailingLosses * 7))
  );

  const bankrollHealth = currentBalance / Math.max(1, buyInReference);

  // Classify dominant micro-state and synthesize instant dopamine modifiers
  if (recentDepositBoostActive && roundsSinceLastDeposit < 3) {
    return {
      microState: 'RELOAD_WELCOME',
      stateLabel: 'Credit Reload Hook',
      rationale: `User recently added credits (${roundsSinceLastDeposit}/3 warm rounds) — boosting early win & scatter resonance.`,
      tiltScore,
      fatigueScore,
      euphoriaScore: Math.max(euphoriaScore, 60),
      avgReactionMs,
      recentDepositBoostActive: true,
      betEscalationRatio,
      winBiasDelta: 0.08,
      teaseDelta: 0.08,
      bonusDelta: 0.25,
      dopamineTarget: 84,
    };
  }

  if (bankrollHealth < 0.28 && currentBalance > 0) {
    return {
      microState: 'BAILOUT_RISK',
      stateLabel: 'Bailout Rescue Window',
      rationale: 'Bankroll dipped below 28% of anchor — engaging protective comeback surge to spark dramatic recovery.',
      tiltScore,
      fatigueScore,
      euphoriaScore,
      avgReactionMs,
      recentDepositBoostActive,
      betEscalationRatio,
      winBiasDelta: 0.11,
      teaseDelta: 0.05,
      bonusDelta: 0.35,
      dopamineTarget: 88,
    };
  }

  if (tiltScore >= 62) {
    return {
      microState: 'TILT_CHASE',
      stateLabel: 'Tilt / Loss-Chase Surge',
      rationale: `Fast cadence (${(avgReactionMs / 1000).toFixed(1)}s) with ${betEscalationRatio}x bet jump — injecting high-tension relief hit.`,
      tiltScore,
      fatigueScore,
      euphoriaScore,
      avgReactionMs,
      recentDepositBoostActive,
      betEscalationRatio,
      winBiasDelta: 0.07,
      teaseDelta: 0.12,
      bonusDelta: 0.28,
      dopamineTarget: 86,
    };
  }

  if (fatigueScore >= 58) {
    return {
      microState: 'FATIGUE_DRIFT',
      stateLabel: 'Attention Re-Ignition',
      rationale: 'Slowing pace or game hopping detected — elevating anticipation teases & bonus density to re-hook focus.',
      tiltScore,
      fatigueScore,
      euphoriaScore,
      avgReactionMs,
      recentDepositBoostActive,
      betEscalationRatio,
      winBiasDelta: 0.05,
      teaseDelta: 0.16,
      bonusDelta: 0.32,
      dopamineTarget: 82,
    };
  }

  if (euphoriaScore >= 72) {
    return {
      microState: 'EUPHORIA_FLOW',
      stateLabel: 'Peak Euphoria Momentum',
      rationale: 'Player riding winning streak — riding Markov cascade escalation while pacing variable-ratio tension.',
      tiltScore,
      fatigueScore,
      euphoriaScore,
      avgReactionMs,
      recentDepositBoostActive,
      betEscalationRatio,
      winBiasDelta: 0.03,
      teaseDelta: 0.1,
      bonusDelta: 0.22,
      dopamineTarget: 92,
    };
  }

  return {
    microState: 'STEADY_ENGAGED',
    stateLabel: 'Optimal Flow Zone',
    rationale: 'Healthy wager cadence and engagement — maintaining crisp variable-ratio anticipation waves.',
    tiltScore,
    fatigueScore,
    euphoriaScore,
    avgReactionMs,
    recentDepositBoostActive,
    betEscalationRatio,
    winBiasDelta: 0.02,
    teaseDelta: 0.06,
    bonusDelta: 0.1,
    dopamineTarget: 76,
  };
}

/**
 * Computes per-game affinity breakdown from complete event history.
 */
export function computeGameAffinities(events: BehavioralEvent[]): GameAffinityStat[] {
  const map = new Map<string, { rounds: number; wagered: number; returned: number }>();
  let totalRounds = 0;

  for (const e of events) {
    if (e.type !== 'ROUND_PLAYED' || !e.gameId) continue;
    totalRounds++;
    const cur = map.get(e.gameId) ?? { rounds: 0, wagered: 0, returned: 0 };
    cur.rounds += 1;
    cur.wagered += e.amount;
    cur.returned += e.payout ?? 0;
    map.set(e.gameId, cur);
  }

  const list: GameAffinityStat[] = [];
  for (const [gameId, stat] of map.entries()) {
    list.push({
      gameId,
      rounds: stat.rounds,
      totalWagered: Number(stat.wagered.toFixed(2)),
      totalReturned: Number(stat.returned.toFixed(2)),
      avgBet: Number((stat.wagered / Math.max(1, stat.rounds)).toFixed(2)),
      sharePct: totalRounds > 0 ? Math.round((stat.rounds / totalRounds) * 100) : 0,
    });
  }

  return list.sort((a, b) => b.rounds - a.rounds);
}

/**
 * SYSTEM 2: Comprehensive Longitudinal Analyzer & Future Policy Optimizer
 * Processes ALL stored behavioral records (credits, rounds, game switches, bet elasticity,
 * time-of-day windows) and generates an updated FutureAdaptationProfile applied to future play.
 */
export function runComprehensiveAnalysis(
  events: BehavioralEvent[],
  now = Date.now()
): FutureAdaptationProfile {
  const deposits = events.filter((e) => e.type === 'CREDIT_ADDED' || e.type === 'SESSION_START');
  const rounds = events.filter((e) => e.type === 'ROUND_PLAYED');

  const totalCreditsAdded = Number(
    deposits.reduce((sum, d) => sum + d.amount, 0).toFixed(2)
  );
  const creditDepositCount = deposits.length;
  const avgDepositSize =
    creditDepositCount > 0 ? Number((totalCreditsAdded / creditDepositCount).toFixed(2)) : 1000;

  // Peak play hour histogram
  const hourCounts = new Array<number>(24).fill(0);
  for (const e of events) {
    if (e.hourOfDay >= 0 && e.hourOfDay < 24) hourCounts[e.hourOfDay]++;
  }
  let peakPlayHour: number | null = null;
  let maxHourCount = 0;
  hourCounts.forEach((c, h) => {
    if (c > maxHourCount) {
      maxHourCount = c;
      peakPlayHour = h;
    }
  });

  const affinities = computeGameAffinities(events);
  const favoriteGameId = affinities[0]?.gameId ?? null;

  // Measure risk appetite: average bet as % of balance before bet
  let riskSum = 0;
  let lossChaseCount = 0;
  let postLossOpportunities = 0;
  let bigWinSpeedups = 0;
  let bigWinEvents = 0;

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const ratio = r.amount / Math.max(1, r.balanceBefore);
    riskSum += Math.min(1, ratio * 5); // 20% of bankroll in one bet => 1.0 risk

    if (i > 0) {
      const prev = rounds[i - 1];
      if ((prev.payout ?? 0) <= 0) {
        postLossOpportunities++;
        if (r.amount > prev.amount * 1.15) {
          lossChaseCount++;
        }
      }
      if ((prev.multiplier ?? 0) >= 2.5) {
        bigWinEvents++;
        if ((r.reactionMs ?? 5000) < 3500) {
          bigWinSpeedups++;
        }
      }
    }
  }

  const riskAppetiteScore =
    rounds.length > 0
      ? Math.min(99, Math.max(12, Math.round((riskSum / rounds.length) * 100)))
      : 50;

  const lossChaseIndex =
    postLossOpportunities > 0
      ? Math.min(99, Math.max(8, Math.round((lossChaseCount / postLossOpportunities) * 100)))
      : 28;

  const dopamineResponsiveness =
    bigWinEvents > 0
      ? Math.min(99, Math.max(35, Math.round(52 + (bigWinSpeedups / bigWinEvents) * 44)))
      : 66;

  // Classify Player Archetype from full behavioral history
  let archetype: PlayerArchetype = 'Adaptive Explorer';
  let archetypeSummary = 'Balanced multi-game player responding well to varied pacing and cascade rewards.';
  let adaptedRtpFloor = 102.5;
  let adaptedPityThreshold = 5;
  let adaptedTeaseMultiplier = 1.05;
  let adaptedCascadeMultiplier = 1.1;
  let favoriteGameBonusBias = 0.03;
  let futureStrategyNote = 'Maintain adaptive variable-ratio pacing across floor games.';

  if (creditDepositCount >= 3 && avgDepositSize >= 500) {
    archetype = 'Reload Thrill-Seeker';
    archetypeSummary = `Frequent credit top-ups (${creditDepositCount} deposits, avg $${avgDepositSize.toFixed(0)}) driven by dramatic swing comebacks.`;
    adaptedRtpFloor = 105.0;
    adaptedPityThreshold = 4;
    adaptedTeaseMultiplier = 1.25;
    adaptedCascadeMultiplier = 1.25;
    favoriteGameBonusBias = 0.06;
    futureStrategyNote = 'Prioritize post-deposit hot streaks, faster pity recovery, and dramatic Super/Mega Win peaks.';
  } else if (riskAppetiteScore >= 65 || lossChaseIndex >= 55) {
    archetype = 'High-Roller Volatility Hunter';
    archetypeSummary = `High stake-to-bankroll intensity (${riskAppetiteScore}/100) with aggressive rebound sizing.`;
    adaptedRtpFloor = 104.5;
    adaptedPityThreshold = 4;
    adaptedTeaseMultiplier = 1.2;
    adaptedCascadeMultiplier = 1.35;
    favoriteGameBonusBias = 0.05;
    futureStrategyNote = 'Amplify high-multiplier jackpot ceilings and tighten comeback rubber-banding below 25% bankroll.';
  } else if (affinities.length >= 4 && (affinities[0]?.sharePct ?? 100) < 45) {
    archetype = 'Adaptive Explorer';
    archetypeSummary = `Plays across ${affinities.length} distinct games — thrives on novelty, visual spectacle, and fresh triggers.`;
    adaptedRtpFloor = 103.0;
    adaptedPityThreshold = 4;
    adaptedTeaseMultiplier = 1.18;
    adaptedCascadeMultiplier = 1.15;
    favoriteGameBonusBias = 0.04;
    futureStrategyNote = 'Front-load first-spin excitement whenever switching games and keep anticipation frames crisp.';
  } else if (rounds.length >= 6 && dopamineResponsiveness >= 70) {
    archetype = 'Streak & Cascade Chaser';
    archetypeSummary = `Strong positive acceleration after multi-x hits (Dopamine Sensitivity ${dopamineResponsiveness}/100).`;
    adaptedRtpFloor = 103.5;
    adaptedPityThreshold = 4;
    adaptedTeaseMultiplier = 1.3;
    adaptedCascadeMultiplier = 1.35;
    favoriteGameBonusBias = 0.05;
    futureStrategyNote = 'Extend Markov FEVER windows and chain tumbling multipliers during hot streaks.';
  } else if (rounds.length >= 5 && riskAppetiteScore < 35) {
    archetype = 'Methodical Strategist';
    archetypeSummary = `Disciplined bankroll sizing (${riskAppetiteScore}/100 risk) — values steady hit frequency and VIP floor goals.`;
    adaptedRtpFloor = 102.0;
    adaptedPityThreshold = 5;
    adaptedTeaseMultiplier = 0.95;
    adaptedCascadeMultiplier = 1.1;
    favoriteGameBonusBias = 0.03;
    futureStrategyNote = 'Keep hit frequency smooth (Flow Drip bias) with milestone pushes near VIP Room quotas.';
  }

  return {
    archetype,
    archetypeSummary,
    favoriteGameId,
    peakPlayHour,
    totalCreditsAdded,
    creditDepositCount,
    avgDepositSize,
    riskAppetiteScore,
    lossChaseIndex,
    dopamineResponsiveness,
    adaptedRtpFloor,
    adaptedPityThreshold,
    adaptedTeaseMultiplier,
    adaptedCascadeMultiplier,
    favoriteGameBonusBias,
    futureStrategyNote,
    lastProcessedAt: now,
    samplesProcessed: events.length,
  };
}

/**
 * Appends a new behavioral event, immediately runs System 1 (Real-Time Analyzer),
 * and runs System 2 (Comprehensive Analyzer) on deposits, milestones, or every 5 events
 * so the player's future adaptation profile continuously evolves.
 */
export function recordBehavioralEvent(
  store: BehavioralStore,
  input: {
    type: BehavioralEventType;
    gameId?: string;
    amount: number;
    payout?: number;
    multiplier?: number;
    balanceBefore: number;
    balanceAfter: number;
    wasNearMiss?: boolean;
    buyInReference: number;
    now?: number;
    forceComprehensive?: boolean;
  }
): BehavioralStore {
  const now = input.now ?? Date.now();
  const reactionMs =
    store.lastActionAt > 0 && input.type === 'ROUND_PLAYED'
      ? Math.max(150, Math.min(60000, now - store.lastActionAt))
      : undefined;

  const event: BehavioralEvent = {
    id: `evt-${now}-${store.totalEventsRecorded + 1}`,
    timestamp: now,
    type: input.type,
    gameId: input.gameId,
    amount: Number(input.amount.toFixed(2)),
    payout: input.payout !== undefined ? Number(input.payout.toFixed(2)) : undefined,
    multiplier: input.multiplier !== undefined ? Number(input.multiplier.toFixed(2)) : undefined,
    balanceBefore: Number(input.balanceBefore.toFixed(2)),
    balanceAfter: Number(input.balanceAfter.toFixed(2)),
    reactionMs,
    wasNearMiss: input.wasNearMiss,
    hourOfDay: new Date(now).getHours(),
  };

  const nextEvents = [...store.events.slice(-599), event];
  const nextTotal = store.totalEventsRecorded + 1;

  // System 1: Always runs in real time
  const realtime = analyzeRealTimeBehavior(
    nextEvents,
    input.balanceAfter,
    input.buyInReference,
    now
  );

  // System 2: Runs on credit additions, session starts, manual request, or every 4 recorded events
  const shouldRunComprehensive =
    Boolean(input.forceComprehensive) ||
    input.type === 'CREDIT_ADDED' ||
    input.type === 'SESSION_START' ||
    nextTotal % 4 === 0;

  const comprehensive = shouldRunComprehensive
    ? runComprehensiveAnalysis(nextEvents, now)
    : store.comprehensive;

  return {
    events: nextEvents,
    totalEventsRecorded: nextTotal,
    lastActionAt: now,
    realtime,
    comprehensive,
  };
}
