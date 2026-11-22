import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialDirectorState,
  computeDirectorModifiers,
  recordRoundOutcome,
} from './mlDirector';
import {
  evaluateSlotGrid,
  resolveThunderfallSpin,
  runMonteCarloSimulation,
  type SlotGrid,
} from './slotMath';
import {
  resolvePlinkoDrop,
  generateCrashPoint,
  resolveRouletteSpin,
  calculateMinesMultiplier,
  generateMinesBoard,
  applyDirectorMinesProtection,
  evaluateBlackjackHand,
  resolveBlackjackOutcome,
  calculateDiceSpecs,
  resolveDiceRoll,
  resolveWheelSpin,
} from './gameEngines';
import {
  createInitialRoguelikeState,
  advanceRoguelikeRound,
  computeRelicBonuses,
} from './roguelikeLoop';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('ML Director: Fair RNG mode disables win bias and comeback nudges', () => {
  const state = createInitialDirectorState(1000, 'off');
  const { modifiers } = computeDirectorModifiers(state, 100, 10);
  assert.equal(modifiers.winBias, 0);
  assert.equal(modifiers.pityActive, false);
  assert.equal(modifiers.comebackActive, false);
});

test('ML Director: Pity timer and Comeback rubber-banding activate under stress', () => {
  let state = createInitialDirectorState(1000, 'adaptive_ml');
  // Simulate 6 consecutive dry losses down to $150 (15% of buy-in)
  let balance = 1000;
  for (let i = 0; i < 6; i++) {
    const before = balance;
    balance -= 140;
    state = recordRoundOutcome(state, {
      gameId: 'slots',
      bet: 140,
      payout: 0,
      balanceBefore: before,
      balanceAfter: balance,
      armUsed: 'FLOW_DRIP',
      now: 1000 + i * 2000,
    });
  }
  assert.equal(state.dryStreak, 6);
  const { modifiers } = computeDirectorModifiers(
    state,
    balance,
    25,
    undefined,
    createSeededRng(42)
  );
  assert.equal(modifiers.pityActive, true);
  assert.equal(modifiers.comebackActive, true);
  assert.ok(modifiers.winBias > 0.15, `expected elevated winBias, got ${modifiers.winBias}`);
  assert.ok(modifiers.bonusBoost > 1.3, `expected elevated bonusBoost, got ${modifiers.bonusBoost}`);
});

test('ML Director: Online bandit learning updates arm posteriors and history', () => {
  const initial = createInitialDirectorState(1000, 'adaptive_ml');
  const updated = recordRoundOutcome(initial, {
    gameId: 'slots',
    bet: 20,
    payout: 160,
    balanceBefore: 1000,
    balanceAfter: 1140,
    armUsed: 'HOT_STREAK',
    now: 5000,
  });
  assert.equal(updated.roundsPlayed, 1);
  assert.equal(updated.winStreak, 1);
  assert.equal(updated.dryStreak, 0);
  assert.equal(updated.arms.HOT_STREAK.pulls, 1);
  assert.ok(updated.dopamineIndex > initial.dopamineIndex);
  assert.equal(updated.history.length, 1);
});

test('Slot Math: Evaluates 5-of-a-kind with wilds and 3 scatters accurately', () => {
  const grid: SlotGrid = [
    ['SCATTER', 'CROWN', 'CLUB'],
    ['SPADE', 'WILD', 'HEART'],
    ['SCATTER', 'CROWN', 'SPADE'],
    ['CLUB', 'CROWN', 'HEART'],
    ['SCATTER', 'CROWN', 'CLUB'],
  ];
  const evalRes = evaluateSlotGrid(grid);
  assert.equal(evalRes.scatterCount, 3);
  assert.ok(evalRes.wins.some((w) => w.symbol === 'CROWN' && w.count === 5));
  assert.ok(evalRes.scatterMultiplier > 0);
});

test('Slot Math: Monte Carlo simulation returns bounded RTP and distribution', () => {
  const state = createInitialDirectorState(1000, 'balanced');
  const { modifiers } = computeDirectorModifiers(state, 1000, 10, undefined, createSeededRng(7));
  const report = runMonteCarloSimulation(2000, modifiers, createSeededRng(99));
  assert.equal(report.spins, 2000);
  assert.ok(report.empiricalRtp > 40 && report.empiricalRtp < 250);
  assert.ok(report.hitFrequency > 10 && report.hitFrequency < 95);
  const sumCounts = report.distribution.reduce((a, b) => a + b.count, 0);
  assert.equal(sumCounts, 2000);
});

test('Slot Math: Thunderfall spin cascade steps and free spins trigger cleanly', () => {
  const state = createInitialDirectorState(1000, 'dopamine_max');
  const { modifiers } = computeDirectorModifiers(state, 1000, 10, undefined, createSeededRng(12));
  const res = resolveThunderfallSpin(10, modifiers, { rng: createSeededRng(123) });
  assert.ok(res.steps.length >= 1);
  assert.ok(res.totalPayout >= 0);
});

test('Game Engines: Plinko, Crash, Roulette, Mines, Blackjack, Dice, Wheel sanity checks', () => {
  const rng = createSeededRng(2026);
  const { modifiers } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'balanced'),
    1000,
    20,
    undefined,
    rng
  );

  // Plinko
  const plinko = resolvePlinkoDrop(10, 12, 'medium', modifiers, rng);
  assert.equal(plinko.path.length, 12);
  assert.ok(plinko.bucketIndex >= 0 && plinko.bucketIndex <= 12);

  // Crash
  const crashPt = generateCrashPoint(modifiers, rng);
  assert.ok(crashPt >= 1.01 && crashPt <= 150);

  // Roulette
  const roulette = resolveRouletteSpin(
    [{ id: 'b1', label: 'Red', type: { kind: 'red' }, amount: 25 }],
    modifiers,
    rng
  );
  assert.ok(roulette.landed >= 0 && roulette.landed <= 36);

  // Mines
  const m1 = calculateMinesMultiplier(25, 3, 1);
  const m3 = calculateMinesMultiplier(25, 3, 3);
  assert.ok(m3 > m1 && m1 > 1);
  const board = generateMinesBoard(5, rng);
  assert.equal(board.filter(Boolean).length, 5);
  const mineIndex = board.findIndex(Boolean);
  const protectedBoard = applyDirectorMinesProtection(
    board,
    new Array(25).fill(false),
    mineIndex,
    { ...modifiers, winBias: 0.9 },
    () => 0.01
  );
  assert.equal(protectedBoard[mineIndex], false);
  assert.equal(protectedBoard.filter(Boolean).length, 5);

  // Blackjack
  const bjHand = evaluateBlackjackHand([
    { suit: '♠', rank: 'A', id: '1' },
    { suit: '♥', rank: 'K', id: '2' },
  ]);
  assert.equal(bjHand.total, 21);
  assert.equal(bjHand.isBlackjack, true);
  const bjRes = resolveBlackjackOutcome(
    [
      { suit: '♠', rank: 'A', id: '1' },
      { suit: '♥', rank: 'K', id: '2' },
    ],
    [
      { suit: '♦', rank: '10', id: '3' },
      { suit: '♣', rank: '9', id: '4' },
    ],
    100
  );
  assert.equal(bjRes.outcome, 'BLACKJACK');
  assert.equal(bjRes.payout, 250);

  // Dice
  const diceSpec = calculateDiceSpecs(50, 'over');
  assert.equal(diceSpec.winChance, 50);
  assert.equal(diceSpec.multiplier, 1.98);
  const diceRoll = resolveDiceRoll(10, 50, 'over', modifiers, rng);
  assert.ok(diceRoll.roll >= 0 && diceRoll.roll <= 100);

  // Royal Wheel
  const wheel = resolveWheelSpin(10, modifiers, rng);
  assert.ok(wheel.segmentIndex >= 0 && wheel.segmentIndex < 24);
});

test('Roguelike VIP Loop: Clears floor when balance hits target and applies Vault Relics', () => {
  const initial = createInitialRoguelikeState(1000);
  assert.equal(initial.targetBalance, 1350);
  const { nextState, bonusAwarded } = advanceRoguelikeRound(initial, 1400);
  assert.equal(nextState.floorIndex, 1);
  assert.equal(nextState.floorsCleared, 1);
  assert.equal(bonusAwarded, 200);

  const bonuses = computeRelicBonuses(['golden-pity', 'cascade-catalyst', 'velvet-comp']);
  assert.equal(bonuses.pityReduction, 2);
  assert.equal(bonuses.cascadeStartBonus, 1);
  assert.equal(bonuses.cashbackRate, 0.06);
});
