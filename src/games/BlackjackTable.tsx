import React, { useRef, useState } from 'react';
import type { GameCommonProps } from '../types/casino';
import {
  applyBlackjackHouseBias,
  createShuffledShoe,
  evaluateBlackjackHand,
  resolveBlackjackOutcome,
  type PlayingCard,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';
import feltTextureUrl from '../assets/images/felt_table_texture_1795386776893.jpg';

type BjPhase = 'IDLE' | 'PLAYER_TURN' | 'SETTLED';

function CardView({ card, hidden = false, index = 0 }: { card: PlayingCard; hidden?: boolean; index?: number }) {
  if (hidden) {
    return (
      <div
        style={{ animationDelay: `${index * 70}ms` }}
        className="animate-card-deal flex h-28 w-20 items-center justify-center rounded-lg border-2 border-[#D4AF37]/70 bg-[#16202C] shadow-lg"
      >
        <div className="h-20 w-12 rounded border border-[#D4AF37]/40 bg-[#0E151E]" />
      </div>
    );
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div
      style={{ animationDelay: `${index * 70}ms` }}
      className="animate-card-deal flex h-28 w-20 flex-col justify-between rounded-lg border border-slate-300 bg-[#FAF9F6] p-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
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

export const BlackjackTable: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(50);
  const [activeBet, setActiveBet] = useState(50);
  const [phase, setPhase] = useState<BjPhase>('IDLE');
  const [playerHand, setPlayerHand] = useState<PlayingCard[]>([]);
  const [dealerHand, setDealerHand] = useState<PlayingCard[]>([]);
  const [resultText, setResultText] = useState('Place your wager and deal cards on the emerald felt.');

  const shoeRef = useRef<PlayingCard[]>(createShuffledShoe(6));

  const drawCard = (): PlayingCard => {
    if (shoeRef.current.length < 24) {
      shoeRef.current = createShuffledShoe(6);
    }
    return shoeRef.current.pop()!;
  };

  const finishHand = (pCards: PlayingCard[], dCards: PlayingCard[], stake: number) => {
    const finalDealer = [...dCards];
    const playerTotal = evaluateBlackjackHand(pCards).total;
    while (evaluateBlackjackHand(finalDealer).total < 17) {
      const next = drawCard();
      const biasedCard = applyBlackjackHouseBias(finalDealer, next, playerTotal, modifiers);
      finalDealer.push(biasedCard);
    }

    setDealerHand(finalDealer);
    setPhase('SETTLED');

    const { outcome, payout } = resolveBlackjackOutcome(pCards, finalDealer, stake);
    const celebrateTier = outcome === 'BLACKJACK' ? 'BIG' : undefined;
    if (outcome === 'BLACKJACK') {
      setResultText(`Natural Blackjack 3:2! Paid $${payout.toFixed(2)}`);
      onTriggerBurst('heavy');
    } else if (outcome === 'WIN') {
      setResultText(`Dealer busts or beaten — Won $${payout.toFixed(2)}!`);
      audioEngine.playWinFanfare('WIN');
      onTriggerBurst('light');
    } else if (outcome === 'PUSH') {
      setResultText(`Push — $${payout.toFixed(2)} returned to bankroll.`);
      audioEngine.playClick();
    } else {
      setResultText(`Dealer wins (${evaluateBlackjackHand(finalDealer).total}).`);
      audioEngine.playBust();
    }

    onSettleRound({
      gameId: 'blackjack',
      bet: stake,
      payout,
      wasNearMiss: outcome === 'LOSE' && evaluateBlackjackHand(pCards).total === 20,
      celebrateTier,
      celebrateLabel: 'SALON BLACKJACK 21',
    });
  };

  const deal = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) return;

    audioEngine.playCardDeal();
    const p = [drawCard(), drawCard()];
    const d = [drawCard(), drawCard()];

    setActiveBet(effectiveBet);
    setPlayerHand(p);
    setDealerHand(d);

    const pEval = evaluateBlackjackHand(p);
    if (pEval.isBlackjack) {
      finishHand(p, d, effectiveBet);
    } else {
      setPhase('PLAYER_TURN');
      setResultText('Your turn — Hit, Stand, or Double Down.');
    }
  };

  const hit = () => {
    if (phase !== 'PLAYER_TURN') return;
    audioEngine.playCardDeal();
    const nextHand = [...playerHand, drawCard()];
    setPlayerHand(nextHand);
    const evalP = evaluateBlackjackHand(nextHand);
    if (evalP.isBust) {
      setPhase('SETTLED');
      audioEngine.playBust();
      setResultText(`Bust at ${evalP.total}. Lost $${activeBet.toFixed(2)}.`);
      onSettleRound({ gameId: 'blackjack', bet: activeBet, payout: 0 });
    } else if (evalP.total === 21) {
      finishHand(nextHand, dealerHand, activeBet);
    }
  };

  const stand = () => {
    if (phase !== 'PLAYER_TURN') return;
    finishHand(playerHand, dealerHand, activeBet);
  };

  const doubleDown = () => {
    if (phase !== 'PLAYER_TURN' || playerHand.length !== 2) return;
    if (balance < activeBet || !onWager(activeBet)) return;
    audioEngine.playCardDeal();
    const doubledStake = activeBet * 2;
    setActiveBet(doubledStake);
    const nextHand = [...playerHand, drawCard()];
    setPlayerHand(nextHand);
    if (evaluateBlackjackHand(nextHand).isBust) {
      setPhase('SETTLED');
      audioEngine.playBust();
      setResultText(`Doubled and busted at ${evaluateBlackjackHand(nextHand).total}.`);
      onSettleRound({ gameId: 'blackjack', bet: doubledStake, payout: 0 });
    } else {
      finishHand(nextHand, dealerHand, doubledStake);
    }
  };

  const pEval = evaluateBlackjackHand(playerHand);
  const dEval = evaluateBlackjackHand(dealerHand);
  const dealerVisibleEval =
    phase === 'PLAYER_TURN' && dealerHand.length > 0
      ? evaluateBlackjackHand([dealerHand[0]]).total
      : dEval.total;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Blackjack 21</h2>
          <p className="text-xs text-slate-400">6-Deck Shoe · Blackjack Pays 3:2 · Dealer Stands on All 17s</p>
        </div>
        <div className="font-mono-num text-xs text-slate-300">
          Active Stake: <strong className="text-[#ECCB63]">${phase === 'PLAYER_TURN' ? activeBet : bet}</strong>
        </div>
      </div>

      {/* Velvet Felt Table */}
      <div
        className="flex min-h-[380px] flex-col justify-between rounded-xl border border-[#D4AF37]/30 bg-[#0D3B2A] p-6 shadow-[inset_0_0_60px_rgba(0,0,0,0.65)]"
        style={{
          backgroundImage: `linear-gradient(rgba(8,26,18,0.68), rgba(8,26,18,0.82)), url(${feltTextureUrl})`,
          backgroundSize: 'cover',
        }}
      >
        {/* Dealer Zone */}
        <div className="flex flex-col items-center">
          <div className="text-xs font-semibold tracking-wider text-emerald-200/80">
            Dealer Hand {dealerHand.length > 0 ? `· ${dealerVisibleEval}` : ''}
          </div>
          <div className="mt-3 flex min-h-[112px] items-center justify-center gap-3">
            {dealerHand.length === 0 ? (
              <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-dashed border-emerald-300/25 text-xs text-emerald-200/40">
                Dealer
              </div>
            ) : (
              dealerHand.map((card, i) => (
                <CardView key={`${card.id}-${i}`} card={card} index={i} hidden={phase === 'PLAYER_TURN' && i === 1} />
              ))
            )}
          </div>
        </div>

        {/* Center Status Banner */}
        <div className="my-4 text-center">
          <p className="text-sm font-medium text-[#F9E7A8]">{resultText}</p>
        </div>

        {/* Player Zone */}
        <div className="flex flex-col items-center">
          <div className="flex min-h-[112px] items-center justify-center gap-3">
            {playerHand.length === 0 ? (
              <div className="flex h-28 w-20 items-center justify-center rounded-lg border border-dashed border-emerald-300/25 text-xs text-emerald-200/40">
                Player
              </div>
            ) : (
              playerHand.map((card, i) => <CardView key={`${card.id}-${i}`} card={card} index={i} />)
            )}
          </div>
          <div className="mt-3 text-xs font-semibold tracking-wider text-emerald-100">
            Your Hand {playerHand.length > 0 ? `· ${pEval.total}${pEval.soft ? ' (Soft)' : ''}` : ''}
          </div>

          {phase === 'PLAYER_TURN' && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={hit}
                className="min-w-[104px] rounded-lg bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-[#090C10] hover:bg-[#ECCB63]"
              >
                Hit
              </button>
              <button
                type="button"
                onClick={stand}
                className="min-w-[104px] rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#071510] hover:bg-emerald-400"
              >
                Stand
              </button>
              <button
                type="button"
                disabled={playerHand.length !== 2 || balance < activeBet}
                onClick={doubleDown}
                className="min-w-[120px] rounded-lg border border-[#D4AF37]/60 bg-[#0B1713] px-5 py-2.5 text-sm font-semibold text-[#F9E7A8] hover:bg-[#132922] disabled:opacity-40"
              >
                Double Down
              </button>
            </div>
          )}
        </div>
      </div>

      <WagerBar
        bet={bet}
        balance={balance}
        disabled={phase === 'PLAYER_TURN'}
        onChangeBet={setBet}
        actionLabel={phase === 'PLAYER_TURN' ? 'Hand In Progress' : 'Deal Hand'}
        onAction={deal}
        actionDisabled={phase === 'PLAYER_TURN'}
      />
    </div>
  );
};
