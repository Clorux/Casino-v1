import React, { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Crosshair, RotateCw, Zap } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import { calculateLimboWinChance, resolveLimboRound } from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

const TARGET_PRESETS = [1.5, 2, 3, 5, 10, 25, 100];

interface LimboHistoryItem {
  id: number;
  rolled: number;
  target: number;
  won: boolean;
  wasNearMiss: boolean;
}

export const VaultLimbo: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
  onRitualSignal,
}) => {
  const [bet, setBet] = useState(25);
  const [target, setTarget] = useState(2.5);
  const [displayMult, setDisplayMult] = useState(1.0);
  const [rolling, setRolling] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [autoBet, setAutoBet] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<'IDLE' | 'WIN' | 'LOSE' | 'NEARMISS'>('IDLE');
  const [hitKey, setHitKey] = useState(0);
  const [history, setHistory] = useState<LimboHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    'Set any target multiplier from 1.05x to 1,000x. Hit or beat your target for instant payout.'
  );

  const rollingRef = useRef(false);
  const odoRef = useRef({ val: 1.0 });
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    return () => {
      tweenRef.current?.kill();
    };
  }, []);

  const winChance = calculateLimboWinChance(target);

  const fireShot = useCallback(() => {
    if (rollingRef.current) return;
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) {
      setAutoBet(false);
      setStatusMessage('Insufficient bankroll for this Limbo shot.');
      return;
    }

    rollingRef.current = true;
    setRolling(true);
    setLastOutcome('IDLE');
    audioEngine.playClick();

    const result = resolveLimboRound(effectiveBet, target, modifiers);
    odoRef.current.val = 1.0;
    tweenRef.current?.kill();

    const duration = turbo ? 0.16 : 0.44;
    tweenRef.current = gsap.to(odoRef.current, {
      val: result.rolledMultiplier,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        setDisplayMult(odoRef.current.val);
      },
      onComplete: () => {
        setDisplayMult(result.rolledMultiplier);
        rollingRef.current = false;
        setRolling(false);
        setHitKey((k) => k + 1);

        setHistory((prev) => [
          {
            id: Date.now() + Math.random(),
            rolled: result.rolledMultiplier,
            target: result.targetMultiplier,
            won: result.won,
            wasNearMiss: result.wasNearMiss,
          },
          ...prev.slice(0, 11),
        ]);

        let celebrateTier: 'BIG' | 'SUPER' | 'MEGA' | 'JACKPOT' | undefined;
        if (result.won) {
          setLastOutcome('WIN');
          if (result.targetMultiplier >= 50) celebrateTier = 'JACKPOT';
          else if (result.targetMultiplier >= 20) celebrateTier = 'MEGA';
          else if (result.targetMultiplier >= 8) celebrateTier = 'SUPER';
          else if (result.targetMultiplier >= 3.5) celebrateTier = 'BIG';
          else {
            audioEngine.playWinFanfare('WIN');
            onTriggerBurst('light');
          }
          setStatusMessage(
            `TARGET CRUSHED! Rolled ${result.rolledMultiplier.toFixed(2)}x ≥ ${result.targetMultiplier.toFixed(
              2
            )}x · Paid $${result.payout.toFixed(2)}`
          );
        } else {
          setLastOutcome(result.wasNearMiss ? 'NEARMISS' : 'LOSE');
          audioEngine.playBust();
          setStatusMessage(
            result.wasNearMiss
              ? `AGONIZING NEAR MISS! Stopped at ${result.rolledMultiplier.toFixed(
                  2
                )}x (needed ${result.targetMultiplier.toFixed(2)}x)`
              : `Crashed short at ${result.rolledMultiplier.toFixed(2)}x (target ${result.targetMultiplier.toFixed(2)}x).`
          );
        }

        onSettleRound({
          gameId: 'limbo',
          bet: effectiveBet,
          payout: result.payout,
          wasNearMiss: result.wasNearMiss,
          celebrateTier,
          celebrateLabel: 'VAULT LIMBO SNIPER',
          turboActive: turbo,
          autoSpinActive: autoBet,
        });
      },
    });
  }, [autoBet, balance, bet, modifiers, onSettleRound, onTriggerBurst, onWager, target, turbo]);

  useEffect(() => {
    if (!autoBet) return;
    const interval = window.setInterval(() => {
      if (!rollingRef.current && balance >= bet) {
        fireShot();
      } else if (balance < bet) {
        setAutoBet(false);
      }
    }, turbo ? 240 : 650);
    return () => window.clearInterval(interval);
  }, [autoBet, balance, bet, fireShot, turbo]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Vault Limbo</h2>
          <span className="text-xs text-slate-400">
            Instant Multiplier Sniper · 1.05x to 1,000.00x
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              const next = !turbo;
              setTurbo(next);
              onRitualSignal?.('TURBO_TOGGLE', `Limbo Turbo ${next ? 'ON' : 'OFF'}`, {
                turboActive: next,
                autoSpinActive: autoBet,
              });
            }}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors ${
              turbo
                ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                : 'border-slate-700 bg-[#0D1218] text-slate-300 hover:border-slate-500'
            }`}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Turbo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !autoBet;
              setAutoBet(next);
              onRitualSignal?.('AUTO_TOGGLE', `Limbo Auto-Bet ${next ? 'ON' : 'OFF'}`, {
                turboActive: turbo,
                autoSpinActive: next,
              });
            }}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors ${
              autoBet
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-[#0D1218] text-slate-300 hover:border-slate-500'
            }`}
          >
            <RotateCw className={`h-3.5 w-3.5 ${autoBet ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{autoBet ? 'Stop Auto' : 'Auto Bet'}</span>
          </button>
        </div>
      </div>

      {/* Main Odometer Arena */}
      <div
        data-testid="vault-limbo-stage"
        className="rounded-xl border border-[#D4AF37]/30 bg-[#0A0E14] p-6 shadow-[inset_0_0_70px_rgba(0,0,0,0.85)]"
      >
        {/* Recent History Ribbon */}
        <div className="mb-5 flex min-h-[26px] flex-wrap items-center gap-1.5 font-mono-num text-[11px]">
          {history.length === 0 ? (
            <span className="text-slate-500">No shots fired yet — calibrate your target below.</span>
          ) : (
            history.map((item) => (
              <span
                key={item.id}
                className={`rounded px-2 py-0.5 font-bold ${
                  item.won
                    ? 'bg-emerald-950/75 text-emerald-300 border border-emerald-500/40'
                    : item.wasNearMiss
                    ? 'bg-amber-950/75 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {item.rolled.toFixed(2)}x
              </span>
            ))
          )}
        </div>

        {/* Center Multiplier Readout */}
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Vault Multiplier Roll
          </div>
          <div
            key={hitKey}
            data-testid="limbo-odometer"
            className={`font-mono-num mt-2 text-6xl font-black tracking-tight sm:text-7xl ${
              lastOutcome === 'WIN'
                ? 'animate-odometer-hit text-emerald-400 drop-shadow-[0_0_32px_rgba(16,185,129,0.55)]'
                : lastOutcome === 'NEARMISS'
                ? 'animate-chromatic-hit text-amber-300 drop-shadow-[0_0_24px_rgba(245,158,11,0.45)]'
                : lastOutcome === 'LOSE'
                ? 'text-rose-400'
                : 'text-[#F9E7A8]'
            }`}
          >
            {displayMult.toFixed(2)}x
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 font-mono-num text-xs text-slate-300">
            <span>
              Target <strong className="text-[#ECCB63]">{target.toFixed(2)}x</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>
              Win Chance <strong className="text-sky-300">{winChance.toFixed(2)}%</strong>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span>
              Profit on Hit{' '}
              <strong className="text-emerald-400">
                +${Math.max(0, bet * target - bet).toFixed(2)}
              </strong>
            </span>
          </div>
        </div>

        {/* Target Multiplier Controls */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-[#11161D] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="limbo-target-input" className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Crosshair className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" />
              <span>Target Multiplier</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="limbo-target-input"
                type="number"
                min={1.05}
                max={1000}
                step={0.1}
                value={target}
                onChange={(e) => setTarget(Math.min(1000, Math.max(1.05, Number(e.target.value) || 1.05)))}
                className="font-mono-num w-28 rounded-lg border border-slate-700 bg-[#090C10] px-2.5 py-1.5 text-right text-sm font-bold text-[#FEF08A] outline-none focus:border-[#D4AF37]"
              />
              <span className="font-mono-num text-xs text-slate-400">x</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {TARGET_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  audioEngine.playClick();
                  setTarget(preset);
                }}
                className={`font-mono-num rounded-md border px-3 py-1 text-xs font-bold transition-colors ${
                  Math.abs(target - preset) < 0.01
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FEF08A]'
                    : 'border-slate-800 bg-[#090C10] text-slate-300 hover:border-slate-600'
                }`}
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
          <span className="text-slate-300">{statusMessage}</span>
          <span className="font-mono-num text-slate-400">
            House Edge Shift:{' '}
            <strong className={modifiers.winBias < 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {modifiers.winBias >= 0 ? '+' : ''}
              {(modifiers.winBias * 100).toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>

      {/* Wager Bar */}
      <WagerBar
        bet={bet}
        balance={balance}
        disabled={rolling}
        onChangeBet={setBet}
        actionLabel={rolling ? 'Rolling...' : `Fire ${target.toFixed(2)}x Shot`}
        onAction={fireShot}
        actionDisabled={rolling}
      />
    </div>
  );
};
