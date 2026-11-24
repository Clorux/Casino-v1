import React, { useState } from 'react';
import { Bomb, Gem, Shuffle } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  applyDirectorMinesProtection,
  calculateMinesMultiplier,
  generateMinesBoard,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

export const VaultMines: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [mineCount, setMineCount] = useState(4);
  const [active, setActive] = useState(false);
  const [activeBet, setActiveBet] = useState(25);
  const [mines, setMines] = useState<boolean[]>(() => new Array(25).fill(false));
  const [revealed, setRevealed] = useState<boolean[]>(() => new Array(25).fill(false));
  const [bustedIndex, setBustedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [status, setStatus] = useState('Choose mine count and start uncovering emerald vault tiles.');

  const safeFound = revealed.filter((r, i) => r && !mines[i]).length;
  const currentMult = calculateMinesMultiplier(25, mineCount, safeFound);
  const nextMult = calculateMinesMultiplier(25, mineCount, safeFound + 1);
  const currentPayout = Number((activeBet * currentMult).toFixed(2));

  const startRound = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    audioEngine.playChipPlace();
    setMines(generateMinesBoard(mineCount));
    setRevealed(new Array(25).fill(false));
    setBustedIndex(null);
    setShowAll(false);
    setActiveBet(effectiveBet);
    setActive(true);
    setStatus(`Vault unlocked with ${mineCount} mines. Pick a tile or cash out anytime.`);
  };

  const revealTile = (idx: number) => {
    if (!active || revealed[idx]) return;

    // Apply Director comeback/pity safe swap on early clicks if active
    const board = applyDirectorMinesProtection(mines, revealed, idx, modifiers);
    if (board !== mines) {
      setMines(board);
    }

    const nextRevealed = [...revealed];
    nextRevealed[idx] = true;
    setRevealed(nextRevealed);

    if (board[idx]) {
      // Detonated a mine!
      setActive(false);
      setBustedIndex(idx);
      setShowAll(true);
      audioEngine.playBust();
      setStatus(`Mine detonated at tile #${idx + 1}. Lost $${activeBet.toFixed(2)}.`);
      onSettleRound({
        gameId: 'mines',
        bet: activeBet,
        payout: 0,
        wasNearMiss: safeFound >= 3,
      });
      return;
    }

    const newSafeCount = safeFound + 1;
    audioEngine.playComboChime(newSafeCount);
    const mult = calculateMinesMultiplier(25, mineCount, newSafeCount);
    const maxSafe = 25 - mineCount;

    if (newSafeCount >= maxSafe) {
      // Cleared entire board!
      const payout = Number((activeBet * mult).toFixed(2));
      setActive(false);
      setShowAll(true);
      onTriggerBurst('heavy');
      setStatus(`Vault Cleared! Won $${payout.toFixed(2)} (${mult}x)`);
      onSettleRound({
        gameId: 'mines',
        bet: activeBet,
        payout,
        celebrateTier: mult >= 30 ? 'JACKPOT' : mult >= 15 ? 'MEGA' : mult >= 8 ? 'SUPER' : 'BIG',
        celebrateLabel: 'VAULT MINES FULL CLEAR',
      });
    } else {
      setStatus(`Emerald gem found! Current Cashout: $${(activeBet * mult).toFixed(2)} (${mult}x)`);
    }
  };

  const pickRandomTile = () => {
    if (!active) return;
    const unrevealed = revealed
      .map((isRev, idx) => (isRev ? -1 : idx))
      .filter((idx) => idx >= 0);
    if (unrevealed.length === 0) return;
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    revealTile(pick);
  };

  const cashOut = () => {
    if (!active || safeFound === 0) return;
    setActive(false);
    setShowAll(true);
    const payout = currentPayout;
    const celebrateTier =
      currentMult >= 30
        ? 'JACKPOT'
        : currentMult >= 15
        ? 'MEGA'
        : currentMult >= 6
        ? 'SUPER'
        : currentMult >= 3
        ? 'BIG'
        : undefined;
    if (!celebrateTier) {
      audioEngine.playWinFanfare('WIN');
    }
    if (currentMult >= 2.5) onTriggerBurst(currentMult >= 8 ? 'heavy' : 'light');
    setStatus(`Cashed out $${payout.toFixed(2)} at ${currentMult}x!`);
    onSettleRound({
      gameId: 'mines',
      bet: activeBet,
      payout,
      celebrateTier,
      celebrateLabel: 'VAULT MINES CASHOUT',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Vault Mines</h2>
          <p className="text-xs text-slate-400">
            5×5 High-Tension Grid · Ascending semitone chimes per emerald gem · Cash out any step
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="mines-count" className="text-xs text-slate-400">
            Mines ({mineCount})
          </label>
          <select
            id="mines-count"
            disabled={active}
            value={mineCount}
            onChange={(e) => setMineCount(Number(e.target.value))}
            className="font-mono-num rounded-lg border border-slate-700 bg-[#090C10] px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-[#D4AF37]"
          >
            {[1, 2, 3, 4, 5, 7, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Mine' : 'Mines'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 5x5 Vault Grid + Live Multiplier Readout */}
      <div className="grid grid-cols-1 gap-6 rounded-xl border border-slate-800 bg-[#0A0E14] p-5 lg:grid-cols-[1fr_280px]">
        <div className="mx-auto grid w-full max-w-[440px] grid-cols-5 gap-2.5">
          {Array.from({ length: 25 }, (_, i) => {
            const isRevealed = revealed[i];
            const isMine = mines[i];
            const isBusted = bustedIndex === i;
            const visibleMine = (isRevealed || showAll) && isMine;
            const visibleGem = (isRevealed || showAll) && !isMine;

            return (
              <button
                key={i}
                type="button"
                aria-label={`Vault tile ${i + 1}`}
                disabled={!active || isRevealed}
                onClick={() => revealTile(i)}
                className={`flex aspect-square items-center justify-center rounded-lg border transition-all duration-150 ${
                  isBusted
                    ? 'border-rose-500 bg-rose-950/90 text-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.45)]'
                    : isRevealed && !isMine
                    ? 'border-emerald-500/80 bg-emerald-950/75 text-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                    : showAll && isMine
                    ? 'border-rose-900/60 bg-[#1B1216] text-rose-500/70'
                    : showAll && !isMine
                    ? 'border-slate-800 bg-[#0F151E] text-emerald-500/40'
                    : active
                    ? 'cursor-pointer border-slate-700/80 bg-[#141B24] hover:-translate-y-0.5 hover:border-[#D4AF37]/70 hover:bg-[#1B2430]'
                    : 'border-slate-800/70 bg-[#10151D] opacity-65'
                }`}
              >
                {visibleMine && <Bomb className="h-6 w-6" aria-hidden="true" />}
                {visibleGem && <Gem className="h-6 w-6" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-[#11161D] p-5">
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-400">Current Multiplier</div>
              <div className="font-mono-num mt-1 text-3xl font-bold text-[#F9E7A8]">
                {currentMult.toFixed(2)}x
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="text-xs text-slate-400">Next Gem Multiplier</div>
              <div className="font-mono-num mt-1 text-xl font-semibold text-emerald-400">
                {nextMult.toFixed(2)}x
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="text-xs text-slate-400">Gems Uncovered</div>
              <div className="font-mono-num mt-1 text-lg font-semibold text-slate-100">
                {safeFound} / {25 - mineCount}
              </div>
            </div>

            {active && (
              <button
                type="button"
                onClick={pickRandomTile}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#D4AF37]/60 bg-[#D4AF37]/12 py-2 text-xs font-bold text-[#F9E7A8] hover:bg-[#D4AF37]/22"
              >
                <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pick Random Tile</span>
              </button>
            )}
          </div>

          <p className="mt-5 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-300">
            {status}
          </p>
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={active}
        onChangeBet={setBet}
        actionLabel={active ? 'Round Active' : 'Start Vault Round'}
        onAction={startRound}
        actionDisabled={active}
        secondaryAction={
          active
            ? {
                label: `Cash Out $${currentPayout.toFixed(2)}`,
                onClick: cashOut,
                disabled: safeFound === 0,
                tone: 'emerald',
              }
            : undefined
        }
      />
    </div>
  );
};
