import type { RelicBonuses } from './mlDirector';

export interface VaultRelic {
  id: string;
  name: string;
  effectText: string;
  cost: number;
  apply: (b: RelicBonuses) => RelicBonuses;
}

export const VAULT_RELICS: VaultRelic[] = [
  {
    id: 'golden-pity',
    name: 'Gilded Pity Seal',
    effectText: 'Triggers bad-luck protection 2 dry rounds earlier.',
    cost: 400,
    apply: (b) => ({ ...b, pityReduction: b.pityReduction + 2 }),
  },
  {
    id: 'cascade-catalyst',
    name: 'Cascade Catalyst',
    effectText: 'Starts Thunderfall Slot cascades at 2x base multiplier.',
    cost: 850,
    apply: (b) => ({ ...b, cascadeStartBonus: b.cascadeStartBonus + 1 }),
  },
  {
    id: 'velvet-comp',
    name: 'Velvet House Comp',
    effectText: 'Rebates 6% of your wager on losing rounds automatically.',
    cost: 1200,
    apply: (b) => ({ ...b, cashbackRate: Math.min(0.2, b.cashbackRate + 0.06) }),
  },
  {
    id: 'crown-magnet',
    name: 'Sovereign Scatter Charm',
    effectText: 'Boosts bonus scatter density & high-tier resonance by +25%.',
    cost: 2200,
    apply: (b) => ({ ...b, scatterBoost: b.scatterBoost + 0.25 }),
  },
];

export interface VipFloorSpec {
  floor: number;
  roomName: string;
  quotaMultiplier: number; // Relative to buy-in when floor started
  roundsLimit: number;
  clearBonusRate: number; // Bonus % of buy-in awarded on clearing floor
}

export const VIP_FLOORS: VipFloorSpec[] = [
  { floor: 1, roomName: 'Parlor Lounge', quotaMultiplier: 1.35, roundsLimit: 20, clearBonusRate: 0.2 },
  { floor: 2, roomName: 'Emerald Salon', quotaMultiplier: 1.75, roundsLimit: 20, clearBonusRate: 0.3 },
  { floor: 3, roomName: 'Brass Terrace', quotaMultiplier: 2.35, roundsLimit: 22, clearBonusRate: 0.4 },
  { floor: 4, roomName: 'Monte Carlo Suite', quotaMultiplier: 3.2, roundsLimit: 24, clearBonusRate: 0.5 },
  { floor: 5, roomName: 'Obsidian Vault', quotaMultiplier: 4.5, roundsLimit: 25, clearBonusRate: 0.75 },
  { floor: 6, roomName: 'Sovereign Penthouse', quotaMultiplier: 6.5, roundsLimit: 30, clearBonusRate: 1.0 },
];

export interface RoguelikeState {
  floorIndex: number; // 0..VIP_FLOORS.length-1
  floorStartBalance: number;
  targetBalance: number;
  roundsInFloor: number;
  floorsCleared: number;
  unlockedRelics: string[];
  lastFloorEvent: { type: 'CLEARED' | 'RENT_DUE'; message: string; bonus?: number } | null;
}

export function createInitialRoguelikeState(startingBalance: number): RoguelikeState {
  const spec = VIP_FLOORS[0];
  return {
    floorIndex: 0,
    floorStartBalance: startingBalance,
    targetBalance: Math.round(startingBalance * spec.quotaMultiplier),
    roundsInFloor: 0,
    floorsCleared: 0,
    unlockedRelics: [],
    lastFloorEvent: null,
  };
}

export function computeRelicBonuses(unlockedRelics: string[]): RelicBonuses {
  let bonuses: RelicBonuses = {
    cascadeStartBonus: 0,
    pityReduction: 0,
    scatterBoost: 0,
    cashbackRate: 0,
  };
  for (const relic of VAULT_RELICS) {
    if (unlockedRelics.includes(relic.id)) {
      bonuses = relic.apply(bonuses);
    }
  }
  return bonuses;
}

export function advanceRoguelikeRound(
  state: RoguelikeState,
  currentBalance: number
): { nextState: RoguelikeState; bonusAwarded: number } {
  const spec = VIP_FLOORS[Math.min(state.floorIndex, VIP_FLOORS.length - 1)];
  const roundsInFloor = state.roundsInFloor + 1;

  if (currentBalance >= state.targetBalance) {
    const bonusAwarded = Math.round(state.floorStartBalance * spec.clearBonusRate);
    const nextFloorIdx = Math.min(VIP_FLOORS.length - 1, state.floorIndex + 1);
    const nextSpec = VIP_FLOORS[nextFloorIdx];
    const nextStart = currentBalance + bonusAwarded;
    return {
      bonusAwarded,
      nextState: {
        ...state,
        floorIndex: nextFloorIdx,
        floorStartBalance: nextStart,
        targetBalance: Math.round(nextStart * nextSpec.quotaMultiplier),
        roundsInFloor: 0,
        floorsCleared: state.floorsCleared + 1,
        lastFloorEvent: {
          type: 'CLEARED',
          message: `Cleared ${spec.roomName}! Advanced to ${nextSpec.roomName} with +$${bonusAwarded.toLocaleString()} VIP comp.`,
          bonus: bonusAwarded,
        },
      },
    };
  }

  if (roundsInFloor >= spec.roundsLimit) {
    // Rent check missed — reset round timer on current floor with fresh attainable target
    const base = Math.max(100, currentBalance);
    return {
      bonusAwarded: 0,
      nextState: {
        ...state,
        floorStartBalance: base,
        targetBalance: Math.round(base * spec.quotaMultiplier),
        roundsInFloor: 0,
        lastFloorEvent: {
          type: 'RENT_DUE',
          message: `${spec.roomName} quota timer expired. New ${spec.roundsLimit}-round challenge opened.`,
        },
      },
    };
  }

  return {
    bonusAwarded: 0,
    nextState: {
      ...state,
      roundsInFloor,
      lastFloorEvent: null,
    },
  };
}
