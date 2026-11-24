import React, { useEffect, useRef, useState } from 'react';
import type { GameCommonProps } from '../types/casino';
import {
  resolveBaccaratRound,
  type BaccaratBetSide,
  type BaccaratResult,
  type PlayingCard,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';
import feltTextureUrl from '../assets/images/felt_table_texture_1795386776893.jpg';

function BaccaratCard({ card, index }: { card: PlayingCard; index: number }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div
      style={{ animationDelay: `${index * 90}ms` }}
      className="animate-card-deal flex h-28 w-20 flex-col justify-between rounded-lg border border-slate-300 bg-[#FAF9F6] p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.5)]"
    >
      <div className={`font-mono-num text-base font-bold leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.rank}
        <span className="ml-0.5 text-sm">{card.suit}</span>
      </div>
      <div className={`self-center text-3xl leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>
      <div className={`rotate-180 font-mono-num text-base font-bold leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.rank}
        <span className="ml-0.5 text-sm">{card.suit}</span>
      </div>
    </div>
  );
}

const BET_OPTIONS: Array<{
  side: BaccaratBetSide;
  label: string;
  payoutLabel: string;
  accent: string;
}> = [
  { side: 'player', label: 'Player', payoutLabel: '1 : 1', accent: 'border-sky-400/70 bg-sky-950/50 text-sky-200' },
  { side: 'banker', label: 'Banker', payoutLabel: '0.95 : 1', accent: 'border-rose-400/70 bg-rose-950/50 text-rose-200' },
  { side: 'tie', label: 'Tie', payoutLabel: '8 : 1', accent: 'border-emerald-400/70 bg-emerald-950/50 text-emerald-200' },
  { side: 'pair', label: 'Dragon Pair', payoutLabel: '11 : 1', accent: 'border-[#D4AF37]/80 bg-[#271F0D] text-[#F9E7A8]' },
];

export const SovereignBaccarat: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(50);
  const [selectedSide, setSelectedSide] = useState<BaccaratBetSide>('banker');
  const [dealing, setDealing] = useState(false);
  const [lastHand, setLastHand] = useState<BaccaratResult | null>(null);
  const [roadmap, setRoadmap] = useState<Array<'player' | 'banker' | 'tie'>>([
    'banker',
    'banker',
    'player',
    'tie',
    'player',
    'banker',
  ]);
  const [statusText, setStatusText] = useState('Select Player, Banker, Tie, or Dragon Pair and deal.');
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const dealBaccarat = () => {
    if (dealing) return;
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    setDealing(true);
    audioEngine.playCardDeal();

    const res = resolveBaccaratRound(effectiveBet, selectedSide, modifiers);

    timerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      audioEngine.playCardDeal();
      setLastHand(res);
      setRoadmap((prev) => [res.winner, ...prev.slice(0, 17)]);
      setDealing(false);

      const mult = effectiveBet > 0 ? res.payout / effectiveBet : 0;
      if (res.payout > effectiveBet) {
        setStatusText(
          `${res.isNatural ? 'NATURAL! ' : ''}${res.winner.toUpperCase()} wins ${res.playerTotal}–${res.bankerTotal} · Paid $${res.payout.toFixed(2)}`
        );
        if (mult >= 8) {
          onTriggerBurst('heavy');
        } else {
          audioEngine.playWinFanfare('WIN');
          onTriggerBurst('light');
        }
      } else if (res.payout === effectiveBet) {
        setStatusText(`Tie ${res.playerTotal}–${res.bankerTotal} — Stake returned ($${res.payout.toFixed(2)}).`);
        audioEngine.playClick();
      } else {
        setStatusText(
          `${res.winner.toUpperCase()} wins ${res.playerTotal}–${res.bankerTotal}.${res.wasNearMiss ? ' Missed by a single point!' : ''}`
        );
        audioEngine.playBust();
      }

      onSettleRound({
        gameId: 'baccarat',
        bet: effectiveBet,
        payout: res.payout,
        wasNearMiss: res.wasNearMiss,
        celebrateTier: mult >= 11 ? 'SUPER' : mult >= 8 ? 'BIG' : undefined,
        celebrateLabel: 'SOVEREIGN BACCARAT',
      });
    }, 340);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Sovereign Baccarat</h2>
          <p className="text-xs text-slate-400">
            Official Punto Banco 3rd-Card Rules · Natural 8/9 · 8:1 Tie · 11:1 Dragon Pair
          </p>
        </div>

        {/* Live Bead Plate Road */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="mr-1 text-slate-400">Road:</span>
          {roadmap.slice(0, 12).map((w, idx) => (
            <span
              key={idx}
              className={`font-mono-num flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                w === 'banker'
                  ? 'bg-rose-700 text-white'
                  : w === 'player'
                  ? 'bg-sky-700 text-white'
                  : 'bg-emerald-700 text-white'
              }`}
            >
              {w === 'banker' ? 'B' : w === 'player' ? 'P' : 'T'}
            </span>
          ))}
        </div>
      </div>

      {/* Felt Baccarat Salon Table */}
      <div
        className="flex min-h-[380px] flex-col justify-between gap-6 rounded-xl border border-[#D4AF37]/30 bg-[#0D3B2A] p-6 shadow-[inset_0_0_70px_rgba(0,0,0,0.68)]"
        style={{
          backgroundImage: `linear-gradient(rgba(7,24,17,0.72), rgba(7,24,17,0.86)), url(${feltTextureUrl})`,
          backgroundSize: 'cover',
        }}
      >
        {/* Player vs Banker Hands */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div
            className={`flex flex-col items-center rounded-xl border p-4 transition-all ${
              lastHand?.winner === 'player'
                ? 'border-sky-400 bg-sky-950/35 shadow-[0_0_28px_rgba(56,189,248,0.28)]'
                : 'border-emerald-300/15 bg-black/20'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-sky-300">
              <span>PLAYER</span>
              {lastHand && (
                <span className="font-mono-num text-lg text-white">{lastHand.playerTotal}</span>
              )}
            </div>
            <div className="mt-4 flex min-h-[112px] items-center justify-center gap-2.5">
              {lastHand ? (
                lastHand.playerCards.map((c, idx) => <BaccaratCard key={c.id} card={c} index={idx} />)
              ) : (
                <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-dashed border-emerald-200/25 text-xs text-emerald-100/40">
                  Player
                </div>
              )}
            </div>
          </div>

          <div
            className={`flex flex-col items-center rounded-xl border p-4 transition-all ${
              lastHand?.winner === 'banker'
                ? 'border-rose-400 bg-rose-950/35 shadow-[0_0_28px_rgba(251,113,133,0.28)]'
                : 'border-emerald-300/15 bg-black/20'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-rose-300">
              <span>BANKER</span>
              {lastHand && (
                <span className="font-mono-num text-lg text-white">{lastHand.bankerTotal}</span>
              )}
            </div>
            <div className="mt-4 flex min-h-[112px] items-center justify-center gap-2.5">
              {lastHand ? (
                lastHand.bankerCards.map((c, idx) => <BaccaratCard key={c.id} card={c} index={idx} />)
              ) : (
                <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-dashed border-emerald-200/25 text-xs text-emerald-100/40">
                  Banker
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center text-sm font-semibold text-[#F9E7A8]">{statusText}</div>

        {/* Bet Selection Boxes */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BET_OPTIONS.map((opt) => {
            const active = selectedSide === opt.side;
            return (
              <button
                key={opt.side}
                type="button"
                disabled={dealing}
                onClick={() => {
                  audioEngine.playChipPlace();
                  setSelectedSide(opt.side);
                }}
                className={`flex flex-col items-center justify-center rounded-xl border-2 px-4 py-3.5 transition-all ${
                  active
                    ? `${opt.accent} scale-[1.02] shadow-lg`
                    : 'border-slate-700/70 bg-[#0A1D15]/85 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="font-mono-num mt-0.5 text-xs opacity-80">{opt.payoutLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={dealing}
        onChangeBet={setBet}
        actionLabel={dealing ? 'Dealing...' : `Deal on ${selectedSide.toUpperCase()}`}
        onAction={dealBaccarat}
        actionDisabled={dealing}
      />
    </div>
  );
};
