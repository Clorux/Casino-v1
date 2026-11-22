import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { WinCelebration } from '../types/casino';
import { audioEngine } from '../engine/audioEngine';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  life: number;
  maxLife: number;
  shape: 'coin' | 'spark';
}

interface ParticleOverlayProps {
  burstSignal: { id: number; intensity: 'light' | 'heavy' } | null;
  celebration: WinCelebration | null;
  onDismissCelebration: () => void;
}

const POOL_SIZE = 140;
const COLORS = ['#ECCB63', '#D4AF37', '#FDE68A', '#34D399', '#F8FAFC'];

export const ParticleOverlay: React.FC<ParticleOverlayProps> = ({
  burstSignal,
  celebration,
  onDismissCelebration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poolRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const [displayAmount, setDisplayAmount] = useState(0);

  // Pre-allocate zero-GC ring buffer once
  useEffect(() => {
    poolRef.current = Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 6,
      color: '#D4AF37',
      rotation: 0,
      vr: 0,
      life: 0,
      maxLife: 1,
      shape: 'coin',
    }));
  }, []);

  // Trigger particle fountain on burstSignal
  useEffect(() => {
    if (!burstSignal || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));

    const count = burstSignal.intensity === 'heavy' ? 70 : 24;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.48;
    let spawned = 0;

    for (const p of poolRef.current) {
      if (!p.active && spawned < count) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 90;
        p.y = cy + (Math.random() - 0.5) * 40;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
        const speed = (burstSignal.intensity === 'heavy' ? 280 : 170) + Math.random() * 260;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 60;
        p.size = 4 + Math.random() * 6;
        p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        p.rotation = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 10;
        p.life = 0;
        p.maxLife = 0.85 + Math.random() * 0.65;
        p.shape = Math.random() < 0.65 ? 'coin' : 'spark';
        spawned++;
      }
    }

    if (!runningRef.current) {
      runningRef.current = true;
      let last = performance.now();

      const step = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          runningRef.current = false;
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let anyActive = false;
        for (const p of poolRef.current) {
          if (!p.active) continue;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          anyActive = true;
          p.vy += 680 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rotation += p.vr * dt;

          const alpha = Math.max(0, 1 - p.life / p.maxLife);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          if (p.shape === 'coin') {
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * (0.45 + 0.55 * Math.abs(Math.cos(p.rotation))), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#785A12';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            ctx.fillRect(-p.size * 0.5, -p.size * 0.25, p.size, p.size * 0.5);
          }
          ctx.restore();
        }

        if (anyActive) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          runningRef.current = false;
        }
      };

      rafRef.current = requestAnimationFrame(step);
    }
  }, [burstSignal]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // GSAP count-up for Big / Super / Mega Win banner
  useEffect(() => {
    if (!celebration) return;
    const obj = { val: 0 };
    let lastTick = 0;
    const tween = gsap.to(obj, {
      val: celebration.amount,
      duration: celebration.tier === 'MEGA' ? 1.8 : celebration.tier === 'SUPER' ? 1.35 : 0.95,
      ease: 'power3.out',
      onUpdate: () => {
        setDisplayAmount(obj.val);
        const now = performance.now();
        if (now - lastTick > 75) {
          audioEngine.playCoinTick();
          lastTick = now;
        }
      },
      onComplete: () => {
        setDisplayAmount(celebration.amount);
      },
    });

    const autoHide = window.setTimeout(() => {
      onDismissCelebration();
    }, celebration.tier === 'MEGA' ? 3600 : 2500);

    return () => {
      tween.kill();
      window.clearTimeout(autoHide);
    };
  }, [celebration, onDismissCelebration]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />

      {celebration && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/45">
          <div
            role="status"
            aria-live="polite"
            className="animate-banner-pop flex min-w-[320px] max-w-md flex-col items-center rounded-xl border border-[#D4AF37]/60 bg-[#0F141B] px-10 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
          >
            <span className="text-xs font-semibold tracking-[0.22em] text-[#ECCB63]">
              {celebration.label}
            </span>
            <h2 className="font-display mt-1 text-5xl font-bold tracking-wide text-[#F9E7A8]">
              {celebration.tier} WIN
            </h2>
            <div className="font-mono-num mt-4 text-4xl font-bold text-emerald-400">
              +${displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {celebration.multiplier.toFixed(2)}x Payout Multiplier
            </div>
            <button
              type="button"
              onClick={onDismissCelebration}
              className="mt-6 rounded-lg border border-[#D4AF37]/40 bg-[#1B232E] px-5 py-2 text-xs font-medium text-[#F3F4F6] transition-colors hover:border-[#D4AF37] hover:bg-[#232D3B]"
            >
              Collect Chips
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
