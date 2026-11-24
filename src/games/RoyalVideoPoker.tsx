import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Sparkles, Unlock } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  POKER_PAYTABLE,
  createShuffledShoe,
  evaluatePokerHand,
  resolvePokerDraw,
  type PlayingCard,
  type PokerEvaluation,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';
import feltTextureUrl from '../assets/images/felt_table_texture_1795386776893.jpg';

type PokerPhase = 'IDLE' | 'HOLDING' | 'SETTLED';

function PokerCardTile({
  card,
  held,
  canToggle,
  index,
  onToggle,
}: {
  card: PlayingCard;
  held: boolean;
  canToggle: boolean;
  index: number;
  onToggle: () => void;
}) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <button
      type="button"
      disabled={!canToggle}
      onClick={onToggle}
      className={`group relative flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ECCB63] rounded-xl transition-transform ${
        held ? 'animate-card-hold-pop' : ''
      } ${canToggle ? 'cursor-pointer' : 'cursor-default'}`}
      aria-pressed={held}
      aria-label={`Card ${index + 1}: ${card.rank}${card.suit}${held ? ' (Held)' : ''}`}
    >
      <div
        className={`mb-1.5 flex h-5 items-center gap-1 text-[10px] font-bold tracking-widest uppercase transition-opacity ${
          held ? 'text-[#ECCB63] opacity-100' : 'text-slate-500 opacity-50 group-hover:opacity-90'
        }`}
      >
        {held ? (
          <>
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>HELD</span>
          </>
        ) : (
          <span>{canToggle ? `KEY ${index + 1}` : '·'}</span>
        )}
      </div>

      <div
        style={{ animationDelay: `${index * 45}ms` }}
        className={`animate-card-deal flex h-34 w-24 sm:h-40 sm:w-28 flex-col justify-between rounded-xl border-2 bg-[#FAF9F6] p-3 shadow-[0_14px_30px_rgba(0,0,0,0.55)] transition-colors ${
          held
            ? 'border-[#ECCB63] ring-2 ring-[#ECCB63]/40'
            : 'border-slate-300 group-hover:border-[#D4AF37]/70'
        }`}
      >
        <div
          className={`font-mono-num text-left text-lg sm:text-xl font-bold leading-none ${
            isRed ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {card.rank}
          <span className="ml-0.5 text-sm">{card.suit}</span>
        </div>
        <div
          className={`self-center text-4xl sm:text-5xl leading-none ${
            isRed ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {card.suit}
        </div>
        <div
          className={`rotate-180 font-mono-num text-left text-lg sm:text-xl font-bold leading-none ${
            isRed ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {card.rank}
          <span className="ml-0.5 text-sm">{card.suit}</span>
        </div>
      </div>
    </button>
  );
}

export const RoyalVideoPoker: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  directorState,
  houseMind,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [activeBet, setActiveBet] = useState(25);
  const [phase, setPhase] = useState<PokerPhase>('IDLE');
  const [hand, setHand] = useState<PlayingCard[]>([]);
  const [deck, setDeck] = useState<PlayingCard[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [evaluation, setEvaluation] = useState<PokerEvaluation | null>(null);
  const [status, setStatus] = useState(
    'Deal 5 cards, click or press keys 1–5 to HOLD keepers, then draw for Jacks or Better up to 800x.'
  );

  const toggleHold = useCallback(
    (idx: number) => {
      if (phase !== 'HOLDING') return;
      setHeld((prev) => {
        const next = [...prev];
        next[idx] = !next[idx];
        audioEngine.playPokerHold(next[idx]);
        return next;
      });
    },
    [phase]
  );

  const autoSuggestHolds = (cards: PlayingCard[]): boolean[] => {
    const rankCounts = new Map<string, number[]>();
    const suitCounts = new Map<string, number[]>();
    cards.forEach((c, idx) => {
      rankCounts.set(c.rank, [...(rankCounts.get(c.rank) ?? []), idx]);
      suitCounts.set(c.suit, [...(suitCounts.get(c.suit) ?? []), idx]);
    });
    const evalNow = evaluatePokerHand(cards);
    if (evalNow.multiplier >= 4) return [true, true, true, true, true];
    const mask = [false, false, false, false, false];
    let pickedAny = false;
    // Hold pairs / trips / quads
    for (const idxs of rankCounts.values()) {
      if (idxs.length >= 2) {
        idxs.forEach((i) => {
          mask[i] = true;
          pickedAny = true;
        });
      }
    }
    if (pickedAny) return mask;
    // Hold 4-to-a-flush
    for (const idxs of suitCounts.values()) {
      if (idxs.length === 4) {
        idxs.forEach((i) => {
          mask[i] = true;
        });
        return mask;
      }
    }
    // Hold high cards (J, Q, K, A)
    cards.forEach((c, idx) => {
      if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K' || c.rank === 'A') {
        mask[idx] = true;
      }
    });
    return mask;
  };

  const dealNewHand = useCallback(() => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    audioEngine.playCardDeal();
    const freshShoe = createShuffledShoe(1);
    const dealt = freshShoe.slice(0, 5);
    const rest = freshShoe.slice(5);
    const initialEval = evaluatePokerHand(dealt);

    setActiveBet(effectiveBet);
    setHand(dealt);
    setDeck(rest);
    setHeld([false, false, false, false, false]);
    setEvaluation(initialEval.multiplier > 0 ? initialEval : null);
    setPhase('HOLDING');
    setStatus(
      initialEval.multiplier > 0
        ? `Dealt ${initialEval.label}! Lock your winning cards (keys 1–5) and press Draw.`
        : 'Select cards to HOLD (click or keys 1–5), or tap Smart Hold, then press Draw.'
    );
  }, [balance, bet, onWager]);

  const drawCards = useCallback(() => {
    if (phase !== 'HOLDING') return;
    audioEngine.playCardDeal();

    const { finalHand, evaluation: finalEval, payout } = resolvePokerDraw(
      hand,
      held,
      deck,
      activeBet,
      modifiers
    );

    setHand(finalHand);
    setEvaluation(finalEval);
    setPhase('SETTLED');

    const celebrateTier =
      finalEval.multiplier >= 50
        ? 'JACKPOT'
        : finalEval.multiplier >= 25
        ? 'MEGA'
        : finalEval.multiplier >= 6
        ? 'SUPER'
        : finalEval.multiplier >= 3
        ? 'BIG'
        : undefined;

    if (payout > 0) {
      if (finalEval.multiplier >= 6) {
        audioEngine.playRoyalHandFanfare(finalEval.multiplier >= 25);
        onTriggerBurst('heavy');
      } else {
        audioEngine.playWinFanfare('WIN');
        if (finalEval.multiplier >= 2) onTriggerBurst('light');
      }
      setStatus(
        `${finalEval.label} (${finalEval.multiplier}x) — Paid $${payout.toFixed(2)}!`
      );
    } else {
      if (finalEval.isNearMiss) {
        audioEngine.playNearMissSting();
      } else {
        audioEngine.playBust();
      }
      setStatus(
        finalEval.isNearMiss
          ? `${finalEval.label} — one card shy of a payout.`
          : 'No qualifying hand. Deal again.'
      );
    }

    onSettleRound({
      gameId: 'poker',
      bet: activeBet,
      payout,
      wasNearMiss: finalEval.isNearMiss,
      celebrateTier,
      celebrateLabel: 'ROYAL VIDEO POKER',
    });
  }, [activeBet, deck, hand, held, modifiers, onSettleRound, onTriggerBurst, phase]);

  // Keyboard shortcuts: 1-5 toggle HOLD during HOLDING phase
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (phase === 'HOLDING' && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        toggleHold(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, toggleHold]);

  const isRealistic = directorState.mode === 'realistic_house';

  return (
    <div data-testid="royal-poker-stage" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Royal Video Poker</h2>
          <p className="text-xs text-slate-400">
            9/6 Jacks or Better · 5-Card Draw · Royal Flush 800x · Keys 1–5 to Hold
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono-num text-xs">
          <span className="text-slate-400">
            House Edge Shift:{' '}
            <strong className={modifiers.winBias < 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {modifiers.winBias >= 0 ? '+' : ''}
              {(modifiers.winBias * 100).toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>

      {/* Main Emerald Felt Poker Cabinet */}
      <div
        className={`flex flex-col gap-5 rounded-xl border p-5 sm:p-6 shadow-[inset_0_0_70px_rgba(0,0,0,0.72)] ${
          isRealistic && houseMind.phase === 'PREDATOR_HARVEST'
            ? 'border-rose-500/55 animate-predator-pulse'
            : 'border-[#D4AF37]/30'
        }`}
        style={{
          backgroundImage: `linear-gradient(rgba(7,22,16,0.76), rgba(7,18,14,0.88)), url(${feltTextureUrl})`,
          backgroundSize: 'cover',
        }}
      >
        {/* Paytable Strip */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-[#D4AF37]/25 bg-[#090C10]/85 p-2.5 text-xs sm:grid-cols-3 lg:grid-cols-9">
          {POKER_PAYTABLE.map((row) => {
            const isActiveTier = evaluation?.tier === row.tier && evaluation.multiplier > 0;
            return (
              <div
                key={row.tier}
                className={`flex flex-col items-center justify-center rounded-md px-2 py-1.5 text-center transition-colors ${
                  isActiveTier
                    ? 'bg-[#D4AF37] text-[#090C10] font-bold shadow-[0_0_18px_rgba(236,203,99,0.5)]'
                    : 'bg-[#11161D]/90 text-slate-300'
                }`}
              >
                <span className="text-[10px] leading-tight whitespace-nowrap truncate max-w-full">
                  {row.label}
                </span>
                <span
                  className={`font-mono-num mt-0.5 text-xs font-bold ${
                    isActiveTier ? 'text-[#090C10]' : 'text-[#ECCB63]'
                  }`}
                >
                  {row.multiplier}x
                </span>
              </div>
            );
          })}
        </div>

        {/* 5-Card Hand Stage */}
        <div className="flex min-h-[210px] flex-wrap items-center justify-center gap-3 sm:gap-4 py-2">
          {hand.length === 0 ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="flex h-34 w-24 sm:h-40 sm:w-28 items-center justify-center rounded-xl border-2 border-dashed border-[#D4AF37]/30 bg-[#0B1712]/70 text-xs font-semibold text-emerald-200/45"
              >
                Card {idx + 1}
              </div>
            ))
          ) : (
            hand.map((card, idx) => (
              <PokerCardTile
                key={`${card.id}-${idx}`}
                card={card}
                held={held[idx]}
                canToggle={phase === 'HOLDING'}
                index={idx}
                onToggle={() => toggleHold(idx)}
              />
            ))
          )}
        </div>

        {/* Holding Helper Controls + Outcome Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-200/15 pt-3 text-xs">
          <p className="font-medium text-[#F9E7A8]">{status}</p>

          {phase === 'HOLDING' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const suggested = autoSuggestHolds(hand);
                  setHeld(suggested);
                  audioEngine.playPokerHold(true);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/50 bg-[#1B170A] px-3 py-1.5 font-semibold text-[#F9E7A8] hover:bg-[#2A220F] whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Smart Hold</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setHeld([false, false, false, false, false]);
                  audioEngine.playPokerHold(false);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D131A] px-3 py-1.5 font-medium text-slate-300 hover:text-white whitespace-nowrap"
              >
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear Holds</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={phase === 'HOLDING'}
        onChangeBet={setBet}
        actionLabel={phase === 'HOLDING' ? 'Draw Cards' : 'Deal 5 Cards'}
        onAction={phase === 'HOLDING' ? drawCards : dealNewHand}
        actionDisabled={false}
      />
    </div>
  );
};
