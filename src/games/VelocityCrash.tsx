import React, { useEffect, useRef, useState } from 'react';
import type { GameCommonProps } from '../types/casino';
import { generateCrashPoint } from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

type CrashPhase = 'IDLE' | 'FLYING' | 'CASHED_OUT' | 'CRASHED';

export const VelocityCrash: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [autoCashout, setAutoCashout] = useState<string>('2.5');
  const [phase, setPhase] = useState<CrashPhase>('IDLE');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [crashPoint, setCrashPoint] = useState<number>(0);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([2.41, 1.32, 6.84, 1.09, 3.75]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({
    phase: 'IDLE' as CrashPhase,
    startTime: 0,
    targetCrash: 2.0,
    currentMult: 1.0,
    activeBet: 25,
    autoCash: 2.5,
    lastToneAt: 0,
  });

  const settleRef = useRef(onSettleRound);
  const burstRef = useRef(onTriggerBurst);
  useEffect(() => {
    settleRef.current = onSettleRound;
    burstRef.current = onTriggerBurst;
  }, [onSettleRound, onTriggerBurst]);

  const executeCashout = (atMult: number) => {
    const s = stateRef.current;
    if (s.phase !== 'FLYING') return;
    s.phase = 'CASHED_OUT';
    const payout = Number((s.activeBet * atMult).toFixed(2));
    setPhase('CASHED_OUT');
    setCashedAt(atMult);
    setHistory((prev) => [s.targetCrash, ...prev.slice(0, 9)]);
    audioEngine.playWinFanfare(atMult >= 8 ? 'SUPER' : atMult >= 3 ? 'BIG' : 'WIN');
    burstRef.current(atMult >= 4 ? 'heavy' : 'light');
    settleRef.current({
      gameId: 'crash',
      bet: s.activeBet,
      payout,
      celebrateTier: atMult >= 15 ? 'MEGA' : atMult >= 7 ? 'SUPER' : atMult >= 3.5 ? 'BIG' : undefined,
      celebrateLabel: 'VELOCITY CRASH CASHOUT',
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = (now: number) => {
      const s = stateRef.current;
      if (s.phase === 'FLYING') {
        const elapsedSec = (now - s.startTime) / 1000;
        const m = Number(Math.pow(Math.E, 0.28 * elapsedSec).toFixed(2));
        s.currentMult = m;
        setMultiplier(m);

        if (now - s.lastToneAt > 180) {
          audioEngine.playCrashRise(m);
          s.lastToneAt = now;
        }

        if (s.autoCash >= 1.05 && m >= s.autoCash && s.autoCash <= s.targetCrash) {
          executeCashout(s.autoCash);
        } else if (m >= s.targetCrash) {
          s.currentMult = s.targetCrash;
          s.phase = 'CRASHED';
          setMultiplier(s.targetCrash);
          setPhase('CRASHED');
          setHistory((prev) => [s.targetCrash, ...prev.slice(0, 9)]);
          audioEngine.playBust();
          const wasNearMiss = s.autoCash > 1 && Math.abs(s.targetCrash - s.autoCash) <= 0.35;
          settleRef.current({
            gameId: 'crash',
            bet: s.activeBet,
            payout: 0,
            wasNearMiss,
          });
        }
      }

      // Render canvas
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(280, Math.floor(rect.height));
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // Subtle grid
        ctx.strokeStyle = 'rgba(148,163,184,0.08)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
          const y = h - (i * (h - 48)) / 4 - 24;
          ctx.beginPath();
          ctx.moveTo(42, y);
          ctx.lineTo(w - 20, y);
          ctx.stroke();
        }

        // Draw curve
        const mDisp = Math.max(1, s.currentMult);
        const maxScale = Math.max(3, mDisp * 1.25);
        const progressX = Math.min(1, Math.log(mDisp) / Math.log(maxScale));
        const endX = 48 + progressX * (w - 86);
        const endY = h - 32 - ((mDisp - 1) / (maxScale - 1)) * (h - 76);

        const curveColor =
          s.phase === 'CRASHED'
            ? '#F43F5E'
            : s.phase === 'CASHED_OUT'
            ? '#34D399'
            : '#ECCB63';

        ctx.beginPath();
        ctx.moveTo(48, h - 32);
        const steps = 40;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = 48 + t * (endX - 48);
          const y = h - 32 - Math.pow(t, 1.75) * (h - 32 - endY);
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = curveColor;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Fill subtle under-curve wash
        ctx.lineTo(endX, h - 32);
        ctx.closePath();
        ctx.fillStyle =
          s.phase === 'CRASHED'
            ? 'rgba(244,63,94,0.12)'
            : s.phase === 'CASHED_OUT'
            ? 'rgba(52,211,153,0.14)'
            : 'rgba(212,175,55,0.12)';
        ctx.fill();

        // Leading point
        ctx.beginPath();
        ctx.arc(endX, endY, 6, 0, Math.PI * 2);
        ctx.fillStyle = curveColor;
        ctx.fill();

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const launchRound = () => {
    if (phase === 'FLYING') return;
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    const target = generateCrashPoint(modifiers);
    setCrashPoint(target);
    setCashedAt(null);
    setMultiplier(1.0);
    setPhase('FLYING');

    stateRef.current = {
      phase: 'FLYING',
      startTime: performance.now(),
      targetCrash: target,
      currentMult: 1.0,
      activeBet: effectiveBet,
      autoCash: Math.max(0, Number(autoCashout) || 0),
      lastToneAt: 0,
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Velocity Crash</h2>
          <p className="text-xs text-slate-400">
            Ride the exponential multiplier curve and cash out before the engine busts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="auto-cashout" className="text-xs text-slate-400">
            Auto Cashout (x)
          </label>
          <input
            id="auto-cashout"
            type="number"
            min={1.1}
            max={100}
            step={0.1}
            disabled={phase === 'FLYING'}
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            className="font-mono-num w-20 rounded-lg border border-slate-700 bg-[#090C10] px-2.5 py-1.5 text-xs font-semibold text-white outline-none focus:border-[#D4AF37]"
          />
        </div>
      </div>

      {/* Main Crash Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0A0E14] p-4">
        <canvas ref={canvasRef} data-testid="crash-canvas" className="h-[340px] w-full rounded-lg" />

        {/* Center Multiplier Readout */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`font-mono-num text-6xl font-bold tracking-tight sm:text-7xl ${
              phase === 'CRASHED'
                ? 'text-rose-500'
                : phase === 'CASHED_OUT'
                ? 'text-emerald-400'
                : 'text-[#F9E7A8]'
            }`}
          >
            {multiplier.toFixed(2)}x
          </div>
          <div className="mt-2 text-sm font-medium text-slate-300">
            {phase === 'IDLE' && 'Place wager and launch curve'}
            {phase === 'FLYING' && `Live Cashout: $${(stateRef.current.activeBet * multiplier).toFixed(2)}`}
            {phase === 'CASHED_OUT' && cashedAt && `Cashed out at ${cashedAt.toFixed(2)}x · Crashed at ${crashPoint.toFixed(2)}x`}
            {phase === 'CRASHED' && `Crashed at ${crashPoint.toFixed(2)}x`}
          </div>
        </div>

        {/* Recent crash rail */}
        <div className="mt-2 flex items-center gap-3 border-t border-slate-800/80 pt-2.5 text-xs">
          <span className="text-slate-400">Recent crashes:</span>
          <div className="flex flex-wrap items-center gap-3 font-mono-num">
            {history.map((c, idx) => (
              <span
                key={idx}
                className={c >= 4 ? 'font-bold text-[#ECCB63]' : c >= 2 ? 'text-emerald-400' : 'text-rose-400'}
              >
                {c.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={phase === 'FLYING'}
        onChangeBet={setBet}
        actionLabel={phase === 'FLYING' ? 'In Flight...' : 'Launch Round'}
        onAction={launchRound}
        actionDisabled={phase === 'FLYING'}
        secondaryAction={
          phase === 'FLYING'
            ? {
                label: `Cash Out ($${(stateRef.current.activeBet * multiplier).toFixed(0)})`,
                onClick: () => executeCashout(stateRef.current.currentMult),
                tone: 'emerald',
              }
            : undefined
        }
      />
    </div>
  );
};
