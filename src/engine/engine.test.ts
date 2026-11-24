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

import {
  createInitialBehavioralStore,
  recordBehavioralEvent,
  runComprehensiveAnalysis,
} from './behavioralAnalyzer';
import {
  getBaccaratTotal,
  resolveBaccaratRound,
  getHiLoOdds,
  drawHiLoCard,
} from './gameEngines';

test('Behavioral System 1 (Real-Time) detects Credit Reload Hook & Tilt Chase', () => {
  let store = createInitialBehavioralStore(1000, 10000);
  // Add credit top-up
  store = recordBehavioralEvent(store, {
    type: 'CREDIT_ADDED',
    amount: 500,
    balanceBefore: 1000,
    balanceAfter: 1500,
    buyInReference: 1000,
    now: 20000,
  });
  assert.equal(store.realtime.microState, 'RELOAD_WELCOME');
  assert.equal(store.realtime.recentDepositBoostActive, true);
  assert.ok(store.realtime.winBiasDelta >= 0.06);

  // Play 5 rapid escalating losing rounds to push past reload window and trigger Tilt Chase
  let bal = 1500;
  for (let i = 0; i < 5; i++) {
    const bet = 40 * (i + 1);
    const before = bal;
    bal -= bet;
    store = recordBehavioralEvent(store, {
      type: 'ROUND_PLAYED',
      gameId: 'slots',
      amount: bet,
      payout: 0,
      multiplier: 0,
      balanceBefore: before,
      balanceAfter: bal,
      buyInReference: 1500,
      now: 25000 + i * 900,
    });
  }
  assert.ok(store.realtime.tiltScore >= 60, `expected high tiltScore, got ${store.realtime.tiltScore}`);
  assert.equal(store.realtime.microState, 'TILT_CHASE');
});

test('Behavioral System 2 (Comprehensive) classifies archetype and adapts future ML Director modifiers', () => {
  let store = createInitialBehavioralStore(1000, 1000);
  // 3 deposits + several rounds on baccarat
  for (let d = 0; d < 2; d++) {
    store = recordBehavioralEvent(store, {
      type: 'CREDIT_ADDED',
      amount: 1000,
      balanceBefore: 500,
      balanceAfter: 1500,
      buyInReference: 1000,
      now: 2000 + d * 1000,
    });
  }
  for (let i = 0; i < 6; i++) {
    store = recordBehavioralEvent(store, {
      type: 'ROUND_PLAYED',
      gameId: 'baccarat',
      amount: 100,
      payout: i % 2 === 0 ? 200 : 0,
      multiplier: i % 2 === 0 ? 2 : 0,
      balanceBefore: 1500,
      balanceAfter: 1500,
      buyInReference: 1000,
      now: 5000 + i * 2500,
      forceComprehensive: i === 5,
    });
  }
  const profile = runComprehensiveAnalysis(store.events, 30000);
  assert.equal(profile.archetype, 'Reload Thrill-Seeker');
  assert.equal(profile.favoriteGameId, 'baccarat');
  assert.equal(profile.creditDepositCount, 3);
  assert.equal(profile.totalCreditsAdded, 3000);
  assert.ok(profile.adaptedRtpFloor >= 104);

  const dir = createInitialDirectorState(1000, 'adaptive_ml');
  const rng = createSeededRng(77);
  const { modifiers: withoutBeh } = computeDirectorModifiers(dir, 1000, 50, undefined, rng);
  const { modifiers: withBeh } = computeDirectorModifiers(dir, 1000, 50, undefined, createSeededRng(77), {
    realtime: store.realtime,
    comprehensive: profile,
    currentGameId: 'baccarat',
  });
  assert.ok(withBeh.winBias > withoutBeh.winBias, 'behavioral profile should elevate winBias on favorite game');
});

test('New Games: Sovereign Baccarat & Crimson Hi-Lo Ladder math checks', () => {
  const rng = createSeededRng(555);
  const { modifiers } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'balanced'),
    1000,
    50,
    undefined,
    rng
  );

  // Baccarat points modulo 10
  assert.equal(
    getBaccaratTotal([
      { suit: '♠', rank: '9', id: 'a' },
      { suit: '♥', rank: 'K', id: 'b' },
    ]),
    9
  );
  assert.equal(
    getBaccaratTotal([
      { suit: '♠', rank: '7', id: 'c' },
      { suit: '♥', rank: '8', id: 'd' },
    ]),
    5
  );
  const bacc = resolveBaccaratRound(100, 'banker', modifiers, rng);
  assert.ok(bacc.playerTotal >= 0 && bacc.playerTotal <= 9);
  assert.ok(bacc.bankerTotal >= 0 && bacc.bankerTotal <= 9);
  assert.ok(bacc.playerCards.length >= 2 && bacc.playerCards.length <= 3);

  // Hi-Lo odds
  const odds7 = getHiLoOdds('7');
  assert.equal(odds7.higherChance, odds7.lowerChance);
  const odds2 = getHiLoOdds('2');
  assert.ok(odds2.lowerMult > odds2.higherMult);
  const draw = drawHiLoCard({ suit: '♠', rank: '7', id: 'cur' }, 'higher', modifiers, rng);
  assert.ok(draw.stepMultiplier >= 1.06);
});

import {
  getKenoPayoutMultiplier,
  resolveKenoDraw,
} from './gameEngines';
import {
  advanceJackpotAndFever,
  createInitialJackpotFeverState,
  FEVER_BONUS_RATE,
  FEVER_DURATION_ROUNDS,
} from './jackpotEngine';

test('Emerald Keno: 10 unique drawn numbers, accurate hit counts, and 1000x high-risk top payout', () => {
  const rng = createSeededRng(2026);
  const { modifiers } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'adaptive_ml'),
    1000,
    25,
    undefined,
    rng
  );

  assert.equal(getKenoPayoutMultiplier(10, 10, 'high'), 1000);
  assert.equal(getKenoPayoutMultiplier(10, 10, 'medium'), 1000);
  assert.equal(getKenoPayoutMultiplier(5, 0, 'high'), 0);

  const picks = [1, 5, 9, 14, 22, 31, 40];
  const res = resolveKenoDraw(20, picks, 'medium', modifiers, rng);
  assert.equal(res.drawnNumbers.length, 10);
  assert.equal(new Set(res.drawnNumbers).size, 10);
  assert.equal(res.hits, res.matches.length);
  assert.equal(res.payout, Number((20 * res.multiplier).toFixed(2)));
});

test('Progressive Jackpot & Fever Overdrive: charges fever to 100%, applies +15% bonus, and resets pool on drop', () => {
  let state = createInitialJackpotFeverState();
  const initialGrand = state.grandPool;

  // Force fever charge across winning rounds with non-jackpot RNG
  let triggered = false;
  for (let i = 0; i < 6; i++) {
    const res = advanceJackpotAndFever(state, {
      bet: 50,
      payout: 150,
      directorMode: 'adaptive_ml',
      microState: 'STEADY_ENGAGED',
      dopamineResponsiveness: 75,
      rng: () => 0.99,
    });
    state = res.nextState;
    if (res.feverJustTriggered) triggered = true;
  }
  assert.equal(triggered, true, 'Fever Overdrive should trigger upon reaching 100% charge');
  assert.ok(state.feverRoundsLeft > 0 && state.feverRoundsLeft <= FEVER_DURATION_ROUNDS);
  assert.ok(state.grandPool > initialGrand, 'Progressive pools should grow with every wager');

  // Verify +15% Fever bonus applies during active Fever Overdrive
  const feverRound = advanceJackpotAndFever(state, {
    bet: 100,
    payout: 200,
    directorMode: 'adaptive_ml',
    microState: 'EUPHORIA_FLOW',
    dopamineResponsiveness: 80,
    rng: () => 0.99,
  });
  assert.equal(feverRound.feverBonusPayout, Number((200 * FEVER_BONUS_RATE).toFixed(2)));

  // Verify Sovereign Grand Jackpot drop resets grand pool back to 25000 seed
  const jpDrop = advanceJackpotAndFever(feverRound.nextState, {
    bet: 100,
    payout: 0,
    directorMode: 'dopamine_max',
    microState: 'RELOAD_WELCOME',
    dopamineResponsiveness: 90,
    rng: () => 0.00001,
  });
  assert.ok(jpDrop.jackpotHit !== null);
  assert.equal(jpDrop.jackpotHit?.tier, 'GRAND');
  assert.equal(jpDrop.nextState.grandPool, 25000);
  assert.equal(jpDrop.nextState.totalJackpotsWon, 1);
});

import {
  FULL_VAULT_BONUS_MULT,
  resolveHoldWinBaseSpin,
  stepHoldWinRespin,
  sumBoardMultiplier,
  type HoldWinState,
} from './holdAndWinEngine';

test('Sovereign Hold & Win: forceBonus entry, 3-respin reset, Collector/Multiplier mechanics, and 15/15 Full Vault crack', () => {
  const rng = createSeededRng(4242);
  const { modifiers } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'adaptive_ml'),
    1000,
    25,
    undefined,
    rng
  );

  // 1. Direct Vault Feature Entry guarantees >= 5 orbs and 3 respins
  const entry = resolveHoldWinBaseSpin(25, modifiers, { forceBonus: true, rng });
  assert.equal(entry.enteredBonus, true);
  assert.equal(entry.state.phase, 'RESPINNING');
  assert.equal(entry.state.respinsLeft, 3);
  const openingLocked = entry.state.cells.filter(Boolean).length;
  assert.ok(openingLocked >= 5 && openingLocked <= 6);

  // 2. Blank respin decrements respinsLeft from 3 -> 2
  const blankStep = stepHoldWinRespin(entry.state, modifiers, () => 0.999);
  assert.equal(blankStep.landedCount, 0);
  assert.equal(blankStep.nextState.respinsLeft, 2);
  assert.equal(blankStep.finished, false);

  // 3. Landing a new orb resets respinsLeft back to 3
  const hitStep = stepHoldWinRespin(blankStep.nextState, modifiers, () => 0.001);
  assert.ok(hitStep.landedCount >= 1);
  assert.equal(hitStep.nextState.respinsLeft, 3);

  // 4. Deterministic Emerald Collector absorbs sum of all existing coins & reports source indices
  const collectorSetup: HoldWinState = {
    phase: 'RESPINNING',
    bet: 20,
    cells: [
      { id: 'c1', kind: 'COIN', value: 5 },
      { id: 'c2', kind: 'COIN', value: 10 },
      null,
      ...new Array(12).fill(null),
    ],
    respinsLeft: 2,
    spinCount: 1,
    totalMultiplier: 15,
    fullBoardBonus: false,
    lastStepEvents: [],
    collectorSourceIndices: [],
    collectorTargetIndex: null,
  };
  // Deterministic rng sequence: cell idx 2 drops (< cellDropProb), then rollOrbKind hits COLLECTOR (0.15)
  const seq = [0.01, 0.15, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99];
  let idx = 0;
  const collRes = stepHoldWinRespin(collectorSetup, { ...modifiers, bonusBoost: 1 }, () => seq[idx++] ?? 0.99);
  assert.equal(collRes.nextState.collectorTargetIndex, 2);
  assert.deepEqual(collRes.nextState.collectorSourceIndices, [0, 1]);
  assert.equal(collRes.nextState.cells[2]?.kind, 'COLLECTOR');
  assert.equal(collRes.nextState.cells[2]?.value, 15);
  assert.equal(sumBoardMultiplier(collRes.nextState.cells), 30);

  // 5. Filling the 15th cell triggers FULL VAULT CRACK (+100x bonus) and COMPLETED phase
  const almostFull: HoldWinState = {
    phase: 'RESPINNING',
    bet: 10,
    cells: [
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `f-${i}`,
        kind: 'COIN' as const,
        value: 2,
      })),
      null,
    ],
    respinsLeft: 1,
    spinCount: 4,
    totalMultiplier: 28,
    fullBoardBonus: false,
    lastStepEvents: [],
    collectorSourceIndices: [],
    collectorTargetIndex: null,
  };
  const crackSeq = [0.001, 0.5, 0.1]; // drop at cell 14, COIN kind, value=1
  let cIdx = 0;
  const fullRes = stepHoldWinRespin(almostFull, modifiers, () => crackSeq[cIdx++] ?? 0.5);
  assert.equal(fullRes.finished, true);
  assert.equal(fullRes.nextState.phase, 'COMPLETED');
  assert.equal(fullRes.nextState.fullBoardBonus, true);
  assert.equal(fullRes.nextState.totalMultiplier, 28 + 1 + FULL_VAULT_BONUS_MULT);
  assert.equal(fullRes.finalPayout, Number((10 * (29 + FULL_VAULT_BONUS_MULT)).toFixed(2)));
});

import {
  computeCadenceEntropy,
  createInitialHouseMindState,
  recordHouseCashOut,
  recordHouseRitualSignal,
  updateHouseMindAfterRound,
} from './houseMind';

test('The House Mind (Realistic Adversarial ML): Shannon entropy, ritual bait-to-harvest trap, anti-quit lifeline & cash-out ledger', () => {
  // 1. Shannon Cadence Entropy distinguishes robotic timing from varied chaotic timing
  const robotic = computeCadenceEntropy([2400, 2450, 2380, 2420, 2410, 2440]);
  assert.ok(robotic.entropyPct < 35, `expected low entropy for fixed cadence, got ${robotic.entropyPct}`);
  const chaotic = computeCadenceEntropy([500, 1200, 2400, 4200, 7500, 12500]);
  assert.ok(chaotic.entropyPct > 90, `expected high entropy across all 6 buckets, got ${chaotic.entropyPct}`);

  // 2. Superstition toggle rituals trigger BAIT_THEORY -> then flip polarity to PREDATOR_HARVEST
  let hm = createInitialHouseMindState(1000, 10000);
  hm = recordHouseRitualSignal(hm, {
    type: 'TURBO_TOGGLE',
    gameId: 'slots',
    detail: 'Turbo ON',
    now: 11000,
  });
  hm = recordHouseRitualSignal(hm, {
    type: 'AUDIO_TOGGLE',
    gameId: 'slots',
    detail: 'Audio Muted',
    now: 12000,
  });
  assert.equal(hm.phase, 'BAIT_THEORY');
  assert.equal(hm.ritualBaitRemaining, 2);

  // Two bait rounds exhaust ritualBaitRemaining and arm the counter-trap
  hm = updateHouseMindAfterRound(hm, {
    gameId: 'slots',
    bet: 50,
    payout: 90,
    balanceBefore: 1000,
    balanceAfter: 1040,
    reactionMs: 2400,
    dryStreak: 0,
    winStreak: 1,
    avgBet: 50,
    now: 15000,
  });
  assert.equal(hm.phase, 'BAIT_THEORY');
  assert.equal(hm.ritualBaitRemaining, 1);

  hm = updateHouseMindAfterRound(hm, {
    gameId: 'slots',
    bet: 50,
    payout: 0,
    balanceBefore: 1040,
    balanceAfter: 990,
    reactionMs: 2420,
    dryStreak: 1,
    winStreak: 0,
    avgBet: 50,
    now: 17500,
  });
  assert.equal(hm.phase, 'PREDATOR_HARVEST');
  assert.equal(hm.ritualExploitArmed, true);
  assert.ok(hm.adversarialWinBias <= -0.14, `expected harsh negative winBias, got ${hm.adversarialWinBias}`);
  assert.equal(hm.houseBankroll, 50010); // -40 on round 1, +50 on round 2 -> +$10 net

  // 3. Anti-Quit Lifeline triggers when player suffers a deep dry streak & drawdown
  for (let i = 0; i < 3; i++) {
    hm = updateHouseMindAfterRound(hm, {
      gameId: 'slots',
      bet: 150,
      payout: 0,
      balanceBefore: 990 - i * 150,
      balanceAfter: 990 - (i + 1) * 150,
      reactionMs: 5200,
      dryStreak: 2 + i,
      winStreak: 0,
      avgBet: 100,
      now: 22000 + i * 5200,
    });
  }
  assert.equal(hm.phase, 'LIFELINE_TEASE');
  assert.ok(hm.lifelinesReleased >= 1);
  assert.ok(hm.adversarialWinBias > 0.1, `expected positive relief winBias, got ${hm.adversarialWinBias}`);

  // 4. Cash-Out Battle Accounting categorizes outcomes accurately
  const escaped = recordHouseCashOut(hm, 1450, 50000);
  assert.equal(escaped.record.outcome, 'PLAYER_ESCAPED_PROFIT');
  assert.equal(escaped.record.netPlayerProfit, 450);

  const wiped = recordHouseCashOut(escaped.nextState, 0, 60000);
  assert.equal(wiped.record.outcome, 'HOUSE_WIPED_PLAYER');
  assert.equal(wiped.nextState.cashOutHistory.length, 2);
});

test('Adversarial Negative winBias Squeeze: realistic_house director & Predator Traps in game engines', () => {
  const dirState = createInitialDirectorState(1000, 'realistic_house');
  const harvestMind = {
    ...createInitialHouseMindState(1000, 1000),
    phase: 'PREDATOR_HARVEST' as const,
    adversarialWinBias: -0.22,
    adversarialNearMissRate: 0.58,
    adversarialBonusBoost: 0.72,
    targetEffectiveRtp: 83.2,
  };

  const { modifiers } = computeDirectorModifiers(
    dirState,
    1300,
    50,
    undefined,
    createSeededRng(77),
    undefined,
    harvestMind
  );
  assert.equal(modifiers.winBias, -0.22);
  assert.ok(modifiers.expectedRtp < 90);
  assert.equal(modifiers.pityActive, false);

  // Mines Predator Trap: swaps a mine onto a greedy safe click once safeSoFar >= 2
  const board = generateMinesBoard(5, createSeededRng(42));
  const revealed = new Array<boolean>(25).fill(false);
  const safeIndices = board
    .map((isMine, idx) => (isMine ? -1 : idx))
    .filter((idx) => idx >= 0);
  revealed[safeIndices[0]] = true;
  revealed[safeIndices[1]] = true;
  const targetSafeIdx = safeIndices[2];

  const trappedBoard = applyDirectorMinesProtection(
    board,
    revealed,
    targetSafeIdx,
    modifiers,
    () => 0.005
  );
  assert.equal(trappedBoard[targetSafeIdx], true, 'Predator Trap should move a mine onto greedy tile');
  assert.equal(trappedBoard.filter(Boolean).length, 5, 'Total mine count must remain invariant');

  // Dice & Wheel negative winBias squeeze remain valid and bounded
  const diceRes = resolveDiceRoll(25, 50, 'over', modifiers, createSeededRng(101));
  assert.ok(diceRes.roll >= 0 && diceRes.roll <= 100);

  const wheelRes = resolveWheelSpin(25, modifiers, createSeededRng(202));
  assert.ok(wheelRes.segmentIndex >= 0 && wheelRes.segmentIndex < 24);
});

import {
  applyBlackjackHouseBias,
  calculateCoinFlipMultiplier,
  calculateLimboWinChance,
  calculateTowerMultiplier,
  createShuffledShoe,
  evaluatePokerHand,
  generateTowerBoard,
  resolveCoinFlipStep,
  resolveLimboRound,
  resolvePokerDraw,
  resolveTowerStep,
} from './gameEngines';
import {
  computeCadenceAutocorrelation,
  runAllStrategiesBenchmark,
  runRealisticBattleSimulation,
  setHousePersonality,
} from './houseMind';

test('Upgraded Realistic Mode: Balance Triplet, Martingale/Speed/Auto patterns, activeTheoriesCount & Universal Multi-Game Ledger', () => {
  let hm = createInitialHouseMindState(1000, 10000);
  assert.equal(hm.activeTheoriesCount, 0);
  assert.equal(hm.startingBalance, 1000);

  // 1. Speed switch to 8x + Turbo + Auto-Spin immediately raises activeTheoriesCount
  hm = recordHouseRitualSignal(hm, {
    type: 'SPEED_CHANGE',
    gameId: 'slots',
    detail: 'Slots Speed 8x',
    spinSpeedMultiplier: 8,
    now: 11000,
  });
  assert.ok(hm.activeTheoriesCount >= 1, `expected activeTheoriesCount >= 1, got ${hm.activeTheoriesCount}`);
  const afterSpeedCount = hm.activeTheoriesCount;

  hm = recordHouseRitualSignal(hm, {
    type: 'AUTO_TOGGLE',
    gameId: 'slots',
    detail: 'Slots Auto-Spin ON',
    autoSpinActive: true,
    now: 12000,
  });
  assert.ok(
    hm.activeTheoriesCount > afterSpeedCount,
    `expected activeTheoriesCount to increment from ${afterSpeedCount}, got ${hm.activeTheoriesCount}`
  );

  // 2. Round 1 loss ($50) -> Round 2 Martingale doubling ($100) triggers MARTINGALE_CHASE & PREDATOR_HARVEST
  hm = updateHouseMindAfterRound(hm, {
    gameId: 'slots',
    bet: 50,
    payout: 0,
    balanceBefore: 1000,
    balanceAfter: 950,
    reactionMs: 1400,
    dryStreak: 1,
    winStreak: 0,
    avgBet: 50,
    autoSpinActive: true,
    spinSpeedMultiplier: 8,
    now: 14000,
  });
  assert.equal(hm.lastBalance, 1000);
  assert.equal(hm.currentBalance, 950);
  assert.equal(hm.lastBalanceDelta, -50);

  hm = updateHouseMindAfterRound(hm, {
    gameId: 'limbo',
    bet: 100,
    payout: 0,
    balanceBefore: 950,
    balanceAfter: 850,
    reactionMs: 1350,
    dryStreak: 2,
    winStreak: 0,
    avgBet: 75,
    autoSpinActive: true,
    spinSpeedMultiplier: 8,
    now: 15500,
  });
  assert.equal(hm.betPattern, 'MARTINGALE_CHASE');
  assert.equal(hm.betChangeRatio, 2);
  assert.equal(hm.betDelta, 50);
  assert.ok(hm.activeTheoriesCount >= 3, `expected >= 3 active theories, got ${hm.activeTheoriesCount}`);
  assert.ok(hm.perGameStats.slots && hm.perGameStats.limbo, 'perGameStats must track across multiple games');

  // 3. Windfall profit jump classifies WINDFALL_LOCK & harsh negative adversarial bias
  hm = updateHouseMindAfterRound(hm, {
    gameId: 'tower',
    bet: 100,
    payout: 600,
    balanceBefore: 850,
    balanceAfter: 1350,
    reactionMs: 1420,
    dryStreak: 0,
    winStreak: 1,
    avgBet: 83,
    now: 17000,
  });
  assert.equal(hm.balanceScenario, 'WINDFALL_LOCK');
  assert.equal(hm.phase, 'PREDATOR_HARVEST');
  assert.ok(hm.adversarialWinBias <= -0.18, `expected strong harvest squeeze, got ${hm.adversarialWinBias}`);
  assert.equal(Object.keys(hm.perGameStats).length, 3);
});

test('New Games (Dragon Tower & Vault Limbo) + Blackjack Realistic House Bias', () => {
  const rng = createSeededRng(2026);
  const { modifiers: harvestMods } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'realistic_house'),
    1300,
    50,
    undefined,
    rng,
    undefined,
    {
      ...createInitialHouseMindState(1000, 1000),
      phase: 'PREDATOR_HARVEST',
      adversarialWinBias: -0.24,
      adversarialNearMissRate: 0.6,
      adversarialBonusBoost: 0.7,
      targetEffectiveRtp: 81.5,
    }
  );

  // Dragon Tower
  const towerBoard = generateTowerBoard('medium', createSeededRng(7));
  assert.equal(towerBoard.length, 9);
  for (const row of towerBoard) {
    assert.equal(row.length, 3);
    assert.equal(row.filter(Boolean).length, 2);
  }
  assert.ok(calculateTowerMultiplier('medium', 5) > calculateTowerMultiplier('medium', 2));
  const safeCol = towerBoard[3].findIndex(Boolean);
  const trappedStep = resolveTowerStep(towerBoard[3], safeCol, 3, harvestMods, () => 0.01);
  assert.equal(trappedStep.isSafe, false, 'Predator Harvest should spring trap on greedy upper floor');
  assert.equal(trappedStep.updatedRow.filter(Boolean).length, 2, 'Safe egg count per row must remain invariant');

  // Vault Limbo
  assert.equal(calculateLimboWinChance(2), 49.25);
  const limboRes = resolveLimboRound(50, 5, harvestMods, createSeededRng(33));
  assert.ok(limboRes.rolledMultiplier >= 1.0 && limboRes.rolledMultiplier <= 2500);
  assert.equal(limboRes.payout, limboRes.won ? 250 : 0);

  // Blackjack Realistic Bias
  const dealerHand = [
    { suit: '♠' as const, rank: '10' as const, id: 'd1' },
    { suit: '♦' as const, rank: '5' as const, id: 'd2' },
  ];
  const bustDraw = { suit: '♣' as const, rank: '9' as const, id: 'd3' };
  const savedCard = applyBlackjackHouseBias(dealerHand, bustDraw, 19, harvestMods, () => 0.01);
  assert.equal(savedCard.rank, '5', 'Realistic squeeze should save dealer 15 to 20 against player 19');

  // Consecutive shuffled shoes must produce globally unique card IDs (prevents duplicate React keys in Hi-Lo / Blackjack)
  const shoeA = createShuffledShoe(1, createSeededRng(10));
  const shoeB = createShuffledShoe(1, createSeededRng(10));
  const idsA = new Set(shoeA.map((c) => c.id));
  for (const c of shoeB) {
    assert.ok(!idsA.has(c.id), `duplicate card id across shoes: ${c.id}`);
  }
});

test('New Games #15 & #16: Royal Video Poker evaluator/draw bias & Obsidian Coin Flip streak math', () => {
  // Royal Flush 800x check
  const royal = [
    { suit: '♠' as const, rank: '10' as const, id: 'r1' },
    { suit: '♠' as const, rank: 'J' as const, id: 'r2' },
    { suit: '♠' as const, rank: 'Q' as const, id: 'r3' },
    { suit: '♠' as const, rank: 'K' as const, id: 'r4' },
    { suit: '♠' as const, rank: 'A' as const, id: 'r5' },
  ];
  const royalEval = evaluatePokerHand(royal);
  assert.equal(royalEval.tier, 'ROYAL_FLUSH');
  assert.equal(royalEval.multiplier, 800);

  // Jacks or Better vs Low Pair near-miss
  const jacksPair = [
    { suit: '♠' as const, rank: 'J' as const, id: 'j1' },
    { suit: '♥' as const, rank: 'J' as const, id: 'j2' },
    { suit: '♦' as const, rank: '3' as const, id: 'j3' },
    { suit: '♣' as const, rank: '7' as const, id: 'j4' },
    { suit: '♠' as const, rank: '9' as const, id: 'j5' },
  ];
  assert.equal(evaluatePokerHand(jacksPair).tier, 'JACKS_OR_BETTER');
  assert.equal(evaluatePokerHand(jacksPair).multiplier, 1);

  const lowPair = [
    { suit: '♠' as const, rank: '6' as const, id: 'l1' },
    { suit: '♥' as const, rank: '6' as const, id: 'l2' },
    { suit: '♦' as const, rank: '3' as const, id: 'l3' },
    { suit: '♣' as const, rank: '7' as const, id: 'l4' },
    { suit: '♠' as const, rank: '9' as const, id: 'l5' },
  ];
  const lowEval = evaluatePokerHand(lowPair);
  assert.equal(lowEval.multiplier, 0);
  assert.equal(lowEval.isNearMiss, true);

  // resolvePokerDraw respects heldMask
  const deck = createShuffledShoe(1, createSeededRng(42));
  const { modifiers } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'off'),
    1000,
    25,
    undefined,
    createSeededRng(42)
  );
  const drawRes = resolvePokerDraw(
    royal,
    [true, true, true, true, true],
    deck,
    10,
    modifiers,
    createSeededRng(42)
  );
  assert.equal(drawRes.payout, 8000);

  // Obsidian Coin Flip compounding multiplier & Predator Harvest pressure
  assert.equal(calculateCoinFlipMultiplier(1), 1.96);
  assert.equal(calculateCoinFlipMultiplier(3), 7.53);
  const { modifiers: harvestMods } = computeDirectorModifiers(
    createInitialDirectorState(1000, 'realistic_house'),
    1300,
    50,
    undefined,
    createSeededRng(9),
    undefined,
    {
      ...createInitialHouseMindState(1000, 1000),
      phase: 'PREDATOR_HARVEST',
      adversarialWinBias: -0.24,
    }
  );
  const flipLoss = resolveCoinFlipStep('crown', 3, harvestMods, () => 0.9);
  assert.equal(flipLoss.won, false);
  assert.equal(flipLoss.landed, 'vault');
  assert.equal(flipLoss.wasNearMiss, true);
});

test('House Mind Theories #9/#10 (Clock-Boundary & Reload Revenge), equityHistory & Offline Battle Simulator', () => {
  let hm = createInitialHouseMindState(1000, 60_000);
  // Log credit reload signal -> Theory #10 (reload-revenge)
  hm = recordHouseRitualSignal(hm, {
    type: 'CREDIT_RELOAD',
    detail: 'Added $500 chips',
    creditAmount: 500,
    now: 60_000,
  });
  assert.ok(
    hm.detectedTheories.some((t) => t.id === 'reload-revenge'),
    'CREDIT_RELOAD should trigger reload-revenge theory'
  );

  // Play 4 rounds right on :00 / :15 / :30 / :45 clock-second boundaries -> Theory #9
  const boundaryTimes = [60_000, 75_000, 90_000, 105_000];
  let bal = 1500;
  for (let i = 0; i < boundaryTimes.length; i++) {
    const before = bal;
    bal -= 25;
    hm = updateHouseMindAfterRound(hm, {
      gameId: 'poker',
      bet: 25,
      payout: 0,
      balanceBefore: before,
      balanceAfter: bal,
      reactionMs: 15000,
      dryStreak: i + 1,
      winStreak: 0,
      avgBet: 25,
      now: boundaryTimes[i],
    });
  }
  assert.ok(
    hm.detectedTheories.some((t) => t.id === 'clock-minute-theory'),
    'Repeated :00/:15/:30/:45 taps should trigger clock-minute-theory'
  );
  assert.ok(hm.equityHistory.length >= 5, 'equityHistory should track session balance trajectory');

  // Offline Monte Carlo Realistic Battle Simulator
  const sim = runRealisticBattleSimulation('martingale', {
    sessions: 12,
    maxRounds: 60,
    startingBalance: 1000,
    baseBet: 25,
    rng: createSeededRng(12345),
  });
  assert.equal(sim.sessionsSimulated, 12);
  assert.ok(sim.bankruptRatePct >= 0 && sim.bankruptRatePct <= 100);
  assert.ok(sim.avgActiveTheories >= 1, `expected active theories detected in martingale sim, got ${sim.avgActiveTheories}`);
});

test('Deep Realistic Mode: Markov 2x3 Bet Forecast, Pre-Emptive Squeeze, Lag-1 Autocorrelation & 4-Arm Tactic Bandit', () => {
  // Verify Lag-1 autocorrelation detects alternating fast/slow tap rhythm
  const alternating = [700, 4200, 750, 4300, 720, 4150, 710, 4250];
  const rAlt = computeCadenceAutocorrelation(alternating);
  assert.ok(rAlt <= -0.75, `expected strong negative lag-1 autocorrelation, got ${rAlt}`);

  let hm = createInitialHouseMindState(1000, 10_000, undefined, 'PSYCHOLOGIST');
  assert.equal(hm.personality, 'PSYCHOLOGIST');

  // Simulate 8 rounds of post-loss bet raising + alternating fast/slow taps + LDW partial hits
  let bal = 1000;
  let bet = 20;
  for (let i = 0; i < 8; i++) {
    const before = bal;
    const payout = i % 2 === 1 ? Number((bet * 0.4).toFixed(2)) : 0; // LDW on odd rounds
    bal = Number((bal - bet + payout).toFixed(2));
    hm = updateHouseMindAfterRound(hm, {
      gameId: 'slots',
      bet,
      payout,
      balanceBefore: before,
      balanceAfter: bal,
      reactionMs: alternating[i],
      dryStreak: i + 1,
      winStreak: 0,
      avgBet: 35,
      now: 12_000 + i * 2500,
    });
    // Raise bet after every loss so Markov P(UP | Loss) spikes past 60%
    bet = Math.min(200, Math.round(bet * 1.4));
  }

  assert.ok(hm.nextBetSpikeProb >= 60, `expected Markov nextBetSpikeProb >= 60%, got ${hm.nextBetSpikeProb}`);
  assert.equal(hm.preemptiveSqueezeArmed, true, 'pre-emptive squeeze must arm when Markov raise prob >= 60%');
  assert.ok(
    hm.detectedTheories.some((t) => t.id === 'markov-bet-predictability'),
    'expected Theory #11 markov-bet-predictability'
  );
  assert.ok(
    hm.detectedTheories.some((t) => t.id === 'alternating-cadence-pattern'),
    'expected Theory #12 alternating-cadence-pattern'
  );
  assert.equal(hm.ldwCount, 4, 'expected 4 Losses Disguised as Wins rounds tracked');
  assert.ok(hm.ldwRatePct === 50, `expected 50% LDW rate, got ${hm.ldwRatePct}`);

  const totalTacticPulls = Object.values(hm.tacticArms).reduce((acc, a) => acc + a.pulls, 0);
  assert.equal(totalTacticPulls, 8, '4-Arm House Tactic Bandit must record every round');
  assert.ok(hm.kellyOverbetIndex >= 20, 'kellyOverbetIndex must rise under escalating bets');
  assert.ok(hm.estimatedRoundsToRuin !== null && hm.estimatedRoundsToRuin > 0);

  // Verify LDW micro-hit injection works inside Thunderfall slotMath when ldwIntensity is high
  const ldwMods = {
    activeArm: 'TEASE_BUILD' as const,
    winBias: -0.1,
    bonusBoost: 0.85,
    nearMissRate: 0.4,
    cascadeBoost: 0,
    pityActive: false,
    comebackActive: false,
    markovState: 'COLD' as const,
    expectedRtp: 88,
    ldwIntensity: 0.45,
  };
  let ldwHits = 0;
  const rng = createSeededRng(77);
  for (let i = 0; i < 60; i++) {
    const spin = resolveThunderfallSpin(100, ldwMods, { rng });
    if (spin.totalPayout > 0 && spin.totalPayout < 100) ldwHits++;
  }
  assert.ok(ldwHits >= 5, `expected LDW sub-1x hits in slots with ldwIntensity=0.45, got ${ldwHits}`);
});

test('Deep Realistic Mode: Cross-Session House Memory Ambush, Operator Personalities & 6-Strategy Benchmark', () => {
  // Player escapes with +16% profit -> House Memory tightens adaptiveWindfallTriggerPct below 15%
  const s1 = createInitialHouseMindState(1000, 1000, undefined, 'CASINO_FLOOR');
  const { nextState: afterEscape } = recordHouseCashOut(s1, 1160, 2000);
  assert.equal(afterEscape.memory.sessionsObserved, 1);
  assert.equal(afterEscape.memory.playerEscapes, 1);
  assert.ok(
    afterEscape.memory.adaptiveWindfallTriggerPct < 15,
    `expected tightened adaptiveWindfallTriggerPct < 15, got ${afterEscape.memory.adaptiveWindfallTriggerPct}`
  );

  // Next session inherits House Memory and switches to SHARK_PIT
  let s2 = createInitialHouseMindState(1000, 3000, afterEscape.memory, 'CASINO_FLOOR');
  s2 = setHousePersonality(s2, 'SHARK_PIT', 3500);
  assert.equal(s2.personality, 'SHARK_PIT');
  assert.equal(s2.memory.sessionsObserved, 1);

  // Even a +11% balance surge now triggers WINDFALL_LOCK under SHARK_PIT / tightened memory!
  const s2After = updateHouseMindAfterRound(s2, {
    gameId: 'blackjack',
    bet: 50,
    payout: 160,
    balanceBefore: 1000,
    balanceAfter: 1110,
    reactionMs: 1800,
    dryStreak: 0,
    winStreak: 1,
    avgBet: 50,
    now: 5000,
  });
  assert.equal(s2After.balanceScenario, 'WINDFALL_LOCK');

  // 6-Strategy Offline Benchmark
  const bench = runAllStrategiesBenchmark('SHARK_PIT', {
    sessions: 8,
    maxRounds: 45,
    rng: createSeededRng(999),
  });
  assert.equal(bench.length, 6);
  const ids = bench.map((b) => b.strategy);
  assert.ok(ids.includes('ritual_toggler') && ids.includes('entropy_ghost'));
  for (const row of bench) {
    assert.equal(row.personality, 'SHARK_PIT');
    assert.ok(row.avgRoundsSurvived > 0);
    assert.ok(row.dominantTactic.length > 0);
  }
});






