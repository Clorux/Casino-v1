import React, { useEffect, useRef, useState } from 'react';
import type { GameCommonProps } from '../types/casino';
import { ROYAL_WHEEL_SEGMENTS, resolveWheelSpin } from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

export const RoyalWheel: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ label: string; payout: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const drawWheel = (rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 340;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2 + 8;
    const radius = 148;
    const count = ROYAL_WHEEL_SEGMENTS.length;
    const slice = (Math.PI * 2) / count;

    // Outer brass bezel
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    ctx.fillStyle = '#1B232E';
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const seg = ROYAL_WHEEL_SEGMENTS[i];
      const start = rot + i * slice - slice / 2 - Math.PI / 2;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const mid = start + slice / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * (radius - 28), cy + Math.sin(mid) * (radius - 28));
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = seg.textColor;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seg.label, 0, 0);
      ctx.restore();
    }

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#090C10';
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ECCB63';
    ctx.font = '700 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VAULT', cx, cy);

    // Top pointer flapper
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy - radius - 12);
    ctx.lineTo(cx + 11, cy - radius - 12);
    ctx.lineTo(cx, cy - radius + 12);
    ctx.closePath();
    ctx.fillStyle = '#ECCB63';
    ctx.fill();
    ctx.strokeStyle = '#090C10';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  };

  useEffect(() => {
    mountedRef.current = true;
    drawWheel(angleRef.current);
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const spin = () => {
    if (spinning) return;
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    setSpinning(true);
    const res = resolveWheelSpin(effectiveBet, modifiers);
    const count = ROYAL_WHEEL_SEGMENTS.length;
    const slice = (Math.PI * 2) / count;

    // Target rotation where segmentIndex aligns under top pointer (-PI/2)
    const desiredMod = ((-res.segmentIndex * slice) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const current = angleRef.current;
    const currentMod = ((current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += Math.PI * 2;
    const targetRot = current + Math.PI * 10 + delta;

    const duration = 3100;
    const t0 = performance.now();
    let lastSegTick = -1;

    const tick = (now: number) => {
      if (!mountedRef.current) return;
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 4.1);
      const cur = current + (targetRot - current) * ease;
      angleRef.current = cur;
      drawWheel(cur);

      const segTick = Math.floor(cur / slice);
      if (segTick !== lastSegTick && p < 0.98) {
        lastSegTick = segTick;
        audioEngine.playWheelTick(1 - p);
      }

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setSpinning(false);
        setLastResult({ label: res.segment.label, payout: res.payout });
        const celebrateTier =
          res.segment.multiplier >= 50
            ? 'JACKPOT'
            : res.segment.multiplier >= 25
            ? 'MEGA'
            : res.segment.multiplier >= 10
            ? 'SUPER'
            : res.segment.multiplier >= 5
            ? 'BIG'
            : undefined;

        if (res.payout > 0) {
          if (!celebrateTier) {
            audioEngine.playWinFanfare('WIN');
          }
          if (res.segment.multiplier >= 3) {
            onTriggerBurst(res.segment.multiplier >= 10 ? 'heavy' : 'light');
          }
        } else {
          audioEngine.playBust();
        }
        onSettleRound({
          gameId: 'wheel',
          bet: effectiveBet,
          payout: res.payout,
          wasNearMiss: res.wasNearMiss,
          celebrateTier,
          celebrateLabel: 'ROYAL WHEEL JACKPOT',
        });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Royal Wheel of Fortune</h2>
          <p className="text-xs text-slate-400">
            24-Segment Brass Prize Wheel · 50x Sovereign Crown Wedge · Audio-Synced Flapper
          </p>
        </div>
        {lastResult && (
          <div className="font-mono-num text-sm font-bold text-[#ECCB63]">
            Last: {lastResult.label} {lastResult.payout > 0 ? `(+$${lastResult.payout.toFixed(2)})` : ''}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#0A0E14] p-6">
        <canvas ref={canvasRef} data-testid="wheel-canvas" className="h-[340px] w-[340px]" />
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={spinning}
        onChangeBet={setBet}
        actionLabel={spinning ? 'Spinning...' : 'Spin Royal Wheel'}
        onAction={spin}
        actionDisabled={spinning}
      />
    </div>
  );
};
