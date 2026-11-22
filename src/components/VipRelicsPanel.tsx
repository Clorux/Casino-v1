import React, { useState } from 'react';
import { Check, Crown, Lock } from 'lucide-react';
import {
  VAULT_RELICS,
  VIP_FLOORS,
  type RoguelikeState,
} from '../engine/roguelikeLoop';
import { audioEngine } from '../engine/audioEngine';

interface VipRelicsPanelProps {
  balance: number;
  roguelike: RoguelikeState;
  onBuyRelic: (relicId: string, cost: number) => void;
}

export const VipRelicsPanel: React.FC<VipRelicsPanelProps> = ({
  balance,
  roguelike,
  onBuyRelic,
}) => {
  const [imgError, setImgError] = useState(false);
  const currentFloor = VIP_FLOORS[Math.min(roguelike.floorIndex, VIP_FLOORS.length - 1)];
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((balance / Math.max(1, roguelike.targetBalance)) * 100))
  );

  return (
    <div className="flex flex-col gap-5">
      {/* VIP Floor Challenge Banner */}
      <section className="grid grid-cols-1 gap-6 rounded-xl border border-[#D4AF37]/35 bg-[#11161D] p-6 lg:grid-cols-[160px_1fr]">
        <div className="flex items-center justify-center">
          {!imgError ? (
            <img
              src="/src/assets/images/vault_crest_emblem_1795386777662.jpg"
              alt="Velvet Vault VIP medallion"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-36 w-36 rounded-xl border border-[#D4AF37]/40 object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#090C10]">
              <Crown className="h-12 w-12 text-[#D4AF37]" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#ECCB63]">
              FLOOR {currentFloor.floor} OF {VIP_FLOORS.length} · HIGH-ROLLER STAKES LOOP
            </div>
            <h2 className="font-display mt-1 text-3xl font-bold text-[#F9E7A8]">
              {currentFloor.roomName}
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              Reach your room quota within {currentFloor.roundsLimit} rounds across any game to unlock
              the next high-roller salon and claim a{' '}
              <strong className="text-emerald-400">
                +{Math.round(currentFloor.clearBonusRate * 100)}% VIP comp bonus
              </strong>
              .
            </p>
          </div>

          <div className="mt-5">
            <div className="flex justify-between font-mono-num text-xs">
              <span className="text-slate-300">
                Bankroll: ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} / Quota $
                {roguelike.targetBalance.toLocaleString()}
              </span>
              <span className="text-[#ECCB63]">
                Round {roguelike.roundsInFloor} / {currentFloor.roundsLimit}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-md bg-[#090C10]">
              <div
                className="h-full rounded-md bg-[#D4AF37] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Permanent Vault Relics */}
      <section className="rounded-xl border border-slate-800 bg-[#11161D] p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Permanent Vault Relics</h3>
            <p className="text-xs text-slate-400">
              Invest virtual winnings into lasting probability and cashback modifiers saved offline
            </p>
          </div>
          <span className="font-mono-num text-xs text-slate-300">
            Unlocked: {roguelike.unlockedRelics.length} / {VAULT_RELICS.length}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {VAULT_RELICS.map((relic) => {
            const owned = roguelike.unlockedRelics.includes(relic.id);
            const canAfford = balance >= relic.cost;
            return (
              <div
                key={relic.id}
                className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
                  owned
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-slate-800 bg-[#0B0F15]'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-slate-100">{relic.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{relic.effectText}</p>
                </div>

                {owned ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 whitespace-nowrap">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Active</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      audioEngine.playWinFanfare('BIG');
                      onBuyRelic(relic.id, relic.cost);
                    }}
                    className="font-mono-num flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 whitespace-nowrap"
                  >
                    {!canAfford && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span>Buy ${relic.cost}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Floor Ladder Overview */}
      <section className="rounded-xl border border-slate-800 bg-[#11161D] p-5">
        <h3 className="text-sm font-semibold text-slate-100">Salon Progression Ladder</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {VIP_FLOORS.map((f, idx) => {
            const cleared = idx < roguelike.floorIndex;
            const active = idx === roguelike.floorIndex;
            return (
              <div
                key={f.floor}
                className={`rounded-lg border p-3 ${
                  active
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                    : cleared
                    ? 'border-emerald-600/40 bg-emerald-950/20'
                    : 'border-slate-800 bg-[#090C10] opacity-65'
                }`}
              >
                <div className="font-mono-num text-[11px] text-slate-400">Floor {f.floor}</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-100">{f.roomName}</div>
                <div className="font-mono-num mt-1.5 text-[11px] text-[#ECCB63]">
                  {f.quotaMultiplier}x · {f.roundsLimit}r
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
