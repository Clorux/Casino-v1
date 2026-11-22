import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameCommonProps } from '../types/casino';
import {
  PLINKO_MULTIPLIERS,
  resolvePlinkoDrop,
  type PlinkoRisk,
  type PlinkoRows,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

interface ActiveBall {
  id: number;
  path: Array<0 | 1>;
  rows: PlinkoRows;
  bet: number;
  bucketIndex: number;
  multiplier: number;
  payout: number;
  wasNearMiss: boolean;
  progress: number; // 0 .. rows
  lastRowSound: number;
  color: string;
}

interface PegFlash {
  row: number;
  col: number;
  alpha: number;
}

export const GravityPlinko: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(20);
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [risk, setRisk] = useState<PlinkoRisk>('medium');
  const [recentHits, setRecentHits] = useState<Array<{ id: number; mult: number; profit: number }>>([]);
  const [activeBucketFlash, setActiveBucketFlash] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<ActiveBall[]>([]);
  const flashesRef = useRef<PegFlash[]>([]);
  const rafRef = useRef<number | null>(null);
  const nextBallId = useRef(1);
  const settleRef = useRef(onSettleRound);
  const burstRef = useRef(onTriggerBurst);
  const rowsRef = useRef(rows);
  const riskRef = useRef(risk);

  useEffect(() => {
    settleRef.current = onSettleRound;
    burstRef.current = onTriggerBurst;
  }, [onSettleRound, onTriggerBurst]);

  useEffect(() => {
    rowsRef.current = rows;
    riskRef.current = risk;
  }, [rows, risk]);

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const rCount = rowsRef.current;
    const multipliers = PLINKO_MULTIPLIERS[riskRef.current][rCount];

    ctx.clearRect(0, 0, w, h);

    const topY = 38;
    const bottomY = h - 56;
    const rowStepY = (bottomY - topY) / rCount;
    const maxCols = rCount + 2;
    const spacingX = Math.min(44, (w - 64) / maxCols);
    const centerX = w / 2;

    // Draw pegs
    for (let r = 0; r < rCount; r++) {
      const pegsInRow = r + 3;
      const y = topY + r * rowStepY;
      const rowWidth = (pegsInRow - 1) * spacingX;
      const startX = centerX - rowWidth / 2;

      for (let c = 0; c < pegsInRow; c++) {
        const x = startX + c * spacingX;
        ctx.beginPath();
        ctx.arc(x, y, rCount === 16 ? 3.2 : 4.2, 0, Math.PI * 2);
        ctx.fillStyle = '#CBD5E1';
        ctx.fill();
      }
    }

    // Draw peg hit flashes
    for (const fl of flashesRef.current) {
      const pegsInRow = fl.row + 3;
      const y = topY + fl.row * rowStepY;
      const rowWidth = (pegsInRow - 1) * spacingX;
      const x = centerX - rowWidth / 2 + fl.col * spacingX;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(236, 203, 99, ${fl.alpha * 0.65})`;
      ctx.fill();
    }

    // Draw multiplier buckets along bottom
    const bucketCount = multipliers.length;
    const bucketWidth = spacingX - 4;
    const totalBucketRowW = (bucketCount - 1) * spacingX;
    const bStartX = centerX - totalBucketRowW / 2;

    for (let i = 0; i < bucketCount; i++) {
      const mult = multipliers[i];
      const bx = bStartX + i * spacingX - bucketWidth / 2;
      const by = bottomY + 10;
      const isHigh = mult >= 10;
      const isProfit = mult >= 1.5;

      ctx.fillStyle = isHigh ? '#D4AF37' : isProfit ? '#0F5132' : '#1E293B';
      ctx.beginPath();
      ctx.roundRect(bx, by, bucketWidth, 30, 5);
      ctx.fill();

      ctx.fillStyle = isHigh ? '#090C10' : '#F8FAFC';
      ctx.font = `600 ${rCount === 16 ? 9 : 11}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mult}x`, bx + bucketWidth / 2, by + 15);
    }

    // Draw active balls
    for (const ball of ballsRef.current) {
      const idx = Math.floor(ball.progress);
      const frac = ball.progress - idx;

      let prevRights = 0;
      for (let k = 0; k < Math.min(idx, ball.path.length); k++) {
        prevRights += ball.path[k];
      }
      const nextStep = ball.path[idx] ?? 0;
      const xOffsetPrev = (prevRights - idx / 2) * spacingX;
      const xOffsetNext = (prevRights + nextStep - (idx + 1) / 2) * spacingX;

      // Smooth parabolic arc bounce between peg rows
      const curX = centerX + xOffsetPrev + (xOffsetNext - xOffsetPrev) * frac;
      const bounceLift = Math.sin(frac * Math.PI) * 9;
      const curY = topY + (idx + frac) * rowStepY - bounceLift;

      ctx.beginPath();
      ctx.arc(curX, curY, rCount === 16 ? 6.5 : 8, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.max(300, Math.floor(rect.width));
      const targetH = Math.max(340, Math.floor(rect.height));
      if (canvas.width !== Math.floor(targetW * dpr) || canvas.height !== Math.floor(targetH * dpr)) {
        canvas.width = Math.floor(targetW * dpr);
        canvas.height = Math.floor(targetH * dpr);
      }

      // Advance balls
      const remaining: ActiveBall[] = [];
      for (const b of ballsRef.current) {
        b.progress += dt * (b.rows === 16 ? 8.2 : 6.8);
        const curRow = Math.floor(b.progress);

        if (curRow > b.lastRowSound && curRow < b.rows) {
          b.lastRowSound = curRow;
          audioEngine.playPlinkoPeg(curRow, b.rows);
          let rSoFar = 0;
          for (let k = 0; k < curRow; k++) rSoFar += b.path[k];
          flashesRef.current.push({ row: curRow, col: rSoFar + 1, alpha: 1 });
        }

        if (b.progress >= b.rows) {
          setActiveBucketFlash(b.bucketIndex);
          setRecentHits((prev) => [
            { id: b.id, mult: b.multiplier, profit: b.payout - b.bet },
            ...prev.slice(0, 7),
          ]);
          if (b.multiplier >= 4) {
            burstRef.current(b.multiplier >= 10 ? 'heavy' : 'light');
          }
          settleRef.current({
            gameId: 'plinko',
            bet: b.bet,
            payout: b.payout,
            wasNearMiss: b.wasNearMiss,
            celebrateTier:
              b.multiplier >= 30 ? 'MEGA' : b.multiplier >= 12 ? 'SUPER' : b.multiplier >= 5 ? 'BIG' : undefined,
            celebrateLabel: 'GRAVITY PLINKO',
          });
        } else {
          remaining.push(b);
        }
      }
      ballsRef.current = remaining;

      // Decay flashes
      flashesRef.current = flashesRef.current
        .map((f) => ({ ...f, alpha: f.alpha - dt * 3.5 }))
        .filter((f) => f.alpha > 0.02);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(dpr, dpr);
        drawFrame(ctx, targetW, targetH);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  const dropBall = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    audioEngine.playChipPlace();
    const res = resolvePlinkoDrop(effectiveBet, rows, risk, modifiers);
    ballsRef.current.push({
      id: nextBallId.current++,
      path: res.path,
      rows,
      bet: effectiveBet,
      bucketIndex: res.bucketIndex,
      multiplier: res.multiplier,
      payout: res.payout,
      wasNearMiss: res.wasNearMiss,
      progress: 0,
      lastRowSound: -1,
      color: risk === 'high' ? '#ECCB63' : risk === 'medium' ? '#34D399' : '#60A5FA',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Gravity Plinko</h2>
          <p className="text-xs text-slate-400">
            Click Drop repeatedly for multi-ball cascades · Up to 1,000x High Risk edge buckets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-[#090C10] p-1">
            {(['low', 'medium', 'high'] as PlinkoRisk[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRisk(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  risk === r ? 'bg-[#D4AF37] text-[#090C10]' : 'text-slate-300 hover:text-white'
                }`}
              >
                {r} Risk
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-[#090C10] p-1">
            {([8, 12, 16] as PlinkoRows[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRows(r)}
                className={`font-mono-num rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  rows === r ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r} Rows
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Board */}
      <div className="relative rounded-xl border border-slate-800 bg-[#0A0E14] p-3">
        <canvas
          ref={canvasRef}
          data-testid="plinko-canvas"
          className="h-[420px] w-full rounded-lg"
        />

        {recentHits.length > 0 && (
          <div className="mt-2 flex items-center gap-3 border-t border-slate-800/80 px-2 pt-2.5 text-xs">
            <span className="text-slate-400">Recent drops:</span>
            <div className="flex flex-wrap items-center gap-3 font-mono-num">
              {recentHits.map((h) => (
                <span
                  key={h.id}
                  className={
                    h.mult >= 4
                      ? 'font-bold text-[#ECCB63]'
                      : h.mult >= 1
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }
                >
                  {h.mult}x
                </span>
              ))}
            </div>
            {activeBucketFlash !== null && (
              <span className="ml-auto font-mono-num text-slate-400">
                Last pocket #{activeBucketFlash + 1}
              </span>
            )}
          </div>
        )}
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        onChangeBet={setBet}
        actionLabel="Drop Ball"
        onAction={dropBall}
      />
    </div>
  );
};
