import React, { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import { calculateDiceSpecs, resolveDiceRoll } from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

export const HyperDice: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [lastRoll, setLastRoll] = useState<{
    roll: number;
    won: boolean;
    payout: number;
    wasNearMiss: boolean;
  } | null>(null);
  const [history, setHistory] = useState<Array<{ roll: number; won: boolean }>>([]);

  const { winChance, multiplier } = calculateDiceSpecs(target, direction);

  const rollDice = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    const res = resolveDiceRoll(effectiveBet, target, direction, modifiers);
    setLastRoll({ roll: res.roll, won: res.won, payout: res.payout, wasNearMiss: res.wasNearMiss });
    setHistory((prev) => [{ roll: res.roll, won: res.won }, ...prev.slice(0, 9)]);

    if (res.won) {
      audioEngine.playComboChime(res.multiplier >= 4 ? 5 : 2);
      if (res.multiplier >= 3) onTriggerBurst(res.multiplier >= 8 ? 'heavy' : 'light');
    } else {
      audioEngine.playBust();
    }

    onSettleRound({
      gameId: 'dice',
      bet: effectiveBet,
      payout: res.payout,
      wasNearMiss: res.wasNearMiss,
      celebrateTier:
        res.won && res.multiplier >= 20
          ? 'MEGA'
          : res.won && res.multiplier >= 9
          ? 'SUPER'
          : res.won && res.multiplier >= 4.5
          ? 'BIG'
          : undefined,
      celebrateLabel: 'HYPER DICE PRECISION HIT',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Hyper Dice</h2>
          <p className="text-xs text-slate-400">
            Slide target threshold for instant custom odds from 1.01x up to 49.50x
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            audioEngine.playClick();
            setDirection((d) => (d === 'over' ? 'under' : 'over'));
          }}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1218] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#D4AF37]"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" />
          <span>Mode: Roll {direction === 'over' ? 'Over' : 'Under'}</span>
        </button>
      </div>

      {/* Dramatic Dice Arena */}
      <div
        className={`flex flex-col justify-between gap-8 rounded-xl border p-6 transition-all duration-300 sm:p-8 ${
          lastRoll?.won
            ? 'border-emerald-400/70 bg-[#081511] shadow-[inset_0_0_70px_rgba(16,185,129,0.16)]'
            : lastRoll && !lastRoll.won
            ? 'border-rose-500/45 bg-[#150A0E] shadow-[inset_0_0_60px_rgba(244,63,94,0.12)]'
            : 'border-slate-800 bg-[#0A0E14]'
        }`}
      >
        {/* Big Result Readout */}
        <div className="flex flex-col items-center text-center">
          <div className="text-xs font-semibold tracking-wider text-slate-300">
            {lastRoll
              ? lastRoll.won
                ? `PRECISION HIT · PAID $${lastRoll.payout.toFixed(2)}`
                : lastRoll.wasNearMiss
                ? 'RAZOR-THIN NEAR MISS!'
                : 'MISSED TARGET RANGE'
              : 'SLIDE TARGET & ROLL'}
          </div>
          <div
            className={`font-mono-num mt-2 text-6xl font-bold tracking-tight transition-colors duration-200 sm:text-7xl ${
              !lastRoll
                ? 'text-slate-100'
                : lastRoll.won
                ? 'text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.45)]'
                : 'text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.38)]'
            }`}
          >
            {lastRoll ? lastRoll.roll.toFixed(2) : '50.00'}
          </div>
        </div>

        {/* Dramatic Visual Probability Slide Track */}
        <div className="mx-auto w-full max-w-2xl pt-6">
          <div className="relative h-14 w-full rounded-xl border border-[#D4AF37]/35 bg-[#11161D] p-2 shadow-[inset_0_2px_16px_rgba(0,0,0,0.85)]">
            <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-900">
              {/* Red/Emerald range split with glowing edge */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-150 ${
                  direction === 'under'
                    ? 'bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
                    : 'bg-gradient-to-r from-rose-950 via-rose-800 to-rose-600'
                }`}
                style={{ width: `${target}%` }}
              />
              <div
                className={`absolute inset-y-0 right-0 transition-all duration-150 ${
                  direction === 'over'
                    ? 'bg-gradient-to-l from-emerald-700 via-emerald-500 to-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
                    : 'bg-gradient-to-l from-rose-950 via-rose-800 to-rose-600'
                }`}
                style={{ width: `${100 - target}%` }}
              />
              {/* Glowing golden divider thumb on the rail */}
              <div
                className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-[#FDE047] shadow-[0_0_16px_#FDE047]"
                style={{ left: `${target}%` }}
              />
            </div>

            {/* Sliding landed roll marker */}
            {lastRoll && (
              <div
                className="pointer-events-none absolute -top-10 -translate-x-1/2 transition-all duration-300 ease-out"
                style={{ left: `${Math.min(97, Math.max(3, lastRoll.roll))}%` }}
              >
                <div
                  className={`font-mono-num rounded-md px-2.5 py-1 text-xs font-bold shadow-lg ${
                    lastRoll.won
                      ? 'bg-emerald-400 text-[#071510] shadow-emerald-500/40'
                      : 'bg-rose-500 text-white shadow-rose-500/40'
                  }`}
                >
                  {lastRoll.roll.toFixed(2)}
                </div>
                <div
                  className={`mx-auto h-2 w-0.5 ${lastRoll.won ? 'bg-emerald-400' : 'bg-rose-500'}`}
                />
              </div>
            )}
          </div>

          <input
            aria-label="Dice target threshold"
            type="range"
            min={2}
            max={98}
            step={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-4 h-2.5 w-full cursor-pointer accent-[#D4AF37]"
          />

          <div className="mt-2 flex justify-between font-mono-num text-[11px] text-slate-400">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* 3 Numeric Telemetry Columns */}
        <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-slate-800/80 pt-5 text-center">
          <div>
            <div className="text-xs text-slate-400">Multiplier</div>
            <div className="font-mono-num mt-1 text-2xl font-bold text-[#F9E7A8]">
              {multiplier.toFixed(2)}x
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Roll {direction === 'over' ? 'Over' : 'Under'}</div>
            <div className="font-mono-num mt-1 text-2xl font-bold text-white">{target.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Win Chance</div>
            <div className="font-mono-num mt-1 text-2xl font-bold text-emerald-400">
              {winChance.toFixed(0)}%
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="flex items-center justify-center gap-3 border-t border-slate-800/80 pt-3 font-mono-num text-xs">
            <span className="text-slate-400">Recent:</span>
            {history.map((h, i) => (
              <span key={i} className={h.won ? 'font-bold text-emerald-400' : 'text-slate-500'}>
                {h.roll.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        onChangeBet={setBet}
        actionLabel="Roll Dice"
        onAction={rollDice}
      />
    </div>
  );
};
