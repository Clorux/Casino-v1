import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, RotateCw, Sparkles, Zap } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  SLOT_SYMBOLS,
  SYMBOL_LIST,
  resolveThunderfallSpin,
  type SlotGrid,
  type SlotSymbolId,
} from '../engine/slotMath';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

const INITIAL_GRID: SlotGrid = [
  ['CROWN', 'EMERALD', 'SPADE'],
  ['RUBY', 'WILD', 'HEART'],
  ['DIAMOND', 'CROWN', 'CLUB'],
  ['GOLD_BAR', 'SCATTER', 'RUBY'],
  ['EMERALD', 'DIAMOND', 'SPADE'],
];

function SymbolGlyph({ id, isWin }: { id: SlotSymbolId; isWin: boolean }) {
  const spec = SLOT_SYMBOLS[id];
  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center rounded-lg border transition-transform duration-200 ${
        isWin
          ? 'scale-[1.04] border-[#ECCB63] bg-[#241E0E] shadow-[0_0_24px_rgba(236,203,99,0.38)]'
          : id === 'SCATTER'
          ? 'border-amber-500/60 bg-[#1B140C]'
          : id === 'WILD'
          ? 'border-[#D4AF37]/60 bg-[#1A180F]'
          : 'border-slate-800/80 bg-[#0D1219]'
      }`}
    >
      <svg viewBox="0 0 48 48" className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true">
        {id === 'CROWN' && (
          <path
            d="M8 35L11 16L19 24L24 12L29 24L37 16L40 35H8Z"
            fill={spec.color}
            stroke={spec.accent}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {id === 'DIAMOND' && (
          <polygon
            points="24,7 41,21 24,42 7,21"
            fill={spec.color}
            stroke={spec.accent}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {id === 'RUBY' && (
          <polygon
            points="16,9 32,9 41,20 24,41 7,20"
            fill={spec.color}
            stroke={spec.accent}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}
        {id === 'EMERALD' && (
          <rect
            x="11"
            y="9"
            width="26"
            height="30"
            rx="4"
            fill={spec.color}
            stroke={spec.accent}
            strokeWidth="2.2"
          />
        )}
        {id === 'GOLD_BAR' && (
          <g>
            <polygon points="10,33 16,18 32,18 38,33" fill={spec.color} stroke={spec.accent} strokeWidth="2" />
            <line x1="16" y1="22" x2="32" y2="22" stroke="#FEF3C7" strokeWidth="2" />
          </g>
        )}
        {id === 'WILD' && (
          <g>
            <polygon
              points="24,6 29,18 42,19 32,28 35,41 24,34 13,41 16,28 6,19 19,18"
              fill={spec.color}
              stroke={spec.accent}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>
        )}
        {id === 'SCATTER' && (
          <g>
            <circle cx="24" cy="24" r="17" fill="#451A03" stroke="#F59E0B" strokeWidth="2.2" />
            <path d="M26 11L15 26H24L22 37L33 22H24L26 11Z" fill="#FDE047" />
          </g>
        )}
        {id === 'SPADE' && (
          <text x="24" y="34" textAnchor="middle" fontSize="30" fill={spec.color}>
            ♠
          </text>
        )}
        {id === 'HEART' && (
          <text x="24" y="34" textAnchor="middle" fontSize="30" fill={spec.color}>
            ♥
          </text>
        )}
        {id === 'CLUB' && (
          <text x="24" y="34" textAnchor="middle" fontSize="30" fill={spec.color}>
            ♣
          </text>
        )}
      </svg>
      <span
        className="mt-0.5 text-[10px] font-semibold tracking-wider"
        style={{ color: spec.color }}
      >
        {spec.short}
      </span>
    </div>
  );
}

export const ThunderfallSlots: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  relicBonuses,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [grid, setGrid] = useState<SlotGrid>(INITIAL_GRID);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);
  const [teaseReel, setTeaseReel] = useState<number | null>(null);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [cascadeMult, setCascadeMult] = useState<number>(1);
  const [freeSpins, setFreeSpins] = useState<number>(0);
  const [turbo, setTurbo] = useState<boolean>(false);
  const [autoSpin, setAutoSpin] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    '15 Paylines · Cascading Tumble Multipliers · 3+ Scatters trigger Free Spins'
  );
  const [lastWin, setLastWin] = useState<number>(0);

  const isSpinningRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  const clearTimers = () => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, []);

  const spin = useCallback(() => {
    if (isSpinningRef.current) return;
    const usingFreeSpin = freeSpins > 0;
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));

    if (!usingFreeSpin) {
      if (balance < effectiveBet || !onWager(effectiveBet)) {
        setAutoSpin(false);
        setStatusMessage('Insufficient balance for this wager. Adjust bet or top up.');
        return;
      }
    } else {
      setFreeSpins((prev) => Math.max(0, prev - 1));
    }

    isSpinningRef.current = true;
    setWinningCells(new Set());
    setLastWin(0);
    setTeaseReel(null);

    const startMult = Math.max(1, 1 + relicBonuses.cascadeStartBonus);
    setCascadeMult(usingFreeSpin ? Math.max(2, startMult) : startMult);
    setSpinningReels([true, true, true, true, true]);
    setStatusMessage(usingFreeSpin ? 'Free Spin Active — 2x Starting Cascade' : 'Spinning Reels...');

    const result = resolveThunderfallSpin(effectiveBet, modifiers, {
      startCascadeMult: startMult,
      isFreeSpin: usingFreeSpin,
    });

    const firstStep = result.steps[0];
    const baseDelay = turbo ? 90 : 190;

    // Rapid reel flicker interval while reels spin
    const flickerId = window.setInterval(() => {
      if (!mountedRef.current) return;
      setGrid((prev) =>
        prev.map((col, rIdx) => {
          return col.map((sym) => {
            if (!isSpinningRef.current) return sym;
            return SYMBOL_LIST[Math.floor(Math.random() * SYMBOL_LIST.length)];
          });
        })
      );
      audioEngine.playReelTick(Math.random() * 4);
    }, 65);
    timersRef.current.push(flickerId);

    // Schedule staggered stops for each of the 5 reels, with dramatic slowdown on anticipation reels
    let cumulativeMs = turbo ? 180 : 340;
    const stopTimes: number[] = [];

    for (let r = 0; r < 5; r++) {
      const isTease = result.anticipationReels.includes(r);
      cumulativeMs += isTease ? (turbo ? 320 : 760) : baseDelay;
      stopTimes.push(cumulativeMs);

      if (isTease) {
        const teaseStartMs = cumulativeMs - (turbo ? 300 : 700);
        const tId = window.setTimeout(() => {
          if (!mountedRef.current) return;
          setTeaseReel(r);
          setStatusMessage('2 Scatters Landed — Anticipation Tease!');
          audioEngine.playAnticipationTease();
        }, Math.max(10, teaseStartMs));
        timersRef.current.push(tId);
      }

      const stopId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setSpinningReels((prev) => {
          const next = [...prev];
          next[r] = false;
          return next;
        });
        setGrid((prev) => {
          const next = prev.map((c) => [...c]);
          next[r] = [...firstStep.grid[r]];
          return next;
        });
        const landedScatter = firstStep.grid[r].includes('SCATTER');
        audioEngine.playReelStop(r, landedScatter);
        if (r === 4) {
          window.clearInterval(flickerId);
          setTeaseReel(null);
        }
      }, cumulativeMs);
      timersRef.current.push(stopId);
    }

    // Play through cascade steps after all 5 reels settle
    let cascadeCursorMs = cumulativeMs + (turbo ? 120 : 260);
    result.steps.forEach((step, idx) => {
      const stepId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setGrid(step.grid.map((c) => [...c]));
        setCascadeMult(step.cascadeMultiplier);
        const winSet = new Set(step.winningCells.map(([r, row]) => `${r}:${row}`));
        setWinningCells(winSet);

        if (step.stepPayout > 0) {
          audioEngine.playComboChime(idx);
          setLastWin((prev) => Number((prev + step.stepPayout).toFixed(2)));
          setStatusMessage(
            idx > 0
              ? `Cascade Chain x${step.cascadeMultiplier}! +$${step.stepPayout.toFixed(2)}`
              : `Line Hit! +$${step.stepPayout.toFixed(2)}`
          );
          if (idx >= 1 || step.stepPayout >= effectiveBet * 3) {
            onTriggerBurst(idx >= 2 ? 'heavy' : 'light');
          }
        }
      }, cascadeCursorMs);
      timersRef.current.push(stepId);

      if (step.wins.length > 0) {
        cascadeCursorMs += turbo ? 360 : 680;
      }
    });

    // Final settlement
    const settleId = window.setTimeout(() => {
      if (!mountedRef.current) return;
      isSpinningRef.current = false;
      setSpinningReels([false, false, false, false, false]);

      if (result.freeSpinsAwarded > 0) {
        setFreeSpins((prev) => prev + result.freeSpinsAwarded);
        setStatusMessage(`Thunder Bonus! +${result.freeSpinsAwarded} Free Spins Awarded`);
        audioEngine.playWinFanfare('SUPER');
      } else if (result.totalPayout > 0) {
        setStatusMessage(
          `Paid $${result.totalPayout.toFixed(2)} (${result.totalMultiplier.toFixed(2)}x) across ${result.steps.length} ${
            result.steps.length === 1 ? 'stage' : 'cascades'
          }`
        );
      } else if (result.wasNearMiss) {
        setStatusMessage('So close — 2 Scatters on the board! Tension rising.');
      } else {
        setStatusMessage('Ready for next spin.');
      }

      const celebrateTier =
        result.winTier === 'MEGA' || result.winTier === 'SUPER' || result.winTier === 'BIG'
          ? result.winTier
          : undefined;

      onSettleRound({
        gameId: 'slots',
        bet: usingFreeSpin ? 0 : effectiveBet,
        payout: result.totalPayout,
        wasNearMiss: result.wasNearMiss,
        celebrateTier,
        celebrateLabel: 'THUNDERFALL CASCADE',
      });
    }, cascadeCursorMs + 80);
    timersRef.current.push(settleId);
  }, [balance, bet, freeSpins, modifiers, onSettleRound, onTriggerBurst, onWager, relicBonuses.cascadeStartBonus, turbo]);

  // Auto-spin scheduler
  useEffect(() => {
    if (!autoSpin) return;
    const interval = window.setInterval(() => {
      if (!isSpinningRef.current && (balance >= bet || freeSpins > 0)) {
        spin();
      } else if (balance < bet && freeSpins === 0) {
        setAutoSpin(false);
      }
    }, turbo ? 600 : 1100);
    return () => window.clearInterval(interval);
  }, [autoSpin, balance, bet, freeSpins, spin, turbo]);

  const isBusy = spinningReels.some(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {/* Header strip inside game stage */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Thunderfall Cascades</h2>
          <span className="text-xs text-slate-400">
            5×3 Weighted Virtual Reels · 15 Paylines · Tumble Multipliers
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-mono-num text-[#ECCB63]">
            <Flame className="h-4 w-4" aria-hidden="true" />
            <span>Cascade {cascadeMult}x</span>
          </div>
          {freeSpins > 0 && (
            <div className="flex items-center gap-1.5 font-mono-num font-bold text-emerald-400">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{freeSpins} Free Spins</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTurbo((t) => !t)}
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
            onClick={() => setAutoSpin((a) => !a)}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors ${
              autoSpin
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-[#0D1218] text-slate-300 hover:border-slate-500'
            }`}
          >
            <RotateCw className={`h-3.5 w-3.5 ${autoSpin ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{autoSpin ? 'Stop Auto' : 'Auto Spin'}</span>
          </button>
        </div>
      </div>

      {/* Main 5x3 Reel Cabinet */}
      <div
        data-testid="slots-cabinet"
        className="relative overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-[#0A0E14] p-4 shadow-[inset_0_0_60px_rgba(0,0,0,0.85)] sm:p-6"
      >
        {/* Cascade Multiplier Ladder */}
        <div className="mb-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 font-mono-num">
            {[1, 2, 4, 8, 16].map((m) => (
              <span
                key={m}
                className={`transition-all ${
                  cascadeMult === m
                    ? 'scale-110 font-bold text-[#ECCB63]'
                    : cascadeMult > m
                    ? 'text-emerald-400'
                    : 'text-slate-600'
                }`}
              >
                {m}x
              </span>
            ))}
          </div>
          <div className="font-mono-num text-sm font-semibold text-emerald-400">
            {lastWin > 0 ? `Win +$${lastWin.toFixed(2)}` : ''}
          </div>
        </div>

        {/* 5 Reel Columns */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {grid.map((column, reelIdx) => {
            const isTeasingThis = teaseReel === reelIdx;
            const isDimmed = teaseReel !== null && teaseReel !== reelIdx;
            return (
              <div
                key={reelIdx}
                className={`flex flex-col gap-2 sm:gap-2.5 rounded-xl p-1 transition-all duration-200 ${
                  isTeasingThis
                    ? 'border border-[#ECCB63] bg-[#241B0B] shadow-[0_0_32px_rgba(236,203,99,0.4)]'
                    : 'bg-transparent'
                } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
              >
                {column.map((sym, rowIdx) => {
                  const key = `${reelIdx}:${rowIdx}`;
                  const isWin = winningCells.has(key);
                  return (
                    <div
                      key={rowIdx}
                      className={`h-22 sm:h-26 ${spinningReels[reelIdx] ? 'blur-[1.5px] opacity-85' : ''}`}
                    >
                      <SymbolGlyph id={sym} isWin={isWin} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Live outcome / anticipation bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
          <span className="text-slate-300">{statusMessage}</span>
          <span className="font-mono-num text-slate-400">
            Director Policy: {modifiers.activeArm.replace('_', ' ')} · Est. RTP {modifiers.expectedRtp}%
          </span>
        </div>
      </div>

      {/* Wager Bar */}
      <WagerBar
        bet={bet}
        balance={balance}
        disabled={isBusy}
        onChangeBet={setBet}
        actionLabel={freeSpins > 0 ? `Free Spin (${freeSpins})` : isBusy ? 'Spinning...' : 'Spin Reels'}
        onAction={spin}
        actionDisabled={isBusy}
      />
    </div>
  );
};
