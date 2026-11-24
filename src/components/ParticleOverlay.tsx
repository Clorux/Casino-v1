import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { WinCelebration, WinFlare, WinTier } from '../types/casino';
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
  shape: 'coin' | 'spark' | 'diamond';
}

interface Shockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface ParticleOverlayProps {
  burstSignal: { id: number; intensity: 'light' | 'heavy' } | null;
  celebration: WinCelebration | null;
  winFlare: WinFlare | null;
  onDismissCelebration: () => void;
}

const POOL_SIZE = 220;

const TIER_STYLES: Record<
  WinTier,
  {
    title: string;
    rimColor: string;
    rayColor: string;
    scrimBg: string;
    cardBorder: string;
    titleColor: string;
    amountColor: string;
    palette: string[];
  }
> = {
  BIG: {
    title: 'BIG WIN',
    rimColor: '#F59E0B',
    rayColor: 'rgba(245, 158, 11, 0.16)',
    scrimBg: 'radial-gradient(circle at 50% 45%, rgba(180, 83, 9, 0.36) 0%, rgba(9, 12, 16, 0.78) 70%)',
    cardBorder: 'border-amber-400/80',
    titleColor: 'text-amber-300',
    amountColor: 'text-[#FDE68A]',
    palette: ['#F59E0B', '#ECCB63', '#FEF3C7', '#F97316'],
  },
  SUPER: {
    title: 'SUPER WIN',
    rimColor: '#10B981',
    rayColor: 'rgba(16, 185, 129, 0.19)',
    scrimBg: 'radial-gradient(circle at 50% 45%, rgba(6, 95, 70, 0.44) 0%, rgba(9, 12, 16, 0.82) 72%)',
    cardBorder: 'border-emerald-400/85',
    titleColor: 'text-emerald-300',
    amountColor: 'text-[#F9E7A8]',
    palette: ['#34D399', '#10B981', '#ECCB63', '#A7F3D0'],
  },
  MEGA: {
    title: 'MEGA WIN',
    rimColor: '#F43F5E',
    rayColor: 'rgba(244, 63, 94, 0.22)',
    scrimBg: 'radial-gradient(circle at 50% 45%, rgba(159, 18, 57, 0.48) 0%, rgba(9, 12, 16, 0.86) 72%)',
    cardBorder: 'border-rose-400/90',
    titleColor: 'text-rose-300',
    amountColor: 'text-[#FDE047]',
    palette: ['#F43F5E', '#FB7185', '#ECCB63', '#FDE047', '#FFF1F2'],
  },
  JACKPOT: {
    title: 'SOVEREIGN JACKPOT',
    rimColor: '#FDE047',
    rayColor: 'rgba(253, 224, 71, 0.26)',
    scrimBg:
      'radial-gradient(circle at 50% 45%, rgba(217, 119, 6, 0.52) 0%, rgba(136, 19, 55, 0.42) 38%, rgba(9, 12, 16, 0.9) 76%)',
    cardBorder: 'border-[#FDE047]',
    titleColor: 'text-[#FEF08A]',
    amountColor: 'text-emerald-300',
    palette: ['#FDE047', '#ECCB63', '#F43F5E', '#34D399', '#FFFFFF'],
  },
};

export const ParticleOverlay: React.FC<ParticleOverlayProps> = ({
  burstSignal,
  celebration,
  winFlare,
  onDismissCelebration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poolRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const celebrationRef = useRef<WinCelebration | null>(celebration);
  const rayAngleRef = useRef(0);
  const flashAlphaRef = useRef(0);

  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    celebrationRef.current = celebration;
  }, [celebration]);

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

  const ensureLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas || runningRef.current) return;
    runningRef.current = true;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(1, Math.floor(rect.width));
      const targetH = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        runningRef.current = false;
        return;
      }
      ctx.clearRect(0, 0, targetW, targetH);

      const activeCeleb = celebrationRef.current;
      const cx = targetW * 0.5;
      const cy = targetH * 0.46;

      // Volumetric additive ('lighter') radial light beams during BIG/SUPER/MEGA/JACKPOT
      if (activeCeleb) {
        const style = TIER_STYLES[activeCeleb.tier];
        rayAngleRef.current += dt * (activeCeleb.tier === 'JACKPOT' ? 0.65 : 0.38);
        const rayCount = activeCeleb.tier === 'JACKPOT' ? 16 : 12;
        const maxLen = Math.hypot(targetW, targetH) * 0.72;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalCompositeOperation = 'lighter';

        // Soft volumetric core radial aura
        const coreGrad = ctx.createRadialGradient(0, 0, 12, 0, 0, maxLen * 0.55);
        coreGrad.addColorStop(0, style.rayColor);
        coreGrad.addColorStop(0.55, style.rayColor);
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, maxLen * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Primary rotating volumetric gradient beams
        ctx.rotate(rayAngleRef.current);
        const beamGrad = ctx.createRadialGradient(0, 0, 18, 0, 0, maxLen);
        beamGrad.addColorStop(0, style.rayColor);
        beamGrad.addColorStop(0.6, style.rayColor);
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        for (let i = 0; i < rayCount; i++) {
          const a = (i * Math.PI * 2) / rayCount;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, maxLen, a, a + Math.PI / (rayCount * 1.45));
          ctx.closePath();
          ctx.fill();
        }

        // Secondary counter-rotating golden inner rays for MEGA / JACKPOT
        if (activeCeleb.tier === 'MEGA' || activeCeleb.tier === 'JACKPOT') {
          ctx.rotate(-rayAngleRef.current * 1.8);
          const innerGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, maxLen * 0.65);
          innerGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
          innerGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.fillStyle = innerGrad;
          for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI * 2) / 10;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, maxLen * 0.65, a, a + Math.PI / 18);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Draw expanding shockwaves
      const nextWaves: Shockwave[] = [];
      for (const sw of shockwavesRef.current) {
        sw.radius += dt * (sw.maxRadius * 1.85);
        if (sw.radius <= 0) {
          nextWaves.push(sw);
          continue;
        }
        sw.alpha = Math.min(1, Math.max(0, 1 - sw.radius / sw.maxRadius));
        if (sw.alpha > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = sw.color;
          ctx.globalAlpha = sw.alpha * 0.72;
          ctx.lineWidth = 4.5;
          ctx.stroke();
          ctx.restore();
          nextWaves.push(sw);
        }
      }
      shockwavesRef.current = nextWaves;

      // Update & render particles
      let anyActive = false;
      for (const p of poolRef.current) {
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        anyActive = true;
        p.vy += 640 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vr * dt;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        if (p.shape === 'spark') {
          // Velocity-aligned additive glowing spark motion trail
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, p.size * 0.36);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.042, p.y - p.vy * 0.042);
          ctx.stroke();
          ctx.restore();
          continue;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === 'coin') {
          ctx.beginPath();
          ctx.ellipse(
            0,
            0,
            p.size,
            p.size * (0.4 + 0.6 * Math.abs(Math.cos(p.rotation))),
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.strokeStyle = '#785A12';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.75, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.75, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Crisp radial golden-white impact flash on MEGA / JACKPOT hit
      if (flashAlphaRef.current > 0.01) {
        const flashA = Math.min(0.65, flashAlphaRef.current);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flashGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.hypot(targetW, targetH) * 0.65);
        flashGrad.addColorStop(0, `rgba(255, 251, 235, ${flashA})`);
        flashGrad.addColorStop(0.55, `rgba(253, 224, 71, ${flashA * 0.45})`);
        flashGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.restore();
        flashAlphaRef.current = Math.max(0, flashAlphaRef.current - dt * 2.5);
      }

      if (
        anyActive ||
        shockwavesRef.current.length > 0 ||
        celebrationRef.current ||
        flashAlphaRef.current > 0.01
      ) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, targetW, targetH);
        runningRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const spawnBurst = (count: number, palette: string[], speedBoost = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(300, Math.floor(rect.height));
    const cx = w * 0.5;
    const cy = h * 0.46;

    let spawned = 0;
    for (const p of poolRef.current) {
      if (!p.active && spawned < count) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 110;
        p.y = cy + (Math.random() - 0.5) * 45;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.5;
        const speed = (220 + Math.random() * 340) * speedBoost;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 85 * speedBoost;
        p.size = 4.5 + Math.random() * 6.5;
        p.color = palette[Math.floor(Math.random() * palette.length)];
        p.rotation = Math.random() * Math.PI * 2;
        p.vr = (Math.random() - 0.5) * 12;
        p.life = 0;
        p.maxLife = 0.95 + Math.random() * 0.85;
        const r = Math.random();
        p.shape = r < 0.5 ? 'coin' : r < 0.72 ? 'diamond' : 'spark';
        spawned++;
      }
    }
    ensureLoop();
  };

  useEffect(() => {
    if (!burstSignal) return;
    const isHeavy = burstSignal.intensity === 'heavy';
    spawnBurst(
      isHeavy ? 85 : 30,
      ['#ECCB63', '#D4AF37', '#FDE047', '#34D399', '#F8FAFC'],
      isHeavy ? 1.15 : 0.9
    );
    if (isHeavy) {
      shockwavesRef.current.push({
        radius: 18,
        maxRadius: 420,
        alpha: 1,
        color: '#ECCB63',
      });
    }
  }, [burstSignal]);

  // Dramatic multi-stage Celebration Count-Up & Shower
  useEffect(() => {
    if (!celebration) return;
    const style = TIER_STYLES[celebration.tier];
    const count =
      celebration.tier === 'JACKPOT'
        ? 160
        : celebration.tier === 'MEGA'
        ? 125
        : celebration.tier === 'SUPER'
        ? 95
        : 65;

    if (celebration.tier === 'JACKPOT') {
      flashAlphaRef.current = 0.56;
    } else if (celebration.tier === 'MEGA') {
      flashAlphaRef.current = 0.34;
    } else if (celebration.tier === 'SUPER') {
      flashAlphaRef.current = 0.18;
    }

    spawnBurst(count, style.palette, celebration.tier === 'JACKPOT' ? 1.35 : 1.15);
    shockwavesRef.current.push({
      radius: 20,
      maxRadius: celebration.tier === 'JACKPOT' ? 680 : 520,
      alpha: 1,
      color: style.rimColor,
    });

    // Secondary dramatic fountain wave for MEGA / JACKPOT
    let waveTimer: number | undefined;
    if (celebration.tier === 'MEGA' || celebration.tier === 'JACKPOT') {
      waveTimer = window.setTimeout(() => {
        flashAlphaRef.current = Math.max(flashAlphaRef.current, 0.25);
        spawnBurst(90, style.palette, 1.25);
        shockwavesRef.current.push({
          radius: 16,
          maxRadius: 620,
          alpha: 1,
          color: '#FDE047',
        });
      }, 650);
    }

    const obj = { val: 0 };
    let lastTick = 0;
    const duration =
      celebration.tier === 'JACKPOT'
        ? 2.2
        : celebration.tier === 'MEGA'
        ? 1.85
        : celebration.tier === 'SUPER'
        ? 1.4
        : 1.05;

    const tween = gsap.to(obj, {
      val: celebration.amount,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        setDisplayAmount(obj.val);
        const now = performance.now();
        if (now - lastTick > 70) {
          audioEngine.playCoinTick();
          lastTick = now;
        }
      },
      onComplete: () => {
        setDisplayAmount(celebration.amount);
      },
    });

    const autoHide = window.setTimeout(
      () => onDismissCelebration(),
      celebration.tier === 'JACKPOT' ? 4400 : celebration.tier === 'MEGA' ? 3600 : 2800
    );

    return () => {
      tween.kill();
      window.clearTimeout(autoHide);
      if (waveTimer) window.clearTimeout(waveTimer);
    };
  }, [celebration, onDismissCelebration]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const tierStyle = celebration ? TIER_STYLES[celebration.tier] : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Subtle dramatic floating win flare for normal wins */}
      {winFlare && !celebration && (
        <div
          key={winFlare.id}
          className="animate-win-flare pointer-events-none fixed left-1/2 top-24 z-40 rounded-lg border border-emerald-400/60 bg-[#0A1F17]/95 px-5 py-2 text-center shadow-[0_12px_36px_rgba(16,185,129,0.35)]"
        >
          <div className="font-mono-num text-xl font-bold text-emerald-300">
            +${winFlare.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="font-mono-num text-[11px] font-semibold text-[#ECCB63]">
            {winFlare.multiplier.toFixed(2)}x Hit
          </div>
        </div>
      )}

      {/* Dramatic Tiered Color Scrim */}
      {celebration && tierStyle && (
        <div
          className="pointer-events-auto fixed inset-0 flex items-center justify-center transition-opacity"
          style={{ background: tierStyle.scrimBg }}
        />
      )}

      {/* Full-screen Canvas for Volumetric Light Beams, Shockwaves, Impact Flash & Coins */}
      <canvas ref={canvasRef} className="relative z-10 h-full w-full" aria-hidden="true" />

      {/* Dramatic Center Banner Card */}
      {celebration && tierStyle && (
        <div className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center p-4">
          <div
            role="status"
            aria-live="polite"
            className={`animate-banner-pop relative overflow-hidden ${
              celebration.tier === 'JACKPOT'
                ? 'jackpot-aura animate-chromatic-hit vault-shimmer'
                : celebration.tier === 'MEGA'
                ? 'jackpot-aura animate-chromatic-hit'
                : ''
            } flex min-w-[320px] max-w-lg flex-col items-center rounded-2xl border-2 ${
              tierStyle.cardBorder
            } bg-[#0D1118]/95 px-10 py-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.9)]`}
          >
            <span className="text-xs font-bold tracking-[0.26em] text-[#ECCB63]">
              {celebration.label}
            </span>
            <h2
              className={`font-display mt-1.5 text-5xl font-bold tracking-wide sm:text-6xl ${tierStyle.titleColor}`}
              style={{ textShadow: `0 4px 28px ${tierStyle.rimColor}` }}
            >
              {tierStyle.title}
            </h2>

            <div
              className={`font-mono-num mt-4 text-4xl font-bold sm:text-5xl ${tierStyle.amountColor}`}
            >
              +$
              {displayAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>

            <div className="mt-2 font-mono-num text-sm font-semibold text-slate-200">
              {celebration.multiplier.toFixed(2)}x Payout Multiplier
            </div>

            <button
              type="button"
              onClick={onDismissCelebration}
              className="mt-6 rounded-lg bg-[#D4AF37] px-6 py-2.5 text-xs font-bold text-[#090C10] shadow-lg transition-transform hover:bg-[#ECCB63] active:scale-95"
            >
              Collect Chips
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
