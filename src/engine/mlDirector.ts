export type DirectorMode = 'off' | 'balanced' | 'adaptive_ml' | 'dopamine_max';

export type BanditArmId =
  | 'FLOW_DRIP'
  | 'TEASE_BUILD'
  | 'COMEBACK_SURGE'
  | 'HOT_STREAK'
  | 'JACKPOT_SPIKE';

export interface BanditArmStats {
  id: BanditArmId;
  label: string;
  description: string;
  alpha: number; // Beta posterior successes
  beta: number; // Beta posterior failures
  pulls: number;
  avgReward: number;
  weights: number[]; // Contextual linear weights (6 features)
  lastScore: number;
}

export interface DirectorModifiers {
  activeArm: BanditArmId;
  winBias: number; // -0.05 to +0.28 additive win/hit boost
  bonusBoost: number; // 1.0 to 2.6 multiplier on scatter/high-tier events
  nearMissRate: number; // 0.0 to 0.55 anticipation tease probability
  cascadeBoost: number; // 0.0 to 0.35 extra tumble continuity
  pityActive: boolean;
  comebackActive: boolean;
  markovState: 'COLD' | 'NEUTRAL' | 'WARM' | 'FEVER';
  expectedRtp: number; // Displayed live target RTP %
}

export interface RoundTelemetry {
  id: string;
  timestamp: number;
  gameId: string;
  bet: number;
  payout: number;
  net: number;
  multiplier: number;
  balanceAfter: number;
  armUsed: BanditArmId;
  dopamineIndex: number;
  rpe: number; // Reward Prediction Error (-1 to +2)
  wasNearMiss: boolean;
}

export interface DirectorState {
  mode: DirectorMode;
  targetRtp: number; // 96 to 112 (%)
  pityThreshold: number; // Dry spins before pity kicks in
  volatility: 'low' | 'medium' | 'high';
  dryStreak: number;
  winStreak: number;
  markovState: 'COLD' | 'NEUTRAL' | 'WARM' | 'FEVER';
  buyIn: number;
  peakBalance: number;
  totalWagered: number;
  totalReturned: number;
  roundsPlayed: number;
  dopamineIndex: number; // 0 to 100
  engagementScore: number; // 0 to 100
  lastRoundAt: number;
  avgCadenceSec: number;
  activeArm: BanditArmId;
  arms: Record<BanditArmId, BanditArmStats>;
  history: RoundTelemetry[];
}

export interface RelicBonuses {
  cascadeStartBonus: number; // e.g., +1x starting cascade
  pityReduction: number; // reduces dryStreak threshold
  scatterBoost: number; // additive scatter boost
  cashbackRate: number; // % returned on bust rounds
}

const ARM_DEFINITIONS: Array<{
  id: BanditArmId;
  label: string;
  description: string;
  initWeights: number[];
}> = [
  {
    id: 'FLOW_DRIP',
    label: 'Flow Drip',
    description: 'Frequent modest hits to stabilize rhythm and prevent boredom.',
    initWeights: [0.35, 0.1, 0.25, 0.15, 0.2, 0.1],
  },
  {
    id: 'TEASE_BUILD',
    label: 'Anticipation Tease',
    description: 'Elevated near-misses and scatter slow-downs to spike anticipation.',
    initWeights: [0.2, 0.3, 0.15, 0.25, 0.35, 0.25],
  },
  {
    id: 'COMEBACK_SURGE',
    label: 'Comeback Rubber-Band',
    description: 'Protective surge triggered when bankroll dips into danger territory.',
    initWeights: [-0.65, 0.45, -0.3, 0.15, 0.1, -0.2],
  },
  {
    id: 'HOT_STREAK',
    label: 'Markov Fever Chain',
    description: 'Escalates consecutive wins and tumbling multipliers during warm states.',
    initWeights: [0.15, -0.1, 0.5, 0.35, 0.3, 0.4],
  },
  {
    id: 'JACKPOT_SPIKE',
    label: 'Jackpot Spike',
    description: 'High-variance breakthrough window after sustained tension or pity build.',
    initWeights: [-0.15, 0.65, -0.2, 0.4, 0.25, -0.15],
  },
];

export function createInitialDirectorState(
  buyIn = 1000,
  mode: DirectorMode = 'adaptive_ml'
): DirectorState {
  const arms = {} as Record<BanditArmId, BanditArmStats>;
  for (const def of ARM_DEFINITIONS) {
    arms[def.id] = {
      id: def.id,
      label: def.label,
      description: def.description,
      alpha: 2.0,
      beta: 2.0,
      pulls: 0,
      avgReward: 0.5,
      weights: [...def.initWeights],
      lastScore: 0.5,
    };
  }

  return {
    mode,
    targetRtp: 102.5,
    pityThreshold: 5,
    volatility: 'medium',
    dryStreak: 0,
    winStreak: 0,
    markovState: 'NEUTRAL',
    buyIn: Math.max(10, buyIn),
    peakBalance: Math.max(10, buyIn),
    totalWagered: 0,
    totalReturned: 0,
    roundsPlayed: 0,
    dopamineIndex: 58,
    engagementScore: 62,
    lastRoundAt: 0,
    avgCadenceSec: 3.5,
    activeArm: 'FLOW_DRIP',
    arms,
    history: [],
  };
}

/**
 * Sample standard normal via Box-Muller transform for Thompson Sampling approximation.
 */
function sampleNormal(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Approximate Beta(alpha, beta) sample using Normal approximation clamped to [0.02, 0.98]
 * (fast, deterministic-friendly, zero external dependencies).
 */
export function sampleBetaApprox(alpha: number, beta: number, rng: () => number = Math.random): number {
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const std = Math.sqrt(Math.max(1e-6, variance));
  const raw = mean + sampleNormal(rng) * std;
  return Math.min(0.98, Math.max(0.02, raw));
}

/**
 * Extract 6-dimensional normalized contextual feature vector from live player state:
 * [0] bankrollRatio: clamp(balance / buyIn, 0, 2) - 1  (-1 = broke, 0 = even, +1 = 2x up)
 * [1] dryPressure: clamp(dryStreak / pityThreshold, 0, 2)
 * [2] recentWinRate: rolling 12-round hit rate (0..1)
 * [3] betIntensity: clamp(bet / max(1, balance), 0, 1)
 * [4] cadenceEnergy: fast clicking = higher arousal (0..1)
 * [5] dopamineLevel: dopamineIndex / 100 (0..1)
 */
export function extractContextFeatures(
  state: DirectorState,
  balance: number,
  bet: number
): number[] {
  const bankrollRatio = Math.min(2, Math.max(0, balance / Math.max(1, state.buyIn))) - 1;
  const dryPressure = Math.min(2, state.dryStreak / Math.max(1, state.pityThreshold));
  const recent = state.history.slice(-12);
  const recentWinRate =
    recent.length === 0
      ? 0.42
      : recent.filter((r) => r.payout > 0).length / recent.length;
  const betIntensity = Math.min(1, Math.max(0, bet / Math.max(1, balance)));
  const cadenceEnergy = Math.min(1, Math.max(0.1, 1 - state.avgCadenceSec / 12));
  const dopamineLevel = state.dopamineIndex / 100;

  return [
    bankrollRatio,
    dryPressure,
    recentWinRate,
    betIntensity,
    cadenceEnergy,
    dopamineLevel,
  ];
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Selects optimal manipulation arm using hybrid Contextual LinUCB + Thompson Sampling
 * and computes live probability modifiers for any casino game.
 */
export function computeDirectorModifiers(
  state: DirectorState,
  balance: number,
  bet: number,
  relics: RelicBonuses = { cascadeStartBonus: 0, pityReduction: 0, scatterBoost: 0, cashbackRate: 0 },
  rng: () => number = Math.random
): { modifiers: DirectorModifiers; scoredArms: Record<BanditArmId, number> } {
  const scoredArms = {} as Record<BanditArmId, number>;

  if (state.mode === 'off') {
    for (const id of Object.keys(state.arms) as BanditArmId[]) {
      scoredArms[id] = 0;
    }
    return {
      modifiers: {
        activeArm: 'FLOW_DRIP',
        winBias: 0,
        bonusBoost: 1 + relics.scatterBoost,
        nearMissRate: 0.08,
        cascadeBoost: 0,
        pityActive: false,
        comebackActive: false,
        markovState: 'NEUTRAL',
        expectedRtp: 96.2,
      },
      scoredArms,
    };
  }

  const features = extractContextFeatures(state, balance, bet);
  const effectivePityThreshold = Math.max(2, state.pityThreshold - relics.pityReduction);
  const pityActive = state.dryStreak >= effectivePityThreshold;
  const lowBankrollRatio = balance / Math.max(1, Math.max(state.buyIn, state.peakBalance * 0.75));
  const comebackActive = lowBankrollRatio <= 0.22 && balance > 0;

  let bestArm: BanditArmId = 'FLOW_DRIP';
  let bestScore = -Infinity;

  const armIds = Object.keys(state.arms) as BanditArmId[];
  for (const id of armIds) {
    const arm = state.arms[id];
    const tsSample = sampleBetaApprox(arm.alpha, arm.beta, rng);
    const contextSignal = Math.tanh(dot(arm.weights, features));
    const ucbExploration = Math.sqrt(Math.log(state.roundsPlayed + 2) / (arm.pulls + 1)) * 0.14;

    let heuristicNudge = 0;
    if (comebackActive && id === 'COMEBACK_SURGE') heuristicNudge += 0.42;
    if (pityActive && id === 'JACKPOT_SPIKE') heuristicNudge += 0.36;
    if (state.markovState === 'FEVER' && id === 'HOT_STREAK') heuristicNudge += 0.25;
    if (state.mode === 'dopamine_max' && (id === 'TEASE_BUILD' || id === 'JACKPOT_SPIKE')) {
      heuristicNudge += 0.12;
    }

    const score = 0.48 * tsSample + 0.38 * ((contextSignal + 1) / 2) + ucbExploration + heuristicNudge;
    scoredArms[id] = Number(score.toFixed(4));
    if (score > bestScore) {
      bestScore = score;
      bestArm = id;
    }
  }

  const modeScale =
    state.mode === 'balanced' ? 0.55 : state.mode === 'adaptive_ml' ? 1.0 : 1.35;
  const volBonusScale =
    state.volatility === 'low' ? 0.85 : state.volatility === 'medium' ? 1.0 : 1.28;
  const rtpDelta = (state.targetRtp - 96.5) / 100; // e.g., +0.06 for 102.5%

  let winBias = rtpDelta * 0.55;
  let bonusBoost = 1.0 + relics.scatterBoost;
  let nearMissRate = 0.22;
  let cascadeBoost = 0.08;

  switch (bestArm) {
    case 'FLOW_DRIP':
      winBias += 0.08 * modeScale;
      bonusBoost += 0.15 * modeScale;
      nearMissRate = 0.18;
      cascadeBoost = 0.12 * modeScale;
      break;
    case 'TEASE_BUILD':
      winBias += 0.03 * modeScale;
      bonusBoost += 0.35 * modeScale;
      nearMissRate = Math.min(0.55, 0.38 * modeScale);
      cascadeBoost = 0.15 * modeScale;
      break;
    case 'COMEBACK_SURGE':
      winBias += 0.17 * modeScale;
      bonusBoost += 0.55 * modeScale;
      nearMissRate = 0.25;
      cascadeBoost = 0.22 * modeScale;
      break;
    case 'HOT_STREAK':
      winBias += 0.11 * modeScale;
      bonusBoost += 0.45 * modeScale * volBonusScale;
      nearMissRate = 0.28;
      cascadeBoost = 0.28 * modeScale;
      break;
    case 'JACKPOT_SPIKE':
      winBias += 0.09 * modeScale;
      bonusBoost += 0.85 * modeScale * volBonusScale;
      nearMissRate = 0.35;
      cascadeBoost = 0.24 * modeScale;
      break;
  }

  if (pityActive) {
    const excessDry = Math.min(6, state.dryStreak - effectivePityThreshold + 1);
    winBias += 0.035 * excessDry * modeScale;
    bonusBoost += 0.2 * excessDry * modeScale;
  }

  if (comebackActive) {
    winBias += 0.07 * modeScale;
  }

  // Clamp modifiers to sensible, dramatic ranges
  winBias = Math.min(0.28, Math.max(-0.04, winBias));
  bonusBoost = Math.min(2.6, Math.max(0.85, bonusBoost));
  cascadeBoost = Math.min(0.35, Math.max(0, cascadeBoost));

  const expectedRtp = Number(
    Math.min(118, Math.max(92, state.targetRtp + (comebackActive ? 4.5 : 0) + (pityActive ? 3.2 : 0))).toFixed(1)
  );

  return {
    modifiers: {
      activeArm: bestArm,
      winBias,
      bonusBoost,
      nearMissRate,
      cascadeBoost,
      pityActive,
      comebackActive,
      markovState: state.markovState,
      expectedRtp,
    },
    scoredArms,
  };
}

/**
 * Transitions the Markov Chain thermal state based on outcome & momentum.
 */
function nextMarkovState(
  current: DirectorState['markovState'],
  won: boolean,
  multiplier: number,
  dryStreak: number,
  winStreak: number
): DirectorState['markovState'] {
  if (multiplier >= 5 || winStreak >= 3) return 'FEVER';
  if (won) {
    if (current === 'COLD') return 'NEUTRAL';
    if (current === 'NEUTRAL') return 'WARM';
    return 'FEVER';
  }
  // Lost
  if (dryStreak >= 4) return 'COLD';
  if (current === 'FEVER') return 'WARM';
  if (current === 'WARM') return 'NEUTRAL';
  return 'COLD';
}

/**
 * Updates the ML Director online after each completed round:
 * - Calculates Reward Prediction Error (RPE) & estimated Dopamine Index
 * - Updates Beta(alpha, beta) Thompson Sampling posteriors
 * - Performs online SGD update on the contextual bandit weights
 */
export function recordRoundOutcome(
  state: DirectorState,
  params: {
    gameId: string;
    bet: number;
    payout: number;
    balanceBefore: number;
    balanceAfter: number;
    armUsed: BanditArmId;
    wasNearMiss?: boolean;
    now?: number;
  }
): DirectorState {
  const now = params.now ?? Date.now();
  const net = params.payout - params.bet;
  const multiplier = params.bet > 0 ? params.payout / params.bet : 0;
  const won = params.payout > 0;
  const wasNearMiss = Boolean(params.wasNearMiss);

  const dryStreak = won ? 0 : state.dryStreak + 1;
  const winStreak = won ? state.winStreak + 1 : 0;
  const peakBalance = Math.max(state.peakBalance, params.balanceAfter);

  const deltaSec =
    state.lastRoundAt > 0 ? Math.min(30, Math.max(0.4, (now - state.lastRoundAt) / 1000)) : 3.5;
  const avgCadenceSec = state.avgCadenceSec * 0.78 + deltaSec * 0.22;

  // Compute Reward Prediction Error (RPE): surprise relative to expected ~0.95x return
  const expectedMult = 0.95;
  const rawRpe = Math.tanh((multiplier - expectedMult) * 0.55);
  const rpe = Number((wasNearMiss && !won ? Math.max(-0.15, rawRpe + 0.35) : rawRpe).toFixed(3));

  // Dopamine Index model (0-100): spikes on surprise wins, near-miss anticipation, and fever streaks;
  // dips on extended flat dry spells without teases.
  let dopamineDelta = 0;
  if (multiplier >= 10) dopamineDelta = +26;
  else if (multiplier >= 3) dopamineDelta = +16;
  else if (won) dopamineDelta = +8;
  else if (wasNearMiss) dopamineDelta = +5.5;
  else dopamineDelta = -Math.min(10, 3.2 + dryStreak * 0.9);

  // Mean reversion toward baseline 52 + momentum
  const reverted = state.dopamineIndex + (52 - state.dopamineIndex) * 0.08 + dopamineDelta;
  const dopamineIndex = Math.round(Math.min(99, Math.max(12, reverted)));

  // Engagement reward signal (0..1) used to train the contextual bandit online
  const keptAlive = params.balanceAfter > 0 ? 0.25 : 0;
  const arousalTerm = dopamineIndex / 100 * 0.45;
  const cadenceTerm = Math.min(1, 2.5 / Math.max(1, avgCadenceSec)) * 0.15;
  const surpriseTerm = Math.min(1, Math.max(0, (rpe + 1) / 2)) * 0.15;
  const banditReward = Math.min(1, Math.max(0.05, keptAlive + arousalTerm + cadenceTerm + surpriseTerm));

  const features = extractContextFeatures(state, params.balanceBefore, params.bet);
  const prevArm = state.arms[params.armUsed];
  const lr = 0.09; // online gradient step
  const pred = (Math.tanh(dot(prevArm.weights, features)) + 1) / 2;
  const error = banditReward - pred;

  const updatedWeights = prevArm.weights.map((w, idx) =>
    Number(Math.min(1.5, Math.max(-1.5, w + lr * error * features[idx])).toFixed(4))
  );

  // Exponential decay keeps posteriors adaptive to shifting play styles
  const decay = 0.985;
  const nextAlpha = prevArm.alpha * decay + banditReward;
  const nextBeta = prevArm.beta * decay + (1 - banditReward);
  const nextPulls = prevArm.pulls + 1;
  const nextAvgReward = (prevArm.avgReward * prevArm.pulls + banditReward) / nextPulls;

  const updatedArms: Record<BanditArmId, BanditArmStats> = {
    ...state.arms,
    [params.armUsed]: {
      ...prevArm,
      alpha: Number(nextAlpha.toFixed(3)),
      beta: Number(nextBeta.toFixed(3)),
      pulls: nextPulls,
      avgReward: Number(nextAvgReward.toFixed(3)),
      weights: updatedWeights,
      lastScore: Number(banditReward.toFixed(3)),
    },
  };

  const markovState = nextMarkovState(state.markovState, won, multiplier, dryStreak, winStreak);

  const entry: RoundTelemetry = {
    id: `${now}-${state.roundsPlayed + 1}`,
    timestamp: now,
    gameId: params.gameId,
    bet: Number(params.bet.toFixed(2)),
    payout: Number(params.payout.toFixed(2)),
    net: Number(net.toFixed(2)),
    multiplier: Number(multiplier.toFixed(2)),
    balanceAfter: Number(params.balanceAfter.toFixed(2)),
    armUsed: params.armUsed,
    dopamineIndex,
    rpe,
    wasNearMiss,
  };

  const engagementScore = Math.round(
    Math.min(99, Math.max(15, state.engagementScore * 0.7 + banditReward * 100 * 0.3))
  );

  return {
    ...state,
    dryStreak,
    winStreak,
    markovState,
    peakBalance,
    totalWagered: Number((state.totalWagered + params.bet).toFixed(2)),
    totalReturned: Number((state.totalReturned + params.payout).toFixed(2)),
    roundsPlayed: state.roundsPlayed + 1,
    dopamineIndex,
    engagementScore,
    lastRoundAt: now,
    avgCadenceSec: Number(avgCadenceSec.toFixed(2)),
    activeArm: params.armUsed,
    arms: updatedArms,
    history: [...state.history.slice(-119), entry],
  };
}
