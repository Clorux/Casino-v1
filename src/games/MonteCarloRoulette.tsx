import React, { useEffect, useRef, useState } from 'react';
import type { GameCommonProps } from '../types/casino';
import {
  EUROPEAN_WHEEL_ORDER,
  getRouletteColor,
  resolveRouletteSpin,
  type RouletteBet,
  type RouletteBetType,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import feltTextureUrl from '../assets/images/felt_table_texture_1795386776893.jpg';

const CHIP_VALUES = [5, 10, 25, 100, 250];

export const MonteCarloRoulette: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [chipSize, setChipSize] = useState(25);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [lastBets, setLastBets] = useState<RouletteBet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([17, 32, 0, 19, 8]);
  const [message, setMessage] = useState('Place chips on the felt table, then spin the European wheel.');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelAngleRef = useRef(0);
  const ballAngleRef = useRef(0);
  const ballRadiusRef = useRef(102);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const totalStaked = bets.reduce((s, b) => s + b.amount, 0);

  const drawWheel = (wheelAngle: number, ballAngle: number, ballR: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 260;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    // Mahogany outer rim
    ctx.beginPath();
    ctx.arc(cx, cy, 122, 0, Math.PI * 2);
    ctx.fillStyle = '#2B1810';
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 37 pockets
    const slice = (Math.PI * 2) / 37;
    for (let i = 0; i < 37; i++) {
      const n = EUROPEAN_WHEEL_ORDER[i];
      const start = wheelAngle + i * slice - slice / 2;
      const end = start + slice;
      const col = getRouletteColor(n);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 108, start, end);
      ctx.closePath();
      ctx.fillStyle = col === 'green' ? '#0F766E' : col === 'red' ? '#9F1239' : '#111827';
      ctx.fill();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Number label
      const mid = start + slice / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * 94, cy + Math.sin(mid) * 94);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }

    // Inner brass turret
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#0E131A';
    ctx.fill();
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#D4AF37';
    ctx.fill();

    // Ivory ball
    const bx = cx + Math.cos(ballAngle) * ballR;
    const by = cy + Math.sin(ballAngle) * ballR;
    ctx.beginPath();
    ctx.arc(bx, by, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFDF5';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  };

  useEffect(() => {
    mountedRef.current = true;
    drawWheel(wheelAngleRef.current, ballAngleRef.current, ballRadiusRef.current);
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const addBet = (id: string, label: string, type: RouletteBetType) => {
    if (spinning) return;
    if (totalStaked + chipSize > balance) {
      setMessage('Not enough bankroll for additional chips.');
      return;
    }
    audioEngine.playChipPlace();
    setBets((prev) => {
      const existing = prev.find((b) => b.id === id);
      if (existing) {
        return prev.map((b) => (b.id === id ? { ...b, amount: b.amount + chipSize } : b));
      }
      return [...prev, { id, label, type, amount: chipSize }];
    });
  };

  const getBetAmount = (id: string) => bets.find((b) => b.id === id)?.amount ?? 0;

  const spinWheel = () => {
    if (spinning || bets.length === 0) return;
    if (totalStaked > balance || !onWager(totalStaked)) return;

    setSpinning(true);
    setLastBets(bets);
    setMessage('No more bets — ball in motion...');

    const res = resolveRouletteSpin(bets, modifiers);
    const pocketIdx = EUROPEAN_WHEEL_ORDER.indexOf(res.landed);
    const slice = (Math.PI * 2) / 37;

    const startWheel = wheelAngleRef.current;
    const targetWheel = startWheel + Math.PI * 4 + Math.random() * 2;
    const targetBallFinal = targetWheel + pocketIdx * slice;
    const startBall = ballAngleRef.current;
    // Counter-rotate ball several laps then settle into exact pocket angle
    const endBall = targetBallFinal - Math.PI * 8 - (Math.ceil((targetBallFinal - startBall) / (Math.PI * 2)) * Math.PI * 2);

    const duration = 2600;
    const t0 = performance.now();
    let lastTickIdx = -1;

    const animate = (now: number) => {
      if (!mountedRef.current) return;
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3.4);

      const curW = startWheel + (targetWheel - startWheel) * ease;
      const curB = startBall + (endBall - startBall) * ease;
      const curR = p < 0.72 ? 112 : 112 - ((p - 0.72) / 0.28) * 34;

      wheelAngleRef.current = curW;
      ballAngleRef.current = curB;
      ballRadiusRef.current = curR;
      drawWheel(curW, curB, curR);

      const tickBucket = Math.floor(Math.abs(curB) / slice);
      if (tickBucket !== lastTickIdx && p < 0.96) {
        lastTickIdx = tickBucket;
        audioEngine.playWheelTick(1 - p);
      }

      if (p < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
        setSpinning(false);
        setLanded(res.landed);
        setHistory((prev) => [res.landed, ...prev.slice(0, 11)]);
        setBets([]);

        const mult = totalStaked > 0 ? res.totalPayout / totalStaked : 0;
        const celebrateTier =
          mult >= 35
            ? 'JACKPOT'
            : mult >= 20
            ? 'MEGA'
            : mult >= 10
            ? 'SUPER'
            : mult >= 5
            ? 'BIG'
            : undefined;

        if (res.totalPayout > 0) {
          setMessage(`Landed ${res.landed} (${res.color.toUpperCase()}) — Won $${res.totalPayout.toFixed(2)}!`);
          if (!celebrateTier) audioEngine.playWinFanfare('WIN');
          if (mult >= 3) onTriggerBurst(mult >= 10 ? 'heavy' : 'light');
        } else {
          setMessage(`Landed ${res.landed} (${res.color.toUpperCase()}). Place bets for next spin.`);
          audioEngine.playBust();
        }

        onSettleRound({
          gameId: 'roulette',
          bet: totalStaked,
          payout: res.totalPayout,
          wasNearMiss: res.wasNearMiss,
          celebrateTier,
          celebrateLabel: 'MONTE CARLO ROULETTE',
        });
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Monte Carlo Roulette</h2>
          <p className="text-xs text-slate-400">Single-Zero European Wheel · 35:1 Straight · 2:1 Dozens · 1:1 Outside</p>
        </div>

        <div className="flex items-center gap-2 font-mono-num text-xs">
          <span className="text-slate-400">Recent:</span>
          {history.slice(0, 8).map((n, idx) => {
            const c = getRouletteColor(n);
            return (
              <span
                key={idx}
                className={`flex h-6 w-6 items-center justify-center rounded font-bold ${
                  c === 'green'
                    ? 'bg-emerald-700 text-white'
                    : c === 'red'
                    ? 'bg-rose-700 text-white'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {n}
              </span>
            );
          })}
        </div>
      </div>

      {/* Wheel + Velvet Felt Grid */}
      <div
        className="relative grid grid-cols-1 gap-6 overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-[#0D3B2A] p-5 lg:grid-cols-[280px_1fr]"
        style={{
          backgroundImage: `linear-gradient(rgba(9,24,18,0.78), rgba(9,24,18,0.88)), url(${feltTextureUrl})`,
          backgroundSize: 'cover',
        }}
      >
        <div className="flex flex-col items-center justify-center">
          <canvas ref={canvasRef} data-testid="roulette-canvas" className="h-[260px] w-[260px]" />
          <div className="mt-3 text-center">
            {landed !== null && (
              <div className="font-mono-num text-lg font-bold text-[#F9E7A8]">
                Result: {landed} ({getRouletteColor(landed).toUpperCase()})
              </div>
            )}
            <p className="mt-1 text-xs text-emerald-100/80">{message}</p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3">
          {/* Number Board 0..36 */}
          <div className="grid grid-cols-[44px_1fr] gap-1.5">
            <button
              type="button"
              onClick={() => addBet('n-0', '0', { kind: 'straight', value: 0 })}
              className="relative flex items-center justify-center rounded-md border border-[#D4AF37]/50 bg-emerald-800/85 font-mono-num text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              0
              {getBetAmount('n-0') > 0 && (
                <span className="absolute bottom-1 rounded bg-[#D4AF37] px-1 text-[10px] font-bold text-[#090C10]">
                  ${getBetAmount('n-0')}
                </span>
              )}
            </button>

            <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
              {Array.from({ length: 36 }, (_, idx) => {
                const n = idx + 1;
                const col = getRouletteColor(n);
                const amt = getBetAmount(`n-${n}`);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => addBet(`n-${n}`, `#${n}`, { kind: 'straight', value: n })}
                    className={`relative flex h-11 flex-col items-center justify-center rounded border font-mono-num text-xs font-bold text-white transition-transform active:scale-95 ${
                      col === 'red'
                        ? 'border-rose-400/30 bg-rose-800/90 hover:bg-rose-700'
                        : 'border-slate-600/40 bg-slate-900/90 hover:bg-slate-800'
                    }`}
                  >
                    <span>{n}</span>
                    {amt > 0 && (
                      <span className="rounded bg-[#D4AF37] px-1 text-[9px] font-bold text-[#090C10]">
                        ${amt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dozens */}
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map((d) => {
              const id = `dozen-${d}`;
              const amt = getBetAmount(id);
              const label = d === 1 ? '1st 12 (2:1)' : d === 2 ? '2nd 12 (2:1)' : '3rd 12 (2:1)';
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => addBet(id, label, { kind: 'dozen', value: d })}
                  className="flex items-center justify-center gap-2 rounded-md border border-[#D4AF37]/40 bg-[#0B2B20]/90 py-2.5 text-xs font-semibold text-slate-100 hover:bg-[#124231]"
                >
                  <span>{label}</span>
                  {amt > 0 && <span className="font-mono-num font-bold text-[#ECCB63]">${amt}</span>}
                </button>
              );
            })}
          </div>

          {/* Outside Bets */}
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {(
              [
                { id: 'low', label: '1–18', type: { kind: 'low' as const } },
                { id: 'even', label: 'Even', type: { kind: 'even' as const } },
                { id: 'red', label: 'Red', type: { kind: 'red' as const } },
                { id: 'black', label: 'Black', type: { kind: 'black' as const } },
                { id: 'odd', label: 'Odd', type: { kind: 'odd' as const } },
                { id: 'high', label: '19–36', type: { kind: 'high' as const } },
              ] as const
            ).map((o) => {
              const amt = getBetAmount(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => addBet(o.id, o.label, o.type)}
                  className={`flex items-center justify-center gap-1.5 rounded-md border py-2.5 text-xs font-semibold text-white transition-colors ${
                    o.id === 'red'
                      ? 'border-rose-400/40 bg-rose-800/85 hover:bg-rose-700'
                      : o.id === 'black'
                      ? 'border-slate-600/50 bg-slate-900/90 hover:bg-slate-800'
                      : 'border-[#D4AF37]/40 bg-[#0B2B20]/90 hover:bg-[#124231]'
                  }`}
                >
                  <span>{o.label}</span>
                  {amt > 0 && <span className="font-mono-num font-bold text-[#ECCB63]">${amt}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Roulette Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#11161D] px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Chip Size:</span>
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setChipSize(v)}
              className={`font-mono-num rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                chipSize === v
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                  : 'border-slate-700 bg-[#0D1218] text-slate-300 hover:border-slate-500'
              }`}
            >
              ${v}
            </button>
          ))}
          <span className="ml-2 font-mono-num text-xs text-slate-300">
            Table Stake: <strong className="text-[#ECCB63]">${totalStaked}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={spinning || bets.length === 0}
            onClick={() => setBets([])}
            className="rounded-lg border border-slate-700 bg-[#171E28] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={spinning || bets.length === 0 || totalStaked * 2 > balance}
            onClick={() => {
              audioEngine.playChipPlace();
              setBets((prev) => prev.map((b) => ({ ...b, amount: b.amount * 2 })));
            }}
            className="rounded-lg border border-slate-700 bg-[#171E28] px-3.5 py-2.5 text-xs font-semibold text-[#F9E7A8] hover:border-[#D4AF37] disabled:opacity-40"
          >
            2x
          </button>
          <button
            type="button"
            disabled={spinning || lastBets.length === 0}
            onClick={() => {
              const sum = lastBets.reduce((s, b) => s + b.amount, 0);
              if (sum <= balance) {
                audioEngine.playChipPlace();
                setBets(lastBets);
              }
            }}
            className="rounded-lg border border-slate-700 bg-[#171E28] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40"
          >
            Rebet
          </button>
          <button
            type="button"
            disabled={spinning || bets.length === 0}
            onClick={spinWheel}
            className="min-w-[140px] rounded-lg bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-[#090C10] hover:bg-[#ECCB63] disabled:opacity-45"
          >
            {spinning ? 'Spinning...' : 'Spin Wheel'}
          </button>
        </div>
      </div>
    </div>
  );
};
