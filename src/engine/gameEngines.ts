import type { DirectorModifiers } from './mlDirector';

/* ===================== 1. PLINKO ENGINE ===================== */

export type PlinkoRisk = 'low' | 'medium' | 'high';
export type PlinkoRows = 8 | 12 | 16;

export const PLINKO_MULTIPLIERS: Record<PlinkoRisk, Record<PlinkoRows, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export interface PlinkoDropResult {
  path: Array<0 | 1>; // 0 = left, 1 = right per row
  bucketIndex: number;
  multiplier: number;
  payout: number;
  wasNearMiss: boolean;
}

export function resolvePlinkoDrop(
  bet: number,
  rows: PlinkoRows,
  risk: PlinkoRisk,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): PlinkoDropResult {
  const table = PLINKO_MULTIPLIERS[risk][rows];
  // Outer edges pay bigger; Director comeback/pity softly nudges ball toward an outer wing
  const edgeDirection: 0 | 1 = rng() < 0.5 ? 0 : 1;
  const edgeDrift =
    modifiers.winBias > 0
      ? Math.min(0.14, modifiers.winBias * 0.45 + (modifiers.pityActive ? 0.05 : 0))
      : 0;

  const path: Array<0 | 1> = [];
  let rights = 0;
  for (let i = 0; i < rows; i++) {
    const pRight =
      edgeDirection === 1 ? 0.5 + edgeDrift : 0.5 - edgeDrift;
    const step: 0 | 1 = rng() < pRight ? 1 : 0;
    path.push(step);
    rights += step;
  }

  const multiplier = table[rights];
  const payout = Number((bet * multiplier).toFixed(2));
  const wasNearMiss =
    (rights === 2 || rights === rows - 2) && multiplier < 4;

  return { path, bucketIndex: rights, multiplier, payout, wasNearMiss };
}

/* ===================== 2. CRASH ENGINE ===================== */

export function generateCrashPoint(
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): number {
  const u = Math.max(0.0001, Math.min(0.9999, rng()));
  // Standard provably-fair style heavy tail: 0.99 / (1 - u), shaped by Director
  const houseFactor = 0.97 + Math.max(0, modifiers.winBias) * 0.28;
  let crash = houseFactor / (1 - u);

  // During comeback or pity surge, prevent instant 1.00x–1.18x busts
  if ((modifiers.comebackActive || modifiers.pityActive) && crash < 1.85) {
    crash = 1.85 + rng() * 3.4 * modifiers.bonusBoost;
  }

  // Cap at 150x for clean display stability
  return Number(Math.min(150, Math.max(1.01, crash)).toFixed(2));
}

/* ===================== 3. ROULETTE ENGINE ===================== */

export const EUROPEAN_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteBetType =
  | { kind: 'straight'; value: number }
  | { kind: 'red' }
  | { kind: 'black' }
  | { kind: 'even' }
  | { kind: 'odd' }
  | { kind: 'low' } // 1-18
  | { kind: 'high' } // 19-36
  | { kind: 'dozen'; value: 1 | 2 | 3 };

export interface RouletteBet {
  id: string;
  label: string;
  type: RouletteBetType;
  amount: number;
}

export function getRouletteColor(n: number): 'green' | 'red' | 'black' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export function evaluateRouletteBet(bet: RouletteBet, landed: number): number {
  const { type, amount } = bet;
  switch (type.kind) {
    case 'straight':
      return landed === type.value ? amount * 36 : 0;
    case 'red':
      return landed !== 0 && RED_NUMBERS.has(landed) ? amount * 2 : 0;
    case 'black':
      return landed !== 0 && !RED_NUMBERS.has(landed) ? amount * 2 : 0;
    case 'even':
      return landed !== 0 && landed % 2 === 0 ? amount * 2 : 0;
    case 'odd':
      return landed !== 0 && landed % 2 === 1 ? amount * 2 : 0;
    case 'low':
      return landed >= 1 && landed <= 18 ? amount * 2 : 0;
    case 'high':
      return landed >= 19 && landed <= 36 ? amount * 2 : 0;
    case 'dozen': {
      const min = (type.value - 1) * 12 + 1;
      const max = type.value * 12;
      return landed >= min && landed <= max ? amount * 3 : 0;
    }
  }
}

export function resolveRouletteSpin(
  bets: RouletteBet[],
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): { landed: number; color: 'green' | 'red' | 'black'; totalPayout: number; wasNearMiss: boolean } {
  let landed = Math.floor(rng() * 37);

  // Director comeback/pity check: if landed loses everything, roll a second chance weighted by winBias
  let totalPayout = bets.reduce((s, b) => s + evaluateRouletteBet(b, landed), 0);
  if (totalPayout === 0 && bets.length > 0 && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.15) {
    const winningCandidates: number[] = [];
    for (let n = 0; n <= 36; n++) {
      const p = bets.reduce((s, b) => s + evaluateRouletteBet(b, n), 0);
      if (p > 0) winningCandidates.push(n);
    }
    if (winningCandidates.length > 0) {
      landed = winningCandidates[Math.floor(rng() * winningCandidates.length)];
      totalPayout = bets.reduce((s, b) => s + evaluateRouletteBet(b, landed), 0);
    }
  }

  // Near miss if player bet a straight number and wheel landed adjacent pocket
  const wheelIdx = EUROPEAN_WHEEL_ORDER.indexOf(landed);
  const prevNeighbor = EUROPEAN_WHEEL_ORDER[(wheelIdx - 1 + 37) % 37];
  const nextNeighbor = EUROPEAN_WHEEL_ORDER[(wheelIdx + 1) % 37];
  const wasNearMiss =
    totalPayout === 0 &&
    bets.some(
      (b) =>
        b.type.kind === 'straight' &&
        (b.type.value === prevNeighbor || b.type.value === nextNeighbor)
    );

  return {
    landed,
    color: getRouletteColor(landed),
    totalPayout: Number(totalPayout.toFixed(2)),
    wasNearMiss,
  };
}

/* ===================== 4. VAULT MINES ENGINE ===================== */

export function calculateMinesMultiplier(
  totalTiles: number,
  mineCount: number,
  revealedSafe: number
): number {
  if (revealedSafe <= 0) return 1;
  let prob = 1;
  for (let i = 0; i < revealedSafe; i++) {
    prob *= (totalTiles - mineCount - i) / (totalTiles - i);
  }
  const raw = 0.99 / Math.max(1e-9, prob);
  return Number(Math.max(1.01, raw).toFixed(2));
}

export function generateMinesBoard(
  mineCount: number,
  rng: () => number = Math.random
): boolean[] {
  const clamped = Math.min(24, Math.max(1, mineCount));
  const indices = Array.from({ length: 25 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const mines = new Array<boolean>(25).fill(false);
  for (let i = 0; i < clamped; i++) {
    mines[indices[i]] = true;
  }
  return mines;
}

/**
 * If Director comeback/pity is active on the first 2 reveals and the player clicks a mine,
 * swaps that mine with an unrevealed safe cell with probability proportional to winBias.
 */
export function applyDirectorMinesProtection(
  mines: boolean[],
  revealed: boolean[],
  clickedIndex: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): boolean[] {
  const safeSoFar = revealed.filter(Boolean).length;
  if (
    !mines[clickedIndex] ||
    safeSoFar > 2 ||
    modifiers.winBias <= 0 ||
    rng() >= modifiers.winBias * 1.4
  ) {
    return mines;
  }
  const safeUnrevealed: number[] = [];
  for (let i = 0; i < mines.length; i++) {
    if (!mines[i] && !revealed[i] && i !== clickedIndex) {
      safeUnrevealed.push(i);
    }
  }
  if (safeUnrevealed.length === 0) return mines;
  const swapIdx = safeUnrevealed[Math.floor(rng() * safeUnrevealed.length)];
  const next = [...mines];
  next[clickedIndex] = false;
  next[swapIdx] = true;
  return next;
}

/* ===================== 5. BLACKJACK ENGINE ===================== */

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface PlayingCard {
  suit: Suit;
  rank: Rank;
  id: string;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createShuffledShoe(decks = 4, rng: () => number = Math.random): PlayingCard[] {
  const shoe: PlayingCard[] = [];
  let seq = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ suit, rank, id: `${d}-${rank}-${suit}-${seq++}` });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function evaluateBlackjackHand(cards: PlayingCard[]): {
  total: number;
  soft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
} {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else if (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J') {
      total += 10;
    } else {
      total += Number(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return {
    total,
    soft: aces > 0,
    isBlackjack: cards.length === 2 && total === 21,
    isBust: total > 21,
  };
}

export function resolveBlackjackOutcome(
  playerCards: PlayingCard[],
  dealerCards: PlayingCard[],
  bet: number
): { outcome: 'BLACKJACK' | 'WIN' | 'PUSH' | 'LOSE'; payout: number } {
  const p = evaluateBlackjackHand(playerCards);
  const d = evaluateBlackjackHand(dealerCards);

  if (p.isBust) return { outcome: 'LOSE', payout: 0 };
  if (p.isBlackjack && !d.isBlackjack) {
    return { outcome: 'BLACKJACK', payout: Number((bet * 2.5).toFixed(2)) };
  }
  if (d.isBlackjack && !p.isBlackjack) {
    return { outcome: 'LOSE', payout: 0 };
  }
  if (d.isBust || p.total > d.total) {
    return { outcome: 'WIN', payout: Number((bet * 2).toFixed(2)) };
  }
  if (p.total === d.total) {
    return { outcome: 'PUSH', payout: Number(bet.toFixed(2)) };
  }
  return { outcome: 'LOSE', payout: 0 };
}

/* ===================== 6. HYPER DICE ENGINE ===================== */

export interface DiceRollResult {
  roll: number; // 0.00 .. 99.99
  won: boolean;
  multiplier: number;
  payout: number;
  winChance: number;
  wasNearMiss: boolean;
}

export function calculateDiceSpecs(target: number, direction: 'over' | 'under'): {
  winChance: number;
  multiplier: number;
} {
  const clamped = Math.min(98, Math.max(2, target));
  const winChance = direction === 'over' ? 100 - clamped : clamped;
  const multiplier = Number((99 / Math.max(1, winChance)).toFixed(4));
  return { winChance: Number(winChance.toFixed(2)), multiplier };
}

export function resolveDiceRoll(
  bet: number,
  target: number,
  direction: 'over' | 'under',
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): DiceRollResult {
  const { winChance, multiplier } = calculateDiceSpecs(target, direction);
  let roll = Number((rng() * 100).toFixed(2));
  let won = direction === 'over' ? roll > target : roll < target;

  // Director comeback/pity boost on missed rolls
  if (!won && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.1) {
    roll =
      direction === 'over'
        ? Number((target + 0.05 + rng() * Math.max(1, 99.9 - target)).toFixed(2))
        : Number((rng() * Math.max(1, target - 0.05)).toFixed(2));
    won = true;
  }

  // Director near-miss tease on normal misses
  let wasNearMiss = false;
  if (!won && rng() < modifiers.nearMissRate * 0.45) {
    const offset = 0.2 + rng() * 1.8;
    roll =
      direction === 'over'
        ? Number(Math.max(0.01, target - offset).toFixed(2))
        : Number(Math.min(99.99, target + offset).toFixed(2));
    wasNearMiss = true;
  } else if (!won && Math.abs(roll - target) <= 2.5) {
    wasNearMiss = true;
  }

  const payout = won ? Number((bet * multiplier).toFixed(2)) : 0;
  return { roll, won, multiplier, payout, winChance, wasNearMiss };
}

/* ===================== 7. ROYAL WHEEL ENGINE ===================== */

export interface WheelSegment {
  label: string;
  multiplier: number;
  color: string;
  textColor: string;
}

export const ROYAL_WHEEL_SEGMENTS: WheelSegment[] = [
  { label: '50x', multiplier: 50, color: '#D4AF37', textColor: '#090C10' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '1.5x', multiplier: 1.5, color: '#0F4C3A', textColor: '#ECFDF5' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '2x', multiplier: 2, color: '#1E3A5F', textColor: '#E0F2FE' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '3x', multiplier: 3, color: '#581C3C', textColor: '#FCE7F3' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '1.5x', multiplier: 1.5, color: '#0F4C3A', textColor: '#ECFDF5' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '5x', multiplier: 5, color: '#78350F', textColor: '#FEF3C7' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '10x', multiplier: 10, color: '#991B1B', textColor: '#FEE2E2' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '1.5x', multiplier: 1.5, color: '#0F4C3A', textColor: '#ECFDF5' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '2x', multiplier: 2, color: '#1E3A5F', textColor: '#E0F2FE' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '3x', multiplier: 3, color: '#581C3C', textColor: '#FCE7F3' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '25x', multiplier: 25, color: '#B45309', textColor: '#FFFBEB' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
  { label: '2x', multiplier: 2, color: '#1E3A5F', textColor: '#E0F2FE' },
  { label: '0x', multiplier: 0, color: '#1B222C', textColor: '#94A3B8' },
];

export function resolveWheelSpin(
  bet: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): { segmentIndex: number; segment: WheelSegment; payout: number; wasNearMiss: boolean } {
  let segmentIndex = Math.floor(rng() * ROYAL_WHEEL_SEGMENTS.length);
  let seg = ROYAL_WHEEL_SEGMENTS[segmentIndex];

  if (seg.multiplier === 0 && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.4) {
    // Re-roll into a paying segment
    const winners = ROYAL_WHEEL_SEGMENTS.map((s, i) => ({ s, i })).filter((x) => x.s.multiplier > 0);
    const pick = winners[Math.floor(rng() * winners.length)];
    segmentIndex = pick.i;
    seg = pick.s;
  }

  // Near-miss if landed immediately adjacent to 50x or 25x
  const wasNearMiss =
    seg.multiplier === 0 && (segmentIndex === 1 || segmentIndex === 23 || segmentIndex === 19 || segmentIndex === 21);

  return {
    segmentIndex,
    segment: seg,
    payout: Number((bet * seg.multiplier).toFixed(2)),
    wasNearMiss,
  };
}
