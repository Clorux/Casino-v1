import type { DirectorModifiers } from './mlDirector';

export type SlotSymbolId =
  | 'CROWN'
  | 'DIAMOND'
  | 'RUBY'
  | 'EMERALD'
  | 'GOLD_BAR'
  | 'SPADE'
  | 'HEART'
  | 'CLUB'
  | 'WILD'
  | 'SCATTER';

export interface SlotSymbolSpec {
  id: SlotSymbolId;
  name: string;
  short: string;
  color: string;
  accent: string;
  tier: 'low' | 'mid' | 'high' | 'special';
  weight: number; // Base weight on 64-stop virtual reel strip
  pays: { 3: number; 4: number; 5: number }; // Multipliers of bet per payline
}

export const SLOT_SYMBOLS: Record<SlotSymbolId, SlotSymbolSpec> = {
  CROWN: {
    id: 'CROWN',
    name: 'Sovereign Crown',
    short: 'CRN',
    color: '#ECCB63',
    accent: '#9A7418',
    tier: 'high',
    weight: 3,
    pays: { 3: 2.5, 4: 10, 5: 45 },
  },
  DIAMOND: {
    id: 'DIAMOND',
    name: 'Vault Diamond',
    short: 'DIA',
    color: '#7DD3FC',
    accent: '#0284C7',
    tier: 'high',
    weight: 4,
    pays: { 3: 1.8, 4: 6.5, 5: 25 },
  },
  RUBY: {
    id: 'RUBY',
    name: 'Crimson Ruby',
    short: 'RBY',
    color: '#FB7185',
    accent: '#BE123C',
    tier: 'mid',
    weight: 6,
    pays: { 3: 1.2, 4: 4.0, 5: 14 },
  },
  EMERALD: {
    id: 'EMERALD',
    name: 'Monte Emerald',
    short: 'EMR',
    color: '#34D399',
    accent: '#047857',
    tier: 'mid',
    weight: 7,
    pays: { 3: 0.9, 4: 3.0, 5: 10 },
  },
  GOLD_BAR: {
    id: 'GOLD_BAR',
    name: 'Bullion Ingot',
    short: 'GLD',
    color: '#FBBF24',
    accent: '#B45309',
    tier: 'mid',
    weight: 8,
    pays: { 3: 0.7, 4: 2.2, 5: 7.5 },
  },
  SPADE: {
    id: 'SPADE',
    name: 'Royal Spade',
    short: '♠',
    color: '#CBD5E1',
    accent: '#475569',
    tier: 'low',
    weight: 10,
    pays: { 3: 0.35, 4: 1.0, 5: 3.2 },
  },
  HEART: {
    id: 'HEART',
    name: 'Velvet Heart',
    short: '♥',
    color: '#F43F5E',
    accent: '#9F1239',
    tier: 'low',
    weight: 10,
    pays: { 3: 0.35, 4: 1.0, 5: 3.2 },
  },
  CLUB: {
    id: 'CLUB',
    name: 'Salon Club',
    short: '♣',
    color: '#94A3B8',
    accent: '#334155',
    tier: 'low',
    weight: 10,
    pays: { 3: 0.3, 4: 0.85, 5: 2.8 },
  },
  WILD: {
    id: 'WILD',
    name: 'Vault Wild',
    short: 'WLD',
    color: '#FDE047',
    accent: '#CA8A04',
    tier: 'special',
    weight: 3,
    pays: { 3: 3.0, 4: 12.0, 5: 60.0 },
  },
  SCATTER: {
    id: 'SCATTER',
    name: 'Thunder Scatter',
    short: 'SCT',
    color: '#F59E0B',
    accent: '#7C2D12',
    tier: 'special',
    weight: 3,
    pays: { 3: 4.0, 4: 15.0, 5: 75.0 },
  },
};

export const SYMBOL_LIST: SlotSymbolId[] = Object.keys(SLOT_SYMBOLS) as SlotSymbolId[];

// 15 classic 5x3 paylines (row index per reel 0..4)
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // center
  [0, 0, 0, 0, 0], // top
  [2, 2, 2, 2, 2], // bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // inverted V
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
];

export type SlotGrid = SlotSymbolId[][]; // [reel 0..4][row 0..2]

export interface LineWin {
  lineIndex: number;
  symbol: SlotSymbolId;
  count: 3 | 4 | 5;
  positions: Array<[number, number]>; // [reel, row]
  baseMultiplier: number;
}

export interface CascadeStep {
  grid: SlotGrid;
  wins: LineWin[];
  winningCells: Array<[number, number]>;
  cascadeMultiplier: number;
  stepPayout: number;
  scatterCount: number;
  scatterPayout: number;
}

export interface SlotSpinResult {
  steps: CascadeStep[];
  totalPayout: number;
  totalMultiplier: number;
  freeSpinsAwarded: number;
  anticipationReels: number[]; // reels that should slow-down tease (e.g. [3, 4] when 2 scatters land on 0..2)
  wasNearMiss: boolean;
  winTier: 'NONE' | 'WIN' | 'BIG' | 'SUPER' | 'MEGA';
}

/**
 * Builds a weighted virtual reel strip (64+ stops) modulated by the ML Director.
 */
export function buildVirtualReelStrip(modifiers: DirectorModifiers): SlotSymbolId[] {
  const strip: SlotSymbolId[] = [];
  for (const id of SYMBOL_LIST) {
    const spec = SLOT_SYMBOLS[id];
    let weight = spec.weight;
    if (id === 'WILD') {
      weight = Math.max(1, Math.round(spec.weight * (1 + modifiers.winBias * 2.4)));
    } else if (id === 'SCATTER') {
      weight = Math.max(1, Math.round(spec.weight * modifiers.bonusBoost));
    } else if (spec.tier === 'high') {
      weight = Math.max(1, Math.round(spec.weight * (1 + modifiers.winBias * 1.6)));
    }
    for (let i = 0; i < weight; i++) {
      strip.push(id);
    }
  }
  return strip;
}

function pickFromStrip(strip: SlotSymbolId[], rng: () => number): SlotSymbolId {
  return strip[Math.floor(rng() * strip.length)];
}

/**
 * Evaluates all 15 paylines and scatter awards on a 5x3 grid.
 */
export function evaluateSlotGrid(grid: SlotGrid): {
  wins: LineWin[];
  winningCells: Array<[number, number]>;
  scatterCount: number;
  scatterMultiplier: number;
  scatterCells: Array<[number, number]>;
} {
  const wins: LineWin[] = [];
  const cellSet = new Set<string>();

  for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
    const pattern = PAYLINES[lineIdx];
    const lineSyms: SlotSymbolId[] = pattern.map((row, reel) => grid[reel][row]);

    // Determine target paying symbol (first non-WILD, non-SCATTER symbol)
    let target: SlotSymbolId | null = null;
    for (const s of lineSyms) {
      if (s === 'SCATTER') break;
      if (s !== 'WILD') {
        target = s;
        break;
      }
    }
    if (!target) {
      // All wilds from reel 0
      if (lineSyms[0] === 'WILD') {
        target = 'WILD';
      } else {
        continue;
      }
    }

    let count = 0;
    const positions: Array<[number, number]> = [];
    for (let reel = 0; reel < 5; reel++) {
      const sym = lineSyms[reel];
      if (sym === target || sym === 'WILD') {
        count++;
        positions.push([reel, pattern[reel]]);
      } else {
        break;
      }
    }

    if (count >= 3) {
      const clampedCount = Math.min(5, count) as 3 | 4 | 5;
      // Normalize payline payout by 15 lines so multi-line hits stay well balanced
      const rawPay = SLOT_SYMBOLS[target].pays[clampedCount];
      wins.push({
        lineIndex: lineIdx,
        symbol: target,
        count: clampedCount,
        positions,
        baseMultiplier: Number((rawPay / 3.2).toFixed(3)),
      });
      for (const [r, row] of positions) {
        cellSet.add(`${r}:${row}`);
      }
    }
  }

  const scatterCells: Array<[number, number]> = [];
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      if (grid[r][row] === 'SCATTER') {
        scatterCells.push([r, row]);
      }
    }
  }
  const scatterCount = scatterCells.length;
  let scatterMultiplier = 0;
  if (scatterCount >= 3) {
    const key = Math.min(5, scatterCount) as 3 | 4 | 5;
    scatterMultiplier = SLOT_SYMBOLS.SCATTER.pays[key];
    for (const [r, row] of scatterCells) {
      cellSet.add(`${r}:${row}`);
    }
  }

  const winningCells: Array<[number, number]> = Array.from(cellSet).map((key) => {
    const [r, row] = key.split(':').map(Number);
    return [r, row];
  });

  return { wins, winningCells, scatterCount, scatterMultiplier, scatterCells };
}

/**
 * Generates an initial 5x3 grid, optionally applying Director anticipation tease
 * or comeback alignment, then resolves all cascading tumbles (`1x -> 2x -> 4x -> 8x -> 16x`).
 */
export function resolveThunderfallSpin(
  bet: number,
  modifiers: DirectorModifiers,
  options: {
    startCascadeMult?: number;
    isFreeSpin?: boolean;
    rng?: () => number;
  } = {}
): SlotSpinResult {
  const rng = options.rng ?? Math.random;
  const strip = buildVirtualReelStrip(modifiers);

  const grid: SlotGrid = Array.from({ length: 5 }, () => [
    pickFromStrip(strip, rng),
    pickFromStrip(strip, rng),
    pickFromStrip(strip, rng),
  ]);

  // Director Comeback / Pity alignment boost OR Adversarial House Harvest squeeze
  const initialEval = evaluateSlotGrid(grid);
  if (initialEval.wins.length === 0 && initialEval.scatterCount < 3) {
    if (modifiers.winBias > 0 && rng() < modifiers.winBias * 1.45) {
      const pool: SlotSymbolId[] =
        modifiers.pityActive || modifiers.comebackActive
          ? ['CROWN', 'DIAMOND', 'RUBY', 'EMERALD', 'GOLD_BAR']
          : ['RUBY', 'EMERALD', 'GOLD_BAR', 'SPADE', 'HEART'];
      const chosen = pool[Math.floor(rng() * pool.length)];
      const row = Math.floor(rng() * 3);
      grid[0][row] = chosen;
      grid[1][row] = chosen;
      grid[2][row] = rng() < 0.25 ? 'WILD' : chosen;
      if (rng() < 0.25 + modifiers.winBias) {
        grid[3][row] = chosen;
      }
    } else if ((modifiers.ldwIntensity ?? 0) > 0 && rng() < (modifiers.ldwIntensity ?? 0) * 0.65) {
      // Losses Disguised as Wins (LDW): inject a sub-1x 3-of-a-kind low-tier hit (~0.10x-0.35x bet)
      // Lights up payline & chimes while net bankroll still bleeds
      const ldwPool: SlotSymbolId[] = ['CLUB', 'SPADE', 'HEART'];
      const chosen = ldwPool[Math.floor(rng() * ldwPool.length)];
      const row = Math.floor(rng() * 3);
      grid[0][row] = chosen;
      grid[1][row] = chosen;
      grid[2][row] = chosen;
      if (grid[3][row] === chosen || grid[3][row] === 'WILD') {
        grid[3][row] = ldwPool.find((s) => s !== chosen) ?? 'CLUB';
      }
    }
  } else if (
    (initialEval.wins.length > 0 || initialEval.scatterCount >= 3) &&
    modifiers.winBias < 0 &&
    rng() < Math.min(0.4, Math.abs(modifiers.winBias) * 1.45)
  ) {
    // House Harvest: disrupt reel 2 to turn a paying alignment into a stinging near-miss
    const disruptPool: SlotSymbolId[] = ['SPADE', 'HEART', 'CLUB'];
    for (let row = 0; row < 3; row++) {
      const existing = grid[0][row];
      const replacement = disruptPool.find((s) => s !== existing) ?? 'CLUB';
      grid[2][row] = replacement;
    }
  }

  // Director Anticipation Tease: place 2 scatters on reels 0..2 to trigger dramatic slow-down on reels 3 & 4
  let currentScatters = 0;
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      if (grid[r][row] === 'SCATTER') currentScatters++;
    }
  }
  if (currentScatters < 2 && rng() < modifiers.nearMissRate * 0.55) {
    const r1 = Math.floor(rng() * 2); // reel 0 or 1
    const r2 = r1 + 1 + Math.floor(rng() * (2 - r1)); // reel 1 or 2
    grid[r1][Math.floor(rng() * 3)] = 'SCATTER';
    grid[r2][Math.floor(rng() * 3)] = 'SCATTER';
  }

  // Detect anticipation reels (2 scatters landed on earlier reels before remaining reels stop)
  const anticipationReels: number[] = [];
  let scattersSoFar = 0;
  for (let r = 0; r < 5; r++) {
    if (scattersSoFar >= 2) {
      anticipationReels.push(r);
    }
    if (grid[r].includes('SCATTER')) {
      scattersSoFar++;
    }
  }

  const steps: CascadeStep[] = [];
  let workingGrid: SlotGrid = grid.map((col) => [...col]);
  let cascadeMult = Math.max(1, options.startCascadeMult ?? 1);
  if (options.isFreeSpin) {
    cascadeMult = Math.max(2, cascadeMult);
  }

  let totalPayout = 0;
  let freeSpinsAwarded = 0;
  const maxCascades = 6;

  for (let stepIdx = 0; stepIdx < maxCascades; stepIdx++) {
    const evalRes = evaluateSlotGrid(workingGrid);
    const lineMultSum = evalRes.wins.reduce((acc, w) => acc + w.baseMultiplier, 0);
    const scatterPayout = Number((evalRes.scatterMultiplier * bet).toFixed(2));
    const linePayout = Number((lineMultSum * bet * cascadeMult).toFixed(2));
    const stepPayout = Number((linePayout + scatterPayout).toFixed(2));

    if (evalRes.scatterCount >= 3 && stepIdx === 0) {
      freeSpinsAwarded = evalRes.scatterCount === 3 ? 6 : evalRes.scatterCount === 4 ? 10 : 15;
    }

    steps.push({
      grid: workingGrid.map((col) => [...col]),
      wins: evalRes.wins,
      winningCells: evalRes.winningCells,
      cascadeMultiplier: cascadeMult,
      stepPayout,
      scatterCount: evalRes.scatterCount,
      scatterPayout,
    });

    totalPayout = Number((totalPayout + stepPayout).toFixed(2));

    if (evalRes.wins.length === 0) {
      break;
    }

    // Cascade tumble: remove winning cells, drop symbols down, refill top
    const nextGrid: SlotGrid = workingGrid.map((col, reel) => {
      const removedRows = new Set(
        evalRes.winningCells.filter(([r]) => r === reel).map(([, row]) => row)
      );
      const survivors = col.filter((_, row) => !removedRows.has(row));
      const needed = 3 - survivors.length;
      const refills: SlotSymbolId[] = [];
      for (let i = 0; i < needed; i++) {
        // Cascade boost nudges matching neighbor symbols for chain excitement
        if (modifiers.cascadeBoost > 0 && rng() < modifiers.cascadeBoost * 0.45 && reel > 0) {
          refills.push(workingGrid[reel - 1][1]);
        } else {
          refills.push(pickFromStrip(strip, rng));
        }
      }
      return [...refills, ...survivors];
    });

    workingGrid = nextGrid;
    cascadeMult = Math.min(32, cascadeMult * 2); // 1x -> 2x -> 4x -> 8x -> 16x -> 32x
  }

  const totalMultiplier = bet > 0 ? Number((totalPayout / bet).toFixed(2)) : 0;
  const firstStepScatters = steps[0]?.scatterCount ?? 0;
  const wasNearMiss = firstStepScatters === 2 && totalPayout === 0;

  let winTier: SlotSpinResult['winTier'] = 'NONE';
  if (totalMultiplier >= 25) winTier = 'MEGA';
  else if (totalMultiplier >= 10) winTier = 'SUPER';
  else if (totalMultiplier >= 4) winTier = 'BIG';
  else if (totalPayout > 0) winTier = 'WIN';

  return {
    steps,
    totalPayout,
    totalMultiplier,
    freeSpinsAwarded,
    anticipationReels,
    wasNearMiss,
    winTier,
  };
}

export interface MonteCarloReport {
  spins: number;
  empiricalRtp: number;
  hitFrequency: number;
  volatilitySigma: number;
  maxMultiplier: number;
  bonusTriggerRate: number;
  bigWinRate: number;
  avgCascadeDepth: number;
  distribution: Array<{ bucket: string; count: number; pct: number }>;
  durationMs: number;
}

/**
 * Runs a fast local Monte Carlo simulation to evaluate PAR sheet RTP, hit frequency,
 * volatility standard deviation, and payout distribution.
 */
export function runMonteCarloSimulation(
  spins: number,
  modifiers: DirectorModifiers,
  rng: () => number = Math.random
): MonteCarloReport {
  const start = Date.now();
  const clampedSpins = Math.min(200000, Math.max(500, Math.floor(spins)));

  let totalReturned = 0;
  let hits = 0;
  let bonuses = 0;
  let bigWins = 0;
  let maxMult = 0;
  let totalCascades = 0;
  let sumSq = 0;

  const buckets = [
    { label: '0x (Miss)', min: -1, max: 0, count: 0 },
    { label: '0.1x–1x', min: 0, max: 1, count: 0 },
    { label: '1x–4x', min: 1, max: 4, count: 0 },
    { label: '4x–10x (Big)', min: 4, max: 10, count: 0 },
    { label: '10x–25x (Super)', min: 10, max: 25, count: 0 },
    { label: '25x+ (Mega)', min: 25, max: Infinity, count: 0 },
  ];

  for (let i = 0; i < clampedSpins; i++) {
    const res = resolveThunderfallSpin(1, modifiers, { rng });
    const m = res.totalMultiplier;
    totalReturned += m;
    sumSq += m * m;
    if (m > 0) hits++;
    if (res.freeSpinsAwarded > 0) bonuses++;
    if (m >= 4) bigWins++;
    if (m > maxMult) maxMult = m;
    totalCascades += res.steps.length;

    for (const b of buckets) {
      if (m > b.min && m <= b.max) {
        b.count++;
        break;
      }
    }
  }

  const mean = totalReturned / clampedSpins;
  const variance = Math.max(0, sumSq / clampedSpins - mean * mean);
  const volatilitySigma = Number(Math.sqrt(variance).toFixed(2));

  return {
    spins: clampedSpins,
    empiricalRtp: Number((mean * 100).toFixed(2)),
    hitFrequency: Number(((hits / clampedSpins) * 100).toFixed(2)),
    volatilitySigma,
    maxMultiplier: Number(maxMult.toFixed(2)),
    bonusTriggerRate: Number(((bonuses / clampedSpins) * 100).toFixed(2)),
    bigWinRate: Number(((bigWins / clampedSpins) * 100).toFixed(2)),
    avgCascadeDepth: Number((totalCascades / clampedSpins).toFixed(2)),
    distribution: buckets.map((b) => ({
      bucket: b.label,
      count: b.count,
      pct: Number(((b.count / clampedSpins) * 100).toFixed(2)),
    })),
    durationMs: Math.max(1, Date.now() - start),
  };
}
