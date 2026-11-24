/**
 * Progressive Sovereign Vault Jackpot & Fever Overdrive Engine (100% Offline)
 *
 * - Every settled wager feeds a live 3-tier progressive vault pool (Mini / Major / Sovereign Grand).
 * - Behavioral System 1 & System 2 signals dynamically modulate Vault Crack probability
 *   so surprise jackpot drops land at peak psychological moments (never in Strict RNG mode).
 * - Fever Overdrive meter charges on wins, streaks, and near-misses; reaching 100% triggers
 *   5 rounds of +15% Overdrive Payout Boost across every game on the floor.
 */

import type { DirectorMode } from './mlDirector';
import type { RealTimeMicroState } from './behavioralAnalyzer';

export type ProgressiveTier = 'MINI' | 'MAJOR' | 'GRAND';

export interface JackpotWinEvent {
  tier: ProgressiveTier;
  amount: number;
  label: string;
}

export interface JackpotFeverState {
  miniPool: number;
  majorPool: number;
  grandPool: number;
  totalJackpotsWon: number;
  lastJackpotWon: JackpotWinEvent | null;
  feverCharge: number; // 0 .. 100
  feverRoundsLeft: number; // > 0 means Fever Overdrive (+15% win bonus) is active
  feverActivations: number;
}

export const FEVER_BONUS_RATE = 0.15;
export const FEVER_DURATION_ROUNDS = 5;

const SEED_POOLS = {
  MINI: 250,
  MAJOR: 2500,
  GRAND: 25000,
};

export function createInitialJackpotFeverState(): JackpotFeverState {
  return {
    miniPool: 284.5,
    majorPool: 2740.0,
    grandPool: 26850.0,
    totalJackpotsWon: 0,
    lastJackpotWon: null,
    feverCharge: 22,
    feverRoundsLeft: 0,
    feverActivations: 0,
  };
}

export interface AdvanceJackpotParams {
  bet: number;
  payout: number;
  wasNearMiss?: boolean;
  directorMode: DirectorMode;
  microState: RealTimeMicroState;
  dopamineResponsiveness: number; // 0..100 from System 2
  rng?: () => number;
}

export interface AdvanceJackpotResult {
  nextState: JackpotFeverState;
  feverBonusPayout: number;
  jackpotHit: JackpotWinEvent | null;
  feverJustTriggered: boolean;
}

export function advanceJackpotAndFever(
  state: JackpotFeverState,
  params: AdvanceJackpotParams
): AdvanceJackpotResult {
  const rng = params.rng ?? Math.random;
  const bet = Math.max(0, params.bet);
  const payout = Math.max(0, params.payout);
  const isWin = payout > bet && payout > 0;
  const mult = bet > 0 ? payout / bet : 0;

  // 1. Apply Fever Overdrive (+15%) bonus if active on a winning round
  let feverBonusPayout = 0;
  let nextFeverRounds = state.feverRoundsLeft;
  let nextFeverCharge = state.feverCharge;
  let feverActivations = state.feverActivations;
  let feverJustTriggered = false;

  if (state.feverRoundsLeft > 0) {
    if (isWin) {
      feverBonusPayout = Number((payout * FEVER_BONUS_RATE).toFixed(2));
    }
    nextFeverRounds = Math.max(0, state.feverRoundsLeft - 1);
    if (nextFeverRounds === 0) {
      nextFeverCharge = 12; // warm post-fever residual charge
    }
  } else {
    // Charge Fever Gauge on wins, big multipliers, and high-tension near-misses
    let delta = 4; // baseline play momentum
    if (isWin) {
      delta += mult >= 5 ? 30 : mult >= 2 ? 22 : 16;
    } else if (params.wasNearMiss) {
      delta += 14;
    } else {
      delta += 5;
    }
    if (params.directorMode === 'dopamine_max') {
      delta = Math.round(delta * 1.25);
    }
    nextFeverCharge = Math.min(100, state.feverCharge + delta);
    if (nextFeverCharge >= 100) {
      nextFeverCharge = 100;
      nextFeverRounds = FEVER_DURATION_ROUNDS;
      feverActivations += 1;
      feverJustTriggered = true;
    }
  }

  // 2. Grow 3-tier progressive vault pools from wager contribution
  let miniPool = Number((state.miniPool + Math.max(0.35, bet * 0.032)).toFixed(2));
  let majorPool = Number((state.majorPool + Math.max(0.65, bet * 0.024)).toFixed(2));
  let grandPool = Number((state.grandPool + Math.max(1.25, bet * 0.018)).toFixed(2));

  // 3. Roll Progressive Vault Crack chance
  let jackpotHit: JackpotWinEvent | null = null;
  if (bet >= 5) {
    // Base per-round drop chance scales gently with wager size
    const wagerFactor = Math.min(2.6, 0.7 + Math.log10(Math.max(10, bet)) * 0.65);
    let behavioralBoost = 1.0;

    if (params.directorMode !== 'off') {
      if (params.directorMode === 'dopamine_max') behavioralBoost *= 1.45;
      if (
        params.microState === 'RELOAD_WELCOME' ||
        params.microState === 'BAILOUT_RISK' ||
        params.microState === 'TILT_CHASE'
      ) {
        behavioralBoost *= 1.65;
      } else if (params.microState === 'FATIGUE_DRIFT') {
        behavioralBoost *= 1.4;
      }
      if (params.dopamineResponsiveness >= 70) {
        behavioralBoost *= 1.15;
      }
    }

    const roll = rng();
    const grandChance = 0.00025 * wagerFactor * behavioralBoost;
    const majorChance = 0.0018 * wagerFactor * behavioralBoost;
    const miniChance = 0.0095 * wagerFactor * behavioralBoost;

    if (roll < grandChance) {
      jackpotHit = {
        tier: 'GRAND',
        amount: grandPool,
        label: 'SOVEREIGN GRAND VAULT JACKPOT',
      };
      grandPool = SEED_POOLS.GRAND;
    } else if (roll < grandChance + majorChance) {
      jackpotHit = {
        tier: 'MAJOR',
        amount: majorPool,
        label: 'MAJOR VAULT PROGRESSIVE',
      };
      majorPool = SEED_POOLS.MAJOR;
    } else if (roll < grandChance + majorChance + miniChance) {
      jackpotHit = {
        tier: 'MINI',
        amount: miniPool,
        label: 'MINI VAULT PROGRESSIVE',
      };
      miniPool = SEED_POOLS.MINI;
    }
  }

  return {
    nextState: {
      miniPool,
      majorPool,
      grandPool,
      totalJackpotsWon: state.totalJackpotsWon + (jackpotHit ? 1 : 0),
      lastJackpotWon: jackpotHit ?? state.lastJackpotWon,
      feverCharge: nextFeverCharge,
      feverRoundsLeft: nextFeverRounds,
      feverActivations,
    },
    feverBonusPayout,
    jackpotHit,
    feverJustTriggered,
  };
}
