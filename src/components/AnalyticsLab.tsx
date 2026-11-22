import React, { useState } from 'react';
import { BarChart3, Brain, Play, Sliders } from 'lucide-react';
import type {
  BanditArmId,
  DirectorMode,
  DirectorModifiers,
  DirectorState,
} from '../engine/mlDirector';
import { runMonteCarloSimulation, type MonteCarloReport } from '../engine/slotMath';

interface AnalyticsLabProps {
  balance: number;
  directorState: DirectorState;
  modifiers: DirectorModifiers;
  onUpdateDirectorConfig: (patch: {
    mode?: DirectorMode;
    targetRtp?: number;
    volatility?: 'low' | 'medium' | 'high';
    pityThreshold?: number;
  }) => void;
}

export const AnalyticsLab: React.FC<AnalyticsLabProps> = ({
  balance,
  directorState,
  modifiers,
  onUpdateDirectorConfig,
}) => {
  const [simSpins, setSimSpins] = useState<number>(25000);
  const [report, setReport] = useState<MonteCarloReport | null>(() =>
    runMonteCarloSimulation(5000, modifiers)
  );
  const [runningSim, setRunningSim] = useState(false);

  const sessionRtp =
    directorState.totalWagered > 0
      ? ((directorState.totalReturned / directorState.totalWagered) * 100).toFixed(1)
      : '—';

  const netProfit = balance - directorState.buyIn;

  // Build SVG equity curve points with tight auto-scaling so every spin swing is visible
  const points: number[] = [
    directorState.buyIn,
    ...directorState.history.map((h) => h.balanceAfter),
  ];
  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const minPad = Math.max(25, directorState.buyIn * 0.025);
  const minVal = rawMin - minPad;
  const maxVal = rawMax + minPad;
  const span = Math.max(10, maxVal - minVal);

  const svgWidth = 640;
  const svgHeight = 190;
  const padX = 16;
  const padY = 18;

  const polyline = points
    .map((val, idx) => {
      const x =
        points.length === 1
          ? svgWidth / 2
          : padX + (idx / (points.length - 1)) * (svgWidth - padX * 2);
      const y = svgHeight - padY - ((val - minVal) / span) * (svgHeight - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const buyInY =
    svgHeight - padY - ((directorState.buyIn - minVal) / span) * (svgHeight - padY * 2);

  const handleRunMonteCarlo = () => {
    setRunningSim(true);
    window.setTimeout(() => {
      const res = runMonteCarloSimulation(simSpins, modifiers);
      setReport(res);
      setRunningSim(false);
    }, 20);
  };

  const armList = Object.values(directorState.arms);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-4">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-[#D4AF37]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">
              Real-Time ML Director &amp; Math Lab
            </h2>
            <p className="text-xs text-slate-400">
              Contextual LinUCB + Thompson Sampling Bandit · Live Dopamine Telemetry · Local Monte Carlo PAR Sheet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 font-mono-num text-xs">
          <div>
            <span className="text-slate-400">Dopamine Index </span>
            <strong className="text-[#ECCB63]">{directorState.dopamineIndex}/100</strong>
          </div>
          <div>
            <span className="text-slate-400">Markov </span>
            <strong className="text-emerald-400">{directorState.markovState}</strong>
          </div>
          <div>
            <span className="text-slate-400">Session RTP </span>
            <strong className="text-white">{sessionRtp}%</strong>
          </div>
        </div>
      </div>

      {/* Top Row: Live Equity Curve + Director Controls */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* Equity Curve */}
        <section className="rounded-xl border border-slate-800 bg-[#11161D] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Session Bankroll Curve</h3>
            <div className="flex items-center gap-4 font-mono-num text-xs">
              <span className="text-slate-400">Rounds: {directorState.roundsPlayed}</span>
              <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                Net: {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
              </span>
              <span className="text-slate-300">Peak: ${directorState.peakBalance.toFixed(0)}</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800/80 bg-[#090C10] p-2">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-[190px] w-full">
              {/* Buy-in baseline */}
              <line
                x1={padX}
                y1={buyInY}
                x2={svgWidth - padX}
                y2={buyInY}
                stroke="#475569"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x={padX + 4} y={Math.max(14, buyInY - 5)} fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono">
                Buy-In ${directorState.buyIn}
              </text>

              {points.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="#ECCB63"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  points={polyline}
                />
              ) : (
                <text
                  x={svgWidth / 2}
                  y={svgHeight / 2}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="12"
                >
                  Play rounds in any game to trace live equity and RPE
                </text>
              )}
            </svg>
          </div>

          {/* Live Telemetry Row */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] text-slate-400">Active Policy</div>
              <div className="font-mono-num mt-0.5 text-xs font-bold text-[#F9E7A8]">
                {modifiers.activeArm.replace('_', ' ')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Dry Streak / Pity</div>
              <div className="font-mono-num mt-0.5 text-xs font-bold text-slate-100">
                {directorState.dryStreak} / {directorState.pityThreshold}{' '}
                {modifiers.pityActive ? '(ACTIVE)' : ''}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Rubber-Band</div>
              <div
                className={`font-mono-num mt-0.5 text-xs font-bold ${
                  modifiers.comebackActive ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                {modifiers.comebackActive ? 'SURGE ON' : 'Standby'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Win Bias / Bonus</div>
              <div className="font-mono-num mt-0.5 text-xs font-bold text-emerald-400">
                +{(modifiers.winBias * 100).toFixed(1)}% · {modifiers.bonusBoost.toFixed(2)}x
              </div>
            </div>
          </div>
        </section>

        {/* Adaptive Director Controls */}
        <section className="rounded-xl border border-slate-800 bg-[#11161D] p-5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100">Director Manipulation Controls</h3>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs text-slate-400">ML Policy Engine Mode</div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'off', label: 'Off (Strict RNG)' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'adaptive_ml', label: 'Adaptive ML' },
                    { id: 'dopamine_max', label: 'Dopamine Max' },
                  ] as Array<{ id: DirectorMode; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateDirectorConfig({ mode: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      directorState.mode === opt.id
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                        : 'border-slate-800 bg-[#090C10] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="rtp-slider" className="text-slate-400">
                  Target Session RTP
                </label>
                <span className="font-mono-num font-bold text-[#ECCB63]">
                  {directorState.targetRtp.toFixed(1)}%
                </span>
              </div>
              <input
                id="rtp-slider"
                type="range"
                min={94}
                max={112}
                step={0.5}
                value={directorState.targetRtp}
                onChange={(e) => onUpdateDirectorConfig({ targetRtp: Number(e.target.value) })}
                className="mt-1.5 w-full accent-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <label htmlFor="pity-slider" className="text-slate-400">
                  Pity Timer Trigger (Dry Rounds)
                </label>
                <span className="font-mono-num font-bold text-white">
                  {directorState.pityThreshold} rounds
                </span>
              </div>
              <input
                id="pity-slider"
                type="range"
                min={2}
                max={10}
                step={1}
                value={directorState.pityThreshold}
                onChange={(e) => onUpdateDirectorConfig({ pityThreshold: Number(e.target.value) })}
                className="mt-1.5 w-full accent-[#D4AF37]"
              />
            </div>

            <div>
              <div className="text-xs text-slate-400">Volatility Profile</div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(['low', 'medium', 'high'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateDirectorConfig({ volatility: v })}
                    className={`rounded-lg border py-1.5 text-xs font-semibold capitalize transition-colors ${
                      directorState.volatility === v
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                        : 'border-slate-800 bg-[#090C10] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Contextual Bandit Arms Table */}
      <section className="rounded-xl border border-slate-800 bg-[#11161D] p-5">
        <h3 className="text-sm font-semibold text-slate-100">
          Contextual Multi-Armed Bandit Posteriors (Live Online Learning)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-4 font-medium">Policy Arm</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 text-right font-medium">Pulls</th>
                <th className="py-2 pr-4 text-right font-medium">Beta E[Reward]</th>
                <th className="py-2 text-right font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {armList.map((arm) => {
                const mean = (arm.alpha / (arm.alpha + arm.beta)) * 100;
                const isActive = (modifiers.activeArm as BanditArmId) === arm.id;
                return (
                  <tr key={arm.id} className={isActive ? 'bg-[#D4AF37]/8' : ''}>
                    <td className="py-2.5 pr-4 font-semibold text-slate-100">{arm.label}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{arm.description}</td>
                    <td className="font-mono-num py-2.5 pr-4 text-right text-slate-200">{arm.pulls}</td>
                    <td className="font-mono-num py-2.5 pr-4 text-right text-emerald-400">
                      {mean.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      {isActive ? (
                        <span className="text-[#ECCB63]">Selected</span>
                      ) : (
                        <span className="text-slate-500">Standby</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monte Carlo PAR Sheet Lab */}
      <section className="rounded-xl border border-slate-800 bg-[#11161D] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Local Monte Carlo PAR Sheet Simulator
              </h3>
              <p className="text-xs text-slate-400">
                Simulates Thunderfall virtual reel strips under your active ML Director parameters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Monte Carlo spin sample size"
              value={simSpins}
              onChange={(e) => setSimSpins(Number(e.target.value))}
              className="font-mono-num rounded-lg border border-slate-700 bg-[#090C10] px-3 py-2 text-xs text-white"
            >
              <option value={10000}>10,000 Spins</option>
              <option value={25000}>25,000 Spins</option>
              <option value={50000}>50,000 Spins</option>
              <option value={100000}>100,000 Spins</option>
            </select>
            <button
              type="button"
              disabled={runningSim}
              onClick={handleRunMonteCarlo}
              className="flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63] disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{runningSim ? 'Simulating...' : 'Run Monte Carlo'}</span>
            </button>
          </div>
        </div>

        {report && (
          <div className="mt-5 space-y-4 border-t border-slate-800 pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <div className="text-[11px] text-slate-400">Empirical RTP</div>
                <div className="font-mono-num mt-0.5 text-lg font-bold text-[#ECCB63]">
                  {report.empiricalRtp}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Hit Frequency</div>
                <div className="font-mono-num mt-0.5 text-lg font-bold text-emerald-400">
                  {report.hitFrequency}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Volatility (σ)</div>
                <div className="font-mono-num mt-0.5 text-lg font-bold text-white">
                  {report.volatilitySigma}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Max Multiplier</div>
                <div className="font-mono-num mt-0.5 text-lg font-bold text-[#F9E7A8]">
                  {report.maxMultiplier}x
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Bonus Rate</div>
                <div className="font-mono-num mt-0.5 text-lg font-bold text-white">
                  {report.bonusTriggerRate}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Compute Time</div>
                <div className="font-mono-num mt-0.5 text-lg font-bold text-slate-300">
                  {report.durationMs}ms
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {report.distribution.map((row) => (
                <div key={row.bucket} className="grid grid-cols-[120px_1fr_72px] items-center gap-3 text-xs">
                  <span className="text-slate-300">{row.bucket}</span>
                  <div className="h-2.5 overflow-hidden rounded bg-[#090C10]">
                    <div
                      className="h-full rounded bg-[#D4AF37]"
                      style={{ width: `${Math.min(100, Math.max(1, row.pct))}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-right text-slate-300">{row.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
