import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Flame, Lock, Magnet, Shield, Sparkles, Zap } from 'lucide-react';
import type { GameCommonProps, WinTier } from '../types/casino';
import {
  createEmptyHoldWinState,
  FULL_VAULT_BONUS_MULT,
  resolveHoldWinBaseSpin,
  stepHoldWinRespin,
  type HoldWinState,
  type VaultOrb,
} from '../engine/holdAndWinEngine';
import { audioEngine } from '../engine/audioEngine';

const STAKE_PRESETS = [5, 10, 25, 50, 100, 250];
const FEATURE_BUY_MULT = 12;

interface EnergyArc {
  fromIdx: number;
  toIdx: number;
  progress: number;
  life: number;
  color: string;
}

function getOrbAppearance(orb: VaultOrb): {
  ring: string;
  bg: string;
  text: string;
  sublabel: string;
  badgeIcon: React.ReactNode;
} {
  switch (orb.kind) {
    case 'GRAND':
      return {
        ring: 'border-[#FEF08A] shadow-[0_0_24px_rgba(254,240,138,0.5)]',
        bg: 'bg-gradient-to-br from-[#6B1028] via-[#4A0D1D] to-[#1A0810]',
        text: 'text-[#FEF08A]',
        sublabel: 'GRAND',
        badgeIcon: <Crown className="h-4 w-4 text-[#FEF08A]" aria-hidden="true" />,
      };
    case 'MAJOR':
      return {
        ring: 'border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.42)]',
        bg: 'bg-gradient-to-br from-[#4C1124] via-[#2C0B16] to-[#140910]',
        text: 'text-rose-200',
        sublabel: 'MAJOR',
        badgeIcon: <Flame className="h-4 w-4 text-rose-300" aria-hidden="true" />,
      };
    case 'MINI':
      return {
        ring: 'border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.38)]',
        bg: 'bg-gradient-to-br from-[#3B2608] via-[#241705] to-[#120D05]',
        text: 'text-amber-200',
        sublabel: 'MINI',
        badgeIcon: <Shield className="h-4 w-4 text-amber-300" aria-hidden="true" />,
      };
    case 'COLLECTOR':
      return {
        ring: 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.5)]',
        bg: 'bg-gradient-to-br from-[#0A402E] via-[#072B1F] to-[#041711]',
        text: 'text-emerald-200',
        sublabel: 'COLLECTOR',
        badgeIcon: <Zap className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
      };
    case 'MULTIPLIER':
      return {
        ring: 'border-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.42)]',
        bg: 'bg-gradient-to-br from-[#3B104A] via-[#240B2E] to-[#130719]',
        text: 'text-fuchsia-200',
        sublabel: `+${orb.boostValue ?? 1}x ALL`,
        badgeIcon: <Magnet className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />,
      };
    default:
      return {
        ring: 'border-[#D4AF37] shadow-[0_0_14px_rgba(212,175,55,0.28)]',
        bg: 'bg-gradient-to-br from-[#2B220B] via-[#1C1608] to-[#100D06]',
        text: 'text-[#F9E7A8]',
        sublabel: 'GOLD ORB',
        badgeIcon: <Sparkles className="h-3.5 w-3.5 text-[#ECCB63]" aria-hidden="true" />,
      };
  }
}

export const SovereignHoldWin: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
  onRitualSignal,
}) => {
  const [bet, setBet] = useState<number>(25);
  const [vaultState, setVaultState] = useState<HoldWinState>(() => createEmptyHoldWinState(25));
  const [spinningSlots, setSpinningSlots] = useState<boolean>(false);
  const [autoRespin, setAutoRespin] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Land 4+ Gold Orbs to lock the Sovereign Vault, or enter Vault Lock directly for 12x stake.'
  );
  const [activeWagerSpent, setActiveWagerSpent] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const arcsRef = useRef<EnergyArc[]>([]);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const stateRef = useRef(vaultState);
  const wagerSpentRef = useRef(activeWagerSpent);

  useEffect(() => {
    stateRef.current = vaultState;
  }, [vaultState]);

  useEffect(() => {
    wagerSpentRef.current = activeWagerSpent;
  }, [activeWagerSpent]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Canvas2D Collector Energy Arc Renderer (additive glowing plasma arcs between vault cells)
  const triggerCollectorArcs = useCallback((sourceIndices: number[], targetIndex: number) => {
    if (sourceIndices.length === 0) return;
    arcsRef.current = sourceIndices.map((fromIdx) => ({
      fromIdx,
      toIdx: targetIndex,
      progress: 0,
      life: 1,
      color: '#34D399',
    }));

    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;

    const getCellCenter = (idx: number) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const cellW = canvas.width / 5;
      const cellH = canvas.height / 3;
      return {
        x: col * cellW + cellW * 0.5,
        y: row * cellH + cellH * 0.5,
      };
    };

    let last = performance.now();
    const renderArcs = (now: number) => {
      if (!mountedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const rect = grid.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      let alive = false;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      for (const arc of arcsRef.current) {
        arc.progress = Math.min(1, arc.progress + dt * 2.4);
        arc.life = Math.max(0, arc.life - dt * 1.15);
        if (arc.life <= 0.01) continue;
        alive = true;

        const start = getCellCenter(arc.fromIdx);
        const end = getCellCenter(arc.toIdx);
        const midX = (start.x + end.x) * 0.5 + (start.y - end.y) * 0.16;
        const midY = (start.y + end.y) * 0.5 - Math.abs(start.x - end.x) * 0.14;

        // Glowing quadratic energy arc
        ctx.strokeStyle = arc.color;
        ctx.globalAlpha = arc.life * 0.85;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(midX, midY, end.x, end.y);
        ctx.stroke();

        // Bright golden core filament
        ctx.strokeStyle = '#FEF08A';
        ctx.globalAlpha = arc.life * 0.95;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Travelling plasma orb along curve
        const t = arc.progress;
        const inv = 1 - t;
        const px = inv * inv * start.x + 2 * inv * t * midX + t * t * end.x;
        const py = inv * inv * start.y + 2 * inv * t * midY + t * t * end.y;
        const grad = ctx.createRadialGradient(px, py, 1, px, py, 14);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.45, 'rgba(52, 211, 153, 0.85)');
        grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (alive) {
        rafRef.current = requestAnimationFrame(renderArcs);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderArcs);
  }, []);

  const settleCompletedBonus = useCallback(
    (finalState: HoldWinState, finalPayout: number) => {
      const spent = Math.max(finalState.bet, wagerSpentRef.current);
      const effectiveMult = finalState.bet > 0 ? finalPayout / finalState.bet : 0;

      let celebrateTier: WinTier | undefined;
      let celebrateLabel = 'SOVEREIGN VAULT LOCK';
      if (finalState.fullBoardBonus || effectiveMult >= 120) {
        celebrateTier = 'JACKPOT';
        celebrateLabel = finalState.fullBoardBonus
          ? '15/15 FULL VAULT CRACKED!'
          : 'SOVEREIGN VAULT JACKPOT';
      } else if (effectiveMult >= 60) {
        celebrateTier = 'MEGA';
      } else if (effectiveMult >= 25) {
        celebrateTier = 'SUPER';
      } else if (effectiveMult >= 10) {
        celebrateTier = 'BIG';
      }

      if (celebrateTier) {
        onTriggerBurst('heavy');
      } else if (finalPayout > 0) {
        audioEngine.playWinFanfare('WIN');
        onTriggerBurst('light');
      }

      onSettleRound({
        gameId: 'holdwin',
        bet: spent,
        payout: finalPayout,
        celebrateTier,
        celebrateLabel,
      });

      setStatusMessage(
        finalState.fullBoardBonus
          ? `FULL VAULT CRACKED! 15/15 Orbs + ${FULL_VAULT_BONUS_MULT}x Bonus paid $${finalPayout.toFixed(2)}!`
          : `Vault Lock complete — ${finalState.totalMultiplier.toFixed(1)}x paid $${finalPayout.toFixed(2)}!`
      );
    },
    [onSettleRound, onTriggerBurst]
  );

  const executeRespinStep = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'RESPINNING') return;

    setSpinningSlots(true);
    const isFinalTension = current.respinsLeft === 1;
    if (isFinalTension) {
      audioEngine.playHarmonicRiser(0.95);
    } else {
      audioEngine.playReelTick(current.spinCount % 4);
    }

    const revealDelay = isFinalTension ? 920 : 480;
    timerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      const { nextState, landedCount, finished, finalPayout } = stepHoldWinRespin(
        stateRef.current,
        modifiers
      );
      setSpinningSlots(false);
      setVaultState(nextState);
      stateRef.current = nextState;

      if (nextState.lastStepEvents.length > 0) {
        setStatusMessage(nextState.lastStepEvents.join(' · '));
      }

      if (nextState.collectorTargetIndex !== null && nextState.collectorSourceIndices.length > 0) {
        audioEngine.playCollectorSurge();
        onTriggerBurst('heavy');
        triggerCollectorArcs(nextState.collectorSourceIndices, nextState.collectorTargetIndex);
      } else if (landedCount > 0) {
        const lockedNow = nextState.cells.filter(Boolean).length;
        audioEngine.playVaultTumbler(lockedNow);
        if (landedCount >= 2 || nextState.cells.some((c) => c?.newlyLanded && c.kind !== 'COIN')) {
          onTriggerBurst('light');
        }
      }

      if (finished) {
        settleCompletedBonus(nextState, finalPayout);
      }
    }, revealDelay);
  }, [modifiers, onTriggerBurst, settleCompletedBonus, triggerCollectorArcs]);

  // Auto-advance respins when autoRespin is enabled
  useEffect(() => {
    if (vaultState.phase !== 'RESPINNING' || spinningSlots || !autoRespin) return;
    const pauseMs = vaultState.respinsLeft === 1 ? 620 : 440;
    const id = window.setTimeout(() => {
      if (mountedRef.current && stateRef.current.phase === 'RESPINNING') {
        executeRespinStep();
      }
    }, pauseMs);
    return () => window.clearTimeout(id);
  }, [vaultState, spinningSlots, autoRespin, executeRespinStep]);

  const handleBaseSpin = (forceBonus = false) => {
    if (spinningSlots || vaultState.phase === 'RESPINNING') return;
    const cost = forceBonus ? Number((bet * FEATURE_BUY_MULT).toFixed(2)) : bet;
    if (!onWager(cost)) return;

    setActiveWagerSpent(cost);
    wagerSpentRef.current = cost;
    setSpinningSlots(true);
    setStatusMessage(
      forceBonus
        ? 'Unlocking Sovereign Vault Chambers...'
        : 'Spinning 15 brushed-brass Vault Chambers...'
    );
    audioEngine.playChipPlace();
    if (forceBonus) {
      audioEngine.playHarmonicRiser(0.65);
    }

    timerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      const result = resolveHoldWinBaseSpin(bet, modifiers, { forceBonus });
      setSpinningSlots(false);
      setVaultState(result.state);
      stateRef.current = result.state;
      setStatusMessage(result.state.lastStepEvents.join(' · '));

      if (result.enteredBonus) {
        audioEngine.playVaultTumbler(5);
        audioEngine.playCoinShower(10);
        onTriggerBurst('heavy');
      } else {
        if (result.instantPayout > 0) {
          audioEngine.playVaultTumbler(2);
          const mult = result.instantPayout / bet;
          const celebrateTier: WinTier | undefined = mult >= 10 ? 'BIG' : undefined;
          if (!celebrateTier) {
            audioEngine.playWinFanfare('WIN');
          }
          onTriggerBurst('light');
          onSettleRound({
            gameId: 'holdwin',
            bet: cost,
            payout: result.instantPayout,
            wasNearMiss: result.wasNearMiss,
            celebrateTier,
            celebrateLabel: 'VAULT SCATTER PAY',
          });
        } else {
          audioEngine.playReelStop(2, false);
          onSettleRound({
            gameId: 'holdwin',
            bet: cost,
            payout: 0,
            wasNearMiss: result.wasNearMiss,
          });
        }
      }
    }, forceBonus ? 520 : 420);
  };

  const lockedCount = vaultState.cells.filter(Boolean).length;
  const isRespinning = vaultState.phase === 'RESPINNING';
  const isLastRespinTension = isRespinning && vaultState.respinsLeft === 1;
  const featureBuyCost = Number((bet * FEATURE_BUY_MULT).toFixed(2));
  const liveVaultValue = Number((vaultState.totalMultiplier * vaultState.bet).toFixed(2));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-4">
        <div className="flex items-center gap-3">
          <Lock className="h-6 w-6 text-[#D4AF37]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">
              Sovereign Hold &amp; Win
            </h2>
            <p className="text-xs text-slate-400">
              5×3 Vault Lock Respins · Emerald Collectors · Multiplier Magnets · 15/15 Full Vault +100x
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 font-mono-num text-xs">
          <div>
            <span className="text-slate-400">MINI </span>
            <strong className="text-amber-300">25x</strong>
          </div>
          <div>
            <span className="text-slate-400">MAJOR </span>
            <strong className="text-rose-300">75x</strong>
          </div>
          <div>
            <span className="text-slate-400">GRAND </span>
            <strong className="text-[#FEF08A]">250x</strong>
          </div>
          <div>
            <span className="text-slate-400">FULL VAULT </span>
            <strong className="text-emerald-400">+{FULL_VAULT_BONUS_MULT}x</strong>
          </div>
        </div>
      </div>

      {/* Main Stage + Controls */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        {/* 5x3 Sovereign Vault Matrix Stage */}
        <section
          className={`relative overflow-hidden rounded-2xl border-2 bg-[#0B0F15] p-4 sm:p-6 transition-all duration-300 ${
            isLastRespinTension
              ? 'border-rose-500/80 animate-heartbeat-glow'
              : isRespinning
              ? 'border-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,0.2)]'
              : 'border-slate-800/90'
          }`}
        >
          {/* Live Vault Status Strip */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-4 py-3">
            {/* Respins Remaining Counter */}
            <div className="flex items-center gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Respins
              </div>
              <div className="flex items-center gap-1.5" data-testid="holdwin-respins">
                {[1, 2, 3].map((pip) => {
                  const active = vaultState.respinsLeft >= pip;
                  return (
                    <span
                      key={pip}
                      className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono-num text-xs font-bold transition-all ${
                        active
                          ? isLastRespinTension
                            ? 'border-rose-400 bg-rose-500/25 text-rose-200'
                            : 'border-[#ECCB63] bg-[#D4AF37]/20 text-[#FEF08A]'
                          : 'border-slate-800 bg-[#090C10] text-slate-600'
                      }`}
                    >
                      {pip}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Locked Chambers Progress */}
            <div className="flex items-center gap-4 font-mono-num text-xs">
              <div>
                <span className="text-slate-400">Locked </span>
                <strong data-testid="holdwin-locked-count" className="text-white">
                  {lockedCount}/15
                </strong>
              </div>
              <div className="h-4 w-px bg-slate-800" aria-hidden="true" />
              <div>
                <span className="text-slate-400">Vault Total </span>
                <strong data-testid="holdwin-total-mult" className="text-base text-[#FEF08A]">
                  {vaultState.totalMultiplier.toFixed(1)}x
                </strong>
                <span className="ml-1.5 text-emerald-400">
                  (${liveVaultValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </div>
            </div>
          </div>

          {/* 5x3 Vault Grid with Overlaid Canvas2D Energy Arcs */}
          <div ref={gridRef} className="relative">
            <div
              data-testid="holdwin-grid"
              className="grid grid-cols-5 gap-2 sm:gap-3"
            >
              {vaultState.cells.map((orb, idx) => {
                if (orb) {
                  const style = getOrbAppearance(orb);
                  return (
                    <div
                      key={`${idx}-${orb.id}`}
                      className={`relative flex aspect-[1.08/1] flex-col items-center justify-center overflow-hidden rounded-xl border-2 p-2 text-center select-none ${
                        style.ring
                      } ${style.bg} ${orb.newlyLanded ? 'animate-spring-pop' : ''} vault-shimmer`}
                    >
                      <div className="mb-0.5">{style.badgeIcon}</div>
                      <div className={`font-mono-num text-lg font-black leading-none sm:text-2xl ${style.text}`}>
                        {orb.value}x
                      </div>
                      <div className="mt-1 text-[9px] font-bold tracking-widest text-slate-300 sm:text-[10px]">
                        {style.sublabel}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`flex aspect-[1.08/1] flex-col items-center justify-center rounded-xl border border-slate-800/90 bg-[#0D1219] transition-all ${
                      spinningSlots
                        ? 'border-[#D4AF37]/40 bg-[#141A24] opacity-75'
                        : 'hover:border-slate-700'
                    }`}
                  >
                    <Lock
                      className={`h-4 w-4 ${
                        spinningSlots ? 'text-[#D4AF37]/60' : 'text-slate-700'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="mt-1 font-mono-num text-[10px] text-slate-600">
                      {spinningSlots ? '···' : `V-${idx + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Canvas2D Collector Plasma Arc Overlay */}
            <canvas
              ref={canvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20 h-full w-full"
            />
          </div>

          {/* Live Event Readout */}
          <div
            data-testid="holdwin-status"
            className="mt-4 rounded-lg border border-slate-800/80 bg-[#11161D] px-4 py-2.5 text-center text-xs font-medium text-slate-200"
          >
            {statusMessage}
          </div>
        </section>

        {/* Right Control Deck */}
        <aside className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#11161D] p-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Base Stake</span>
                <span className="font-mono-num text-[#ECCB63]">${bet.toFixed(2)}</span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {STAKE_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={isRespinning || spinningSlots}
                    onClick={() => {
                      audioEngine.playClick();
                      setBet(amt);
                    }}
                    className={`font-mono-num rounded-lg border py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      bet === amt
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                        : 'border-slate-800 bg-[#090C10] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={isRespinning || spinningSlots}
                  onClick={() => setBet((b) => Math.max(5, Number((b / 2).toFixed(0))))}
                  className="rounded-lg border border-slate-800 bg-[#090C10] py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 disabled:opacity-50"
                >
                  ½ Stake
                </button>
                <button
                  type="button"
                  disabled={isRespinning || spinningSlots}
                  onClick={() => setBet((b) => Math.min(Math.max(5, Math.floor(balance)), b * 2))}
                  className="rounded-lg border border-slate-800 bg-[#090C10] py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 disabled:opacity-50"
                >
                  2× Stake
                </button>
              </div>
            </div>

            {/* Auto-Respin Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#090C10] px-3 py-2.5 text-xs">
              <span className="text-slate-300">Auto-Pace Respins</span>
              <button
                type="button"
                onClick={() => {
                  const next = !autoRespin;
                  setAutoRespin(next);
                  onRitualSignal?.('AUTO_TOGGLE', `Hold & Win Auto-Pace ${next ? 'ON' : 'OFF'}`);
                }}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  autoRespin
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {autoRespin ? 'AUTO ON' : 'MANUAL'}
              </button>
            </div>

            {/* Orb Legend */}
            <div className="space-y-2 rounded-lg border border-slate-800/80 bg-[#090C10] p-3 text-[11px]">
              <div className="font-semibold text-slate-200">Special Vault Orbs</div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-emerald-300 font-semibold">Emerald Collector</span>
                <span>Absorbs all board coins</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-fuchsia-300 font-semibold">Multiplier Magnet</span>
                <span>+1x to +3x every coin</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[#FEF08A] font-semibold">15/15 Full Vault</span>
                <span>+{FULL_VAULT_BONUS_MULT}x Grand Crack</span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {isRespinning ? (
              <button
                type="button"
                disabled={spinningSlots}
                onClick={executeRespinStep}
                data-testid="holdwin-respin-btn"
                className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-[#090C10] shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition-all hover:bg-emerald-400 disabled:opacity-60"
              >
                {spinningSlots
                  ? 'Spinning Chambers...'
                  : `Respin Vault (${vaultState.respinsLeft} Left)`}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={spinningSlots || balance < bet}
                  onClick={() => handleBaseSpin(false)}
                  data-testid="holdwin-spin-btn"
                  className="w-full rounded-xl bg-[#D4AF37] px-4 py-3.5 text-sm font-bold text-[#090C10] shadow-[0_8px_28px_rgba(212,175,55,0.3)] transition-all hover:bg-[#ECCB63] disabled:opacity-45"
                >
                  {spinningSlots ? 'Spinning Vault...' : `Spin Vault · $${bet.toFixed(0)}`}
                </button>

                <button
                  type="button"
                  disabled={spinningSlots || balance < featureBuyCost}
                  onClick={() => handleBaseSpin(true)}
                  data-testid="holdwin-buy-btn"
                  className="w-full rounded-xl border border-emerald-500/60 bg-emerald-950/50 px-4 py-3 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-900/60 disabled:opacity-40"
                >
                  Instant Vault Lock Bonus ({FEATURE_BUY_MULT}x · ${featureBuyCost.toLocaleString()})
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
