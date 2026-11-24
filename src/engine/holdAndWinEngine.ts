/**
 * Sovereign Hold & Win — Pure Vault Lock Respin Math Engine (100% Offline)
 *
 * Original high-dopamine 5x3 (15-cell) Vault Lock mechanic:
 * - Standard spin evaluates a 5x3 grid of Coins, Collectors, Multipliers, and Jackpot Orbs.
 * - Landing 4+ Vault Orbs triggers VAULT LOCK RESPIN MODE (starts with 3 respins).
 * - Players can also trigger an instant Vault Feature Entry (12x stake) for immediate bonus thrills.
 * - In Hold & Win mode, every locked orb stays pinned; any new orb resets respins to 3:
 *     * COIN: cash multiplier (1x .. 20x)
 *     * MULTIPLIER: boosts ALL existing coins on the board (+1x .. +3x each) and locks as 2x
 *     * COLLECTOR: absorbs the sum of ALL current coins on the board into one massive orb!
 *     * JACKPOT_MINI (25x), JACKPOT_MAJOR (75x), JACKPOT_GRAND (250x)
 * - Filling all 15/15 Vault cells awards an extra +100x FULL VAULT CRACK bonus!
 */

import type { DirectorModifiers } from './mlDirector';

export type VaultCellKind =
  | 'EMPTY'
  | 'COIN'
  | 'COLLECTOR'
  | 'MULTIPLIER'
  | 'MINI'
  | 'MAJOR'
  | 'GRAND';

export interface VaultOrb {
  id: string;
  kind: Exclude<VaultCellKind, 'EMPTY'>;
  value: number; // multiplier value in x-bet (e.g., 5 = 5x bet)
  boostValue?: number; // for MULTIPLIER orbs (+1x .. +3x applied to board)
  newlyLanded?: boolean;
}

export interface HoldWinState {
  phase: 'IDLE' | 'RESPINNING' | 'COMPLETED';
  bet: number;
  cells: Array<VaultOrb | null>; // length 15 (5 cols x 3 rows)
  respinsLeft: number;
  spinCount: number;
  totalMultiplier: number;
  fullBoardBonus: boolean;
  lastStepEvents: string[];
  collectorSourceIndices: number[]; // indices absorbed by collector on latest spin (for Canvas beam FX)
  collectorTargetIndex: number | null;
}

export const FULL_VAULT_BONUS_MULT = 100;

let orbCounter = 1;

function nextOrbId(): string {
  orbCounter += 1;
  return `orb-${orbCounter}`;
}

export function createEmptyHoldWinState(bet = 25): HoldWinState {
  return {
    phase: 'IDLE',
    bet,
    cells: new Array(15).fill(null),
    respinsLeft: 0,
    spinCount: 0,
    totalMultiplier: 0,
    fullBoardBonus: false,
    lastStepEvents: [],
    collectorSourceIndices: [],
    collectorTargetIndex: null,
  };
}

function rollOrbKind(
  modifiers: DirectorModifiers,
  inBonus: boolean,
  rng: () => number
): VaultOrb {
  const bonusFactor = Math.max(0.8, modifiers.bonusBoost);
  const r = rng();

  if (inBonus) {
    if (r < 0.012 * bonusFactor) {
      return { id: nextOrbId(), kind: 'GRAND', value: 250, newlyLanded: true };
    }
    if (r < 0.045 * bonusFactor) {
      return { id: nextOrbId(), kind: 'MAJOR', value: 75, newlyLanded: true };
    }
    if (r < 0.12 * bonusFactor) {
      return { id: nextOrbId(), kind: 'MINI', value: 25, newlyLanded: true };
    }
    if (r < 0.21 * bonusFactor) {
      return { id: nextOrbId(), kind: 'COLLECTOR', value: 0, newlyLanded: true };
    }
    if (r < 0.31 * bonusFactor) {
      const boost = rng() < 0.3 ? 3 : rng() < 0.65 ? 2 : 1;
      return { id: nextOrbId(), kind: 'MULTIPLIER', value: 2, boostValue: boost, newlyLanded: true };
    }
  } else {
    if (r < 0.03 * bonusFactor) {
      return { id: nextOrbId(), kind: 'MINI', value: 25, newlyLanded: true };
    }
    if (r < 0.08 * bonusFactor) {
      return { id: nextOrbId(), kind: 'MULTIPLIER', value: 2, boostValue: 1, newlyLanded: true };
    }
  }

  // Weighted gold coin values
  const cv = rng();
  const value =
    cv < 0.38
      ? 1
      : cv < 0.66
      ? 2
      : cv < 0.84
      ? 3
      : cv < 0.94
      ? 5
      : cv < 0.985
      ? 10
      : 20;

  return { id: nextOrbId(), kind: 'COIN', value, newlyLanded: true };
}

export function sumBoardMultiplier(cells: Array<VaultOrb | null>): number {
  return Number(
    cells.reduce((acc, c) => acc + (c ? c.value : 0), 0).toFixed(2)
  );
}

/**
 * Resolves a base-game spin on the 5x3 Vault Matrix.
 * - 4+ orbs locks the board and enters VAULT LOCK RESPIN MODE (3 respins).
 * - 1..3 orbs pays instant scatter coin value (0.5x per orb + coin face for 3 orbs).
 * - Pass `forceBonus = true` for direct Vault Feature Buy-In (guarantees 5 starting orbs).
 */
export function resolveHoldWinBaseSpin(
  bet: number,
  modifiers: DirectorModifiers,
  options: { forceBonus?: boolean; rng?: () => number } = {}
): {
  state: HoldWinState;
  enteredBonus: boolean;
  instantPayout: number;
  wasNearMiss: boolean;
} {
  const rng = options.rng ?? Math.random;
  const cells: Array<VaultOrb | null> = new Array(15).fill(null);

  if (options.forceBonus) {
    // Place 5 guaranteed opening orbs at random slots
    const slots = Array.from({ length: 15 }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const count = 5 + (rng() < 0.35 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      cells[slots[k]] = rollOrbKind(modifiers, false, rng);
    }
    const totalMult = sumBoardMultiplier(cells);
    return {
      state: {
        phase: 'RESPINNING',
        bet,
        cells,
        respinsLeft: 3,
        spinCount: 0,
        totalMultiplier: totalMult,
        fullBoardBonus: false,
        lastStepEvents: [`Vault Lock Activated with ${count} opening Gold Orbs!`],
        collectorSourceIndices: [],
        collectorTargetIndex: null,
      },
      enteredBonus: true,
      instantPayout: 0,
      wasNearMiss: false,
    };
  }

  // Base spin per-cell orb chance (~16.5% baseline + bidirectional ML Director / House Mind bias)
  const cellProb = Math.max(
    0.09,
    Math.min(
      0.34,
      0.165 + modifiers.winBias * 0.36 + (modifiers.pityActive ? 0.07 : 0)
    )
  );

  let orbCount = 0;
  for (let i = 0; i < 15; i++) {
    if (rng() < cellProb) {
      cells[i] = rollOrbKind(modifiers, false, rng);
      orbCount += 1;
    }
  }

  // Anticipation tease: if nearMissRate fires when 2 orbs landed, bump to 3 (one shy of Vault Lock!)
  if (orbCount === 2 && rng() < modifiers.nearMissRate * 1.4) {
    const emptyIdx = cells.findIndex((c) => c === null);
    if (emptyIdx >= 0) {
      cells[emptyIdx] = rollOrbKind(modifiers, false, rng);
      orbCount = 3;
    }
  }

  if (orbCount >= 4) {
    const totalMult = sumBoardMultiplier(cells);
    return {
      state: {
        phase: 'RESPINNING',
        bet,
        cells,
        respinsLeft: 3,
        spinCount: 0,
        totalMultiplier: totalMult,
        fullBoardBonus: false,
        lastStepEvents: [`${orbCount} Vault Orbs locked! 3 Respins awarded.`],
        collectorSourceIndices: [],
        collectorTargetIndex: null,
      },
      enteredBonus: true,
      instantPayout: 0,
      wasNearMiss: false,
    };
  }

  // Instant base-game payout for 2 or 3 orbs (keeps rhythm engaging between bonuses)
  const rawSum = sumBoardMultiplier(cells);
  const instantMult = orbCount === 3 ? Number((rawSum * 0.45).toFixed(2)) : orbCount === 2 ? Number((rawSum * 0.25).toFixed(2)) : 0;
  const instantPayout = Number((bet * instantMult).toFixed(2));
  const wasNearMiss = orbCount === 3;

  return {
    state: {
      phase: 'IDLE',
      bet,
      cells,
      respinsLeft: 0,
      spinCount: 0,
      totalMultiplier: instantMult,
      fullBoardBonus: false,
      lastStepEvents:
        orbCount === 3
          ? [`3 Orbs landed — 1 shy of Vault Lock! Instant coin pay $${instantPayout.toFixed(2)}.`]
          : instantPayout > 0
          ? [`${orbCount} Gold Orbs paid $${instantPayout.toFixed(2)}.`]
          : ['Vault chambers spinning — land 4+ Gold Orbs to trigger Vault Lock.'],
      collectorSourceIndices: [],
      collectorTargetIndex: null,
    },
    enteredBonus: false,
    instantPayout,
    wasNearMiss,
  };
}

/**
 * Advances one Respin inside VAULT LOCK BONUS mode.
 * Returns updated HoldWinState + final payout if completed.
 */
export function stepHoldWinRespin(
  state: HoldWinState,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): { nextState: HoldWinState; landedCount: number; finished: boolean; finalPayout: number } {
  if (state.phase !== 'RESPINNING') {
    return {
      nextState: state,
      landedCount: 0,
      finished: true,
      finalPayout: Number((state.bet * state.totalMultiplier).toFixed(2)),
    };
  }

  // Clear previous newlyLanded flags
  const nextCells: Array<VaultOrb | null> = state.cells.map((c) =>
    c ? { ...c, newlyLanded: false } : null
  );

  const emptyIndices = nextCells
    .map((c, idx) => (c === null ? idx : -1))
    .filter((idx) => idx >= 0);

  if (emptyIndices.length === 0) {
    const finalTotal = Number((sumBoardMultiplier(nextCells) + FULL_VAULT_BONUS_MULT).toFixed(2));
    return {
      nextState: {
        ...state,
        phase: 'COMPLETED',
        cells: nextCells,
        respinsLeft: 0,
        totalMultiplier: finalTotal,
        fullBoardBonus: true,
        lastStepEvents: [`ALL 15 CHAMBERS LOCKED! +${FULL_VAULT_BONUS_MULT}x FULL VAULT CRACK!`],
        collectorSourceIndices: [],
        collectorTargetIndex: null,
      },
      landedCount: 0,
      finished: true,
      finalPayout: Number((state.bet * finalTotal).toFixed(2)),
    };
  }

  // Base per-empty-cell drop rate drops slightly as board fills, with last-respin comeback drama!
  const fillRatio = (15 - emptyIndices.length) / 15;
  const isLastRespin = state.respinsLeft === 1;
  let cellDropProb = Math.max(0.055, 0.145 * (1 - fillRatio * 0.42));

  if (modifiers.winBias > 0) {
    cellDropProb += modifiers.winBias * 0.28;
  } else if (modifiers.winBias < 0) {
    cellDropProb = Math.max(0.032, cellDropProb + modifiers.winBias * 0.24);
  }
  // Dramatic last-respin save (dopamine spike when down to 1 respin!)
  if (isLastRespin && (modifiers.comebackActive || modifiers.pityActive || modifiers.winBias > 0.06)) {
    cellDropProb += 0.075;
  }

  const events: string[] = [];
  let landedCount = 0;
  let collectorSources: number[] = [];
  let collectorTarget: number | null = null;

  for (const idx of emptyIndices) {
    if (rng() < cellDropProb) {
      const orb = rollOrbKind(modifiers, true, rng);
      nextCells[idx] = orb;
      landedCount += 1;

      if (orb.kind === 'MULTIPLIER' && orb.boostValue) {
        let boosted = 0;
        for (let k = 0; k < nextCells.length; k++) {
          const target = nextCells[k];
          if (target && k !== idx && target.kind === 'COIN') {
            nextCells[k] = { ...target, value: target.value + orb.boostValue };
            boosted += 1;
          }
        }
        events.push(`Multiplier Magnet +${orb.boostValue}x surged ${boosted} coins!`);
      } else if (orb.kind === 'COLLECTOR') {
        let absorbed = 0;
        const src: number[] = [];
        for (let k = 0; k < nextCells.length; k++) {
          const target = nextCells[k];
          if (target && k !== idx && target.value > 0) {
            absorbed += target.value;
            src.push(k);
          }
        }
        const collectedVal = Math.max(4, Number(absorbed.toFixed(2)));
        nextCells[idx] = { ...orb, value: collectedVal };
        collectorSources = src;
        collectorTarget = idx;
        events.push(`Emerald Collector absorbed ${collectedVal}x across ${src.length} vaults!`);
      } else if (orb.kind === 'MINI' || orb.kind === 'MAJOR' || orb.kind === 'GRAND') {
        events.push(`${orb.kind} VAULT MEDALLION (${orb.value}x) LOCKED!`);
      } else {
        events.push(`+${orb.value}x Gold Orb locked!`);
      }

      // Cap max new orbs per single respin at 3 for crisp pacing
      if (landedCount >= 3) break;
    }
  }

  const remainingEmpty = nextCells.filter((c) => c === null).length;
  const fullBoardBonus = remainingEmpty === 0;
  const nextRespinsLeft = fullBoardBonus
    ? 0
    : landedCount > 0
    ? 3
    : Math.max(0, state.respinsLeft - 1);

  const finished = fullBoardBonus || nextRespinsLeft === 0;
  const boardSum = sumBoardMultiplier(nextCells);
  const totalMultiplier = fullBoardBonus
    ? Number((boardSum + FULL_VAULT_BONUS_MULT).toFixed(2))
    : boardSum;

  if (fullBoardBonus) {
    events.unshift(`15/15 FULL VAULT CRACKED! +${FULL_VAULT_BONUS_MULT}x GRAND BONUS!`);
  } else if (landedCount > 0) {
    events.push('Respins reset to 3!');
  } else if (nextRespinsLeft === 1) {
    events.push('FINAL RESPIN — Heartbeat tension active!');
  } else if (finished) {
    events.push(`Vault Lock complete — Total ${totalMultiplier}x!`);
  }

  return {
    nextState: {
      phase: finished ? 'COMPLETED' : 'RESPINNING',
      bet: state.bet,
      cells: nextCells,
      respinsLeft: nextRespinsLeft,
      spinCount: state.spinCount + 1,
      totalMultiplier,
      fullBoardBonus,
      lastStepEvents: events,
      collectorSourceIndices: collectorSources,
      collectorTargetIndex: collectorTarget,
    },
    landedCount,
    finished,
    finalPayout: finished ? Number((state.bet * totalMultiplier).toFixed(2)) : 0,
  };
}
