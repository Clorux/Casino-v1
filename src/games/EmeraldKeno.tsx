import React, { useEffect, useRef, useState } from 'react';
import { Gem, Shuffle, Trash2 } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  getKenoPayoutMultiplier,
  KENO_PAYOUT_TABLES,
  resolveKenoDraw,
  type KenoRisk,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

const DEFAULT_PICKS = [3, 7, 12, 18, 24, 29, 35];

export const EmeraldKeno: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [risk, setRisk] = useState<KenoRisk>('medium');
  const [picks, setPicks] = useState<number[]>(DEFAULT_PICKS);
  const [drawnRevealed, setDrawnRevealed] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [tensionActive, setTensionActive] = useState(false);
  const [lastHits, setLastHits] = useState<number | null>(null);
  const [status, setStatus] = useState(
    'Pick 1 to 10 lucky numbers on the 40-tile board, then draw 10 emerald vault balls.'
  );

  const timersRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const togglePick = (num: number) => {
    if (drawing) return;
    audioEngine.playClick();
    setDrawnRevealed([]);
    setLastHits(null);
    setPicks((prev) => {
      if (prev.includes(num)) {
        return prev.filter((n) => n !== num);
      }
      if (prev.length >= 10) return prev;
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const quickPick = (count = 7) => {
    if (drawing) return;
    audioEngine.playChipPlace();
    const pool = Array.from({ length: 40 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPicks(pool.slice(0, count).sort((a, b) => a - b));
    setDrawnRevealed([]);
    setLastHits(null);
    setStatus(`Auto-picked ${count} numbers. Ready to draw!`);
  };

  const clearPicks = () => {
    if (drawing) return;
    audioEngine.playClick();
    setPicks([]);
    setDrawnRevealed([]);
    setLastHits(null);
    setStatus('Board cleared — select 1 to 10 numbers or click Quick Pick.');
  };

  const playDraw = () => {
    if (drawing || picks.length === 0) return;
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    setDrawing(true);
    setDrawnRevealed([]);
    setLastHits(null);
    setTensionActive(false);
    setStatus('Drawing 10 vault spheres...');

    const res = resolveKenoDraw(effectiveBet, picks, risk, modifiers);
    const pickSet = new Set(picks);

    let cursorMs = 80;
    let runningHits = 0;

    res.drawnNumbers.forEach((ballNum, idx) => {
      // Anticipation slowdown on final 2 balls if already close to a strong hit tier
      const isLateTension = idx >= 8 && runningHits >= Math.max(2, Math.floor(picks.length * 0.4));
      cursorMs += isLateTension ? 240 : 95;

      const tId = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setDrawnRevealed((prev) => [...prev, ballNum]);
        if (isLateTension) {
          setTensionActive(true);
          audioEngine.playAnticipationTease();
        }

        if (pickSet.has(ballNum)) {
          runningHits += 1;
          setLastHits(runningHits);
          audioEngine.playComboChime(runningHits);
        } else {
          audioEngine.playReelStop(idx % 5);
        }
      }, cursorMs);

      timersRef.current.push(tId);
    });

    const settleId = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setDrawing(false);
      setTensionActive(false);
      setLastHits(res.hits);

      const celebrateTier =
        res.multiplier >= 50
          ? 'JACKPOT'
          : res.multiplier >= 20
          ? 'MEGA'
          : res.multiplier >= 8
          ? 'SUPER'
          : res.multiplier >= 3.5
          ? 'BIG'
          : undefined;

      if (res.payout > 0) {
        setStatus(
          `Matched ${res.hits}/${picks.length} numbers for ${res.multiplier}x — Paid $${res.payout.toFixed(2)}!`
        );
        if (!celebrateTier) {
          audioEngine.playWinFanfare('WIN');
        }
        if (res.multiplier >= 3.5) {
          onTriggerBurst(res.multiplier >= 12 ? 'heavy' : 'light');
        }
      } else {
        setStatus(
          `Matched ${res.hits}/${picks.length}.${
            res.wasNearMiss ? ' One match shy of a payout — tension building!' : ' Try another draw.'
          }`
        );
        audioEngine.playBust();
      }

      onSettleRound({
        gameId: 'keno',
        bet: effectiveBet,
        payout: res.payout,
        wasNearMiss: res.wasNearMiss,
        celebrateTier,
        celebrateLabel: 'EMERALD KENO DRAW',
      });
    }, cursorMs + 160);
    timersRef.current.push(settleId);
  };

  const activeRow =
    picks.length > 0 ? KENO_PAYOUT_TABLES[risk][picks.length] ?? [] : [];
  const drawnSet = new Set(drawnRevealed);
  const pickSet = new Set(picks);
  const currentLiveMatches = drawnRevealed.filter((n) => pickSet.has(n)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Emerald Keno</h2>
          <p className="text-xs text-slate-400">
            40-Tile Vault Grid · Pick up to 10 Numbers · Up to 1,000x Sovereign Jackpot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[#090C10] p-1">
            {(['low', 'medium', 'high'] as KenoRisk[]).map((r) => (
              <button
                key={r}
                type="button"
                disabled={drawing}
                onClick={() => setRisk(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  risk === r ? 'bg-[#D4AF37] text-[#090C10]' : 'text-slate-300 hover:text-white'
                }`}
              >
                {r} Risk
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={drawing}
            onClick={() => quickPick(Math.max(4, picks.length || 7))}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1218] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#D4AF37] disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" />
            <span>Quick Pick</span>
          </button>

          <button
            type="button"
            disabled={drawing || picks.length === 0}
            onClick={clearPicks}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1218] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Main 8x5 Keno Stage */}
      <div
        className={`rounded-xl border p-5 transition-all duration-300 ${
          tensionActive
            ? 'border-[#ECCB63] bg-[radial-gradient(circle_at_50%_30%,rgba(212,175,55,0.16),rgba(10,14,20,1)_72%)] shadow-[0_0_40px_rgba(212,175,55,0.22)]'
            : 'border-slate-800 bg-[#0A0E14]'
        }`}
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-2 sm:grid-cols-8 sm:gap-2.5">
          {Array.from({ length: 40 }, (_, i) => {
            const num = i + 1;
            const isPicked = pickSet.has(num);
            const isDrawn = drawnSet.has(num);
            const isHit = isPicked && isDrawn;

            return (
              <button
                key={num}
                type="button"
                aria-label={`Keno tile ${num}`}
                aria-pressed={isPicked}
                disabled={drawing}
                onClick={() => togglePick(num)}
                className={`relative flex aspect-square items-center justify-center rounded-lg border font-mono-num text-sm font-bold transition-all duration-150 sm:text-base ${
                  isHit
                    ? 'scale-105 border-[#ECCB63] bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_0_24px_rgba(16,185,129,0.55)]'
                    : isDrawn
                    ? 'border-rose-500/60 bg-rose-950/75 text-rose-300'
                    : isPicked
                    ? 'border-[#D4AF37] bg-[#251E0E] text-[#F9E7A8] shadow-[0_0_16px_rgba(212,175,55,0.25)]'
                    : 'border-slate-800 bg-[#131A24] text-slate-300 hover:-translate-y-0.5 hover:border-slate-600 hover:text-white'
                }`}
              >
                {isHit ? (
                  <span className="flex flex-col items-center leading-none">
                    <Gem className="mb-0.5 h-3.5 w-3.5 text-[#FEF3C7]" aria-hidden="true" />
                    <span>{num}</span>
                  </span>
                ) : (
                  num
                )}
              </button>
            );
          })}
        </div>

        {/* Live Payout Multiplier Strip */}
        <div className="mt-5 border-t border-slate-800/80 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">
              Selected: <strong className="font-mono-num text-[#F9E7A8]">{picks.length}/10</strong>
              {lastHits !== null && (
                <>
                  {' '}· Hits:{' '}
                  <strong className="font-mono-num text-emerald-400">
                    {lastHits} ({getKenoPayoutMultiplier(picks.length, lastHits, risk)}x)
                  </strong>
                </>
              )}
            </span>
            <span className="text-slate-300">{status}</span>
          </div>

          {activeRow.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-11">
              {activeRow.map((mult, hitCount) => {
                const isCurrent = drawnRevealed.length > 0 && currentLiveMatches === hitCount;
                return (
                  <div
                    key={hitCount}
                    className={`rounded-md border px-2 py-1.5 text-center font-mono-num transition-all ${
                      isCurrent
                        ? 'border-[#ECCB63] bg-[#D4AF37]/20 text-[#F9E7A8] shadow-[0_0_14px_rgba(212,175,55,0.3)]'
                        : mult >= 50
                        ? 'border-[#D4AF37]/40 bg-[#1A150B] text-[#ECCB63]'
                        : mult > 0
                        ? 'border-slate-800 bg-[#11161D] text-slate-200'
                        : 'border-slate-800/60 bg-[#0D1117] text-slate-600'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400">{hitCount}x Hit</div>
                    <div className="text-xs font-bold">{mult}x</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={drawing}
        onChangeBet={setBet}
        actionLabel={
          drawing ? 'Drawing Balls...' : picks.length === 0 ? 'Pick Numbers' : `Draw Keno (${picks.length})`
        }
        onAction={playDraw}
        actionDisabled={drawing || picks.length === 0}
      />
    </div>
  );
};
