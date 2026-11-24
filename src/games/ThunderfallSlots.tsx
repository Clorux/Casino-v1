import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Flame, Gauge, RotateCw, Sparkles, Zap } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  SLOT_SYMBOLS,
  SYMBOL_LIST,
  resolveThunderfallSpin,
  type SlotGrid,
  type SlotSymbolId,
} from '../engine/slotMath';
import {
  BALANCE_SCENARIO_LABELS,
  BET_PATTERN_LABELS,
  HOUSE_PHASE_META,
  type SpinSpeedMultiplier,
} from '../engine/houseMind';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

const SPEED_OPTIONS: SpinSpeedMultiplier[] = [1, 2, 4, 6, 8, 10];

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
  directorState,
  relicBonuses,
  houseMind,
  onWager,
  onSettleRound,
  onTriggerBurst,
  onRitualSignal,
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
  const [speedMultiplier, setSpeedMultiplier] = useState<SpinSpeedMultiplier>(1);
  const [statusMessage, setStatusMessage] = useState<string>(
    '15 Paylines · Cascading Tumble Multipliers · 1x–10x Speed Engine'
  );
  const [lastWin, setLastWin] = useState<number>(0);
  const [spinsPerMin, setSpinsPerMin] = useState<number>(0);

  const isSpinningRef = useRef(false);
  const spinningReelsRef = useRef<boolean[]>([false, false, false, false, false]);
  const [reelDropKey, setReelDropKey] = useState<number[]>([0, 0, 0, 0, 0]);
  const timersRef = useRef<number[]>([]);
  const spinTimestampsRef = useRef<number[]>([]);
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

  const handleSpeedSelect = (nextSpeed: SpinSpeedMultiplier) => {
    if (nextSpeed === speedMultiplier) return;
    audioEngine.playClick();
    setSpeedMultiplier(nextSpeed);
    onRitualSignal?.('SPEED_CHANGE', `Slots Speed ${nextSpeed}x`, {
      spinSpeedMultiplier: nextSpeed,
      turboActive: turbo,
      autoSpinActive: autoSpin,
    });
  };

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

    // Track real-time spins/minute velocity
    const now = Date.now();
    spinTimestampsRef.current = [...spinTimestampsRef.current.filter((t) => now - t < 60_000), now];
    if (spinTimestampsRef.current.length >= 2) {
      const spanMs = Math.max(1500, now - spinTimestampsRef.current[0]);
      setSpinsPerMin(Math.round((spinTimestampsRef.current.length / spanMs) * 60_000));
    } else {
      setSpinsPerMin(Math.round(18 * speedMultiplier * (turbo ? 1.4 : 1)));
    }

    isSpinningRef.current = true;
    spinningReelsRef.current = [true, true, true, true, true];
    setWinningCells(new Set());
    setLastWin(0);
    setTeaseReel(null);

    const startMult = Math.max(1, 1 + relicBonuses.cascadeStartBonus);
    setCascadeMult(usingFreeSpin ? Math.max(2, startMult) : startMult);
    setSpinningReels([true, true, true, true, true]);
    setStatusMessage(
      usingFreeSpin
        ? `Free Spin Active (${speedMultiplier}x) — 2x Starting Cascade`
        : `Spinning Reels at ${speedMultiplier}x${turbo ? ' + Turbo' : ''}...`
    );

    const result = resolveThunderfallSpin(effectiveBet, modifiers, {
      startCascadeMult: startMult,
      isFreeSpin: usingFreeSpin,
    });

    const firstStep = result.steps[0];
    // Combine 1x–10x speed selector with optional Turbo multiplier
    const paceScale = speedMultiplier * (turbo ? 1.45 : 1);
    const scaleMs = (ms: number, floorMs: number) => Math.max(floorMs, Math.round(ms / paceScale));

    const baseDelay = scaleMs(190, 16);
    const flickerMs = scaleMs(60, 26);

    // Rapid reel flicker interval — ONLY mutates columns still actively spinning!
    const flickerId = window.setInterval(() => {
      if (!mountedRef.current) return;
      setGrid((prev) =>
        prev.map((col, rIdx) => {
          if (!spinningReelsRef.current[rIdx]) return col;
          return col.map(() => SYMBOL_LIST[Math.floor(Math.random() * SYMBOL_LIST.length)]);
        })
      );
      if (speedMultiplier <= 6) {
        audioEngine.playReelTick(Math.random() * 4);
      }
    }, flickerMs);
    timersRef.current.push(flickerId);

    // Schedule staggered stops for each of the 5 reels, with dramatic slowdown on anticipation reels
    let cumulativeMs = scaleMs(320, 28);

    for (let r = 0; r < 5; r++) {
      const isTease = result.anticipationReels.includes(r);
      cumulativeMs += isTease ? scaleMs(740, 85) : baseDelay;

      if (isTease && speedMultiplier <= 6) {
        const teaseStartMs = cumulativeMs - scaleMs(680, 65);
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
        spinningReelsRef.current[r] = false;
        setSpinningReels((prev) => {
          const next = [...prev];
          next[r] = false;
          return next;
        });
        setReelDropKey((prev) => {
          const next = [...prev];
          next[r] = next[r] + 1;
          return next;
        });
        setGrid((prev) => {
          const next = prev.map((c) => [...c]);
          next[r] = [...firstStep.grid[r]];
          return next;
        });
        const landedScatter = firstStep.grid[r].includes('SCATTER');
        if (speedMultiplier <= 6 || r === 4 || landedScatter) {
          audioEngine.playReelStop(r, landedScatter);
        }
        if (r === 4) {
          window.clearInterval(flickerId);
          setTeaseReel(null);
        }
      }, cumulativeMs);
      timersRef.current.push(stopId);
    }

    // Play through cascade steps after all 5 reels settle
    let cascadeCursorMs = cumulativeMs + scaleMs(240, 22);
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
          if (idx >= 1 || step.stepPayout >= effectiveBet * 2.5) {
            onTriggerBurst(idx >= 2 ? 'heavy' : 'light');
          }
        }
      }, cascadeCursorMs);
      timersRef.current.push(stepId);

      if (step.wins.length > 0) {
        cascadeCursorMs += scaleMs(660, 75);
      }
    });

    // Final settlement
    const settleId = window.setTimeout(() => {
      if (!mountedRef.current) return;
      isSpinningRef.current = false;
      spinningReelsRef.current = [false, false, false, false, false];
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
        result.totalMultiplier >= 35
          ? 'JACKPOT'
          : result.totalMultiplier >= 15
          ? 'MEGA'
          : result.totalMultiplier >= 7
          ? 'SUPER'
          : result.totalMultiplier >= 3
          ? 'BIG'
          : undefined;

      onSettleRound({
        gameId: 'slots',
        bet: usingFreeSpin ? 0 : effectiveBet,
        payout: result.totalPayout,
        wasNearMiss: result.wasNearMiss,
        celebrateTier,
        celebrateLabel: 'THUNDERFALL CASCADE',
        turboActive: turbo,
        autoSpinActive: autoSpin,
        spinSpeedMultiplier: speedMultiplier,
      });
    }, cascadeCursorMs + scaleMs(80, 18));
    timersRef.current.push(settleId);
  }, [
    autoSpin,
    balance,
    bet,
    freeSpins,
    modifiers,
    onSettleRound,
    onTriggerBurst,
    onWager,
    relicBonuses.cascadeStartBonus,
    speedMultiplier,
    turbo,
  ]);

  // Auto-spin scheduler scaled cleanly by 1x–10x speed & Turbo
  useEffect(() => {
    if (!autoSpin) return;
    const pace = speedMultiplier * (turbo ? 1.45 : 1);
    const pollMs = Math.max(115, Math.round(980 / pace));
    const interval = window.setInterval(() => {
      if (!isSpinningRef.current && (balance >= bet || freeSpins > 0)) {
        spin();
      } else if (balance < bet && freeSpins === 0) {
        setAutoSpin(false);
      }
    }, pollMs);
    return () => window.clearInterval(interval);
  }, [autoSpin, balance, bet, freeSpins, speedMultiplier, spin, turbo]);

  const isBusy = spinningReels.some(Boolean);
  const isRealistic = directorState.mode === 'realistic_house';
  const phaseMeta = HOUSE_PHASE_META[houseMind.phase];

  return (
    <div className="flex flex-col gap-4">
      {/* Header strip inside game stage */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Thunderfall Cascades</h2>
          <span className="text-xs text-slate-400">
            5×3 Weighted Reels · 15 Paylines · 1x–10x Speed Engine
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* 1x / 2x / 4x / 6x / 8x / 10x Speed Selector */}
          <div
            data-testid="slots-speed-selector"
            role="group"
            aria-label="Spin speed multiplier"
            className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-[#090C10] p-0.5"
          >
            <Gauge className="mx-1.5 h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" />
            {SPEED_OPTIONS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => handleSpeedSelect(spd)}
                className={`font-mono-num rounded-md px-2 py-1 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  speedMultiplier === spd
                    ? spd >= 6
                      ? 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/70'
                      : 'bg-[#D4AF37] text-[#090C10]'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <div
            key={cascadeMult}
            className="animate-badge-bump flex items-center gap-1.5 font-mono-num text-[#ECCB63]"
          >
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
            onClick={() => {
              const next = !turbo;
              setTurbo(next);
              onRitualSignal?.('TURBO_TOGGLE', `Slots Turbo ${next ? 'ON' : 'OFF'}`, {
                turboActive: next,
                autoSpinActive: autoSpin,
                spinSpeedMultiplier: speedMultiplier,
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

          <button
            type="button"
            onClick={() => {
              const next = !autoSpin;
              setAutoSpin(next);
              onRitualSignal?.('AUTO_TOGGLE', `Slots Auto-Spin ${next ? 'ON' : 'OFF'}`, {
                turboActive: turbo,
                autoSpinActive: next,
                spinSpeedMultiplier: speedMultiplier,
              });
            }}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
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
        className={`relative overflow-hidden rounded-xl border bg-[#0A0E14] p-4 shadow-[inset_0_0_60px_rgba(0,0,0,0.85)] sm:p-6 ${
          isRealistic && houseMind.phase === 'PREDATOR_HARVEST'
            ? 'border-rose-500/55 animate-predator-pulse'
            : 'border-[#D4AF37]/30'
        }`}
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
                  const shouldDrop = !spinningReels[reelIdx] && reelDropKey[reelIdx] > 0;
                  return (
                    <div
                      key={`${reelIdx}-${rowIdx}-${reelDropKey[reelIdx]}`}
                      className={`h-22 sm:h-26 ${
                        spinningReels[reelIdx]
                          ? speedMultiplier >= 4
                            ? 'animate-speed-streak blur-[2px]'
                            : 'blur-[1.5px] opacity-85'
                          : shouldDrop
                          ? 'animate-reel-drop'
                          : ''
                      }`}
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
            Policy: {isRealistic ? phaseMeta.label : modifiers.activeArm.replace('_', ' ')} · Est. RTP{' '}
            {modifiers.expectedRtp}%
          </span>
        </div>

        {/* Embedded Real-Time Slots Speed, Bet-Delta & House Mind Analyzer */}
        <div
          data-testid="slots-speed-analyzer"
          className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-slate-800/80 bg-[#0D1219] px-3.5 py-2.5 text-[11px] sm:grid-cols-4"
        >
          <div>
            <div className="flex items-center gap-1 text-slate-400">
              <Gauge className="h-3 w-3 text-[#D4AF37]" aria-hidden="true" />
              <span>Speed &amp; Automation</span>
            </div>
            <div className="font-mono-num mt-0.5 font-bold text-slate-100">
              {speedMultiplier}x{turbo ? ' + Turbo' : ''} · {autoSpin ? 'Auto ON' : 'Manual'}
            </div>
            <div className="font-mono-num text-[10px] text-slate-500">
              {spinsPerMin > 0 ? `${spinsPerMin} spins/min` : 'Ready'} · {houseMind.speedChangeCount} shifts
            </div>
          </div>

          <div>
            <div className="text-slate-400">Balance Trajectory</div>
            <div className="font-mono-num mt-0.5 font-bold text-[#F9E7A8]">
              ${houseMind.startingBalance.toFixed(0)} → ${houseMind.currentBalance.toFixed(0)}
            </div>
            <div className="font-mono-num text-[10px] text-slate-500">
              Last Δ{' '}
              <span className={houseMind.lastBalanceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {houseMind.lastBalanceDelta >= 0 ? '+' : '-'}${Math.abs(houseMind.lastBalanceDelta).toFixed(0)}
              </span>{' '}
              · {BALANCE_SCENARIO_LABELS[houseMind.balanceScenario]}
            </div>
          </div>

          <div>
            <div className="text-slate-400">Bet Change Model</div>
            <div className="font-mono-num mt-0.5 font-bold text-slate-100">
              {BET_PATTERN_LABELS[houseMind.betPattern]}
            </div>
            <div className="font-mono-num text-[10px] text-slate-500">
              Last ${houseMind.lastBet > 0 ? houseMind.lastBet.toFixed(0) : bet} · Ratio{' '}
              {houseMind.betChangeRatio.toFixed(2)}x
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-slate-400">
              <Activity className="h-3 w-3 text-rose-400" aria-hidden="true" />
              <span>House Mind Signal</span>
            </div>
            <div
              className={`font-mono-num mt-0.5 font-bold ${
                modifiers.winBias < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {modifiers.winBias >= 0 ? '+' : ''}
              {(modifiers.winBias * 100).toFixed(1)}% Edge · {houseMind.activeTheoriesCount} Theories
            </div>
            <div className="truncate text-[10px] text-slate-500">
              {houseMind.detectedTheories[0]?.title ?? 'Scanning cadence...'}
            </div>
          </div>
        </div>
      </div>

      {/* Wager Bar */}
      <WagerBar
        bet={bet}
        balance={balance}
        disabled={isBusy}
        onChangeBet={setBet}
        actionLabel={
          freeSpins > 0
            ? `Free Spin (${freeSpins})`
            : isBusy
            ? `Spinning (${speedMultiplier}x)...`
            : `Spin Reels (${speedMultiplier}x)`
        }
        onAction={spin}
        actionDisabled={isBusy}
      />
    </div>
  );
};
