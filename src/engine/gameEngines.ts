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
  const centerPull =
    modifiers.winBias < 0 ? Math.min(0.18, Math.abs(modifiers.winBias) * 0.65) : 0;

  const path: Array<0 | 1> = [];
  let rights = 0;
  for (let i = 0; i < rows; i++) {
    let pRight = edgeDirection === 1 ? 0.5 + edgeDrift : 0.5 - edgeDrift;
    if (centerPull > 0) {
      // Gently pull drifting balls back toward low-paying center pockets during House Harvest
      const expectedHalf = i / 2;
      if (rights > expectedHalf) pRight = 0.5 - centerPull;
      else if (rights < expectedHalf) pRight = 0.5 + centerPull;
    }
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
  // Standard provably-fair style heavy tail: 0.97 / (1 - u), shaped bidirectionally by Director/House Mind
  const houseFactor =
    modifiers.winBias >= 0
      ? 0.97 + modifiers.winBias * 0.28
      : Math.max(0.72, 0.97 + modifiers.winBias * 0.58);
  let crash = houseFactor / (1 - u);

  // During House Predator Harvest, occasional brutal early crashes (1.03x-1.45x) punish greedy holds
  if (modifiers.winBias < -0.06 && crash > 1.8 && rng() < Math.min(0.32, Math.abs(modifiers.winBias) * 1.15)) {
    crash = 1.03 + rng() * 0.42;
  }

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
  } else if (
    totalPayout > 0 &&
    bets.length > 0 &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.36, Math.abs(modifiers.winBias) * 1.35)
  ) {
    // Adversarial House Squeeze: shift to a losing pocket (preferring zero or adjacent near-miss!)
    const losingCandidates: number[] = [];
    for (let n = 0; n <= 36; n++) {
      const p = bets.reduce((s, b) => s + evaluateRouletteBet(b, n), 0);
      if (p === 0) losingCandidates.push(n);
    }
    if (losingCandidates.length > 0) {
      landed = losingCandidates[Math.floor(rng() * losingCandidates.length)];
      totalPayout = 0;
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

  // Adversarial House Predator Trap: when winBias < 0 and player gets greedy (2+ tiles deep),
  // swap an unrevealed mine into the clicked safe tile with probability proportional to |winBias|.
  if (
    !mines[clickedIndex] &&
    safeSoFar >= 2 &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.34, Math.abs(modifiers.winBias) * 1.25)
  ) {
    const unrevealedMines: number[] = [];
    for (let i = 0; i < mines.length; i++) {
      if (mines[i] && !revealed[i] && i !== clickedIndex) {
        unrevealedMines.push(i);
      }
    }
    if (unrevealedMines.length > 0) {
      const srcMine = unrevealedMines[Math.floor(rng() * unrevealedMines.length)];
      const next = [...mines];
      next[srcMine] = false;
      next[clickedIndex] = true;
      return next;
    }
  }

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

let shoeCounter = 0;

export function createShuffledShoe(decks = 4, rng: () => number = Math.random): PlayingCard[] {
  const shoeId = ++shoeCounter;
  const shoe: PlayingCard[] = [];
  let seq = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ suit, rank, id: `s${shoeId}-${d}-${rank}-${suit}-${seq++}` });
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

  // Director comeback/pity boost on missed rolls, OR adversarial House near-miss squeeze on wins
  if (!won && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.1) {
    roll =
      direction === 'over'
        ? Number((target + 0.05 + rng() * Math.max(1, 99.9 - target)).toFixed(2))
        : Number((rng() * Math.max(1, target - 0.05)).toFixed(2));
    won = true;
  } else if (won && modifiers.winBias < 0 && rng() < Math.min(0.34, Math.abs(modifiers.winBias) * 1.25)) {
    const sting = 0.15 + rng() * 1.9;
    roll =
      direction === 'over'
        ? Number(Math.max(0.01, target - sting).toFixed(2))
        : Number(Math.min(99.99, target + sting).toFixed(2));
    won = false;
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
  } else if (
    seg.multiplier > 0 &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.36, Math.abs(modifiers.winBias) * 1.35)
  ) {
    // Adversarial House Squeeze: land on 0x segment adjacent to 50x or 25x for maximum sting!
    const nearMissZeroes = [1, 23, 19, 21];
    segmentIndex = nearMissZeroes[Math.floor(rng() * nearMissZeroes.length)];
    seg = ROYAL_WHEEL_SEGMENTS[segmentIndex];
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

/* ===================== 8. SOVEREIGN BACCARAT ENGINE ===================== */

export type BaccaratBetSide = 'player' | 'banker' | 'tie' | 'pair';

export function getBaccaratCardPoints(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

export function getBaccaratTotal(cards: PlayingCard[]): number {
  const sum = cards.reduce((acc, c) => acc + getBaccaratCardPoints(c.rank), 0);
  return sum % 10;
}

export interface BaccaratResult {
  playerCards: PlayingCard[];
  bankerCards: PlayingCard[];
  playerTotal: number;
  bankerTotal: number;
  winner: 'player' | 'banker' | 'tie';
  isNatural: boolean;
  isPair: boolean;
  payout: number;
  wasNearMiss: boolean;
}

/**
 * Resolves an authentic Punto Banco Baccarat hand with official 3rd-card tableau rules.
 */
export function resolveBaccaratRound(
  bet: number,
  side: BaccaratBetSide,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): BaccaratResult {
  const dealOnce = (): Omit<BaccaratResult, 'payout' | 'wasNearMiss'> => {
    const shoe = createShuffledShoe(1, rng);
    const draw = () => shoe.pop()!;
    const playerCards = [draw(), draw()];
    const bankerCards = [draw(), draw()];

    let pTotal = getBaccaratTotal(playerCards);
    let bTotal = getBaccaratTotal(bankerCards);
    const isNatural = pTotal >= 8 || bTotal >= 8;
    const isPair =
      playerCards[0].rank === playerCards[1].rank ||
      bankerCards[0].rank === bankerCards[1].rank;

    if (!isNatural) {
      let playerThirdVal: number | null = null;
      if (pTotal <= 5) {
        const third = draw();
        playerCards.push(third);
        playerThirdVal = getBaccaratCardPoints(third.rank);
        pTotal = getBaccaratTotal(playerCards);
      }

      if (playerThirdVal === null) {
        if (bTotal <= 5) {
          bankerCards.push(draw());
          bTotal = getBaccaratTotal(bankerCards);
        }
      } else {
        const bankerDraws =
          bTotal <= 2 ||
          (bTotal === 3 && playerThirdVal !== 8) ||
          (bTotal === 4 && playerThirdVal >= 2 && playerThirdVal <= 7) ||
          (bTotal === 5 && playerThirdVal >= 4 && playerThirdVal <= 7) ||
          (bTotal === 6 && (playerThirdVal === 6 || playerThirdVal === 7));
        if (bankerDraws) {
          bankerCards.push(draw());
          bTotal = getBaccaratTotal(bankerCards);
        }
      }
    }

    const winner: 'player' | 'banker' | 'tie' =
      pTotal > bTotal ? 'player' : bTotal > pTotal ? 'banker' : 'tie';

    return {
      playerCards,
      bankerCards,
      playerTotal: pTotal,
      bankerTotal: bTotal,
      winner,
      isNatural,
      isPair,
    };
  };

  const calcPayout = (hand: Omit<BaccaratResult, 'payout' | 'wasNearMiss'>): number => {
    if (side === 'player') {
      if (hand.winner === 'player') return Number((bet * 2).toFixed(2));
      if (hand.winner === 'tie') return Number(bet.toFixed(2));
      return 0;
    }
    if (side === 'banker') {
      if (hand.winner === 'banker') return Number((bet * 1.95).toFixed(2));
      if (hand.winner === 'tie') return Number(bet.toFixed(2));
      return 0;
    }
    if (side === 'tie') {
      return hand.winner === 'tie' ? Number((bet * 9).toFixed(2)) : 0;
    }
    // Dragon Pair side bet (11:1 payout)
    return hand.isPair ? Number((bet * 12).toFixed(2)) : 0;
  };

  let hand = dealOnce();
  let payout = calcPayout(hand);

  // Director comeback / reload hook second-chance deal OR adversarial House counter-deal
  if (payout === 0 && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.05) {
    const retry = dealOnce();
    if (calcPayout(retry) > 0) {
      hand = retry;
      payout = calcPayout(retry);
    }
  } else if (
    payout > bet &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.34, Math.abs(modifiers.winBias) * 1.25)
  ) {
    const counter = dealOnce();
    if (calcPayout(counter) === 0) {
      hand = counter;
      payout = 0;
    }
  }

  const wasNearMiss =
    payout === 0 && Math.abs(hand.playerTotal - hand.bankerTotal) === 1;

  return { ...hand, payout, wasNearMiss };
}

/* ===================== 9. CRIMSON HI-LO LADDER ENGINE ===================== */

export const HILO_RANK_VALUE: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
};

export function getHiLoOdds(currentRank: Rank): {
  higherChance: number;
  lowerChance: number;
  higherMult: number;
  lowerMult: number;
} {
  const val = HILO_RANK_VALUE[currentRank];
  // Equal counts as a win (generous casino Hi-Lo rule except on A/K where strictly higher/lower applies)
  const higherCount = val === 13 ? 1 : 14 - val; // includes equal unless K
  const lowerCount = val === 1 ? 1 : val; // includes equal unless A
  const higherChance = Number(((higherCount / 13) * 100).toFixed(1));
  const lowerChance = Number(((lowerCount / 13) * 100).toFixed(1));
  const higherMult = Number(Math.max(1.06, (0.985 * 13) / higherCount).toFixed(2));
  const lowerMult = Number(Math.max(1.06, (0.985 * 13) / lowerCount).toFixed(2));
  return { higherChance, lowerChance, higherMult, lowerMult };
}

export function drawHiLoCard(
  currentCard: PlayingCard,
  guess: 'higher' | 'lower',
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): { nextCard: PlayingCard; won: boolean; stepMultiplier: number; wasNearMiss: boolean } {
  const shoe = createShuffledShoe(1, rng);
  let nextCard = shoe[0];
  const curVal = HILO_RANK_VALUE[currentCard.rank];
  const odds = getHiLoOdds(currentCard.rank);

  const checkWin = (card: PlayingCard): boolean => {
    const nv = HILO_RANK_VALUE[card.rank];
    if (guess === 'higher') {
      return curVal === 13 ? nv === 13 : nv >= curVal;
    }
    return curVal === 1 ? nv === 1 : nv <= curVal;
  };

  let won = checkWin(nextCard);
  if (!won && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.15) {
    const winningAlt = shoe.find((c) => checkWin(c));
    if (winningAlt) {
      nextCard = winningAlt;
      won = true;
    }
  } else if (
    won &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.34, Math.abs(modifiers.winBias) * 1.25)
  ) {
    const losingAlt = shoe.find((c) => !checkWin(c));
    if (losingAlt) {
      nextCard = losingAlt;
      won = false;
    }
  }

  const nextVal = HILO_RANK_VALUE[nextCard.rank];
  const wasNearMiss = !won && Math.abs(nextVal - curVal) === 1;
  const stepMultiplier = guess === 'higher' ? odds.higherMult : odds.lowerMult;

  return { nextCard, won, stepMultiplier, wasNearMiss };
}

/* ===================== 10. EMERALD KENO ENGINE ===================== */

export type KenoRisk = 'low' | 'medium' | 'high';

// Payout multipliers indexed by [pickCount][hits] for 40-tile, 10-draw casino Keno
export const KENO_PAYOUT_TABLES: Record<KenoRisk, Record<number, number[]>> = {
  low: {
    1: [0.4, 2.75],
    2: [0, 1.8, 5.1],
    3: [0, 1.1, 2.8, 12],
    4: [0, 0.5, 1.8, 5.5, 28],
    5: [0, 0.4, 1.3, 3.2, 14, 65],
    6: [0, 0, 1.1, 2.4, 7.5, 28, 140],
    7: [0, 0, 0.8, 1.9, 5, 16, 65, 260],
    8: [0, 0, 0.5, 1.5, 3.5, 11, 36, 120, 420],
    9: [0, 0, 0.4, 1.2, 2.6, 7.5, 22, 68, 210, 620],
    10: [0, 0, 0, 1.1, 2.2, 5.5, 15, 42, 130, 350, 800],
  },
  medium: {
    1: [0, 3.9],
    2: [0, 1.5, 7.5],
    3: [0, 0.5, 3.2, 24],
    4: [0, 0, 1.8, 9, 60],
    5: [0, 0, 1.4, 4.5, 22, 140],
    6: [0, 0, 0.8, 3, 12, 55, 280],
    7: [0, 0, 0, 2.2, 8, 28, 115, 480],
    8: [0, 0, 0, 1.8, 5.5, 18, 65, 240, 720],
    9: [0, 0, 0, 1.4, 4, 12, 40, 140, 420, 880],
    10: [0, 0, 0, 1.2, 3, 9, 28, 85, 260, 580, 1000],
  },
  high: {
    1: [0, 4.1],
    2: [0, 0, 16.5],
    3: [0, 0, 2.5, 48],
    4: [0, 0, 0, 16, 125],
    5: [0, 0, 0, 7.5, 42, 290],
    6: [0, 0, 0, 4, 20, 110, 520],
    7: [0, 0, 0, 2.5, 12, 55, 240, 760],
    8: [0, 0, 0, 0, 8, 32, 135, 460, 900],
    9: [0, 0, 0, 0, 6, 22, 85, 290, 640, 960],
    10: [0, 0, 0, 0, 4.5, 16, 60, 190, 450, 780, 1000],
  },
};

export function getKenoPayoutMultiplier(
  pickCount: number,
  hits: number,
  risk: KenoRisk
): number {
  const clampedPicks = Math.max(1, Math.min(10, Math.floor(pickCount)));
  const row = KENO_PAYOUT_TABLES[risk][clampedPicks] ?? [];
  return row[Math.max(0, Math.min(row.length - 1, hits))] ?? 0;
}

export interface KenoDrawResult {
  drawnNumbers: number[]; // 10 unique numbers in [1..40]
  matches: number[];
  hits: number;
  multiplier: number;
  payout: number;
  wasNearMiss: boolean;
}

export function resolveKenoDraw(
  bet: number,
  picks: number[],
  risk: KenoRisk,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): KenoDrawResult {
  const cleanPicks = Array.from(
    new Set(picks.filter((n) => Number.isInteger(n) && n >= 1 && n <= 40))
  ).slice(0, 10);

  const pickSet = new Set(cleanPicks);
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);

  const drawTen = (): number[] => {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 10);
  };

  let drawn = drawTen();
  let matches = drawn.filter((n) => pickSet.has(n));
  let mult = getKenoPayoutMultiplier(cleanPicks.length, matches.length, risk);

  // Adaptive ML Director win-bias nudge OR Adversarial House Squeeze
  if (mult < 1 && modifiers.winBias > 0 && cleanPicks.length > 0 && rng() < modifiers.winBias * 1.35) {
    const unhitPicks = cleanPicks.filter((p) => !drawn.includes(p));
    const missIdx = drawn.findIndex((n) => !pickSet.has(n));
    if (unhitPicks.length > 0 && missIdx >= 0) {
      drawn[missIdx] = unhitPicks[Math.floor(rng() * unhitPicks.length)];
      matches = drawn.filter((n) => pickSet.has(n));
      mult = getKenoPayoutMultiplier(cleanPicks.length, matches.length, risk);
    }
  } else if (
    mult >= 1 &&
    modifiers.winBias < 0 &&
    matches.length > 0 &&
    rng() < Math.min(0.36, Math.abs(modifiers.winBias) * 1.35)
  ) {
    const unpickedPool = pool.filter((n) => !pickSet.has(n) && !drawn.includes(n));
    const hitIdx = drawn.findIndex((n) => pickSet.has(n));
    if (unpickedPool.length > 0 && hitIdx >= 0) {
      drawn[hitIdx] = unpickedPool[Math.floor(rng() * unpickedPool.length)];
      matches = drawn.filter((n) => pickSet.has(n));
      mult = getKenoPayoutMultiplier(cleanPicks.length, matches.length, risk);
    }
  }

  // Check if 1 more match would have been a paying hit (near-miss tension)
  const nextHitMult = getKenoPayoutMultiplier(cleanPicks.length, matches.length + 1, risk);
  const wasNearMiss = mult === 0 && nextHitMult >= 1.5;

  return {
    drawnNumbers: drawn,
    matches,
    hits: matches.length,
    multiplier: mult,
    payout: Number((bet * mult).toFixed(2)),
    wasNearMiss,
  };
}

/* ===================== 11. DRAGON TOWER ENGINE ===================== */

export type DragonTowerDifficulty = 'easy' | 'medium' | 'hard' | 'master';

export interface TowerDifficultyConfig {
  label: string;
  cols: number;
  safePerRow: number;
  rows: number;
}

export const TOWER_DIFFICULTY_CONFIGS: Record<DragonTowerDifficulty, TowerDifficultyConfig> = {
  easy: { label: 'Easy (3/4)', cols: 4, safePerRow: 3, rows: 9 },
  medium: { label: 'Medium (2/3)', cols: 3, safePerRow: 2, rows: 9 },
  hard: { label: 'Hard (1/2)', cols: 2, safePerRow: 1, rows: 9 },
  master: { label: 'Master (1/3)', cols: 3, safePerRow: 1, rows: 9 },
};

export function calculateTowerMultiplier(
  difficulty: DragonTowerDifficulty,
  clearedRows: number
): number {
  if (clearedRows <= 0) return 1;
  const cfg = TOWER_DIFFICULTY_CONFIGS[difficulty];
  const singleRowProb = cfg.safePerRow / cfg.cols;
  const raw = 0.985 / Math.pow(singleRowProb, clearedRows);
  return Number(Math.min(5000, Math.max(1.05, raw)).toFixed(2));
}

/**
 * Generates a 9-row Dragon Tower grid where `true` = safe Dragon Egg, `false` = Skull Trap.
 */
export function generateTowerBoard(
  difficulty: DragonTowerDifficulty,
  rng: () => number = Math.random
): boolean[][] {
  const cfg = TOWER_DIFFICULTY_CONFIGS[difficulty];
  const board: boolean[][] = [];
  for (let r = 0; r < cfg.rows; r++) {
    const indices = Array.from({ length: cfg.cols }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const row = new Array<boolean>(cfg.cols).fill(false);
    for (let s = 0; s < cfg.safePerRow; s++) {
      row[indices[s]] = true;
    }
    board.push(row);
  }
  return board;
}

/**
 * Applies bidirectional Director / Realistic House Mind math to a Dragon Tower tile click:
 *  - Positive winBias (Lifeline/Honeymoon): shields rows 0-1 by swapping a clicked trap with a safe egg.
 *  - Negative winBias (Predator Harvest / Slow Bleed): on greedy climbs (row >= 1), can swap a trap
 *    under the player's pick while preserving exact trap count per row.
 */
export function resolveTowerStep(
  rowCells: boolean[],
  clickedCol: number,
  rowIndex: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): { updatedRow: boolean[]; isSafe: boolean } {
  const row = [...rowCells];
  let isSafe = Boolean(row[clickedCol]);

  if (!isSafe && rowIndex <= 1 && modifiers.winBias > 0 && rng() < modifiers.winBias * 1.4) {
    const safeIdx = row.findIndex((safe, i) => safe && i !== clickedCol);
    if (safeIdx >= 0) {
      row[clickedCol] = true;
      row[safeIdx] = false;
      isSafe = true;
    }
  } else if (
    isSafe &&
    rowIndex >= 1 &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.38, Math.abs(modifiers.winBias) * (1.05 + rowIndex * 0.08))
  ) {
    const trapIdx = row.findIndex((safe, i) => !safe && i !== clickedCol);
    if (trapIdx >= 0) {
      row[clickedCol] = false;
      row[trapIdx] = true;
      isSafe = false;
    }
  }

  return { updatedRow: row, isSafe };
}

/* ===================== 12. VAULT LIMBO ENGINE ===================== */

export interface LimboResult {
  rolledMultiplier: number;
  targetMultiplier: number;
  winChance: number;
  won: boolean;
  payout: number;
  wasNearMiss: boolean;
}

export function calculateLimboWinChance(targetMultiplier: number): number {
  const cleanTarget = Math.min(1000, Math.max(1.05, targetMultiplier));
  return Number(Math.min(95, Math.max(0.09, (98.5 / cleanTarget))).toFixed(2));
}

export function resolveLimboRound(
  bet: number,
  targetMultiplier: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): LimboResult {
  const target = Number(Math.min(1000, Math.max(1.05, targetMultiplier)).toFixed(2));
  const winChance = calculateLimboWinChance(target);

  const u = Math.max(0.0001, Math.min(0.9999, rng()));
  const edgeFactor =
    modifiers.winBias >= 0
      ? 0.985 + modifiers.winBias * 0.24
      : Math.max(0.7, 0.985 + modifiers.winBias * 0.62);

  let rolled = Number(Math.min(2500, Math.max(1.0, edgeFactor / (1 - u))).toFixed(2));
  let won = rolled >= target;

  // Positive lifeline / honeymoon boost on missed shots
  if (!won && modifiers.winBias > 0 && target <= 15 && rng() < modifiers.winBias * 0.9) {
    rolled = Number((target * (1.02 + rng() * 0.45)).toFixed(2));
    won = true;
  } else if (
    // Realistic House Mind Squeeze: turn a winning hit into an agonizing near-miss just below target!
    won &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.38, Math.abs(modifiers.winBias) * 1.35)
  ) {
    const stingRatio = 0.91 + rng() * 0.085;
    rolled = Number(Math.max(1.0, target * stingRatio).toFixed(2));
    if (rolled >= target) rolled = Number(Math.max(1.0, target - 0.01).toFixed(2));
    won = false;
  }

  // Near-miss formatting when losing close to target
  let wasNearMiss = false;
  if (!won && rng() < modifiers.nearMissRate * 0.48 && rolled < target * 0.85) {
    rolled = Number(Math.max(1.0, target * (0.93 + rng() * 0.065)).toFixed(2));
    if (rolled >= target) rolled = Number(Math.max(1.0, target - 0.01).toFixed(2));
    wasNearMiss = true;
  } else if (!won && rolled >= target * 0.88) {
    wasNearMiss = true;
  }

  const payout = won ? Number((bet * target).toFixed(2)) : 0;
  return {
    rolledMultiplier: rolled,
    targetMultiplier: target,
    winChance,
    won,
    payout,
    wasNearMiss,
  };
}

/* ===================== 13. BLACKJACK REALISTIC HOUSE BIAS ===================== */

/**
 * Applies bidirectional Realistic House Mind / Director edge to a dealer draw card in Blackjack.
 * - Positive comeback/lifeline bias helps dealer avoid miracle 21s when player stands strong.
 * - Negative winBias (Predator Harvest / Slow Bleed) gives dealer a realistic chance to pull
 *   a saving 18–21 instead of busting when player stands at 17–20.
 */
export function applyBlackjackHouseBias(
  dealerHand: PlayingCard[],
  drawnCard: PlayingCard,
  playerTotal: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): PlayingCard {
  const currentDealerTotal = evaluateBlackjackHand(dealerHand).total;
  const candidateTotal = evaluateBlackjackHand([...dealerHand, drawnCard]).total;

  // Relief / Comeback protection: deflect miracle dealer 21 into a bust card
  if (
    (modifiers.comebackActive || modifiers.winBias > 0.1) &&
    currentDealerTotal >= 12 &&
    candidateTotal === 21 &&
    rng() < 0.38
  ) {
    return { ...drawnCard, rank: '10' };
  }

  // Realistic House Predator Squeeze: save dealer from busting & edge out player 17-20
  if (
    modifiers.winBias < -0.05 &&
    currentDealerTotal >= 12 &&
    currentDealerTotal <= 16 &&
    candidateTotal > 21 &&
    playerTotal <= 21 &&
    rng() < Math.min(0.36, Math.abs(modifiers.winBias) * 1.3)
  ) {
    const needed = Math.max(17, Math.min(21, playerTotal + 1)) - currentDealerTotal;
    if (needed >= 2 && needed <= 9) {
      return { ...drawnCard, rank: String(needed) as Rank };
    }
  }

  return drawnCard;
}

/* ===================== 14. ROYAL VIDEO POKER (JACKS OR BETTER) ===================== */

export type PokerHandTier =
  | 'ROYAL_FLUSH'
  | 'STRAIGHT_FLUSH'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'JACKS_OR_BETTER'
  | 'HIGH_CARD';

export const POKER_PAYTABLE: Array<{
  tier: PokerHandTier;
  label: string;
  multiplier: number;
}> = [
  { tier: 'ROYAL_FLUSH', label: 'Royal Flush', multiplier: 800 },
  { tier: 'STRAIGHT_FLUSH', label: 'Straight Flush', multiplier: 50 },
  { tier: 'FOUR_OF_A_KIND', label: 'Four of a Kind', multiplier: 25 },
  { tier: 'FULL_HOUSE', label: 'Full House', multiplier: 9 },
  { tier: 'FLUSH', label: 'Flush', multiplier: 6 },
  { tier: 'STRAIGHT', label: 'Straight', multiplier: 4 },
  { tier: 'THREE_OF_A_KIND', label: 'Three of a Kind', multiplier: 3 },
  { tier: 'TWO_PAIR', label: 'Two Pair', multiplier: 2 },
  { tier: 'JACKS_OR_BETTER', label: 'Jacks or Better', multiplier: 1 },
];

const POKER_RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export interface PokerEvaluation {
  tier: PokerHandTier;
  label: string;
  multiplier: number;
  isNearMiss: boolean;
}

export function evaluatePokerHand(cards: PlayingCard[]): PokerEvaluation {
  if (cards.length !== 5) {
    return { tier: 'HIGH_CARD', label: 'No Pair', multiplier: 0, isNearMiss: false };
  }

  const vals = cards.map((c) => POKER_RANK_VALUE[c.rank]).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<Suit, number>();

  for (const v of vals) rankCounts.set(v, (rankCounts.get(v) ?? 0) + 1);
  for (const s of suits) suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);

  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const isFlush = suitCounts.size === 1;
  const uniqueVals = Array.from(rankCounts.keys()).sort((a, b) => a - b);

  const isWheel =
    uniqueVals.length === 5 &&
    uniqueVals[0] === 2 &&
    uniqueVals[1] === 3 &&
    uniqueVals[2] === 4 &&
    uniqueVals[3] === 5 &&
    uniqueVals[4] === 14;
  const isNormalStraight =
    uniqueVals.length === 5 && uniqueVals[4] - uniqueVals[0] === 4;
  const isStraight = isNormalStraight || isWheel;
  const isRoyal = isFlush && isNormalStraight && uniqueVals[0] === 10;

  if (isRoyal) {
    return { tier: 'ROYAL_FLUSH', label: 'Royal Flush', multiplier: 800, isNearMiss: false };
  }
  if (isFlush && isStraight) {
    return { tier: 'STRAIGHT_FLUSH', label: 'Straight Flush', multiplier: 50, isNearMiss: false };
  }
  if (counts[0] === 4) {
    return { tier: 'FOUR_OF_A_KIND', label: 'Four of a Kind', multiplier: 25, isNearMiss: false };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return { tier: 'FULL_HOUSE', label: 'Full House', multiplier: 9, isNearMiss: false };
  }
  if (isFlush) {
    return { tier: 'FLUSH', label: 'Flush', multiplier: 6, isNearMiss: false };
  }
  if (isStraight) {
    return { tier: 'STRAIGHT', label: 'Straight', multiplier: 4, isNearMiss: false };
  }
  if (counts[0] === 3) {
    return { tier: 'THREE_OF_A_KIND', label: 'Three of a Kind', multiplier: 3, isNearMiss: false };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    return { tier: 'TWO_PAIR', label: 'Two Pair', multiplier: 2, isNearMiss: false };
  }
  if (counts[0] === 2) {
    const pairRank = Array.from(rankCounts.entries()).find(([, c]) => c === 2)?.[0] ?? 0;
    if (pairRank >= 11) {
      return { tier: 'JACKS_OR_BETTER', label: 'Jacks or Better', multiplier: 1, isNearMiss: false };
    }
    return { tier: 'HIGH_CARD', label: 'Low Pair', multiplier: 0, isNearMiss: true };
  }

  const maxSuitCount = Math.max(...Array.from(suitCounts.values()));
  const nearFlush = maxSuitCount === 4;
  return {
    tier: 'HIGH_CARD',
    label: nearFlush ? '4-to-a-Flush Miss' : 'High Card',
    multiplier: 0,
    isNearMiss: nearFlush,
  };
}

export function resolvePokerDraw(
  initialHand: PlayingCard[],
  heldMask: boolean[],
  remainingDeck: PlayingCard[],
  bet: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): { finalHand: PlayingCard[]; evaluation: PokerEvaluation; payout: number } {
  const buildDraw = (deckSlice: PlayingCard[]): PlayingCard[] => {
    let cursor = 0;
    return initialHand.map((card, idx) =>
      heldMask[idx] ? card : deckSlice[cursor++] ?? card
    );
  };

  let finalHand = buildDraw(remainingDeck);
  let evaluation = evaluatePokerHand(finalHand);

  if (
    evaluation.multiplier === 0 &&
    modifiers.winBias > 0 &&
    remainingDeck.length >= 10 &&
    rng() < modifiers.winBias * 1.15
  ) {
    const altHand = buildDraw(remainingDeck.slice(5, 10));
    const altEval = evaluatePokerHand(altHand);
    if (altEval.multiplier > 0) {
      finalHand = altHand;
      evaluation = altEval;
    }
  } else if (
    evaluation.multiplier >= 1 &&
    modifiers.winBias < 0 &&
    remainingDeck.length >= 10 &&
    rng() < Math.min(0.34, Math.abs(modifiers.winBias) * 1.25)
  ) {
    const altHand = buildDraw(remainingDeck.slice(5, 10));
    const altEval = evaluatePokerHand(altHand);
    if (altEval.multiplier < evaluation.multiplier) {
      finalHand = altHand;
      evaluation = altEval;
    }
  }

  const payout = Number((bet * evaluation.multiplier).toFixed(2));
  return { finalHand, evaluation, payout };
}

/* ===================== 15. OBSIDIAN COIN FLIP STREAK ENGINE ===================== */

export type CoinSide = 'crown' | 'vault';

export function calculateCoinFlipMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  return Number(Math.min(1024, Math.pow(1.96, streak)).toFixed(2));
}

export interface CoinFlipStepResult {
  landed: CoinSide;
  won: boolean;
  nextStreak: number;
  nextMultiplier: number;
  wasNearMiss: boolean;
}

export function resolveCoinFlipStep(
  pick: CoinSide,
  currentStreak: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): CoinFlipStepResult {
  let winProb = 0.49;

  if (modifiers.winBias > 0) {
    const boost = currentStreak === 0 ? modifiers.winBias * 0.45 : modifiers.winBias * 0.25;
    winProb = Math.min(0.62, winProb + boost);
  } else if (modifiers.winBias < 0) {
    const streakPressure = 1 + Math.min(3, currentStreak) * 0.22;
    const squeeze = Math.abs(modifiers.winBias) * 0.55 * streakPressure;
    winProb = Math.max(0.32, winProb - squeeze);
  }

  const won = rng() < winProb;
  const landed: CoinSide = won ? pick : pick === 'crown' ? 'vault' : 'crown';
  const nextStreak = won ? currentStreak + 1 : 0;
  const nextMultiplier = won ? calculateCoinFlipMultiplier(nextStreak) : 0;

  return {
    landed,
    won,
    nextStreak,
    nextMultiplier,
    wasNearMiss: !won && currentStreak >= 2,
  };
}



