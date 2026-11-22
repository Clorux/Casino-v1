import React from 'react';
import { audioEngine } from '../engine/audioEngine';

interface WagerBarProps {
  bet: number;
  balance: number;
  disabled?: boolean;
  onChangeBet: (next: number) => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: 'emerald' | 'neutral';
  };
}

const QUICK_CHIPS = [10, 25, 50, 100, 250];

export const WagerBar: React.FC<WagerBarProps> = ({
  bet,
  balance,
  disabled = false,
  onChangeBet,
  actionLabel,
  onAction,
  actionDisabled = false,
  secondaryAction,
}) => {
  const clampBet = (val: number) => {
    const maxAllowed = Math.max(1, Math.floor(balance));
    return Math.min(maxAllowed, Math.max(1, Math.round(val)));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#11161D] px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <label htmlFor="wager-input" className="text-[11px] font-medium text-slate-400">
            Wager Amount
          </label>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3 font-mono-num text-sm text-[#D4AF37]">
                $
              </span>
              <input
                id="wager-input"
                type="number"
                min={1}
                max={Math.max(1, Math.floor(balance))}
                step={1}
                disabled={disabled}
                value={bet}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) onChangeBet(clampBet(v));
                }}
                className="font-mono-num w-28 rounded-lg border border-slate-700/80 bg-[#0B0F14] py-2 pl-7 pr-2.5 text-sm font-semibold text-white outline-none focus:border-[#D4AF37] disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                audioEngine.playClick();
                onChangeBet(clampBet(bet / 2));
              }}
              className="rounded-lg border border-slate-700/80 bg-[#171E28] px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              1/2
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                audioEngine.playClick();
                onChangeBet(clampBet(bet * 2));
              }}
              className="rounded-lg border border-slate-700/80 bg-[#171E28] px-2.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              2x
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                audioEngine.playClick();
                onChangeBet(clampBet(balance));
              }}
              className="rounded-lg border border-slate-700/80 bg-[#171E28] px-2.5 py-2 text-xs font-medium text-[#ECCB63] transition-colors hover:border-[#D4AF37]/60 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Max
            </button>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 sm:flex sm:pt-4">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={disabled || balance < chip}
              onClick={() => {
                audioEngine.playChipPlace();
                onChangeBet(chip);
              }}
              className={`font-mono-num rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                bet === chip
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                  : 'border-slate-800 bg-[#0D1218] text-slate-300 hover:border-slate-600 hover:text-white'
              } disabled:opacity-35`}
            >
              ${chip}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {secondaryAction && (
          <button
            type="button"
            disabled={secondaryAction.disabled}
            onClick={secondaryAction.onClick}
            className={`min-h-[42px] rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:cursor-not-allowed disabled:opacity-40 ${
              secondaryAction.tone === 'emerald'
                ? 'bg-emerald-500 text-[#071510] hover:bg-emerald-400'
                : 'border border-slate-700 bg-[#171E28] text-slate-100 hover:border-slate-500'
            }`}
          >
            {secondaryAction.label}
          </button>
        )}

        <button
          type="button"
          disabled={actionDisabled || balance < 1}
          onClick={onAction}
          className="min-h-[44px] min-w-[144px] rounded-lg bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-[#090C10] shadow-[0_6px_20px_rgba(212,175,55,0.28)] transition-all hover:bg-[#ECCB63] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};
