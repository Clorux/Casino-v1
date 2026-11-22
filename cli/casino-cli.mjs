#!/usr/bin/env node
/**
 * Velvet Vault Casino - Standalone Zero-Dependency Offline Terminal Edition
 * Runs natively in Windows PowerShell, CMD (DOS), macOS/Linux Terminal, and Android Termux.
 * Usage: node cli/casino-cli.mjs
 */

import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lineQueue = [];
let pendingResolve = null;
let closed = false;
rl.on('line', (line) => {
  if (pendingResolve) {
    const r = pendingResolve;
    pendingResolve = null;
    r(line.trim());
  } else {
    lineQueue.push(line.trim());
  }
});
rl.on('close', () => {
  closed = true;
  if (pendingResolve) {
    const r = pendingResolve;
    pendingResolve = null;
    r('q');
  }
});
const ask = (q) =>
  new Promise((resolve) => {
    process.stdout.write(q);
    if (lineQueue.length > 0) {
      resolve(lineQueue.shift());
    } else if (closed) {
      resolve('q');
    } else {
      pendingResolve = resolve;
    }
  });

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  gold: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const SYMBOLS = [
  { s: 'CRN', mult: 12, w: 3 },
  { s: 'DIA', mult: 8, w: 5 },
  { s: 'RBY', mult: 5, w: 7 },
  { s: 'EMR', mult: 3.5, w: 9 },
  { s: 'WLD', mult: 15, w: 3 },
  { s: 'SCT', mult: 6, w: 4 },
  { s: 'SPD', mult: 1.8, w: 12 },
  { s: 'HRT', mult: 1.8, w: 12 },
];

function createStrip(winBias) {
  const strip = [];
  for (const sym of SYMBOLS) {
    const boost = sym.s === 'WLD' || sym.s === 'CRN' ? 1 + winBias * 2.5 : 1;
    const count = Math.max(1, Math.round(sym.w * boost));
    for (let i = 0; i < count; i++) strip.push(sym);
  }
  return strip;
}

const state = {
  balance: 1000,
  buyIn: 1000,
  dryStreak: 0,
  rounds: 0,
  dopamine: 58,
  directorOn: true,
};

function getDirectorBias() {
  if (!state.directorOn) return { winBias: 0, arm: 'FAIR_RNG' };
  const lowBank = state.balance < state.buyIn * 0.22;
  const pity = state.dryStreak >= 4;
  if (lowBank) return { winBias: 0.24, arm: 'COMEBACK_SURGE' };
  if (pity) return { winBias: 0.2, arm: 'JACKPOT_SPIKE' };
  return { winBias: 0.08, arm: 'ADAPTIVE_FLOW' };
}

function record(bet, payout) {
  state.rounds++;
  state.balance = Number((state.balance - bet + payout).toFixed(2));
  if (payout > 0) {
    state.dryStreak = 0;
    state.dopamine = Math.min(99, Math.round(state.dopamine + Math.min(24, (payout / bet) * 5)));
  } else {
    state.dryStreak++;
    state.dopamine = Math.max(15, state.dopamine - 4);
  }
}

async function playSlots(bet) {
  const { winBias, arm } = getDirectorBias();
  const strip = createStrip(winBias);
  const pick = () => strip[Math.floor(Math.random() * strip.length)];
  const reels = [pick(), pick(), pick()];

  if (reels[0].s !== reels[1].s && Math.random() < winBias * 1.4) {
    reels[1] = reels[0];
    reels[2] = Math.random() < 0.7 ? reels[0] : SYMBOLS[4];
  }

  console.log(`\n  ${C.gold}[ ${reels[0].s} | ${reels[1].s} | ${reels[2].s} ]${C.reset}  ${C.dim}(Policy: ${arm})${C.reset}`);
  let mult = 0;
  const match = (a, b) => a.s === b.s || a.s === 'WLD' || b.s === 'WLD';
  if (match(reels[0], reels[1]) && match(reels[1], reels[2])) {
    const base = reels.find((r) => r.s !== 'WLD') ?? reels[0];
    mult = base.mult;
  } else if (match(reels[0], reels[1]) || match(reels[1], reels[2])) {
    mult = 1.2;
  }
  const payout = Number((bet * mult).toFixed(2));
  record(bet, payout);
  if (payout > 0) {
    console.log(`  ${C.green}${C.bold}WIN! +$${payout.toFixed(2)} (${mult}x)${C.reset}`);
  } else {
    console.log(`  ${C.red}No line hit.${C.reset}`);
  }
}

async function playDice(bet) {
  const targetStr = await ask('  Target Roll Over (5-95, default 50): ');
  const target = Math.min(95, Math.max(5, Number(targetStr) || 50));
  const mult = Number((99 / (100 - target)).toFixed(2));
  const { winBias } = getDirectorBias();
  let roll = Number((Math.random() * 100).toFixed(2));
  if (roll <= target && Math.random() < winBias) {
    roll = Number((target + Math.random() * (99.9 - target)).toFixed(2));
  }
  const won = roll > target;
  const payout = won ? Number((bet * mult).toFixed(2)) : 0;
  record(bet, payout);
  console.log(`  Rolled ${C.bold}${roll.toFixed(2)}${C.reset} vs >${target} (${mult}x) -> ${won ? `${C.green}WIN +$${payout}` : `${C.red}MISS`}${C.reset}`);
}

async function playCrash(bet) {
  const targetStr = await ask('  Auto-Cashout Multiplier (e.g. 2.5): ');
  const cashout = Math.max(1.1, Number(targetStr) || 2.0);
  const { winBias } = getDirectorBias();
  const u = Math.max(0.001, Math.min(0.999, Math.random()));
  let crash = (0.98 + winBias * 0.3) / (1 - u);
  crash = Number(Math.min(100, Math.max(1.01, crash)).toFixed(2));
  const won = crash >= cashout;
  const payout = won ? Number((bet * cashout).toFixed(2)) : 0;
  record(bet, payout);
  console.log(`  Crashed at ${C.bold}${crash.toFixed(2)}x${C.reset} | Your target ${cashout.toFixed(2)}x -> ${won ? `${C.green}CASHED OUT +$${payout}` : `${C.red}BUSTED`}${C.reset}`);
}

async function playRoulette(bet) {
  const pick = (await ask('  Bet on (r)ed, (b)lack, or (0-36): ')).toLowerCase();
  const { winBias } = getDirectorBias();
  const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  let landed = Math.floor(Math.random() * 37);
  const isWin = (n) => {
    if (pick === 'r') return n !== 0 && reds.has(n);
    if (pick === 'b') return n !== 0 && !reds.has(n);
    return Number(pick) === n;
  };
  if (!isWin(landed) && Math.random() < winBias) {
    for (let tries = 0; tries < 20; tries++) {
      const alt = Math.floor(Math.random() * 37);
      if (isWin(alt)) { landed = alt; break; }
    }
  }
  const color = landed === 0 ? 'GREEN' : reds.has(landed) ? 'RED' : 'BLACK';
  const mult = pick === 'r' || pick === 'b' ? 2 : 36;
  const payout = isWin(landed) ? Number((bet * mult).toFixed(2)) : 0;
  record(bet, payout);
  console.log(`  Wheel landed on ${C.bold}${landed} (${color})${C.reset} -> ${payout > 0 ? `${C.green}WIN +$${payout}` : `${C.red}MISS`}${C.reset}`);
}

async function playPlinko(bet) {
  const mults = [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29];
  const { winBias } = getDirectorBias();
  let rights = 0;
  const dir = Math.random() < 0.5 ? 1 : -1;
  for (let i = 0; i < 8; i++) {
    if (Math.random() < 0.5 + dir * winBias * 0.35) rights++;
  }
  const mult = mults[rights];
  const payout = Number((bet * mult).toFixed(2));
  record(bet, payout);
  console.log(`  Plinko bucket #${rights + 1} (${C.bold}${mult}x${C.reset}) -> ${payout >= bet ? C.green : C.red}$${payout.toFixed(2)}${C.reset}`);
}

async function playWheel(bet) {
  const segs = [0, 1.5, 0, 2, 0, 3, 0, 5, 0, 10, 0, 25, 0, 50];
  const { winBias } = getDirectorBias();
  let mult = segs[Math.floor(Math.random() * segs.length)];
  if (mult === 0 && Math.random() < winBias * 1.3) {
    const winners = segs.filter((m) => m > 0);
    mult = winners[Math.floor(Math.random() * winners.length)];
  }
  const payout = Number((bet * mult).toFixed(2));
  record(bet, payout);
  console.log(`  Royal Wheel stopped on ${C.bold}${mult}x${C.reset} -> ${payout > 0 ? `${C.green}WIN +$${payout}` : `${C.red}0x`}${C.reset}`);
}

async function main() {
  console.log(`\n${C.gold}${C.bold}  VELVET VAULT CASINO — OFFLINE CLI EDITION${C.reset}`);
  console.log(`${C.dim}  Works natively in PowerShell, CMD/DOS, Linux/macOS Terminal & Termux${C.reset}\n`);

  const startStr = await ask('  Enter starting bankroll (default 1000): $');
  const startBal = Math.max(10, Number(startStr) || 1000);
  state.balance = startBal;
  state.buyIn = startBal;

  while (true) {
    console.log(`\n  ${C.gold}Balance: $${state.balance.toFixed(2)}${C.reset} | Rounds: ${state.rounds} | Dopamine: ${state.dopamine}/100 | ML Director: ${state.directorOn ? 'ON' : 'OFF'}`);
    console.log('  [1] Thunderfall Slots  [2] Plinko  [3] Crash  [4] Roulette  [5] Dice  [6] Royal Wheel');
    console.log('  [t] Toggle ML Director  [r] Rebuy +$1000  [q] Quit');

    const cmd = (await ask('  Select > ')).toLowerCase();
    if (cmd === 'q') break;
    if (cmd === 't') { state.directorOn = !state.directorOn; continue; }
    if (cmd === 'r') { state.balance += 1000; continue; }

    if (!['1', '2', '3', '4', '5', '6'].includes(cmd)) continue;
    if (state.balance <= 0) {
      console.log(`  ${C.red}Bankroll empty! Press [r] to rebuy.${C.reset}`);
      continue;
    }

    const betStr = await ask(`  Wager (max $${state.balance.toFixed(2)}, default 25): $`);
    const bet = Math.min(state.balance, Math.max(1, Number(betStr) || 25));

    if (cmd === '1') await playSlots(bet);
    else if (cmd === '2') await playPlinko(bet);
    else if (cmd === '3') await playCrash(bet);
    else if (cmd === '4') await playRoulette(bet);
    else if (cmd === '5') await playDice(bet);
    else if (cmd === '6') await playWheel(bet);
  }

  console.log(`\n  Session ended. Final Balance: $${state.balance.toFixed(2)}\n`);
  rl.close();
}

main();
