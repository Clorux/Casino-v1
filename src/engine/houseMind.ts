/**
 * THE HOUSE MIND — 100% Offline Classical ML Adversarial Casino Engine (Zero LLM)
 *
 * Upgraded Realistic Mode Opponent with Universal Multi-Game Coverage:
 *  1. Balance Trajectory Analyzer (Starting Balance vs Last Balance vs Current Balance & Peak Drawdown)
 *  2. Bet-Value & Bet-Change Pattern Classifier (Martingale Chase, Press-the-Win, Probe-and-Spike, All-In Shove)
 *  3. Turbo, Auto-Spin & Hyper-Speed (1x–10x) Fatigue & Speed-Switch Superstition Detector
 *  4. Shannon Cadence Entropy Spectrum Analyzer (measures tap-timing predictability across 6 latency buckets)
 *  5. Online Logistic Regression Quit-Risk Classifier (gradient-descent survival model)
 *  6. 5-Phase Adversarial Strategy Machine:
 *       HONEYMOON_HOOK -> BAIT_THEORY -> SLOW_BLEED -> LIFELINE_TEASE -> PREDATOR_HARVEST
 *  7. Universal Per-Game House Vault Extraction Ledger (applies across all 16 games)
 */

export type HousePhase =
  | 'HONEYMOON_HOOK'
  | 'BAIT_THEORY'
  | 'SLOW_BLEED'
  | 'LIFELINE_TEASE'
  | 'PREDATOR_HARVEST';

export type HousePersonality = 'CASINO_FLOOR' | 'SHARK_PIT' | 'PSYCHOLOGIST';

export type HouseTacticId =
  | 'VOLATILITY_STARVE'
  | 'MICRO_WIN_DRIP'
  | 'FALSE_PATTERN_BAIT'
  | 'PRESSURE_HARVEST';

export type SpinSpeedMultiplier = 1 | 2 | 4 | 6 | 8 | 10;

export type RitualSignalType =
  | 'TURBO_TOGGLE'
  | 'AUTO_TOGGLE'
  | 'AUDIO_TOGGLE'
  | 'GAME_SWITCH'
  | 'STAKE_JUMP'
  | 'DELAYED_TAP'
  | 'CREDIT_RELOAD'
  | 'SPEED_CHANGE';

export type BalanceScenario =
  | 'OPENING_WARMUP'
  | 'WINDFALL_LOCK'
  | 'REVENGE_HARVEST'
  | 'EVEN_GRIND'
  | 'SURVIVAL_LIFELINE'
  | 'DEEP_BLEED'
  | 'BANKRUPT_CHECKMATE';

export type BetChangePattern =
  | 'STEADY'
  | 'MARTINGALE_CHASE'
  | 'PRESS_WIN'
  | 'PROBE_AND_SPIKE'
  | 'ALL_IN_SHOVE'
  | 'MICRO_TAP';

export interface RitualEvent {
  timestamp: number;
  type: RitualSignalType;
  gameId?: string;
  detail: string;
}

export interface DetectedTheory {
  id: string;
  title: string;
  confidence: number; // 0..100
  status: 'OBSERVING' | 'FEEDING_BAIT' | 'EXPLOITING';
  counterMeasure: string;
}

export interface HouseThought {
  id: string;
  timestamp: number;
  phase: HousePhase;
  tag: string;
  message: string;
}

export interface CashOutRecord {
  id: string;
  timestamp: number;
  buyIn: number;
  cashedOut: number;
  netPlayerProfit: number;
  roundsSurvived: number;
  outcome: 'PLAYER_ESCAPED_PROFIT' | 'PLAYER_CUT_LOSSES' | 'HOUSE_WIPED_PLAYER';
}

export interface PerGameHouseStat {
  rounds: number;
  wagered: number;
  returned: number;
  houseProfit: number;
  lastWinBias: number;
}

export interface BetTransitionRow {
  down: number;
  same: number;
  up: number;
}

export interface BetTransitionMatrix {
  afterWin: BetTransitionRow;
  afterLoss: BetTransitionRow;
}

export interface HouseTacticArm {
  id: HouseTacticId;
  label: string;
  description: string;
  alpha: number;
  beta: number;
  pulls: number;
  avgExtraction: number;
  lastScore: number;
}

export interface HouseMemory {
  sessionsObserved: number;
  playerEscapes: number;
  playerWipes: number;
  totalHouseLifetimeProfit: number;
  avgEscapeProfitPct: number;
  adaptiveWindfallTriggerPct: number; // Default 15%, drops as low as 8% against repeat profit snipers
  rememberedWeakness: string;
}

export interface HouseMindState {
  personality: HousePersonality;
  houseBankroll: number; // Starts at $50,000
  initialHouseBankroll: number;
  houseSessionProfit: number; // positive = house winning, negative = player ahead
  playerPeakProfit: number;
  sessionBuyInTotal: number;
  phase: HousePhase;
  phaseRounds: number;
  roundsAnalyzed: number;

  // Balance Trajectory Triplet (Starting, Last, Current)
  startingBalance: number;
  lastBalance: number;
  currentBalance: number;
  lastBalanceDelta: number;
  peakBalance: number;
  balanceScenario: BalanceScenario;

  // Bet & Bet-Change Dynamics
  lastBet: number;
  betDelta: number;
  betChangeRatio: number;
  betHistory: number[];
  betPattern: BetChangePattern;
  lastRoundWon: boolean;

  // Turbo, Auto-Spin & Speed Multiplier (1x–10x) Telemetry
  turboActive: boolean;
  autoSpinActive: boolean;
  spinSpeedMultiplier: SpinSpeedMultiplier;
  speedChangeCount: number;
  autoSpinRounds: number;
  highSpeedRounds: number;

  // Information theory & cadence metrics
  cadenceSamplesMs: number[];
  cadenceEntropy: number; // 0..100 (0 = robotic/predictable timing, 100 = pure chaos)
  avgCadenceMs: number;
  cadenceStdMs: number;
  dominantClockBucket: string;

  // Superstition / ritual tracking
  ritualEvents: RitualEvent[];
  ritualBaitRemaining: number;
  ritualExploitArmed: boolean;
  superstitionScore: number; // 0..100
  detectedTheories: DetectedTheory[];
  activeTheoriesCount: number; // Count of real active detected player habits (0..10)

  // Online Logistic Regression Quit-Risk model: P(quit) = sigmoid(w · x + b)
  quitWeights: number[];
  quitBias: number;
  quitRisk: number; // 0..100
  lifelinesReleased: number;
  lastLifelineRound: number;

  // Real-time adversarial outputs applied across ALL 16 game engines
  adversarialWinBias: number; // -0.32 .. +0.18
  adversarialNearMissRate: number; // 0.15 .. 0.68
  adversarialBonusBoost: number; // 0.55 .. 1.70
  targetEffectiveRtp: number;
  ldwIntensity: number; // 0..0.45 Losses Disguised as Wins micro-hit intensity

  // Deep Realistic Research Telemetry (100% Offline Classical ML)
  betTransitionMatrix: BetTransitionMatrix;
  nextBetSpikeProb: number; // 0..100% Markov forecast that player raises bet next round
  preemptiveSqueezeArmed: boolean;
  cadenceAutocorr: number; // -1..+1 Lag-1 autocorrelation of tap intervals
  activeTactic: HouseTacticId;
  tacticArms: Record<HouseTacticId, HouseTacticArm>;
  ldwCount: number; // Rounds where 0 < payout < bet (Losses Disguised as Wins)
  ldwRatePct: number;
  kellyOverbetIndex: number; // 0..100 over-betting / ruin acceleration vulnerability
  estimatedRoundsToRuin: number | null;
  memory: HouseMemory;

  // Per-game realistic extraction ledger
  perGameStats: Record<string, PerGameHouseStat>;

  // Session bankroll equity curve & clock-second boundary telemetry
  equityHistory: number[];
  clockSecondSamples: number[];

  // Live tactical thought log & battle history
  thoughts: HouseThought[];
  cashOutHistory: CashOutRecord[];
}

const INITIAL_HOUSE_VAULT = 50000;

const LATENCY_BUCKETS: Array<{ label: string; maxMs: number }> = [
  { label: 'Rapid (<0.9s)', maxMs: 900 },
  { label: 'Brisk (0.9–1.8s)', maxMs: 1800 },
  { label: 'Measured (1.8–3.2s)', maxMs: 3200 },
  { label: 'Deliberate (3.2–5.5s)', maxMs: 5500 },
  { label: 'Patient Wait (5.5–10s)', maxMs: 10000 },
  { label: 'Long Stall (>10s)', maxMs: Infinity },
];

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-12, Math.min(12, z))));
}

/**
 * Computes normalized Shannon Entropy (0..100) across the 6 tap-cadence latency buckets.
 * Low entropy means the player is following a deliberate timing pattern or tap-duration theory.
 */
export function computeCadenceEntropy(samplesMs: number[]): {
  entropyPct: number;
  avgMs: number;
  stdMs: number;
  dominantBucket: string;
} {
  if (samplesMs.length < 3) {
    return {
      entropyPct: 72,
      avgMs: samplesMs[samplesMs.length - 1] ?? 2600,
      stdMs: 850,
      dominantBucket: 'Sampling Rhythm',
    };
  }

  const counts = new Array<number>(LATENCY_BUCKETS.length).fill(0);
  let sum = 0;
  for (const ms of samplesMs) {
    sum += ms;
    const bIdx = LATENCY_BUCKETS.findIndex((b) => ms <= b.maxMs);
    counts[bIdx >= 0 ? bIdx : LATENCY_BUCKETS.length - 1] += 1;
  }

  const n = samplesMs.length;
  const avgMs = sum / n;
  let variance = 0;
  for (const ms of samplesMs) {
    variance += (ms - avgMs) ** 2;
  }
  const stdMs = Math.sqrt(variance / n);

  let h = 0;
  let maxCount = 0;
  let dominantIdx = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > maxCount) {
      maxCount = counts[i];
      dominantIdx = i;
    }
    if (counts[i] > 0) {
      const p = counts[i] / n;
      h -= p * Math.log2(p);
    }
  }

  const maxH = Math.log2(LATENCY_BUCKETS.length);
  const entropyPct = Math.round(Math.min(100, Math.max(0, (h / maxH) * 100)));

  return {
    entropyPct,
    avgMs: Math.round(avgMs),
    stdMs: Math.round(stdMs),
    dominantBucket: LATENCY_BUCKETS[dominantIdx].label,
  };
}

/**
 * Computes Lag-1 Pearson Autocorrelation (-1..+1) on tap cadence samples.
 * Strongly negative values (< -0.45) expose alternating fast/slow tap rituals;
 * strongly positive values (> +0.50) expose monotonic stall ramps.
 */
export function computeCadenceAutocorrelation(samplesMs: number[]): number {
  if (samplesMs.length < 5) return 0;
  const n = samplesMs.length;
  let mean = 0;
  for (const x of samplesMs) mean += x;
  mean /= n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const d = samplesMs[i] - mean;
    den += d * d;
    if (i < n - 1) {
      num += d * (samplesMs[i + 1] - mean);
    }
  }
  if (den < 1e-6) return 0;
  return Number(Math.max(-1, Math.min(1, num / den)).toFixed(3));
}

function createInitialTacticArms(): Record<HouseTacticId, HouseTacticArm> {
  return {
    VOLATILITY_STARVE: {
      id: 'VOLATILITY_STARVE',
      label: 'Volatility Starve',
      description: 'Cold dry runs punctuated by near-miss stings to break impatient chasers.',
      alpha: 2.2,
      beta: 2.0,
      pulls: 0,
      avgExtraction: 0,
      lastScore: 0.52,
    },
    MICRO_WIN_DRIP: {
      id: 'MICRO_WIN_DRIP',
      label: 'Micro-Win Drip (LDW)',
      description: 'Frequent sub-1x partial hits that flash wins while silently bleeding balance.',
      alpha: 2.4,
      beta: 2.0,
      pulls: 0,
      avgExtraction: 0,
      lastScore: 0.54,
    },
    FALSE_PATTERN_BAIT: {
      id: 'FALSE_PATTERN_BAIT',
      label: 'False-Pattern Bait',
      description: 'Reinforces timing/toggle rituals briefly, then flips edge on elevated bets.',
      alpha: 2.1,
      beta: 2.0,
      pulls: 0,
      avgExtraction: 0,
      lastScore: 0.51,
    },
    PRESSURE_HARVEST: {
      id: 'PRESSURE_HARVEST',
      label: 'Pressure Harvest',
      description: 'Maximum negative edge wall targeting profit surges, Martingale & All-In shoves.',
      alpha: 2.3,
      beta: 2.0,
      pulls: 0,
      avgExtraction: 0,
      lastScore: 0.53,
    },
  };
}

function createDefaultHouseMemory(): HouseMemory {
  return {
    sessionsObserved: 0,
    playerEscapes: 0,
    playerWipes: 0,
    totalHouseLifetimeProfit: 0,
    avgEscapeProfitPct: 0,
    adaptiveWindfallTriggerPct: 15,
    rememberedWeakness: 'Profiling Habits',
  };
}

export function getRowProbabilities(row: BetTransitionRow): {
  downPct: number;
  samePct: number;
  upPct: number;
} {
  const total = Math.max(1, row.down + row.same + row.up);
  return {
    downPct: Math.round((row.down / total) * 100),
    samePct: Math.round((row.same / total) * 100),
    upPct: Math.round((row.up / total) * 100),
  };
}

/**
 * Synthesizes all active player betting & behavioral theories from current House Mind signals.
 * Returns both the full display list and the exact active count (excluding the baseline probe).
 */
function synthesizeDetectedTheories(ctx: {
  nextSamples: number[];
  entropyStats: { entropyPct: number; dominantBucket: string };
  recentToggleCount: number;
  recentSpeedChanges: number;
  recentDelayCount: number;
  recentStakeJumps: number;
  recentSwitches: number;
  betPattern: BetChangePattern;
  betChangeRatio: number;
  turboActive: boolean;
  autoSpinActive: boolean;
  spinSpeedMultiplier: SpinSpeedMultiplier;
  autoSpinRounds: number;
  highSpeedRounds: number;
  balanceScenario: BalanceScenario;
  nextPhase: HousePhase;
  ritualExploitArmed: boolean;
  ritualBaitRemaining: number;
  clockSecondSamples?: number[];
  recentReloadCount?: number;
  betTransitionMatrix?: BetTransitionMatrix;
  nextBetSpikeProb?: number;
  cadenceAutocorr?: number;
  roundsAnalyzed?: number;
}): { theories: DetectedTheory[]; activeCount: number } {
  const theories: DetectedTheory[] = [];
  const isExploiting = ctx.nextPhase === 'PREDATOR_HARVEST';
  const isBaiting = ctx.nextPhase === 'BAIT_THEORY';

  // 1. Timing Cadence Theory (Low Shannon Entropy)
  if (ctx.nextSamples.length >= 4 && ctx.entropyStats.entropyPct < 62) {
    theories.push({
      id: 'timing-rhythm',
      title: `Timing Cadence Theory (${ctx.entropyStats.dominantBucket})`,
      confidence: Math.min(98, Math.round(100 - ctx.entropyStats.entropyPct + 12)),
      status: isBaiting ? 'FEEDING_BAIT' : isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: isBaiting
        ? 'Rewarding rhythm briefly so player trusts wait-interval timing'
        : 'Counter-shifting RNG edge when player repeats locked cadence',
    });
  }

  // 2. Switch / Toggle Superstition Ritual (Turbo / Auto / Audio)
  if (ctx.recentToggleCount >= 1) {
    theories.push({
      id: 'toggle-ritual',
      title: `Switch / Toggle Ritual (${ctx.recentToggleCount} toggles logged)`,
      confidence: Math.min(96, 52 + ctx.recentToggleCount * 14),
      status: ctx.ritualExploitArmed
        ? 'EXPLOITING'
        : ctx.ritualBaitRemaining > 0
        ? 'FEEDING_BAIT'
        : 'OBSERVING',
      counterMeasure: ctx.ritualExploitArmed
        ? 'Harvesting elevated wagers immediately following Turbo/Auto/Audio flips'
        : 'Logging toggle-to-bet correlation for upcoming bait-and-switch',
    });
  }

  // 3. Speed-Dial Manipulation / Hyper-Speed Velocity (2x–10x)
  if (ctx.recentSpeedChanges >= 1 || ctx.spinSpeedMultiplier >= 4 || ctx.highSpeedRounds >= 3) {
    theories.push({
      id: 'speed-velocity',
      title:
        ctx.recentSpeedChanges >= 2
          ? `Speed-Switch Manipulation (${ctx.spinSpeedMultiplier}x · ${ctx.recentSpeedChanges} shifts)`
          : `Hyper-Speed Velocity (${ctx.spinSpeedMultiplier}x${ctx.turboActive ? ' + Turbo' : ''})`,
      confidence: Math.min(97, 56 + ctx.recentSpeedChanges * 14 + ctx.spinSpeedMultiplier * 3),
      status: isExploiting || ctx.spinSpeedMultiplier >= 6 ? 'EXPLOITING' : isBaiting ? 'FEEDING_BAIT' : 'OBSERVING',
      counterMeasure:
        ctx.spinSpeedMultiplier >= 6
          ? 'Accelerating Slow-Bleed drain with rapid micro-hits while player spins at hyper-speed'
          : 'Tracking speed-dial switches to trap post-shift stake jumps',
    });
  }

  // 4. Auto-Spin Cruise Fatigue
  if (ctx.autoSpinActive || ctx.autoSpinRounds >= 2) {
    theories.push({
      id: 'autospin-fatigue',
      title: `Auto-Spin Cruise Fatigue (${ctx.autoSpinRounds} auto rds)`,
      confidence: Math.min(96, 62 + ctx.autoSpinRounds * 8),
      status: ctx.autoSpinRounds >= 3 || isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: 'Using rhythmic 0.5x–0.9x micro-hits to keep Auto-Spin running down toward $0',
    });
  }

  // 5. Bet-Change Pattern Detectors (Martingale / Probe-and-Spike / Press-Win / All-In)
  if (ctx.betPattern === 'MARTINGALE_CHASE') {
    theories.push({
      id: 'martingale-chase',
      title: `Martingale Loss-Doubling (${ctx.betChangeRatio.toFixed(1)}x post-loss)`,
      confidence: Math.min(98, 72 + ctx.recentStakeJumps * 10),
      status: 'EXPLOITING',
      counterMeasure: 'Applying harsh negative win-bias (-20%+) to punish doubled recovery bets',
    });
  } else if (ctx.betPattern === 'PROBE_AND_SPIKE') {
    theories.push({
      id: 'probe-and-spike',
      title: `Micro-Bet Probe & Spike Trap (${ctx.betChangeRatio.toFixed(1)}x jump)`,
      confidence: 88,
      status: 'EXPLOITING',
      counterMeasure: 'Letting cheap probe bets pass, then slamming variance when the heavy bet lands',
    });
  } else if (ctx.betPattern === 'PRESS_WIN') {
    theories.push({
      id: 'press-the-win',
      title: `Winner's Tilt / Press-the-Win (${ctx.betChangeRatio.toFixed(1)}x spike)`,
      confidence: 82,
      status: isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: 'Injecting stinging near-misses right after hot streaks to reclaim payout',
    });
  } else if (ctx.betPattern === 'ALL_IN_SHOVE') {
    theories.push({
      id: 'all-in-shove',
      title: 'High-Exposure All-In Shove (>45% bankroll)',
      confidence: 94,
      status: 'EXPLOITING',
      counterMeasure: 'Tightening variance wall to capture reckless bankroll-shove attempts',
    });
  } else if (ctx.recentStakeJumps >= 1) {
    theories.push({
      id: 'stake-escalation',
      title: `Stake Escalation Impulse (${ctx.recentStakeJumps} jumps)`,
      confidence: Math.min(94, 58 + ctx.recentStakeJumps * 14),
      status: isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: 'Scaling adversarial house edge dynamically with bet-size velocity',
    });
  }

  // 6. Balance Trajectory Greed / Revenge Harvest
  if (ctx.balanceScenario === 'WINDFALL_LOCK' || ctx.balanceScenario === 'REVENGE_HARVEST') {
    theories.push({
      id: 'balance-greed',
      title:
        ctx.balanceScenario === 'WINDFALL_LOCK'
          ? 'Profit Windfall Refusal to Cash Out'
          : 'Post-Comeback Euphoria Over-Play',
      confidence: 86,
      status: 'EXPLOITING',
      counterMeasure: 'Squeezing table edge across all games to claw back profit before Cash Out',
    });
  }

  // 7. Table-Hopping / Game Chasing
  if (ctx.recentSwitches >= 2) {
    theories.push({
      id: 'table-hopping',
      title: `Cross-Game Table Hopping (${ctx.recentSwitches} switches)`,
      confidence: Math.min(94, 54 + ctx.recentSwitches * 13),
      status: isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: 'Carrying House Mind edge globally across all 16 games — no safe escape table',
    });
  }

  // 8. Deliberate Clock Stall
  if (ctx.recentDelayCount >= 2) {
    theories.push({
      id: 'clock-stall',
      title: `Deliberate Pause / Clock-Waiting (${ctx.recentDelayCount} stalls)`,
      confidence: Math.min(92, 50 + ctx.recentDelayCount * 12),
      status: isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: 'Neutralizing delay-tap edge with calibrated near-miss decoys',
    });
  }

  // 9. Clock-Minute Boundary Ritual (waiting for :00 / :15 / :30 / :45 second marks)
  const clockSamples = ctx.clockSecondSamples ?? [];
  if (clockSamples.length >= 4) {
    const boundaryHits = clockSamples.filter((s) => s % 15 <= 2 || s % 15 >= 13).length;
    if (boundaryHits / clockSamples.length >= 0.55) {
      theories.push({
        id: 'clock-minute-theory',
        title: `Clock-Boundary Timing (${boundaryHits}/${clockSamples.length} hits near :00/:15/:30)`,
        confidence: Math.min(95, Math.round(58 + (boundaryHits / clockSamples.length) * 38)),
        status: isExploiting ? 'EXPLOITING' : 'OBSERVING',
        counterMeasure: 'Decoupling outcome RNG from wall-clock second marks so boundary taps fail',
      });
    }
  }

  // 10. Reload Revenge Escalation (depositing fresh chips & chasing losses)
  if ((ctx.recentReloadCount ?? 0) >= 1) {
    theories.push({
      id: 'reload-revenge',
      title: `Credit Reload Revenge Cycle (${ctx.recentReloadCount} top-up${(ctx.recentReloadCount ?? 0) > 1 ? 's' : ''})`,
      confidence: Math.min(97, 74 + (ctx.recentReloadCount ?? 1) * 10),
      status: isExploiting ? 'EXPLOITING' : 'FEEDING_BAIT',
      counterMeasure: 'Feeding brief 2-round post-deposit Honeymoon Hook before harvesting fresh bankroll',
    });
  }

  // 11. Markov Conditional Bet-Transition Predictability (Pre-Emptive Trap)
  if (ctx.betTransitionMatrix && (ctx.roundsAnalyzed ?? 0) >= 5) {
    const lossProbs = getRowProbabilities(ctx.betTransitionMatrix.afterLoss);
    const winProbs = getRowProbabilities(ctx.betTransitionMatrix.afterWin);
    if (lossProbs.upPct >= 58 || winProbs.upPct >= 60) {
      const postLossDominant = lossProbs.upPct >= winProbs.upPct;
      const peakPct = Math.max(lossProbs.upPct, winProbs.upPct);
      theories.push({
        id: 'markov-bet-predictability',
        title: postLossDominant
          ? `Markov Bet Forecast: ${lossProbs.upPct}% Raise After Loss`
          : `Markov Bet Forecast: ${winProbs.upPct}% Raise After Win`,
        confidence: Math.min(98, Math.max(66, peakPct + 12)),
        status: (ctx.nextBetSpikeProb ?? 0) >= 60 || isExploiting ? 'EXPLOITING' : 'OBSERVING',
        counterMeasure: 'Pre-arming negative edge wall one round BEFORE the predicted stake spike lands',
      });
    }
  }

  // 12. Lag-1 Autocorrelation Alternating / Ramp Cadence Pattern
  const autocorr = ctx.cadenceAutocorr ?? 0;
  if (ctx.nextSamples.length >= 6 && Math.abs(autocorr) >= 0.45) {
    const isAlternating = autocorr < 0;
    theories.push({
      id: 'alternating-cadence-pattern',
      title: isAlternating
        ? `Alternating Fast/Slow Tap Rhythm (r = ${autocorr.toFixed(2)})`
        : `Monotonic Cadence Ramp Pattern (r = +${autocorr.toFixed(2)})`,
      confidence: Math.min(96, Math.round(58 + Math.abs(autocorr) * 38)),
      status: isExploiting ? 'EXPLOITING' : 'OBSERVING',
      counterMeasure: 'Neutralizing rhythmic tap alternation via phase-independent volatility compression',
    });
  }

  const activeCount = theories.length;

  if (theories.length === 0) {
    theories.push({
      id: 'entropy-probe',
      title: 'High-Entropy Unpredictable Play',
      confidence: Math.max(25, ctx.entropyStats.entropyPct),
      status: 'OBSERVING',
      counterMeasure: 'Maintaining disciplined statistical house edge while probing for habits',
    });
  }

  return { theories, activeCount };
}

export function createInitialHouseMindState(
  initialBuyIn = 1000,
  now = Date.now(),
  previousMemory?: HouseMemory,
  personality: HousePersonality = 'CASINO_FLOOR'
): HouseMindState {
  const cleanBuyIn = Math.max(10, initialBuyIn);
  const memory: HouseMemory = previousMemory
    ? { ...previousMemory }
    : createDefaultHouseMemory();
  const ambushNote =
    memory.sessionsObserved > 0 && memory.adaptiveWindfallTriggerPct < 15
      ? ` Cross-session memory active: Windfall Lock tightened to +${memory.adaptiveWindfallTriggerPct.toFixed(0)}%.`
      : '';
  return {
    personality,
    houseBankroll: INITIAL_HOUSE_VAULT,
    initialHouseBankroll: INITIAL_HOUSE_VAULT,
    houseSessionProfit: 0,
    playerPeakProfit: 0,
    sessionBuyInTotal: cleanBuyIn,
    phase: 'HONEYMOON_HOOK',
    phaseRounds: 0,
    roundsAnalyzed: 0,

    startingBalance: cleanBuyIn,
    lastBalance: cleanBuyIn,
    currentBalance: cleanBuyIn,
    lastBalanceDelta: 0,
    peakBalance: cleanBuyIn,
    balanceScenario: 'OPENING_WARMUP',

    lastBet: 0,
    betDelta: 0,
    betChangeRatio: 1,
    betHistory: [],
    betPattern: 'STEADY',
    lastRoundWon: false,

    turboActive: false,
    autoSpinActive: false,
    spinSpeedMultiplier: 1,
    speedChangeCount: 0,
    autoSpinRounds: 0,
    highSpeedRounds: 0,

    cadenceSamplesMs: [],
    cadenceEntropy: 75,
    avgCadenceMs: 2600,
    cadenceStdMs: 900,
    dominantClockBucket: 'Sampling Rhythm',

    ritualEvents: [],
    ritualBaitRemaining: 0,
    ritualExploitArmed: false,
    superstitionScore: 10,
    detectedTheories: [
      {
        id: 'entropy-probe',
        title: 'High-Entropy Unpredictable Play',
        confidence: 75,
        status: 'OBSERVING',
        counterMeasure: 'Maintaining disciplined statistical house edge while probing for habits',
      },
    ],
    activeTheoriesCount: 0,

    // Initial classical logistic regression weights for quit-risk
    quitWeights: [0.95, 1.25, 0.72, 0.58, -0.85, 0.35],
    quitBias: -0.95,
    quitRisk: 22,
    lifelinesReleased: 0,
    lastLifelineRound: -10,

    adversarialWinBias: personality === 'SHARK_PIT' ? 0.05 : 0.08,
    adversarialNearMissRate: personality === 'PSYCHOLOGIST' ? 0.36 : 0.28,
    adversarialBonusBoost: personality === 'SHARK_PIT' ? 1.15 : 1.25,
    targetEffectiveRtp: personality === 'SHARK_PIT' ? 102.0 : 104.5,
    ldwIntensity: personality === 'PSYCHOLOGIST' ? 0.24 : 0.12,

    betTransitionMatrix: {
      afterWin: { down: 1, same: 2, up: 1 },
      afterLoss: { down: 1, same: 2, up: 1 },
    },
    nextBetSpikeProb: 25,
    preemptiveSqueezeArmed: false,
    cadenceAutocorr: 0,
    activeTactic: personality === 'PSYCHOLOGIST' ? 'MICRO_WIN_DRIP' : 'VOLATILITY_STARVE',
    tacticArms: createInitialTacticArms(),
    ldwCount: 0,
    ldwRatePct: 0,
    kellyOverbetIndex: 12,
    estimatedRoundsToRuin: null,
    memory,

    perGameStats: {},
    equityHistory: [cleanBuyIn],
    clockSecondSamples: [],

    thoughts: [
      {
        id: `hm-init-${now}`,
        timestamp: now,
        phase: 'HONEYMOON_HOOK',
        tag: 'INIT',
        message: `House Vault armed ($${INITIAL_HOUSE_VAULT.toLocaleString()} · ${HOUSE_PERSONALITY_META[personality].label}). Monitoring all 16 games for Markov bet shifts, cadence harmonics & rituals.${ambushNote}`,
      },
    ],
    cashOutHistory: [],
  };
}

/**
 * Switches the Realistic Mode House Personality live and immediately adjusts posture.
 */
export function setHousePersonality(
  state: HouseMindState,
  personality: HousePersonality,
  now = Date.now()
): HouseMindState {
  if (state.personality === personality) return state;
  const meta = HOUSE_PERSONALITY_META[personality];
  const nextLdw =
    personality === 'PSYCHOLOGIST'
      ? Math.max(0.28, state.ldwIntensity)
      : personality === 'SHARK_PIT'
      ? 0.08
      : 0.14;
  return {
    ...state,
    personality,
    ldwIntensity: nextLdw,
    thoughts: [
      ...state.thoughts.slice(-19),
      {
        id: `hm-pers-${now}`,
        timestamp: now,
        phase: state.phase,
        tag: 'OPERATOR SHIFT',
        message: `House Operator switched to ${meta.label}: ${meta.summary}`,
      },
    ],
  };
}

/**
 * Safely normalizes a deserialized HouseMindState from older localStorage saves.
 */
export function hydrateHouseMindState(
  raw: Partial<HouseMindState> | undefined,
  fallbackBalance = 1000
): HouseMindState {
  const base = createInitialHouseMindState(fallbackBalance);
  if (!raw) return base;
  const merged: HouseMindState = {
    ...base,
    ...raw,
    personality: raw.personality ?? base.personality,
    startingBalance: raw.startingBalance ?? raw.sessionBuyInTotal ?? fallbackBalance,
    lastBalance: raw.lastBalance ?? fallbackBalance,
    currentBalance: raw.currentBalance ?? fallbackBalance,
    peakBalance: raw.peakBalance ?? Math.max(fallbackBalance, raw.sessionBuyInTotal ?? fallbackBalance),
    betHistory: Array.isArray(raw.betHistory) ? raw.betHistory : [],
    perGameStats: raw.perGameStats && typeof raw.perGameStats === 'object' ? raw.perGameStats : {},
    equityHistory:
      Array.isArray(raw.equityHistory) && raw.equityHistory.length > 0
        ? raw.equityHistory
        : [raw.startingBalance ?? fallbackBalance, raw.currentBalance ?? fallbackBalance],
    clockSecondSamples: Array.isArray(raw.clockSecondSamples) ? raw.clockSecondSamples : [],
    betTransitionMatrix: raw.betTransitionMatrix ?? base.betTransitionMatrix,
    nextBetSpikeProb: typeof raw.nextBetSpikeProb === 'number' ? raw.nextBetSpikeProb : base.nextBetSpikeProb,
    preemptiveSqueezeArmed: Boolean(raw.preemptiveSqueezeArmed),
    cadenceAutocorr: typeof raw.cadenceAutocorr === 'number' ? raw.cadenceAutocorr : 0,
    activeTactic: raw.activeTactic ?? base.activeTactic,
    tacticArms: raw.tacticArms ?? base.tacticArms,
    ldwCount: typeof raw.ldwCount === 'number' ? raw.ldwCount : 0,
    ldwRatePct: typeof raw.ldwRatePct === 'number' ? raw.ldwRatePct : 0,
    ldwIntensity: typeof raw.ldwIntensity === 'number' ? raw.ldwIntensity : base.ldwIntensity,
    kellyOverbetIndex: typeof raw.kellyOverbetIndex === 'number' ? raw.kellyOverbetIndex : base.kellyOverbetIndex,
    estimatedRoundsToRuin: raw.estimatedRoundsToRuin ?? null,
    memory: raw.memory ? { ...base.memory, ...raw.memory } : base.memory,
    detectedTheories: Array.isArray(raw.detectedTheories) && raw.detectedTheories.length > 0
      ? raw.detectedTheories
      : base.detectedTheories,
  };
  if (typeof raw.activeTheoriesCount !== 'number') {
    merged.activeTheoriesCount = merged.detectedTheories.filter((t) => t.id !== 'entropy-probe').length;
  }
  return merged;
}

/**
 * Logs a non-wager ritual/superstition signal (Turbo, Auto, Audio, Speed 1x–10x, Game switch, Reload).
 * Immediately updates detected theories and activeTheoriesCount so the battle bar reacts live.
 */
export function recordHouseRitualSignal(
  state: HouseMindState,
  signal: {
    type: RitualSignalType;
    gameId?: string;
    detail: string;
    creditAmount?: number;
    turboActive?: boolean;
    autoSpinActive?: boolean;
    spinSpeedMultiplier?: SpinSpeedMultiplier;
    now?: number;
  }
): HouseMindState {
  const now = signal.now ?? Date.now();
  const nextRituals = [
    ...state.ritualEvents.slice(-47),
    {
      timestamp: now,
      type: signal.type,
      gameId: signal.gameId,
      detail: signal.detail,
    },
  ];

  const turboActive = signal.turboActive ?? state.turboActive;
  const autoSpinActive = signal.autoSpinActive ?? state.autoSpinActive;
  const spinSpeedMultiplier = signal.spinSpeedMultiplier ?? state.spinSpeedMultiplier;
  const speedChangeCount =
    signal.type === 'SPEED_CHANGE' ? state.speedChangeCount + 1 : state.speedChangeCount;

  const recentWindow = nextRituals.filter((r) => now - r.timestamp < 120_000);
  const toggleCount = recentWindow.filter(
    (r) => r.type === 'TURBO_TOGGLE' || r.type === 'AUTO_TOGGLE' || r.type === 'AUDIO_TOGGLE'
  ).length;
  const speedShiftCount = recentWindow.filter((r) => r.type === 'SPEED_CHANGE').length;
  const switchCount = recentWindow.filter((r) => r.type === 'GAME_SWITCH').length;
  const delayCount = recentWindow.filter((r) => r.type === 'DELAYED_TAP').length;
  const stakeJumpCount = recentWindow.filter((r) => r.type === 'STAKE_JUMP').length;

  const superstitionScore = Math.min(
    99,
    Math.max(
      state.superstitionScore * 0.92,
      Math.round(12 + toggleCount * 16 + speedShiftCount * 13 + switchCount * 10)
    )
  );

  let ritualBaitRemaining = state.ritualBaitRemaining;
  const ritualExploitArmed = state.ritualExploitArmed;
  let nextPhase = state.phase;
  let nextSessionBuyIn = state.sessionBuyInTotal;
  const newThoughts = [...state.thoughts];

  if (signal.type === 'CREDIT_RELOAD' && signal.creditAmount && signal.creditAmount > 0) {
    nextSessionBuyIn = Number((state.sessionBuyInTotal + signal.creditAmount).toFixed(2));
    nextPhase = 'HONEYMOON_HOOK';
    ritualBaitRemaining = Math.max(ritualBaitRemaining, 2);
    newThoughts.push({
      id: `hm-reload-${now}`,
      timestamp: now,
      phase: nextPhase,
      tag: 'RELOAD TRAP',
      message: `Fresh +$${signal.creditAmount.toFixed(0)} deposit detected. Opening 2-round Honeymoon Hook before harvest.`,
    });
  } else if (
    (toggleCount >= 2 || speedShiftCount >= 2) &&
    !ritualExploitArmed &&
    ritualBaitRemaining === 0
  ) {
    ritualBaitRemaining = 2;
    nextPhase = 'BAIT_THEORY';
    newThoughts.push({
      id: `hm-ritual-${now}`,
      timestamp: now,
      phase: 'BAIT_THEORY',
      tag: signal.type === 'SPEED_CHANGE' ? 'SPEED BAIT' : 'RITUAL BAIT',
      message: `Player adjusted ${signal.detail}. Feeding 2-round false confirmation to reinforce superstition before counter-trap.`,
    });
  } else if (signal.type === 'SPEED_CHANGE' && spinSpeedMultiplier >= 6) {
    newThoughts.push({
      id: `hm-speed-${now}`,
      timestamp: now,
      phase: nextPhase,
      tag: 'HYPER VELOCITY',
      message: `Player engaged ${spinSpeedMultiplier}x speed. Accelerating House Slow-Bleed cadence to harvest high-volume spins.`,
    });
  }

  const recentReloadCount = nextRituals.filter(
    (r) => r.type === 'CREDIT_RELOAD' && now - r.timestamp < 300_000
  ).length;

  const entropyStats = computeCadenceEntropy(state.cadenceSamplesMs);
  const { theories, activeCount } = synthesizeDetectedTheories({
    nextSamples: state.cadenceSamplesMs,
    entropyStats,
    recentToggleCount: toggleCount,
    recentSpeedChanges: speedShiftCount,
    recentDelayCount: delayCount,
    recentStakeJumps: stakeJumpCount,
    recentSwitches: switchCount,
    betPattern: state.betPattern,
    betChangeRatio: state.betChangeRatio,
    turboActive,
    autoSpinActive,
    spinSpeedMultiplier,
    autoSpinRounds: state.autoSpinRounds,
    highSpeedRounds: state.highSpeedRounds,
    balanceScenario: state.balanceScenario,
    nextPhase,
    ritualExploitArmed,
    ritualBaitRemaining,
    clockSecondSamples: state.clockSecondSamples,
    recentReloadCount,
    betTransitionMatrix: state.betTransitionMatrix,
    nextBetSpikeProb: state.nextBetSpikeProb,
    cadenceAutocorr: state.cadenceAutocorr,
    roundsAnalyzed: state.roundsAnalyzed,
  });

  return {
    ...state,
    sessionBuyInTotal: nextSessionBuyIn,
    phase: nextPhase,
    turboActive,
    autoSpinActive,
    spinSpeedMultiplier,
    speedChangeCount,
    ritualEvents: nextRituals,
    ritualBaitRemaining,
    ritualExploitArmed,
    superstitionScore: Math.round(superstitionScore),
    detectedTheories: theories,
    activeTheoriesCount: activeCount,
    thoughts: newThoughts.slice(-20),
  };
}

/**
 * Updates the House Mind classical ML engines after every settled round across ANY of the 16 games:
 *  - Evaluates Starting Balance, Last Balance, Current Balance & Peak Drawdown scenarios
 *  - Analyzes Bet Value & Bet-Change Ratio (Martingale, Probe-and-Spike, Press-Win, All-In)
 *  - Evaluates Turbo, Auto-Spin & 1x–10x Speed fatigue/manipulation
 *  - Recomputes Shannon Cadence Entropy & Online Logistic Regression Quit-Risk (SGD)
 *  - Updates Per-Game Extraction Ledger & computes next-round adversarial winBias (-0.28..+0.18)
 */
export function updateHouseMindAfterRound(
  state: HouseMindState,
  params: {
    gameId: string;
    bet: number;
    payout: number;
    balanceBefore: number;
    balanceAfter: number;
    reactionMs?: number;
    dryStreak: number;
    winStreak: number;
    avgBet: number;
    wasNearMiss?: boolean;
    turboActive?: boolean;
    autoSpinActive?: boolean;
    spinSpeedMultiplier?: SpinSpeedMultiplier;
    now?: number;
  }
): HouseMindState {
  const now = params.now ?? Date.now();
  const houseDelta = Number((params.bet - params.payout).toFixed(2));
  const houseBankroll = Number(Math.max(0, state.houseBankroll + houseDelta).toFixed(2));
  const houseSessionProfit = Number((state.houseSessionProfit + houseDelta).toFixed(2));

  const startingBalance = Math.max(10, state.sessionBuyInTotal);
  const lastBalance = Number(params.balanceBefore.toFixed(2));
  const currentBalance = Number(params.balanceAfter.toFixed(2));
  const lastBalanceDelta = Number((currentBalance - lastBalance).toFixed(2));
  const peakBalance = Math.max(state.peakBalance, currentBalance, startingBalance);

  const playerNet = Number((currentBalance - startingBalance).toFixed(2));
  const playerPeakProfit = Math.max(state.playerPeakProfit, playerNet);
  const roundsAnalyzed = state.roundsAnalyzed + 1;

  const turboActive = params.turboActive ?? state.turboActive;
  const autoSpinActive = params.autoSpinActive ?? state.autoSpinActive;
  const spinSpeedMultiplier = params.spinSpeedMultiplier ?? state.spinSpeedMultiplier;
  const autoSpinRounds = autoSpinActive ? state.autoSpinRounds + 1 : state.autoSpinRounds;
  const highSpeedRounds =
    spinSpeedMultiplier >= 4 || turboActive ? state.highSpeedRounds + 1 : state.highSpeedRounds;

  // 1. Update cadence samples, Shannon Entropy & Lag-1 Autocorrelation
  const nextSamples =
    typeof params.reactionMs === 'number' && params.reactionMs >= 150 && params.reactionMs <= 45000
      ? [...state.cadenceSamplesMs.slice(-23), Math.round(params.reactionMs)]
      : state.cadenceSamplesMs;
  const entropyStats = computeCadenceEntropy(nextSamples);
  const cadenceAutocorr = computeCadenceAutocorrelation(nextSamples);

  // 2. Analyze Bet Value, Bet-Change Dynamics & Online Markov 2×3 Bet-Transition Matrix
  const prevBet = state.lastBet > 0 ? state.lastBet : params.avgBet > 0 ? params.avgBet : params.bet;
  const betDelta = params.bet > 0 ? Number((params.bet - prevBet).toFixed(2)) : 0;
  const betChangeRatio =
    params.bet > 0 && prevBet > 0 ? Number((params.bet / prevBet).toFixed(2)) : 1;
  const betHistory =
    params.bet > 0 ? [...state.betHistory.slice(-15), Number(params.bet.toFixed(2))] : state.betHistory;

  const nextBetMatrix: BetTransitionMatrix = {
    afterWin: { ...state.betTransitionMatrix.afterWin },
    afterLoss: { ...state.betTransitionMatrix.afterLoss },
  };
  if (state.roundsAnalyzed >= 1 && params.bet > 0 && prevBet > 0) {
    const row = state.lastRoundWon ? nextBetMatrix.afterWin : nextBetMatrix.afterLoss;
    if (betChangeRatio >= 1.25) {
      row.up += 1;
    } else if (betChangeRatio <= 0.8) {
      row.down += 1;
    } else {
      row.same += 1;
    }
  }
  const currentRoundWon = params.payout > params.bet;
  const forecastRow = currentRoundWon ? nextBetMatrix.afterWin : nextBetMatrix.afterLoss;
  const forecastProbs = getRowProbabilities(forecastRow);
  const nextBetSpikeProb = forecastProbs.upPct;
  const preemptiveSqueezeArmed = roundsAnalyzed >= 4 && nextBetSpikeProb >= 60;

  const betJumpVsAvg = params.avgBet > 0 ? params.bet / params.avgBet : 1;
  const exposureRatio = params.bet / Math.max(1, lastBalance);

  // Check if the player did 2+ cheap probe bets followed by a sudden heavy spike
  const recentSmallProbes =
    state.betHistory.length >= 2 &&
    state.betHistory.slice(-2).every((b) => b <= Math.max(10, params.avgBet * 0.65));

  let betPattern: BetChangePattern = 'STEADY';
  if (exposureRatio >= 0.45 && params.bet > 0) {
    betPattern = 'ALL_IN_SHOVE';
  } else if (recentSmallProbes && betChangeRatio >= 2.0 && params.bet > params.avgBet * 1.35) {
    betPattern = 'PROBE_AND_SPIKE';
  } else if (!state.lastRoundWon && betChangeRatio >= 1.6 && params.bet > 0) {
    betPattern = 'MARTINGALE_CHASE';
  } else if (state.lastRoundWon && betChangeRatio >= 1.65 && params.bet > 0) {
    betPattern = 'PRESS_WIN';
  } else if (params.bet > 0 && exposureRatio <= 0.015) {
    betPattern = 'MICRO_TAP';
  }

  // Record ritual signals discovered directly from round behavior
  const nextRituals = [...state.ritualEvents];
  if (typeof params.reactionMs === 'number' && params.reactionMs >= 3800 && params.reactionMs <= 18000) {
    nextRituals.push({
      timestamp: now,
      type: 'DELAYED_TAP',
      gameId: params.gameId,
      detail: `${(params.reactionMs / 1000).toFixed(1)}s wait`,
    });
  }
  if ((betJumpVsAvg >= 1.65 || betChangeRatio >= 1.65) && params.bet > 0) {
    nextRituals.push({
      timestamp: now,
      type: 'STAKE_JUMP',
      gameId: params.gameId,
      detail: `${Math.max(betJumpVsAvg, betChangeRatio).toFixed(1)}x bet jump ($${prevBet.toFixed(0)}→$${params.bet.toFixed(0)})`,
    });
  }
  const trimmedRituals = nextRituals.slice(-48);

  // 3. Online Logistic Regression Quit-Risk Predictor
  const dryNorm = Math.min(2, params.dryStreak / 5);
  const drawdown = Math.max(0, Math.min(1.5, (startingBalance - currentBalance) / startingBalance));
  const slowRatio = Math.min(1.5, entropyStats.avgMs / 6500);
  const recentSwitches = trimmedRituals.filter(
    (r) => r.type === 'GAME_SWITCH' && now - r.timestamp < 120_000
  ).length;
  const switchRate = Math.min(1, recentSwitches / 4);
  const recentHit = params.payout > params.bet ? 1 : 0;
  const recentRitualCount = trimmedRituals.filter((r) => now - r.timestamp < 90_000).length;
  const ritualDensity = Math.min(1, recentRitualCount / 5);

  const x = [dryNorm, drawdown, slowRatio, switchRate, recentHit, ritualDensity];
  const z =
    state.quitBias + x.reduce((acc, xi, idx) => acc + xi * (state.quitWeights[idx] ?? 0), 0);
  const rawQuitProb = sigmoid(z);

  // Auto-spin / hyper-speed players exhibit lower immediate quit risk (inertia keeps them clicking!)
  const automationInertia = autoSpinActive ? -0.14 : spinSpeedMultiplier >= 4 ? -0.08 : 0;

  const observedQuitTarget = Math.min(
    0.96,
    Math.max(
      0.04,
      0.18 +
        (params.dryStreak >= 4 ? 0.34 : 0) +
        (drawdown > 0.55 ? 0.28 : 0) +
        (slowRatio > 0.85 ? 0.2 : -0.08) +
        (recentHit ? -0.35 : 0) +
        automationInertia
    )
  );
  const gradErr = observedQuitTarget - rawQuitProb;
  const lr = 0.08;
  const nextQuitWeights = state.quitWeights.map((w, idx) =>
    Number(Math.max(-2.0, Math.min(2.2, w + lr * gradErr * x[idx])).toFixed(4))
  );
  const nextQuitBias = Number(
    Math.max(-2.0, Math.min(1.5, state.quitBias + lr * gradErr)).toFixed(4)
  );
  const quitRisk = Math.round(Math.min(98, Math.max(4, rawQuitProb * 100)));

  // 4. Superstition & Recent Ritual Counters
  const recentToggleCount = trimmedRituals.filter(
    (r) =>
      (r.type === 'TURBO_TOGGLE' || r.type === 'AUTO_TOGGLE' || r.type === 'AUDIO_TOGGLE') &&
      now - r.timestamp < 120_000
  ).length;
  const recentSpeedChanges = trimmedRituals.filter(
    (r) => r.type === 'SPEED_CHANGE' && now - r.timestamp < 120_000
  ).length;
  const recentDelayCount = trimmedRituals.filter(
    (r) => r.type === 'DELAYED_TAP' && now - r.timestamp < 120_000
  ).length;
  const recentStakeJumps = trimmedRituals.filter(
    (r) => r.type === 'STAKE_JUMP' && now - r.timestamp < 120_000
  ).length;

  const superstitionScore = Math.min(
    99,
    Math.max(
      8,
      Math.round(
        (100 - entropyStats.entropyPct) * 0.42 +
          recentToggleCount * 14 +
          recentSpeedChanges * 12 +
          recentDelayCount * 10 +
          recentStakeJumps * 9
      )
    )
  );

  // 5. Balance Scenario Classification (Starting vs Last vs Current) + Adaptive Cross-Session Ambush Trigger
  const bankrollRatio = currentBalance / startingBalance;
  const playerWiped = currentBalance < 1;
  const bigSingleRoundJump = lastBalanceDelta >= Math.max(startingBalance * 0.12, params.bet * 3);
  const bouncedFromHole =
    lastBalance < startingBalance * 0.65 && lastBalanceDelta > Math.max(params.bet * 1.5, 40);

  const personalityWindfallBase =
    state.personality === 'SHARK_PIT' ? 1.10 : state.personality === 'PSYCHOLOGIST' ? 1.16 : 1.15;
  const memoryWindfallRatio = 1 + Math.max(0.08, Math.min(0.18, state.memory.adaptiveWindfallTriggerPct / 100));
  const windfallThresholdRatio = Math.min(personalityWindfallBase, memoryWindfallRatio);

  let balanceScenario: BalanceScenario = 'EVEN_GRIND';
  if (playerWiped) {
    balanceScenario = 'BANKRUPT_CHECKMATE';
  } else if (roundsAnalyzed <= 3 && bankrollRatio < windfallThresholdRatio) {
    balanceScenario = 'OPENING_WARMUP';
  } else if (bankrollRatio >= windfallThresholdRatio || (bankrollRatio >= 1.05 && bigSingleRoundJump)) {
    balanceScenario = 'WINDFALL_LOCK';
  } else if (bouncedFromHole) {
    balanceScenario = 'REVENGE_HARVEST';
  } else if (bankrollRatio < 0.35 && quitRisk >= 62) {
    balanceScenario = 'SURVIVAL_LIFELINE';
  } else if (bankrollRatio < 0.65) {
    balanceScenario = 'DEEP_BLEED';
  } else {
    balanceScenario = 'EVEN_GRIND';
  }

  // 6. Phase Machine Transition Logic ("The Battle")
  let nextPhase: HousePhase = state.phase;
  let phaseRounds = state.phaseRounds + 1;
  let ritualBaitRemaining = state.ritualBaitRemaining;
  let ritualExploitArmed = state.ritualExploitArmed;
  let lifelinesReleased = state.lifelinesReleased;
  let lastLifelineRound = state.lastLifelineRound;
  const newThoughts = [...state.thoughts];

  const pushThought = (tag: string, message: string, phaseOverride?: HousePhase) => {
    newThoughts.push({
      id: `hm-${now}-${roundsAnalyzed}-${newThoughts.length}`,
      timestamp: now,
      phase: phaseOverride ?? nextPhase,
      tag,
      message,
    });
  };

  const playerIsUpBig = balanceScenario === 'WINDFALL_LOCK' || bankrollRatio >= windfallThresholdRatio;
  const hostileBetPattern =
    betPattern === 'MARTINGALE_CHASE' ||
    betPattern === 'PROBE_AND_SPIKE' ||
    betPattern === 'ALL_IN_SHOVE';

  if (playerWiped) {
    nextPhase = 'PREDATOR_HARVEST';
    pushThought(
      'CHECKMATE',
      `Player bankroll drained to $0 (Start $${startingBalance.toFixed(0)} → $0). House Vault captured +$${Math.max(
        0,
        houseSessionProfit
      ).toFixed(2)}.`
    );
  } else if (
    // Anti-Quit Lifeline: protect retention when player is down & close to quitting
    (quitRisk >= 68 || (params.dryStreak >= 4 && bankrollRatio < 0.65) || balanceScenario === 'SURVIVAL_LIFELINE') &&
    roundsAnalyzed - lastLifelineRound >= 4 &&
    bankrollRatio < 1.02 &&
    !hostileBetPattern
  ) {
    nextPhase = 'LIFELINE_TEASE';
    phaseRounds = 0;
    lifelinesReleased += 1;
    lastLifelineRound = roundsAnalyzed;
    pushThought(
      'ANTI-QUIT LIFELINE',
      `Balance $${lastBalance.toFixed(0)}→$${currentBalance.toFixed(0)} (Quit Risk ${quitRisk}%). Releasing controlled relief hit to keep player seated.`
    );
  } else if (state.phase === 'LIFELINE_TEASE') {
    if (params.payout > params.bet || phaseRounds >= 2) {
      nextPhase = playerIsUpBig || hostileBetPattern ? 'PREDATOR_HARVEST' : 'SLOW_BLEED';
      phaseRounds = 0;
      pushThought(
        'HOOK RESTORED',
        `Relief hit landed (+$${lastBalanceDelta.toFixed(0)}). Snapping back to ${
          nextPhase === 'PREDATOR_HARVEST' ? 'Predator Harvest' : 'Slow Bleed'
        } while confidence is high.`
      );
    }
  } else if (state.phase === 'HONEYMOON_HOOK') {
    if (roundsAnalyzed >= 3 && (playerNet > startingBalance * 0.08 || phaseRounds >= 4 || hostileBetPattern || playerIsUpBig)) {
      nextPhase =
        hostileBetPattern || playerIsUpBig
          ? 'PREDATOR_HARVEST'
          : superstitionScore >= 42
          ? 'BAIT_THEORY'
          : 'SLOW_BLEED';
      phaseRounds = 0;
      if (nextPhase === 'BAIT_THEORY') ritualBaitRemaining = 2;
      pushThought(
        playerIsUpBig ? 'WINDFALL LOCK' : 'HOOK COMPLETE',
        playerIsUpBig
          ? `Player surged +$${playerNet.toFixed(0)} (${(bankrollRatio * 100).toFixed(0)}% of start). Aborting warmup and locking PREDATOR HARVEST.`
          : `Opening warmup done (${playerNet >= 0 ? '+' : ''}$${playerNet.toFixed(0)} vs start). Shifting to ${
              HOUSE_PHASE_META[nextPhase].label
            }.`
      );
    }
  } else if (state.phase === 'BAIT_THEORY') {
    if (ritualBaitRemaining > 0) {
      ritualBaitRemaining -= 1;
    }
    if (ritualBaitRemaining <= 0 || playerIsUpBig || hostileBetPattern) {
      ritualBaitRemaining = 0;
      ritualExploitArmed = true;
      nextPhase = 'PREDATOR_HARVEST';
      phaseRounds = 0;
      pushThought(
        'TRAP SPRUNG',
        `Player theory confirmed (Superstition ${superstitionScore}/100, Entropy ${entropyStats.entropyPct}%). Flipping polarity to PREDATOR HARVEST!`
      );
    }
  } else if (
    playerIsUpBig ||
    balanceScenario === 'REVENGE_HARVEST' ||
    hostileBetPattern ||
    (betJumpVsAvg >= 1.65 && (entropyStats.entropyPct < 55 || ritualExploitArmed))
  ) {
    if (state.phase !== 'PREDATOR_HARVEST') {
      nextPhase = 'PREDATOR_HARVEST';
      phaseRounds = 0;
      const reason =
        betPattern === 'MARTINGALE_CHASE'
          ? `Martingale ${betChangeRatio.toFixed(1)}x post-loss doubling detected ($${prevBet.toFixed(0)}→$${params.bet.toFixed(0)}). Locking harvest squeeze.`
          : betPattern === 'PROBE_AND_SPIKE'
          ? `Micro-bet probe & ${betChangeRatio.toFixed(1)}x spike spotted. Slamming house edge on heavy wager.`
          : betPattern === 'ALL_IN_SHOVE'
          ? `High-exposure shove (${Math.round(exposureRatio * 100)}% bankroll). Raising predator wall.`
          : balanceScenario === 'REVENGE_HARVEST'
          ? `Player surged +$${lastBalanceDelta.toFixed(0)} off drawdown. Harvesting post-comeback euphoria.`
          : `Player up +$${playerNet.toFixed(0)} (${(bankrollRatio * 100).toFixed(0)}% of start). Reclaiming vault profit across all tables.`;
      pushThought('PREDATOR LOCK', reason);
    }
  } else if (state.phase === 'PREDATOR_HARVEST' && bankrollRatio < 0.84 && phaseRounds >= 3 && !hostileBetPattern) {
    nextPhase = 'SLOW_BLEED';
    phaseRounds = 0;
    pushThought(
      'PACE CONTROL',
      `House secured +$${houseSessionProfit.toFixed(0)} net. Shifting to Slow Bleed${
        autoSpinActive || spinSpeedMultiplier >= 4 ? ` (${spinSpeedMultiplier}x speed drain)` : ''
      }.`
    );
  } else if (
    state.phase === 'SLOW_BLEED' &&
    entropyStats.entropyPct < 48 &&
    nextSamples.length >= 5 &&
    !ritualExploitArmed
  ) {
    nextPhase = 'BAIT_THEORY';
    ritualBaitRemaining = 1;
    phaseRounds = 0;
    pushThought(
      'CADENCE LOCKED',
      `Low tap entropy (${entropyStats.entropyPct}% · ${entropyStats.dominantBucket}). Feeding 1 bait hit before exploiting rhythm.`
    );
  }

  // 6.5. Online 4-Arm House Adversarial Tactic Bandit (Beta/UCB Learning + LDW Tracking)
  const isLdwRound = params.bet > 0 && params.payout > 0 && params.payout < params.bet;
  const nextLdwCount = state.ldwCount + (isLdwRound ? 1 : 0);
  const ldwRatePct = Math.round((nextLdwCount / roundsAnalyzed) * 100);

  // Score the tactic that was active during this round: high extraction + keeping player seated = high reward
  const normalizedExtraction = params.bet > 0 ? Math.max(-1.5, Math.min(1.5, houseDelta / params.bet)) : 0;
  const retentionPenalty = quitRisk >= 72 ? 0.24 : quitRisk >= 60 ? 0.1 : 0;
  const ldwRetentionBonus = isLdwRound && quitRisk < 68 ? 0.08 : 0;
  const tacticReward = Math.min(
    0.98,
    Math.max(0.05, 0.48 + normalizedExtraction * 0.28 + ldwRetentionBonus - retentionPenalty)
  );

  const prevArm = state.tacticArms[state.activeTactic];
  const armDecay = 0.97;
  const updatedPrevArm: HouseTacticArm = {
    ...prevArm,
    alpha: Number((prevArm.alpha * armDecay + tacticReward).toFixed(3)),
    beta: Number((prevArm.beta * armDecay + (1 - tacticReward)).toFixed(3)),
    pulls: prevArm.pulls + 1,
    avgExtraction: Number(
      ((prevArm.avgExtraction * prevArm.pulls + houseDelta) / (prevArm.pulls + 1)).toFixed(2)
    ),
    lastScore: Number(tacticReward.toFixed(3)),
  };
  const nextTacticArms: Record<HouseTacticId, HouseTacticArm> = {
    ...state.tacticArms,
    [state.activeTactic]: updatedPrevArm,
  };

  // Select optimal House Tactic for the NEXT round using UCB posterior + contextual personality fit
  const tacticIds: HouseTacticId[] = [
    'VOLATILITY_STARVE',
    'MICRO_WIN_DRIP',
    'FALSE_PATTERN_BAIT',
    'PRESSURE_HARVEST',
  ];
  let bestTactic: HouseTacticId = state.activeTactic;
  let bestTacticScore = -Infinity;
  for (const tid of tacticIds) {
    const arm = nextTacticArms[tid];
    const posteriorMean = arm.alpha / (arm.alpha + arm.beta);
    const ucbBonus = Math.sqrt(Math.log(roundsAnalyzed + 2) / (arm.pulls + 1)) * 0.14;
    let contextFit = 0;
    if (tid === 'PRESSURE_HARVEST' && (nextPhase === 'PREDATOR_HARVEST' || hostileBetPattern || preemptiveSqueezeArmed)) {
      contextFit += 0.28;
    }
    if (tid === 'MICRO_WIN_DRIP' && (autoSpinActive || spinSpeedMultiplier >= 4 || state.personality === 'PSYCHOLOGIST' || quitRisk >= 48)) {
      contextFit += 0.24;
    }
    if (tid === 'FALSE_PATTERN_BAIT' && (nextPhase === 'BAIT_THEORY' || superstitionScore >= 46)) {
      contextFit += 0.26;
    }
    if (tid === 'VOLATILITY_STARVE' && (nextPhase === 'SLOW_BLEED' && quitRisk < 55)) {
      contextFit += 0.18;
    }
    if (state.personality === 'SHARK_PIT' && tid === 'PRESSURE_HARVEST') contextFit += 0.14;
    if (state.personality === 'PSYCHOLOGIST' && (tid === 'MICRO_WIN_DRIP' || tid === 'FALSE_PATTERN_BAIT')) {
      contextFit += 0.12;
    }
    const totalScore = posteriorMean + ucbBonus + contextFit;
    if (totalScore > bestTacticScore) {
      bestTacticScore = totalScore;
      bestTactic = tid;
    }
  }

  if (preemptiveSqueezeArmed && !state.preemptiveSqueezeArmed && nextPhase !== 'LIFELINE_TEASE') {
    pushThought(
      'MARKOV PRE-EMPT',
      `Markov bet model predicts ${nextBetSpikeProb}% chance of a stake raise next round. Pre-arming edge wall early.`
    );
  }

  // 7. Compute Adversarial Math Modifiers (applies globally to all 16 games!)
  let adversarialWinBias = -0.08;
  let adversarialNearMissRate = 0.42;
  let adversarialBonusBoost = 0.92;
  let targetEffectiveRtp = 91.5;

  const personalityEdgeShift =
    state.personality === 'SHARK_PIT' ? 0.035 : state.personality === 'PSYCHOLOGIST' ? 0.01 : 0;
  const predictabilityPenalty =
    (entropyStats.entropyPct < 50 ? ((50 - entropyStats.entropyPct) / 50) * 0.055 : 0) +
    (Math.abs(cadenceAutocorr) >= 0.45 && nextSamples.length >= 6 ? 0.025 : 0);
  const betChangePenalty =
    betPattern === 'MARTINGALE_CHASE'
      ? 0.065
      : betPattern === 'PROBE_AND_SPIKE'
      ? 0.075
      : betPattern === 'ALL_IN_SHOVE'
      ? 0.06
      : betPattern === 'PRESS_WIN'
      ? 0.04
      : 0;
  const preemptivePenalty = preemptiveSqueezeArmed ? 0.03 : 0;
  const speedAutoPenalty =
    (autoSpinActive ? 0.025 : 0) +
    (spinSpeedMultiplier >= 8 ? 0.035 : spinSpeedMultiplier >= 4 ? 0.02 : turboActive ? 0.015 : 0);
  const tacticEdgeShift =
    bestTactic === 'PRESSURE_HARVEST' ? 0.022 : bestTactic === 'VOLATILITY_STARVE' ? 0.012 : 0;

  let ldwIntensity =
    bestTactic === 'MICRO_WIN_DRIP'
      ? state.personality === 'PSYCHOLOGIST'
        ? 0.42
        : 0.3
      : state.personality === 'PSYCHOLOGIST'
      ? 0.24
      : 0.1;

  switch (nextPhase) {
    case 'HONEYMOON_HOOK':
      adversarialWinBias = state.personality === 'SHARK_PIT' ? 0.05 : 0.09;
      adversarialNearMissRate = state.personality === 'PSYCHOLOGIST' ? 0.36 : 0.28;
      adversarialBonusBoost = state.personality === 'SHARK_PIT' ? 1.15 : 1.3;
      targetEffectiveRtp = state.personality === 'SHARK_PIT' ? 102.5 : 106.5;
      ldwIntensity = 0.08;
      break;
    case 'BAIT_THEORY':
      adversarialWinBias = 0.11;
      adversarialNearMissRate = 0.36;
      adversarialBonusBoost = 1.35;
      targetEffectiveRtp = 108.0;
      ldwIntensity = 0.16;
      break;
    case 'LIFELINE_TEASE':
      adversarialWinBias = 0.16;
      adversarialNearMissRate = 0.3;
      adversarialBonusBoost = 1.55;
      targetEffectiveRtp = 112.5;
      ldwIntensity = 0.05;
      break;
    case 'SLOW_BLEED': {
      const totalPenalty =
        predictabilityPenalty +
        betChangePenalty * 0.7 +
        speedAutoPenalty +
        preemptivePenalty +
        personalityEdgeShift +
        tacticEdgeShift;
      adversarialWinBias = Number(Math.max(-0.26, -0.08 - totalPenalty).toFixed(3));
      adversarialNearMissRate = Number(
        Math.min(
          0.66,
          0.48 + speedAutoPenalty * 1.4 + (state.personality === 'PSYCHOLOGIST' ? 0.06 : 0)
        ).toFixed(2)
      );
      adversarialBonusBoost = 0.85;
      targetEffectiveRtp = Number(Math.max(78.0, 91.5 - totalPenalty * 56).toFixed(1));
      break;
    }
    case 'PREDATOR_HARVEST': {
      const profitPressure = Math.max(0, Math.min(0.08, (bankrollRatio - 1.0) * 0.14));
      const totalPenalty =
        predictabilityPenalty +
        profitPressure +
        betChangePenalty +
        speedAutoPenalty +
        preemptivePenalty +
        personalityEdgeShift +
        tacticEdgeShift;
      const minFloor = state.personality === 'SHARK_PIT' ? -0.32 : -0.28;
      adversarialWinBias = Number(Math.max(minFloor, -0.14 - totalPenalty).toFixed(3));
      adversarialNearMissRate = Number(
        Math.min(
          0.68,
          0.56 + betChangePenalty * 0.9 + (bestTactic === 'VOLATILITY_STARVE' ? 0.05 : 0)
        ).toFixed(2)
      );
      adversarialBonusBoost = state.personality === 'SHARK_PIT' ? 0.58 : 0.68;
      targetEffectiveRtp = Number(Math.max(72.0, 85.2 - totalPenalty * 50).toFixed(1));
      break;
    }
  }

  // 7.5. Gambler's Ruin Physics & Kelly Overbet Vulnerability Index
  const avgBetNow = Math.max(5, params.avgBet > 0 ? params.avgBet : params.bet);
  const betToBankrollPct = (avgBetNow / Math.max(10, currentBalance)) * 100;
  const kellyOverbetIndex = Math.round(
    Math.min(
      100,
      Math.max(
        5,
        betToBankrollPct * 4.5 +
          (betPattern === 'MARTINGALE_CHASE' ? 32 : betPattern === 'ALL_IN_SHOVE' ? 45 : 0) +
          (betPattern === 'PROBE_AND_SPIKE' ? 22 : 0) +
          (spinSpeedMultiplier >= 6 ? 12 : 0)
      )
    )
  );
  const houseEdgeFrac = Math.max(0, (100 - targetEffectiveRtp) / 100);
  const estimatedRoundsToRuin =
    currentBalance < 1
      ? 0
      : houseEdgeFrac >= 0.02
      ? Math.max(
          1,
          Math.min(
            999,
            Math.round(currentBalance / Math.max(0.5, avgBetNow * houseEdgeFrac * (1 + kellyOverbetIndex / 140)))
          )
        )
      : null;

  // 8. Synthesize Detected Theories & Active Count (up to 12 real behavioral detectors)
  const clockSec = Math.floor(now / 1000) % 60;
  const nextClockSecondSamples = [...state.clockSecondSamples.slice(-15), clockSec];
  const recentReloadCount = trimmedRituals.filter(
    (r) => r.type === 'CREDIT_RELOAD' && now - r.timestamp < 300_000
  ).length;

  const { theories, activeCount } = synthesizeDetectedTheories({
    nextSamples,
    entropyStats,
    recentToggleCount,
    recentSpeedChanges,
    recentDelayCount,
    recentStakeJumps,
    recentSwitches,
    betPattern,
    betChangeRatio,
    turboActive,
    autoSpinActive,
    spinSpeedMultiplier,
    autoSpinRounds,
    highSpeedRounds,
    balanceScenario,
    nextPhase,
    ritualExploitArmed,
    ritualBaitRemaining,
    clockSecondSamples: nextClockSecondSamples,
    recentReloadCount,
    betTransitionMatrix: nextBetMatrix,
    nextBetSpikeProb,
    cadenceAutocorr,
    roundsAnalyzed,
  });

  // 9. Update Per-Game Extraction Ledger (proving universal multi-game Realistic enforcement)
  const prevGameStat = state.perGameStats[params.gameId] ?? {
    rounds: 0,
    wagered: 0,
    returned: 0,
    houseProfit: 0,
    lastWinBias: 0,
  };
  const nextPerGameStats: Record<string, PerGameHouseStat> = {
    ...state.perGameStats,
    [params.gameId]: {
      rounds: prevGameStat.rounds + 1,
      wagered: Number((prevGameStat.wagered + params.bet).toFixed(2)),
      returned: Number((prevGameStat.returned + params.payout).toFixed(2)),
      houseProfit: Number((prevGameStat.houseProfit + houseDelta).toFixed(2)),
      lastWinBias: adversarialWinBias,
    },
  };

  const nextEquityHistory = [...state.equityHistory.slice(-47), currentBalance];

  return {
    ...state,
    houseBankroll,
    houseSessionProfit,
    playerPeakProfit,
    phase: nextPhase,
    phaseRounds,
    roundsAnalyzed,
    startingBalance,
    lastBalance,
    currentBalance,
    lastBalanceDelta,
    peakBalance,
    balanceScenario,
    lastBet: params.bet > 0 ? Number(params.bet.toFixed(2)) : state.lastBet,
    betDelta,
    betChangeRatio,
    betHistory,
    betPattern,
    lastRoundWon: currentRoundWon,
    turboActive,
    autoSpinActive,
    spinSpeedMultiplier,
    autoSpinRounds,
    highSpeedRounds,
    cadenceSamplesMs: nextSamples,
    cadenceEntropy: entropyStats.entropyPct,
    avgCadenceMs: entropyStats.avgMs,
    cadenceStdMs: entropyStats.stdMs,
    dominantClockBucket: entropyStats.dominantBucket,
    ritualEvents: trimmedRituals,
    ritualBaitRemaining,
    ritualExploitArmed,
    superstitionScore,
    detectedTheories: theories,
    activeTheoriesCount: activeCount,
    quitWeights: nextQuitWeights,
    quitBias: nextQuitBias,
    quitRisk,
    lifelinesReleased,
    lastLifelineRound,
    adversarialWinBias,
    adversarialNearMissRate,
    adversarialBonusBoost,
    targetEffectiveRtp,
    ldwIntensity: Number(ldwIntensity.toFixed(2)),
    betTransitionMatrix: nextBetMatrix,
    nextBetSpikeProb,
    preemptiveSqueezeArmed,
    cadenceAutocorr,
    activeTactic: bestTactic,
    tacticArms: nextTacticArms,
    ldwCount: nextLdwCount,
    ldwRatePct,
    kellyOverbetIndex,
    estimatedRoundsToRuin,
    perGameStats: nextPerGameStats,
    equityHistory: nextEquityHistory,
    clockSecondSamples: nextClockSecondSamples,
    thoughts: newThoughts.slice(-20),
  };
}

/**
 * Records a player's voluntary Cash-Out (or bust) against the House Mind and updates Cross-Session House Memory.
 */
export function recordHouseCashOut(
  state: HouseMindState,
  currentBalance: number,
  now = Date.now()
): { nextState: HouseMindState; record: CashOutRecord } {
  const netPlayerProfit = Number((currentBalance - state.sessionBuyInTotal).toFixed(2));
  const outcome: CashOutRecord['outcome'] =
    currentBalance < 1
      ? 'HOUSE_WIPED_PLAYER'
      : netPlayerProfit > 0
      ? 'PLAYER_ESCAPED_PROFIT'
      : 'PLAYER_CUT_LOSSES';

  const record: CashOutRecord = {
    id: `co-${now}`,
    timestamp: now,
    buyIn: state.sessionBuyInTotal,
    cashedOut: Number(currentBalance.toFixed(2)),
    netPlayerProfit,
    roundsSurvived: state.roundsAnalyzed,
    outcome,
  };

  // Update persistent Cross-Session House Memory so future sessions adapt to player's escape thresholds
  const prevMem = state.memory;
  const nextSessions = prevMem.sessionsObserved + 1;
  const nextEscapes = prevMem.playerEscapes + (outcome === 'PLAYER_ESCAPED_PROFIT' ? 1 : 0);
  const nextWipes = prevMem.playerWipes + (outcome === 'HOUSE_WIPED_PLAYER' ? 1 : 0);
  const houseGain = Number((state.sessionBuyInTotal - currentBalance).toFixed(2));
  const totalHouseLifetimeProfit = Number((prevMem.totalHouseLifetimeProfit + houseGain).toFixed(2));

  let avgEscapeProfitPct = prevMem.avgEscapeProfitPct;
  let adaptiveWindfallTriggerPct = prevMem.adaptiveWindfallTriggerPct;
  if (outcome === 'PLAYER_ESCAPED_PROFIT' && state.sessionBuyInTotal > 0) {
    const escapePct = (netPlayerProfit / state.sessionBuyInTotal) * 100;
    avgEscapeProfitPct =
      prevMem.playerEscapes === 0
        ? Number(escapePct.toFixed(1))
        : Number(((prevMem.avgEscapeProfitPct * prevMem.playerEscapes + escapePct) / nextEscapes).toFixed(1));
    // Tighten future Windfall Lock below the player's habitual exit point (floor at +8%)
    adaptiveWindfallTriggerPct = Number(
      Math.max(8, Math.min(adaptiveWindfallTriggerPct, Math.round(avgEscapeProfitPct * 0.72))).toFixed(1)
    );
  }

  let rememberedWeakness = prevMem.rememberedWeakness;
  if (state.betPattern === 'MARTINGALE_CHASE') rememberedWeakness = 'Martingale Doubling';
  else if (state.autoSpinRounds >= 4 || state.spinSpeedMultiplier >= 6) rememberedWeakness = 'Hyper-Speed Auto-Spin';
  else if (state.superstitionScore >= 55) rememberedWeakness = 'Toggle & Timing Rituals';
  else if (outcome === 'PLAYER_ESCAPED_PROFIT') rememberedWeakness = `Early Profit Sniper (+${avgEscapeProfitPct.toFixed(0)}%)`;
  else if (outcome === 'HOUSE_WIPED_PLAYER') rememberedWeakness = 'Refusal to Cash Out';

  const nextMemory: HouseMemory = {
    sessionsObserved: nextSessions,
    playerEscapes: nextEscapes,
    playerWipes: nextWipes,
    totalHouseLifetimeProfit,
    avgEscapeProfitPct,
    adaptiveWindfallTriggerPct,
    rememberedWeakness,
  };

  const thoughtMsg =
    outcome === 'PLAYER_ESCAPED_PROFIT'
      ? `Player walked away with +$${netPlayerProfit.toFixed(2)} profit! House Memory tightened future Windfall Lock to +${adaptiveWindfallTriggerPct.toFixed(0)}%.`
      : outcome === 'HOUSE_WIPED_PLAYER'
      ? `Player wiped out ($0). House Vault locks in +$${state.sessionBuyInTotal.toFixed(2)} total extraction.`
      : `Player cut losses and walked with $${currentBalance.toFixed(2)} (House kept +$${Math.abs(
          netPlayerProfit
        ).toFixed(2)}).`;

  return {
    record,
    nextState: {
      ...state,
      memory: nextMemory,
      cashOutHistory: [record, ...state.cashOutHistory].slice(0, 12),
      thoughts: [
        ...state.thoughts.slice(-19),
        {
          id: `hm-co-${now}`,
          timestamp: now,
          phase: state.phase,
          tag: outcome === 'PLAYER_ESCAPED_PROFIT' ? 'PLAYER ESCAPED' : 'VAULT SETTLED',
          message: thoughtMsg,
        },
      ],
    },
  };
}

export const HOUSE_PERSONALITY_META: Record<
  HousePersonality,
  { label: string; shortLabel: string; summary: string; accentClass: string }
> = {
  CASINO_FLOOR: {
    label: 'Vegas / Macau Floor',
    shortLabel: 'Vegas Floor',
    summary: 'Balanced Honeymoon Hook, patient Slow Bleed & calibrated Anti-Quit Lifelines.',
    accentClass: 'text-[#ECCB63]',
  },
  SHARK_PIT: {
    label: 'Predatory Shark Pit',
    shortLabel: 'Shark Pit',
    summary: 'Tight +10% Windfall Lock, ruthless Martingale walls & deep -32% peak harvest pressure.',
    accentClass: 'text-rose-400',
  },
  PSYCHOLOGIST: {
    label: 'Dopamine Psychologist',
    shortLabel: 'Psychologist',
    summary: 'Maximizes Losses Disguised as Wins (LDW), near-miss stings & extended Bait-Theory traps.',
    accentClass: 'text-sky-300',
  },
};

export const HOUSE_PHASE_META: Record<
  HousePhase,
  { label: string; colorClass: string; badgeBg: string; summary: string }
> = {
  HONEYMOON_HOOK: {
    label: 'Honeymoon Hook',
    colorClass: 'text-emerald-400',
    badgeBg: 'border-emerald-500/40 bg-emerald-950/40',
    summary: 'Warming up bankroll & mapping your tap cadence',
  },
  BAIT_THEORY: {
    label: 'Baiting Your Theory',
    colorClass: 'text-amber-300',
    badgeBg: 'border-amber-500/40 bg-amber-950/40',
    summary: 'Feeding false confirmation to your timing/toggle ritual',
  },
  SLOW_BLEED: {
    label: 'Slow Bleed',
    colorClass: 'text-[#ECCB63]',
    badgeBg: 'border-[#D4AF37]/40 bg-[#231B09]',
    summary: 'Steady house edge with agonizing near-misses',
  },
  LIFELINE_TEASE: {
    label: 'Anti-Quit Lifeline',
    colorClass: 'text-sky-300',
    badgeBg: 'border-sky-500/40 bg-sky-950/40',
    summary: 'High quit-risk detected — injecting hope to keep you playing',
  },
  PREDATOR_HARVEST: {
    label: 'Predator Harvest',
    colorClass: 'text-rose-400',
    badgeBg: 'border-rose-500/50 bg-rose-950/50',
    summary: 'Actively hunting profits & exploiting detected patterns',
  },
};

export const BALANCE_SCENARIO_LABELS: Record<BalanceScenario, string> = {
  OPENING_WARMUP: 'Opening Warmup',
  WINDFALL_LOCK: 'Windfall Profit Lock',
  REVENGE_HARVEST: 'Comeback Revenge Harvest',
  EVEN_GRIND: 'Break-Even Grind',
  SURVIVAL_LIFELINE: 'Survival Lifeline Zone',
  DEEP_BLEED: 'Deep Drawdown Bleed',
  BANKRUPT_CHECKMATE: 'Vault Drained ($0)',
};

export const BET_PATTERN_LABELS: Record<BetChangePattern, string> = {
  STEADY: 'Steady Sizing',
  MARTINGALE_CHASE: 'Martingale Doubling',
  PRESS_WIN: 'Press-the-Win Spike',
  PROBE_AND_SPIKE: 'Probe & Heavy Spike',
  ALL_IN_SHOVE: 'All-In Desperation',
  MICRO_TAP: 'Micro-Bet Probing',
};

/* =============== OFFLINE MONTE CARLO REALISTIC BATTLE SIMULATOR =============== */

export type BattleStrategyId =
  | 'steady'
  | 'martingale'
  | 'hit_and_run'
  | 'hyper_auto'
  | 'ritual_toggler'
  | 'entropy_ghost';

export interface RealisticBattleSimSummary {
  strategy: BattleStrategyId;
  personality: HousePersonality;
  label: string;
  sessionsSimulated: number;
  maxRoundsPerSession: number;
  bankruptRatePct: number;
  escapedProfitPct: number;
  avgFinalBalance: number;
  avgPeakBalance: number;
  avgHouseExtraction: number;
  avgActiveTheories: number;
  avgRoundsSurvived: number;
  ldwRatePct: number;
  dominantTactic: HouseTacticId;
}

/**
 * Runs a 100% offline Monte Carlo battle simulation pitting a player strategy
 * directly against the real House Mind adversarial state machine & personality.
 */
export function runRealisticBattleSimulation(
  strategy: BattleStrategyId,
  options?: {
    sessions?: number;
    maxRounds?: number;
    startingBalance?: number;
    baseBet?: number;
    personality?: HousePersonality;
    rng?: () => number;
  }
): RealisticBattleSimSummary {
  const sessions = Math.min(60, Math.max(5, options?.sessions ?? 25));
  const maxRounds = Math.min(180, Math.max(20, options?.maxRounds ?? 100));
  const startBal = Math.max(100, options?.startingBalance ?? 1000);
  const baseBet = Math.max(5, options?.baseBet ?? 25);
  const personality: HousePersonality = options?.personality ?? 'CASINO_FLOOR';
  const rng = options?.rng ?? Math.random;

  const LABELS: Record<BattleStrategyId, string> = {
    steady: 'Steady Grinder ($25 flat)',
    martingale: 'Martingale Loss-Doubler',
    hit_and_run: 'Hit-and-Run Sniper (+25% exit)',
    hyper_auto: 'Hyper-Speed 8x Auto-Spin',
    ritual_toggler: 'Superstitious Toggler + Spike',
    entropy_ghost: 'High-Entropy Pro (+20% / -35% stop)',
  };

  let bankruptCount = 0;
  let profitEscapeCount = 0;
  let totalFinal = 0;
  let totalPeak = 0;
  let totalHouseProfit = 0;
  let totalTheories = 0;
  let totalRounds = 0;
  let totalLdwRate = 0;
  const tacticCounts: Record<HouseTacticId, number> = {
    VOLATILITY_STARVE: 0,
    MICRO_WIN_DRIP: 0,
    FALSE_PATTERN_BAIT: 0,
    PRESSURE_HARVEST: 0,
  };

  for (let s = 0; s < sessions; s++) {
    let bal = startBal;
    let peak = startBal;
    let hm = createInitialHouseMindState(startBal, 10000 + s * 500000, undefined, personality);
    let bet = baseBet;
    let dryStreak = 0;
    let winStreak = 0;
    let totalWagered = 0;
    let clock = 12000 + s * 500000;
    let roundsPlayed = 0;

    if (strategy === 'hyper_auto') {
      hm = recordHouseRitualSignal(hm, {
        type: 'SPEED_CHANGE',
        gameId: 'slots',
        detail: 'Slots Speed 8x',
        spinSpeedMultiplier: 8,
        now: clock,
      });
      hm = recordHouseRitualSignal(hm, {
        type: 'AUTO_TOGGLE',
        gameId: 'slots',
        detail: 'Slots Auto-Spin ON',
        autoSpinActive: true,
        now: clock + 500,
      });
    }

    for (let r = 0; r < maxRounds; r++) {
      if (bal < 5) break;
      if (strategy === 'hit_and_run' && bal >= startBal * 1.25) break;
      if (strategy === 'entropy_ghost' && (bal >= startBal * 1.2 || bal <= startBal * 0.65)) break;

      if (strategy === 'ritual_toggler' && r > 0 && r % 5 === 0) {
        hm = recordHouseRitualSignal(hm, {
          type: r % 10 === 0 ? 'TURBO_TOGGLE' : 'AUDIO_TOGGLE',
          gameId: 'slots',
          detail: r % 10 === 0 ? 'Turbo toggled' : 'Audio toggled',
          turboActive: r % 10 === 0,
          now: clock + 120,
        });
      }

      const wager = Math.min(bal, Math.max(5, Math.round(bet)));
      const balanceBefore = bal;
      bal -= wager;
      totalWagered += wager;
      roundsPlayed += 1;

      // Outcome driven by House Mind adversarialWinBias + LDW micro-hit injection
      const effectiveWinProb = Math.min(0.64, Math.max(0.24, 0.485 + hm.adversarialWinBias * 0.55));
      const roll = rng();
      const won = roll < effectiveWinProb;
      let payout = 0;
      if (won) {
        payout = Number((wager * 1.98).toFixed(2));
      } else if (hm.ldwIntensity > 0 && rng() < hm.ldwIntensity * 0.5) {
        // Simulated Loss Disguised as Win (0.35x-0.65x partial payout)
        payout = Number((wager * (0.35 + rng() * 0.3)).toFixed(2));
      }
      bal = Number((bal + payout).toFixed(2));
      if (bal > peak) peak = bal;

      const netWon = payout > wager;
      if (netWon) {
        winStreak += 1;
        dryStreak = 0;
      } else {
        dryStreak += 1;
        winStreak = 0;
      }

      const reactionMs =
        strategy === 'hyper_auto'
          ? 620
          : strategy === 'martingale'
          ? 1350
          : strategy === 'ritual_toggler'
          ? r % 2 === 0
            ? 850
            : 4400
          : strategy === 'entropy_ghost'
          ? Math.round(650 + rng() * 9800)
          : Math.round(1400 + rng() * 2400);
      clock += reactionMs;

      hm = updateHouseMindAfterRound(hm, {
        gameId: strategy === 'hyper_auto' || strategy === 'ritual_toggler' ? 'slots' : 'coinflip',
        bet: wager,
        payout,
        balanceBefore,
        balanceAfter: bal,
        reactionMs,
        dryStreak,
        winStreak,
        avgBet: totalWagered / roundsPlayed,
        turboActive: strategy === 'hyper_auto',
        autoSpinActive: strategy === 'hyper_auto',
        spinSpeedMultiplier: strategy === 'hyper_auto' ? 8 : 1,
        now: clock,
      });
      tacticCounts[hm.activeTactic] += 1;

      if (strategy === 'martingale') {
        bet = netWon ? baseBet : Math.min(startBal * 0.5, bet * 2);
      } else if (strategy === 'ritual_toggler') {
        bet = r % 5 === 0 ? baseBet * 2.4 : baseBet;
      } else if (strategy === 'entropy_ghost') {
        bet = Math.max(10, Math.round(baseBet * (0.85 + rng() * 0.3)));
      } else {
        bet = baseBet;
      }
    }

    if (bal < 5) bankruptCount += 1;
    if (bal > startBal) profitEscapeCount += 1;
    totalFinal += bal;
    totalPeak += peak;
    totalHouseProfit += startBal - bal;
    totalTheories += hm.activeTheoriesCount;
    totalRounds += roundsPlayed;
    totalLdwRate += hm.ldwRatePct;
  }

  let dominantTactic: HouseTacticId = 'VOLATILITY_STARVE';
  let maxTacticPulls = -1;
  for (const [tid, count] of Object.entries(tacticCounts) as Array<[HouseTacticId, number]>) {
    if (count > maxTacticPulls) {
      maxTacticPulls = count;
      dominantTactic = tid;
    }
  }

  return {
    strategy,
    personality,
    label: LABELS[strategy],
    sessionsSimulated: sessions,
    maxRoundsPerSession: maxRounds,
    bankruptRatePct: Number(((bankruptCount / sessions) * 100).toFixed(1)),
    escapedProfitPct: Number(((profitEscapeCount / sessions) * 100).toFixed(1)),
    avgFinalBalance: Number((totalFinal / sessions).toFixed(2)),
    avgPeakBalance: Number((totalPeak / sessions).toFixed(2)),
    avgHouseExtraction: Number((totalHouseProfit / sessions).toFixed(2)),
    avgActiveTheories: Number((totalTheories / sessions).toFixed(1)),
    avgRoundsSurvived: Number((totalRounds / sessions).toFixed(1)),
    ldwRatePct: Number((totalLdwRate / sessions).toFixed(1)),
    dominantTactic,
  };
}

/**
 * Benchmarks all 6 player archetypes side-by-side against the selected House Personality (100% offline).
 */
export function runAllStrategiesBenchmark(
  personality: HousePersonality = 'CASINO_FLOOR',
  options?: { sessions?: number; maxRounds?: number; rng?: () => number }
): RealisticBattleSimSummary[] {
  const all: BattleStrategyId[] = [
    'steady',
    'martingale',
    'hit_and_run',
    'hyper_auto',
    'ritual_toggler',
    'entropy_ghost',
  ];
  return all.map((strategy) =>
    runRealisticBattleSimulation(strategy, {
      sessions: options?.sessions ?? 18,
      maxRounds: options?.maxRounds ?? 90,
      personality,
      rng: options?.rng,
    })
  );
}
