import React, { useEffect, useRef, useState } from 'react';
import { Crown, Shield, Sparkles, Zap } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  calculateCoinFlipMultiplier,
  resolveCoinFlipStep,
  type CoinSide,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

interface FlipHistoryItem {
  id: number;
  landed: CoinSide;
  won: boolean;
}

export const ObsidianCoinFlip: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  directorState,
  houseMind,
  onWager,
  onSettleRound,
  onTriggerBurst,
  onRitualSignal,
}) => {
  const [bet, setBet] = useState(25);
  const [activeBet, setActiveBet] = useState(25);
  const [active, setActive] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const [coinFace, setCoinFace] = useState<CoinSide>('crown');
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [turbo, setTurbo] = useState(false);
  const [history, setHistory] = useState<FlipHistoryItem[]>([]);
  const [status, setStatus] = useState(
    'Start a streak, call Crown or Vault on every flip, and Cash Out before the coin turns.'
  );

  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const currentCashOut = active && streak > 0 ? Number((activeBet * multiplier).toFixed(2)) : 0;
  const nextMult = calculateCoinFlipMultiplier(streak + 1);
  const isRealistic = directorState.mode === 'realistic_house';

  const startSession = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    audioEngine.playChipPlace();
    setActiveBet(effectiveBet);
    setStreak(0);
    setMultiplier(1.0);
    setActive(true);
    setStatus(`Wager $${effectiveBet} locked. Call Crown or Vault for ${nextMult.toFixed(2)}x!`);
  };

  const executeFlip = (pick: CoinSide) => {
    if (!active || flipping) return;
    setFlipping(true);
    setFlipKey((k) => k + 1);
    audioEngine.playCoinFlipSpin();

    const step = resolveCoinFlipStep(pick, streak, modifiers);
    const delayMs = turbo ? 170 : 540;

    timerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setFlipping(false);
      setCoinFace(step.landed);
      setHistory((prev) => [{ id: Date.now() + Math.random(), landed: step.landed, won: step.won }, ...prev].slice(0, 12));

      if (!step.won) {
        setActive(false);
        setStreak(0);
        setMultiplier(1.0);
        if (step.wasNearMiss) {
          audioEngine.playNearMissSting();
        } else {
          audioEngine.playBust();
        }
        setStatus(
          `Landed ${step.landed === 'crown' ? 'CROWN' : 'VAULT'} — Streak snapped after ${streak} ${
            streak === 1 ? 'flip' : 'flips'
          }.`
        );
        onSettleRound({
          gameId: 'coinflip',
          bet: activeBet,
          payout: 0,
          wasNearMiss: step.wasNearMiss,
          turboActive: turbo,
        });
        return;
      }

      setStreak(step.nextStreak);
      setMultiplier(step.nextMultiplier);
      audioEngine.playComboChime(step.nextStreak);
      if (step.nextMultiplier >= 3.5) {
        onTriggerBurst(step.nextMultiplier >= 12 ? 'heavy' : 'light');
      }
      setStatus(
        `${step.landed === 'crown' ? 'CROWN' : 'VAULT'} HIT! Streak ${step.nextStreak} (${step.nextMultiplier.toFixed(
          2
        )}x · $${(activeBet * step.nextMultiplier).toFixed(2)}) — Flip again or Cash Out.`
      );
    }, delayMs);
  };

  const cashOut = () => {
    if (!active || flipping || streak === 0) return;
    setActive(false);
    const payout = currentCashOut;
    const celebrateTier =
      multiplier >= 30
        ? 'JACKPOT'
        : multiplier >= 14
        ? 'MEGA'
        : multiplier >= 7
        ? 'SUPER'
        : multiplier >= 3.5
        ? 'BIG'
        : undefined;

    if (!celebrateTier) audioEngine.playWinFanfare('WIN');
    if (multiplier >= 3.5) onTriggerBurst(multiplier >= 10 ? 'heavy' : 'light');

    setStatus(`Cashed out $${payout.toFixed(2)} at ${multiplier.toFixed(2)}x (${streak} consecutive flips)!`);
    onSettleRound({
      gameId: 'coinflip',
      bet: activeBet,
      payout,
      celebrateTier,
      celebrateLabel: 'OBSIDIAN COIN FLIP',
      turboActive: turbo,
    });
  };

  return (
    <div data-testid="coin-flip-stage" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Obsidian Coin Flip</h2>
          <p className="text-xs text-slate-400">
            Compounding 1.96x Streak Doubler · Call Crown or Vault · Cash Out Anytime
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono-num text-slate-400">
            Streak: <strong className="text-emerald-400">{streak}</strong>
          </span>
          <span className="font-mono-num text-slate-400">
            Current: <strong className="text-[#ECCB63]">{multiplier.toFixed(2)}x</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !turbo;
              setTurbo(next);
              onRitualSignal?.('TURBO_TOGGLE', `Coin Flip Turbo ${next ? 'ON' : 'OFF'}`, {
                turboActive: next,
              });
            }}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
              turbo
                ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                : 'border-slate-700 bg-[#0D1218] text-slate-300 hover:border-slate-500'
            }`}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Turbo</span>
          </button>
        </div>
      </div>

      {/* Main Coin Arena */}
      <div
        className={`grid grid-cols-1 gap-6 rounded-xl border bg-[#0A0E14] p-6 shadow-[inset_0_0_70px_rgba(0,0,0,0.85)] lg:grid-cols-[1fr_290px] ${
          isRealistic && houseMind.phase === 'PREDATOR_HARVEST'
            ? 'border-rose-500/55 animate-predator-pulse'
            : 'border-[#D4AF37]/30'
        }`}
      >
        {/* Center Embossed 3D Coin Stage */}
        <div className="flex flex-col items-center justify-between gap-6">
          {/* Streak Ladder Ribbon */}
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono-num text-xs">
            {[1, 2, 3, 4, 5, 6].map((stepIdx) => {
              const mult = calculateCoinFlipMultiplier(stepIdx);
              const cleared = streak >= stepIdx;
              const isNext = active && streak + 1 === stepIdx;
              return (
                <div
                  key={stepIdx}
                  className={`rounded-md border px-2.5 py-1 transition-all ${
                    cleared
                      ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300 font-bold'
                      : isNext
                      ? 'border-[#D4AF37] bg-[#241B09] text-[#F9E7A8] font-bold'
                      : 'border-slate-800 bg-[#0E131B] text-slate-500'
                  }`}
                >
                  {mult.toFixed(2)}x
                </div>
              );
            })}
          </div>

          {/* Embossed Metallic Coin */}
          <div className="relative flex flex-col items-center justify-center py-2">
            <div
              key={flipKey}
              data-testid="coin-flip-disc"
              className={`flex h-40 w-40 items-center justify-center rounded-full border-4 shadow-[0_20px_60px_rgba(0,0,0,0.75)] ${
                flipping ? 'animate-coin-flip-3d' : ''
              } ${
                coinFace === 'crown'
                  ? 'border-[#ECCB63] bg-gradient-to-br from-[#F9E7A8] via-[#D4AF37] to-[#7A5E14] text-[#090C10]'
                  : 'border-slate-400 bg-gradient-to-br from-[#2B3544] via-[#141A22] to-[#080B10] text-[#F9E7A8]'
              }`}
            >
              <div
                className={`flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 ${
                  coinFace === 'crown' ? 'border-[#090C10]/30' : 'border-[#D4AF37]/45'
                }`}
              >
                {coinFace === 'crown' ? (
                  <>
                    <Crown className="h-12 w-12" aria-hidden="true" />
                    <span className="mt-1 text-xs font-black tracking-[0.2em]">CROWN</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-12 w-12 text-[#ECCB63]" aria-hidden="true" />
                    <span className="mt-1 text-xs font-black tracking-[0.2em] text-[#ECCB63]">VAULT</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Call Buttons */}
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!active || flipping}
              onClick={() => executeFlip('crown')}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#D4AF37]/70 bg-[#231B09] px-5 py-3.5 text-sm font-bold text-[#F9E7A8] transition-all hover:-translate-y-0.5 hover:bg-[#31250C] disabled:opacity-40 whitespace-nowrap"
            >
              <Crown className="h-4 w-4 text-[#ECCB63]" aria-hidden="true" />
              <span>Pick Crown</span>
            </button>
            <button
              type="button"
              disabled={!active || flipping}
              onClick={() => executeFlip('vault')}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-600 bg-[#141B24] px-5 py-3.5 text-sm font-bold text-slate-100 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-[#1B2430] disabled:opacity-40 whitespace-nowrap"
            >
              <Shield className="h-4 w-4 text-sky-300" aria-hidden="true" />
              <span>Pick Vault</span>
            </button>
          </div>

          <p className="text-center text-xs font-medium text-slate-300">{status}</p>
        </div>

        {/* Side Telemetry & Cash Out Panel */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-[#0D1219] p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Flip Telemetry</span>
              <span className="font-mono-num text-[#ECCB63]">Next {nextMult.toFixed(2)}x</span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#090C10] p-3">
              <div className="text-[11px] text-slate-400">Cash-Out Value</div>
              <div className="font-mono-num mt-1 text-2xl font-bold text-emerald-400">
                ${active && streak > 0 ? currentCashOut.toFixed(2) : '0.00'}
              </div>
              <div className="font-mono-num mt-0.5 text-[11px] text-slate-400">
                House Edge Shift:{' '}
                <span className={modifiers.winBias < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {modifiers.winBias >= 0 ? '+' : ''}
                  {(modifiers.winBias * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {history.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-slate-400">Recent Flips</div>
                <div className="flex flex-wrap gap-1.5">
                  {history.map((h) => (
                    <span
                      key={h.id}
                      className={`font-mono-num rounded border px-2 py-0.5 text-[10px] font-bold ${
                        h.won
                          ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                          : 'border-rose-500/40 bg-rose-950/50 text-rose-300'
                      }`}
                    >
                      {h.landed === 'crown' ? 'CRN' : 'VLT'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={!active || flipping}
              onClick={() => executeFlip(Math.random() < 0.5 ? 'crown' : 'vault')}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#121821] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-[#D4AF37] hover:text-white disabled:opacity-35 whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#ECCB63]" aria-hidden="true" />
              <span>Random Call Flip</span>
            </button>

            <button
              type="button"
              disabled={!active || flipping || streak === 0}
              onClick={cashOut}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#071510] hover:bg-emerald-400 disabled:opacity-35 whitespace-nowrap"
            >
              Cash Out ${currentCashOut.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={active}
        onChangeBet={setBet}
        actionLabel={active ? 'Flip Streak Active' : 'Start Flip Streak'}
        onAction={startSession}
        actionDisabled={active}
      />
    </div>
  );
};
