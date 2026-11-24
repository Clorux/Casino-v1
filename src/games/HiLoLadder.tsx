import React, { useState } from 'react';
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  createShuffledShoe,
  drawHiLoCard,
  getHiLoOdds,
  type PlayingCard,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

function LargeHiLoCard({ card }: { card: PlayingCard }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div
      className="animate-card-deal flex h-44 w-32 flex-col justify-between rounded-xl border-2 border-[#D4AF37]/80 bg-[#FAF9F6] p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
    >
      <div className={`font-mono-num text-2xl font-bold leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.rank}
        <span className="ml-1 text-lg">{card.suit}</span>
      </div>
      <div className={`self-center text-5xl leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.suit}
      </div>
      <div className={`rotate-180 font-mono-num text-2xl font-bold leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
        {card.rank}
        <span className="ml-1 text-lg">{card.suit}</span>
      </div>
    </div>
  );
}

export const HiLoLadder: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [activeBet, setActiveBet] = useState(25);
  const [active, setActive] = useState(false);
  const [currentCard, setCurrentCard] = useState<PlayingCard>(() => createShuffledShoe(1)[0]);
  const [trail, setTrail] = useState<PlayingCard[]>([]);
  const [multiplier, setMultiplier] = useState(1.0);
  const [streak, setStreak] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(2);
  const [status, setStatus] = useState('Start a ladder run, predict Higher or Lower, and cash out at any multiplier.');

  const odds = getHiLoOdds(currentCard.rank);
  const currentPayout = Number((activeBet * multiplier).toFixed(2));

  const startRun = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    audioEngine.playCardDeal();
    const anchor = createShuffledShoe(1)[0];
    setCurrentCard(anchor);
    setTrail([anchor]);
    setActiveBet(effectiveBet);
    setMultiplier(1.0);
    setStreak(0);
    setSkipsLeft(2);
    setActive(true);
    setStatus(`Anchor card is ${anchor.rank}${anchor.suit}. Call Higher or Lower!`);
  };

  const makeGuess = (guess: 'higher' | 'lower') => {
    if (!active) return;
    const res = drawHiLoCard(currentCard, guess, modifiers);
    setCurrentCard(res.nextCard);
    setTrail((prev) => [...prev.slice(-6), res.nextCard]);

    if (!res.won) {
      setActive(false);
      audioEngine.playBust();
      setStatus(
        `Drew ${res.nextCard.rank}${res.nextCard.suit} — Ladder broke after ${streak} ${
          streak === 1 ? 'hit' : 'hits'
        }.${res.wasNearMiss ? ' Off by just 1 rank!' : ''}`
      );
      onSettleRound({
        gameId: 'hilo',
        bet: activeBet,
        payout: 0,
        wasNearMiss: res.wasNearMiss || streak >= 2,
      });
      return;
    }

    const nextStreak = streak + 1;
    const nextMult = Number((multiplier * res.stepMultiplier).toFixed(2));
    setStreak(nextStreak);
    setMultiplier(nextMult);
    audioEngine.playComboChime(nextStreak);
    if (nextMult >= 3) onTriggerBurst(nextMult >= 10 ? 'heavy' : 'light');
    setStatus(
      `Correct! ${res.nextCard.rank}${res.nextCard.suit} climbs ladder to ${nextMult.toFixed(2)}x ($${(
        activeBet * nextMult
      ).toFixed(2)})`
    );
  };

  const skipCard = () => {
    if (!active || skipsLeft <= 0) return;
    audioEngine.playCardDeal();
    const fresh = createShuffledShoe(1)[0];
    setCurrentCard(fresh);
    setSkipsLeft((s) => s - 1);
    setStatus(`Skipped to ${fresh.rank}${fresh.suit}. ${skipsLeft - 1} skips remaining.`);
  };

  const cashOut = () => {
    if (!active || streak === 0) return;
    setActive(false);
    const payout = currentPayout;
    const celebrateTier =
      multiplier >= 30
        ? 'JACKPOT'
        : multiplier >= 14
        ? 'MEGA'
        : multiplier >= 6
        ? 'SUPER'
        : multiplier >= 3
        ? 'BIG'
        : undefined;
    if (!celebrateTier) {
      audioEngine.playWinFanfare('WIN');
    }
    if (multiplier >= 3) onTriggerBurst(multiplier >= 8 ? 'heavy' : 'light');
    setStatus(`Cashed out $${payout.toFixed(2)} at ${multiplier.toFixed(2)}x after ${streak} streak!`);
    onSettleRound({
      gameId: 'hilo',
      bet: activeBet,
      payout,
      celebrateTier,
      celebrateLabel: 'CRIMSON HI-LO LADDER',
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Crimson Hi-Lo Ladder</h2>
          <p className="text-xs text-slate-400">
            Compound multipliers on every consecutive card call · 2 Free Card Skips per run
          </p>
        </div>

        <div className="flex items-center gap-4 font-mono-num text-xs">
          <span className="text-slate-400">
            Streak: <strong className="text-emerald-400">{streak}</strong>
          </span>
          <span className="text-slate-400">
            Multiplier: <strong className="text-[#ECCB63]">{multiplier.toFixed(2)}x</strong>
          </span>
        </div>
      </div>

      {/* Main Hi-Lo Stage */}
      <div
        className={`flex flex-col items-center justify-between gap-6 rounded-xl border p-6 transition-all duration-300 ${
          streak >= 4
            ? 'border-[#ECCB63] bg-[#1C140A] shadow-[inset_0_0_70px_rgba(236,203,99,0.16)]'
            : streak >= 2
            ? 'border-emerald-500/50 bg-[#0B1713]'
            : 'border-slate-800 bg-[#0A0E14]'
        }`}
      >
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
          {/* Lower Button */}
          <button
            type="button"
            disabled={!active}
            onClick={() => makeGuess('lower')}
            className="flex min-w-[170px] flex-col items-center rounded-xl border-2 border-rose-500/60 bg-rose-950/50 px-6 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-rose-400 hover:bg-rose-900/55 disabled:opacity-40"
          >
            <ArrowDown className="h-6 w-6 text-rose-400" aria-hidden="true" />
            <span className="mt-1 text-sm font-bold text-white">
              {currentCard.rank === 'A' ? 'Same Ace' : 'Lower or Equal'}
            </span>
            <span className="font-mono-num mt-1 text-xs text-rose-200">
              {odds.lowerMult.toFixed(2)}x · {odds.lowerChance}%
            </span>
          </button>

          {/* Center Anchor Card */}
          <div className="flex flex-col items-center">
            <LargeHiLoCard key={currentCard.id} card={currentCard} />
            <button
              type="button"
              disabled={!active || skipsLeft <= 0}
              onClick={skipCard}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121821] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-[#D4AF37] hover:text-white disabled:opacity-35"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Skip Card ({skipsLeft})</span>
            </button>
          </div>

          {/* Higher Button */}
          <button
            type="button"
            disabled={!active}
            onClick={() => makeGuess('higher')}
            className="flex min-w-[170px] flex-col items-center rounded-xl border-2 border-emerald-500/60 bg-emerald-950/50 px-6 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-900/55 disabled:opacity-40"
          >
            <ArrowUp className="h-6 w-6 text-emerald-400" aria-hidden="true" />
            <span className="mt-1 text-sm font-bold text-white">
              {currentCard.rank === 'K' ? 'Same King' : 'Higher or Equal'}
            </span>
            <span className="font-mono-num mt-1 text-xs text-emerald-200">
              {odds.higherMult.toFixed(2)}x · {odds.higherChance}%
            </span>
          </button>
        </div>

        {/* Trail of drawn cards */}
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800/80 pt-4 text-xs">
          <span className="text-slate-400">Card Trail:</span>
          {trail.map((c, idx) => {
            const isRed = c.suit === '♥' || c.suit === '♦';
            return (
              <span
                key={`${c.id}-${idx}`}
                className={`font-mono-num rounded border border-slate-700 bg-[#FAF9F6] px-2 py-0.5 font-bold ${
                  isRed ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {c.rank}
                {c.suit}
              </span>
            );
          })}
        </div>

        <p className="text-center text-xs font-medium text-slate-300">{status}</p>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={active}
        onChangeBet={setBet}
        actionLabel={active ? 'Ladder Active' : 'Start Hi-Lo Run'}
        onAction={startRun}
        actionDisabled={active}
        secondaryAction={
          active
            ? {
                label: `Cash Out $${currentPayout.toFixed(2)}`,
                onClick: cashOut,
                disabled: streak === 0,
                tone: 'emerald',
              }
            : undefined
        }
      />
    </div>
  );
};
