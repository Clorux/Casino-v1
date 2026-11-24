import React, { useEffect, useState } from 'react';
import type { DirectorMode } from '../engine/mlDirector';
import salonBackdropUrl from '../assets/images/casino_salon_backdrop_1795386777842.jpg';

interface TitleBuyInScreenProps {
  savedBalance: number | null;
  onStartSession: (buyIn: number, mode: DirectorMode, resumeSaved: boolean) => void;
}

const PRESET_BUYINS = [250, 1000, 5000, 25000];

const DIRECTOR_MODES: Array<{ id: DirectorMode; label: string; note: string; featured?: boolean }> = [
  {
    id: 'realistic_house',
    label: 'Realistic House (Battle)',
    note: 'Adversarial House Mind with $50k vault · reads your timing & toggles · tries to grind you to $0',
    featured: true,
  },
  { id: 'adaptive_ml', label: 'Adaptive ML', note: 'Contextual bandit + dual behavioral AI' },
  { id: 'dopamine_max', label: 'Dopamine Max', note: 'High anticipation teases, cascades & fever bursts' },
  { id: 'balanced', label: 'Balanced', note: 'Gentle bad-luck protection with classic feel' },
  { id: 'off', label: 'Strict RNG', note: 'Pure unregulated house math with zero nudges' },
];

export const TitleBuyInScreen: React.FC<TitleBuyInScreenProps> = ({
  savedBalance,
  onStartSession,
}) => {
  const [buyInInput, setBuyInInput] = useState<string>('1000');
  const [selectedMode, setSelectedMode] = useState<DirectorMode>('realistic_house');
  const [imgError, setImgError] = useState(false);

  const parsedBuyIn = Math.max(10, Math.min(1000000, Number(buyInInput) || 1000));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          onStartSession(parsedBuyIn, selectedMode, false);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStartSession(parsedBuyIn, selectedMode, false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStartSession, parsedBuyIn, selectedMode]);

  return (
    <div className="relative flex min-h-screen w-full items-center overflow-hidden bg-[#090C10]">
      {/* Illustrated Monte Carlo Salon Key-Art Backdrop */}
      {!imgError && (
        <img
          src={salonBackdropUrl}
          alt="Private Monte Carlo casino salon interior"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-85"
        />
      )}
      {/* Measured contrast scrim preserving right-side salon scene while anchoring left negative space */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(9,12,16,0.97) 0%, rgba(9,12,16,0.92) 44%, rgba(9,12,16,0.52) 72%, rgba(9,12,16,0.35) 100%)',
        }}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-between px-6 py-10 sm:px-12 lg:py-14">
        <div className="max-w-lg">
          {/* Custom inline SVG Crest Lockup */}
          <div className="flex items-center gap-4">
            <svg
              width="54"
              height="54"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="32" cy="32" r="29" stroke="#D4AF37" strokeWidth="2.2" fill="#0E131A" />
              <circle cx="32" cy="32" r="22" stroke="#8C7020" strokeWidth="1.2" strokeDasharray="4 3" />
              <path
                d="M20 22L32 45L44 22"
                stroke="#ECCB63"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M26 22L32 34L38 22"
                stroke="#D4AF37"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="32" cy="14" r="2.2" fill="#ECCB63" />
            </svg>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-wide text-[#F9E7A8] sm:text-5xl">
                Velvet Vault
              </h1>
              <p className="mt-0.5 text-sm text-slate-300">
                Offline Monte Carlo Floor · 16 Games · Dual Behavioral AI
              </p>
            </div>
          </div>

          <p className="mt-6 text-base leading-relaxed text-slate-300">
            Set your virtual bankroll and step directly onto the private floor. Runs 100% locally in
            your browser, PowerShell, Terminal, or Android Termux with zero internet required.
          </p>

          {/* Buy-In Controls */}
          <section
            aria-label="Starting bankroll setup"
            className="mt-8 rounded-xl border border-slate-800/90 bg-[#11161D]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-baseline justify-between">
              <label htmlFor="buyin-balance" className="text-sm font-semibold text-slate-100">
                Starting Bankroll
              </label>
              <span className="text-xs text-slate-400">Saved locally offline</span>
            </div>

            <div className="relative mt-2.5 flex items-center">
              <span className="pointer-events-none absolute left-4 font-mono-num text-xl font-bold text-[#D4AF37]">
                $
              </span>
              <input
                id="buyin-balance"
                type="number"
                min={10}
                max={1000000}
                step={50}
                value={buyInInput}
                onChange={(e) => setBuyInInput(e.target.value)}
                className="font-mono-num w-full rounded-lg border border-slate-700 bg-[#090C10] py-3.5 pl-10 pr-4 text-2xl font-bold text-white outline-none transition-colors focus:border-[#D4AF37]"
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {PRESET_BUYINS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBuyInInput(String(amt))}
                  className={`font-mono-num rounded-lg border py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    parsedBuyIn === amt
                      ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                      : 'border-slate-800 bg-[#0D1218] text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>

            {/* ML Director Profile */}
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-100">Probability Director</div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {DIRECTOR_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMode(m.id)}
                    className={`${m.featured ? 'col-span-2' : ''} rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                      selectedMode === m.id
                        ? m.featured
                          ? 'border-rose-400/90 bg-rose-950/35 text-[#FEF08A]'
                          : 'border-[#D4AF37] bg-[#D4AF37]/12 text-[#F9E7A8]'
                        : 'border-slate-800 bg-[#0D1218] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span>{m.label}</span>
                      {m.featured && (
                        <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-rose-300">
                          House vs You
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{m.note}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStartSession(parsedBuyIn, selectedMode, false);
                }}
                className="flex-1 rounded-lg bg-[#D4AF37] px-6 py-3.5 text-sm font-bold text-[#090C10] shadow-[0_8px_28px_rgba(212,175,55,0.3)] transition-all hover:bg-[#ECCB63] active:scale-[0.99] whitespace-nowrap"
              >
                Enter Casino Floor
              </button>

              {savedBalance !== null && savedBalance > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onStartSession(savedBalance, selectedMode, true);
                  }}
                  className="rounded-lg border border-slate-700 bg-[#171E28] px-5 py-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-[#D4AF37]/60 whitespace-nowrap"
                >
                  Resume ${savedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </button>
              )}
            </div>
          </section>

          <p className="mt-6 text-xs text-slate-400">
            Enter / Space Start · 14 Offline Games · PowerShell, Terminal &amp; Termux Ready
          </p>
        </div>
      </main>
    </div>
  );
};
