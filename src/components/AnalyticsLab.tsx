import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Brain,
  Cpu,
  Crosshair,
  Database,
  LogOut,
  Play,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Volume2,
} from 'lucide-react';
import type {
  BanditArmId,
  DirectorMode,
  DirectorModifiers,
  DirectorState,
} from '../engine/mlDirector';
import {
  computeGameAffinities,
  type BehavioralEventType,
  type BehavioralStore,
} from '../engine/behavioralAnalyzer';
import {
  BALANCE_SCENARIO_LABELS,
  BET_PATTERN_LABELS,
  getRowProbabilities,
  HOUSE_PERSONALITY_META,
  HOUSE_PHASE_META,
  runAllStrategiesBenchmark,
  runRealisticBattleSimulation,
  type BattleStrategyId,
  type HouseMindState,
  type HousePersonality,
  type RealisticBattleSimSummary,
} from '../engine/houseMind';
import { runMonteCarloSimulation, type MonteCarloReport } from '../engine/slotMath';
import { audioEngine } from '../engine/audioEngine';
import type { WinTier } from '../types/casino';

interface AnalyticsLabProps {
  balance: number;
  directorState: DirectorState;
  modifiers: DirectorModifiers;
  behavioralStore: BehavioralStore;
  houseMind: HouseMindState;
  onUpdateDirectorConfig: (patch: {
    mode?: DirectorMode;
    targetRtp?: number;
    volatility?: 'low' | 'medium' | 'high';
    pityThreshold?: number;
  }) => void;
  onRecomputeComprehensive: () => void;
  onPreviewCelebration?: (tier: WinTier) => void;
  onCashOut?: () => void;
  onChangeHousePersonality?: (personality: HousePersonality) => void;
}

const EVENT_LABELS: Record<BehavioralEventType, string> = {
  SESSION_START: 'Session Buy-In',
  CREDIT_ADDED: 'Credit Deposit',
  ROUND_PLAYED: 'Round Settled',
  GAME_SWITCH: 'Game Switch',
  RELIC_PURCHASED: 'Relic Unlocked',
};

function formatHour(hour: number | null): string {
  if (hour === null) return '—';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${suffix}`;
}

function MeterBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono-num font-semibold text-slate-100">{clamped}/100</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-[#090C10]">
        <div className={`h-full rounded transition-all duration-300 ${colorClass}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export const AnalyticsLab: React.FC<AnalyticsLabProps> = ({
  balance,
  directorState,
  modifiers,
  behavioralStore,
  houseMind,
  onUpdateDirectorConfig,
  onRecomputeComprehensive,
  onPreviewCelebration,
  onCashOut,
  onChangeHousePersonality,
}) => {
  const [simSpins, setSimSpins] = useState<number>(25000);
  const [report, setReport] = useState<MonteCarloReport | null>(() =>
    runMonteCarloSimulation(5000, modifiers)
  );
  const [runningSim, setRunningSim] = useState(false);
  const [battleStrategy, setBattleStrategy] = useState<BattleStrategyId>('martingale');
  const [battleSim, setBattleSim] = useState<RealisticBattleSimSummary | null>(null);
  const [benchmarkRows, setBenchmarkRows] = useState<RealisticBattleSimSummary[] | null>(null);
  const [masterVolume, setMasterVolume] = useState<number>(() =>
    Math.round(audioEngine.getVolume() * 100)
  );

  const affinities = useMemo(
    () => computeGameAffinities(behavioralStore.events),
    [behavioralStore.events]
  );

  const recentEvents = useMemo(
    () => [...behavioralStore.events].reverse().slice(0, 14),
    [behavioralStore.events]
  );

  const { realtime, comprehensive } = behavioralStore;

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
              Dual Behavioral AI, ML Director &amp; Math Lab
            </h2>
            <p className="text-xs text-slate-400">
              System 1 Real-Time Micro-Analyzer · System 2 Longitudinal Future Optimizer · Contextual Bandit &amp; PAR Sheet
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

      {/* THE HOUSE MIND — Classical ML Adversarial Battle War Room (Realistic Mode) */}
      <section
        data-testid="house-mind-war-room"
        className={`rounded-xl border p-5 ${
          directorState.mode === 'realistic_house'
            ? 'border-rose-500/45 bg-gradient-to-br from-[#170F14] via-[#11161D] to-[#11161D]'
            : 'border-slate-800 bg-[#11161D]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert
              className={`h-5 w-5 ${
                directorState.mode === 'realistic_house' ? 'text-rose-400' : 'text-[#D4AF37]'
              }`}
              aria-hidden="true"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-bold text-[#F9E7A8]">
                  The House Mind · Realistic Adversarial Engine (Non-LLM Classical ML)
                </h3>
                <span
                  data-testid="house-mind-phase-label"
                  className={`font-mono-num rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    HOUSE_PHASE_META[houseMind.phase].badgeBg
                  } ${HOUSE_PHASE_META[houseMind.phase].colorClass}`}
                >
                  {HOUSE_PHASE_META[houseMind.phase].label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Shannon Cadence Entropy · Ritual/Toggle Trap Detector · Online Logistic Quit-Risk Classifier · Profit-Seeking House Vault
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {directorState.mode !== 'realistic_house' && (
              <button
                type="button"
                onClick={() => onUpdateDirectorConfig({ mode: 'realistic_house' })}
                className="rounded-lg border border-rose-500/70 bg-rose-950/50 px-3.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-900/60 whitespace-nowrap"
              >
                Activate Realistic Battle Mode
              </button>
            )}
            {onCashOut && (
              <button
                type="button"
                onClick={onCashOut}
                className="flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3.5 py-2 text-xs font-bold text-[#090C10] hover:bg-[#ECCB63] whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cash Out (${balance.toFixed(0)})</span>
              </button>
            )}
          </div>
        </div>

        {/* House Treasury vs Player Battle Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-800/90 bg-[#090C10] p-3.5 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <div className="text-[11px] text-slate-400">House Vault Treasury</div>
            <div data-testid="house-vault-balance" className="font-mono-num mt-0.5 text-sm font-bold text-[#FEF08A]">
              ${houseMind.houseBankroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">House Net Profit</div>
            <div
              className={`font-mono-num mt-0.5 text-sm font-bold ${
                houseMind.houseSessionProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {houseMind.houseSessionProfit >= 0 ? '+' : '-'}$
              {Math.abs(houseMind.houseSessionProfit).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Tap Cadence Entropy</div>
            <div data-testid="house-entropy-value" className="font-mono-num mt-0.5 text-sm font-bold text-sky-300">
              {houseMind.cadenceEntropy}%
            </div>
            <div className="text-[10px] text-slate-500">{houseMind.dominantClockBucket}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Superstition / Rituals</div>
            <div className="font-mono-num mt-0.5 text-sm font-bold text-amber-300">
              {houseMind.superstitionScore}/100
            </div>
            <div className="text-[10px] text-slate-500">
              {houseMind.ritualExploitArmed ? 'Trap Armed' : `${houseMind.ritualEvents.length} signals`}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Online Quit Risk</div>
            <div className="font-mono-num mt-0.5 text-sm font-bold text-rose-300">
              {houseMind.quitRisk}%
            </div>
            <div className="text-[10px] text-slate-500">
              {houseMind.lifelinesReleased} lifelines sent
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Adversarial Edge</div>
            <div className="font-mono-num mt-0.5 text-sm font-bold text-slate-100">
              {houseMind.adversarialWinBias >= 0 ? '+' : ''}
              {(houseMind.adversarialWinBias * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500">
              Eff. RTP {houseMind.targetEffectiveRtp}%
            </div>
          </div>
        </div>

        {/* Detected Player Theories & Live Tactical Thought Stream */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Detected Player Theories & Counter-Measures */}
          <div className="rounded-lg border border-slate-800 bg-[#0B0F15] p-3.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Crosshair className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                <span>Detected Player Theories &amp; Counter-Traps</span>
              </div>
              <span className="font-mono-num text-[10px] text-slate-500">
                SGD Weights [{houseMind.quitWeights.slice(0, 3).map((w) => w.toFixed(2)).join(', ')}]
              </span>
            </div>
            <div className="mt-2.5 space-y-2">
              {houseMind.detectedTheories.map((t) => (
                <div
                  key={t.id}
                  className="rounded-md border border-slate-800/90 bg-[#11161D] px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100">{t.title}</span>
                    <span
                      className={`font-mono-num text-[10px] font-bold ${
                        t.status === 'EXPLOITING'
                          ? 'text-rose-400'
                          : t.status === 'FEEDING_BAIT'
                          ? 'text-amber-300'
                          : 'text-slate-400'
                      }`}
                    >
                      {t.status.replace('_', ' ')} · {t.confidence}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{t.counterMeasure}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live House Mind Tactical Thought Feed */}
          <div className="flex flex-col rounded-lg border border-slate-800 bg-[#0B0F15] p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Live House Mind Tactical Stream</span>
              <span className="font-mono-num text-[10px] text-slate-500">
                {houseMind.roundsAnalyzed} rounds studied · {houseMind.activeTheoriesCount} active theories
              </span>
            </div>
            <div className="mt-2.5 flex-1 max-h-[420px] space-y-1.5 overflow-y-auto pr-1 text-[11px]">
              {[...houseMind.thoughts].reverse().slice(0, 12).map((th) => (
                <div
                  key={th.id}
                  className="rounded border border-slate-800/70 bg-[#11161D] px-2.5 py-1.5"
                >
                  <span className="font-mono-num font-bold text-rose-300">[{th.tag}] </span>
                  <span className="text-slate-300">{th.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Realistic Mode Scenario Matrix (Balance Triplet + Bet-Change Model + Speed/Auto Profile) */}
        <div
          data-testid="realistic-scenario-matrix"
          className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-800/90 bg-[#090C10] p-3.5 text-xs md:grid-cols-3"
        >
          <div>
            <div className="text-[11px] font-semibold text-slate-300">
              Balance Trajectory (Start → Last → Now)
            </div>
            <div className="font-mono-num mt-1 text-sm font-bold text-[#F9E7A8]">
              ${houseMind.startingBalance.toFixed(0)} → ${houseMind.lastBalance.toFixed(0)} → $
              {houseMind.currentBalance.toFixed(0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{BALANCE_SCENARIO_LABELS[houseMind.balanceScenario]}</span>
              <span
                className={`font-mono-num font-bold ${
                  houseMind.lastBalanceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                Last Δ {houseMind.lastBalanceDelta >= 0 ? '+' : '-'}$
                {Math.abs(houseMind.lastBalanceDelta).toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-300">
              Bet Value &amp; Change Dynamics
            </div>
            <div className="font-mono-num mt-1 text-sm font-bold text-amber-300">
              {BET_PATTERN_LABELS[houseMind.betPattern]}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono-num text-[11px] text-slate-400">
              <span>Last Bet ${houseMind.lastBet.toFixed(0)}</span>
              <span>
                Δ {houseMind.betDelta >= 0 ? '+' : '-'}${Math.abs(houseMind.betDelta).toFixed(0)} (
                {houseMind.betChangeRatio.toFixed(2)}x)
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-300">
              Speed, Turbo &amp; Auto-Spin Profile
            </div>
            <div className="font-mono-num mt-1 text-sm font-bold text-sky-300">
              {houseMind.spinSpeedMultiplier}x Speed · {houseMind.turboActive ? 'Turbo ON' : 'Turbo OFF'} ·{' '}
              {houseMind.autoSpinActive ? 'Auto ON' : 'Manual'}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono-num text-[11px] text-slate-400">
              <span>{houseMind.speedChangeCount} speed shifts</span>
              <span>
                {houseMind.autoSpinRounds} auto / {houseMind.highSpeedRounds} fast rds
              </span>
            </div>
          </div>
        </div>

        {/* Deep Realistic Mode Classical ML Research Deck */}
        <div
          data-testid="house-research-panel"
          className="mt-4 rounded-lg border border-rose-500/25 bg-[#090C10] p-4 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h4 className="font-semibold text-[#F9E7A8]">
                Deep Realistic Mode Research Engine · Operator Profile &amp; Classical ML Signals
              </h4>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {HOUSE_PERSONALITY_META[houseMind.personality].summary}
              </p>
            </div>
            {onChangeHousePersonality && (
              <div
                role="group"
                aria-label="House Operator Personality"
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0D1117] p-0.5"
              >
                {(['CASINO_FLOOR', 'SHARK_PIT', 'PSYCHOLOGIST'] as HousePersonality[]).map((pers) => {
                  const active = houseMind.personality === pers;
                  return (
                    <button
                      key={pers}
                      type="button"
                      data-testid={`personality-btn-${pers.toLowerCase()}`}
                      onClick={() => onChangeHousePersonality(pers)}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
                        active
                          ? pers === 'SHARK_PIT'
                            ? 'bg-rose-500 text-white'
                            : pers === 'PSYCHOLOGIST'
                            ? 'bg-sky-400 text-[#090C10]'
                            : 'bg-[#D4AF37] text-[#090C10]'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {HOUSE_PERSONALITY_META[pers].shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Col 1: Online Markov 2x3 Bet-Transition Matrix & Pre-Emptive Forecast */}
            <div className="rounded-lg border border-slate-800/90 bg-[#0E131B] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">Markov Bet-Transition Model</span>
                <span
                  data-testid="markov-spike-forecast"
                  className={`font-mono-num text-[11px] font-bold ${
                    houseMind.preemptiveSqueezeArmed ? 'text-rose-400' : 'text-amber-300'
                  }`}
                >
                  Next Raise: {houseMind.nextBetSpikeProb}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {houseMind.preemptiveSqueezeArmed
                  ? 'PRE-EMPTIVE SQUEEZE ARMED — House raised edge before your predicted bet jump.'
                  : 'Learning conditional P(Bet Down / Same / Up) given Win vs. Loss.'}
              </p>

              {(() => {
                const lossRow = getRowProbabilities(houseMind.betTransitionMatrix.afterLoss);
                const winRow = getRowProbabilities(houseMind.betTransitionMatrix.afterWin);
                return (
                  <div className="mt-3 space-y-2 font-mono-num text-[11px]">
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-500">
                      <span>Condition</span>
                      <span className="text-right">Down</span>
                      <span className="text-right">Same</span>
                      <span className="text-right">Raise</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 rounded bg-[#090C10] px-2 py-1.5">
                      <span className="font-sans font-semibold text-rose-300">After Loss</span>
                      <span className="text-right text-slate-300">{lossRow.downPct}%</span>
                      <span className="text-right text-slate-300">{lossRow.samePct}%</span>
                      <span className={`text-right font-bold ${lossRow.upPct >= 55 ? 'text-rose-400' : 'text-slate-100'}`}>
                        {lossRow.upPct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 rounded bg-[#090C10] px-2 py-1.5">
                      <span className="font-sans font-semibold text-emerald-300">After Win</span>
                      <span className="text-right text-slate-300">{winRow.downPct}%</span>
                      <span className="text-right text-slate-300">{winRow.samePct}%</span>
                      <span className={`text-right font-bold ${winRow.upPct >= 55 ? 'text-amber-300' : 'text-slate-100'}`}>
                        {winRow.upPct}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Col 2: 4-Arm House Adversarial Tactic Bandit */}
            <div className="rounded-lg border border-slate-800/90 bg-[#0E131B] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">House 4-Arm Tactic Bandit</span>
                <span className="font-mono-num text-[10px] text-rose-300">
                  Active: {houseMind.tacticArms[houseMind.activeTactic].label}
                </span>
              </div>
              <div className="mt-2.5 space-y-2">
                {Object.values(houseMind.tacticArms).map((arm) => {
                  const meanPct = Math.round((arm.alpha / (arm.alpha + arm.beta)) * 100);
                  const isActive = houseMind.activeTactic === arm.id;
                  return (
                    <div key={arm.id}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={isActive ? 'font-bold text-[#F9E7A8]' : 'text-slate-300'}>
                          {arm.label}
                        </span>
                        <span className="font-mono-num text-[10px] text-slate-400">
                          {meanPct}% eff · {arm.pulls}r · {arm.avgExtraction >= 0 ? '+' : '-'}$
                          {Math.abs(arm.avgExtraction).toFixed(0)}/r
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#090C10]">
                        <div
                          className={`h-full rounded transition-all duration-300 ${
                            isActive ? 'bg-rose-400' : 'bg-slate-600'
                          }`}
                          style={{ width: `${meanPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Col 3: Psychophysics, Gambler's Ruin & Cross-Session Memory */}
            <div className="rounded-lg border border-slate-800/90 bg-[#0E131B] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">Psychophysics &amp; House Memory</span>
                <span className="font-mono-num text-[10px] text-slate-400">
                  {houseMind.memory.sessionsObserved} prior battle{houseMind.memory.sessionsObserved === 1 ? '' : 's'}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono-num text-[11px]">
                <div className="rounded bg-[#090C10] px-2.5 py-1.5">
                  <div className="font-sans text-[10px] text-slate-400">Lag-1 Autocorr (r)</div>
                  <div
                    className={`mt-0.5 font-bold ${
                      Math.abs(houseMind.cadenceAutocorr) >= 0.45 ? 'text-rose-400' : 'text-sky-300'
                    }`}
                  >
                    {houseMind.cadenceAutocorr >= 0 ? '+' : ''}
                    {houseMind.cadenceAutocorr.toFixed(2)}
                  </div>
                </div>
                <div className="rounded bg-[#090C10] px-2.5 py-1.5">
                  <div className="font-sans text-[10px] text-slate-400">LDW Illusions</div>
                  <div className="mt-0.5 font-bold text-amber-300">
                    {houseMind.ldwCount} ({houseMind.ldwRatePct}%)
                  </div>
                </div>
                <div className="rounded bg-[#090C10] px-2.5 py-1.5">
                  <div className="font-sans text-[10px] text-slate-400">Kelly Overbet Risk</div>
                  <div
                    className={`mt-0.5 font-bold ${
                      houseMind.kellyOverbetIndex >= 55 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {houseMind.kellyOverbetIndex}/100
                  </div>
                </div>
                <div className="rounded bg-[#090C10] px-2.5 py-1.5">
                  <div className="font-sans text-[10px] text-slate-400">Est. Rounds to $0</div>
                  <div className="mt-0.5 font-bold text-[#F9E7A8]">
                    {houseMind.estimatedRoundsToRuin === null
                      ? 'Positive Drift'
                      : houseMind.estimatedRoundsToRuin === 0
                      ? 'Drained ($0)'
                      : `~${houseMind.estimatedRoundsToRuin} rds`}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 rounded border border-slate-800/80 bg-[#090C10] px-2.5 py-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Adaptive Windfall Lock</span>
                  <span className="font-mono-num font-bold text-rose-300">
                    +{houseMind.memory.adaptiveWindfallTriggerPct.toFixed(0)}% profit
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-400">Remembered Tell</span>
                  <span className="font-semibold text-slate-200">{houseMind.memory.rememberedWeakness}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Universal Multi-Game Realistic Mode Extraction Ledger */}
        <div className="mt-3 rounded-lg border border-slate-800/80 bg-[#0B0F15] p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-200">
              Universal Multi-Game Enforcement (Active Across All 16 Games)
            </span>
            <span className="font-mono-num text-[10px] text-slate-400">
              {Object.keys(houseMind.perGameStats).length} / 16 tables tracked this session
            </span>
          </div>
          {Object.keys(houseMind.perGameStats).length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(houseMind.perGameStats).map(([gId, st]) => (
                <div
                  key={gId}
                  className="rounded border border-slate-800 bg-[#11161D] px-2.5 py-1.5 font-mono-num text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-semibold uppercase text-slate-200">{gId}</span>
                    <span className="text-slate-500">{st.rounds}r</span>
                  </div>
                  <div
                    className={`mt-0.5 font-bold ${
                      st.houseProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    House {st.houseProfit >= 0 ? '+' : '-'}${Math.abs(st.houseProfit).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Play any of the 16 floor games — the House Mind carries your profile and adversarial edge seamlessly across every table.
            </p>
          )}
        </div>

        {/* Offline Monte Carlo Realistic Battle Simulator (6 Strategies vs Active Operator Personality) */}
        <div
          data-testid="realistic-battle-simulator"
          className="mt-3 rounded-lg border border-slate-800/80 bg-[#0B0F15] p-3.5 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-200">
                Offline Realistic Battle Stress-Test (vs. {HOUSE_PERSONALITY_META[houseMind.personality].label})
              </span>
              <p className="text-[11px] text-slate-400">
                Benchmark 6 human archetypes directly against the House Mind engine (100% offline Monte Carlo).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#090C10] p-0.5">
                {(
                  [
                    { id: 'steady', label: 'Steady' },
                    { id: 'martingale', label: 'Martingale' },
                    { id: 'hit_and_run', label: 'Hit & Run' },
                    { id: 'hyper_auto', label: '8x Auto' },
                    { id: 'ritual_toggler', label: 'Ritual' },
                    { id: 'entropy_ghost', label: 'Entropy Pro' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBattleStrategy(opt.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      battleStrategy === opt.id
                        ? 'bg-[#D4AF37] text-[#090C10]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="run-battle-sim-btn"
                onClick={() => {
                  audioEngine.playClick();
                  setBattleSim(
                    runRealisticBattleSimulation(battleStrategy, {
                      personality: houseMind.personality,
                    })
                  );
                }}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/60 bg-rose-950/50 px-3 py-1.5 text-[11px] font-bold text-rose-200 hover:bg-rose-900/60 whitespace-nowrap"
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                <span>Simulate</span>
              </button>
              <button
                type="button"
                data-testid="run-all-benchmark-btn"
                onClick={() => {
                  audioEngine.playClick();
                  setBenchmarkRows(runAllStrategiesBenchmark(houseMind.personality));
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/60 bg-[#D4AF37]/15 px-3 py-1.5 text-[11px] font-bold text-[#F9E7A8] hover:bg-[#D4AF37]/25 whitespace-nowrap"
              >
                <BarChart3 className="h-3 w-3" aria-hidden="true" />
                <span>Compare All 6</span>
              </button>
            </div>
          </div>

          {battleSim && (
            <div
              data-testid="battle-sim-results"
              className="mt-3 grid grid-cols-2 gap-2.5 rounded-lg border border-slate-800/90 bg-[#11161D] p-3 font-mono-num sm:grid-cols-3 lg:grid-cols-6"
            >
              <div>
                <div className="font-sans text-[10px] text-slate-400">Bankrupt Rate ($0)</div>
                <div className="mt-0.5 text-sm font-bold text-rose-400">
                  {battleSim.bankruptRatePct}%
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-slate-400">Escaped w/ Profit</div>
                <div className="mt-0.5 text-sm font-bold text-emerald-400">
                  {battleSim.escapedProfitPct}%
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-slate-400">Avg Peak / Final</div>
                <div className="mt-0.5 text-sm font-bold text-[#F9E7A8]">
                  ${battleSim.avgPeakBalance.toFixed(0)} → ${battleSim.avgFinalBalance.toFixed(0)}
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-slate-400">House Avg Profit</div>
                <div
                  className={`mt-0.5 text-sm font-bold ${
                    battleSim.avgHouseExtraction >= 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {battleSim.avgHouseExtraction >= 0 ? '+' : '-'}$
                  {Math.abs(battleSim.avgHouseExtraction).toFixed(0)}
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-slate-400">Avg Survival / LDW</div>
                <div className="mt-0.5 text-sm font-bold text-amber-300">
                  {battleSim.avgRoundsSurvived}r · {battleSim.ldwRatePct}%
                </div>
              </div>
              <div>
                <div className="font-sans text-[10px] text-slate-400">Active Theories</div>
                <div className="mt-0.5 text-sm font-bold text-sky-300">
                  {battleSim.avgActiveTheories} / sess
                </div>
              </div>
            </div>
          )}

          {benchmarkRows && (
            <div
              data-testid="battle-benchmark-table"
              className="mt-3 overflow-x-auto rounded-lg border border-slate-800/90 bg-[#090C10]"
            >
              <table className="w-full text-left font-mono-num text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400">
                    <th className="px-3 py-2 font-sans font-semibold">Player Strategy</th>
                    <th className="px-2.5 py-2 text-right font-sans font-semibold">Bankrupt</th>
                    <th className="px-2.5 py-2 text-right font-sans font-semibold">Escaped +$</th>
                    <th className="px-2.5 py-2 text-right font-sans font-semibold">Avg Final</th>
                    <th className="px-2.5 py-2 text-right font-sans font-semibold">House Profit</th>
                    <th className="px-2.5 py-2 text-right font-sans font-semibold">Theories</th>
                    <th className="px-3 py-2 text-right font-sans font-semibold">Dominant Counter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {benchmarkRows.map((row) => (
                    <tr key={row.strategy} className="hover:bg-[#11161D]">
                      <td className="px-3 py-2 font-sans font-semibold text-slate-200 whitespace-nowrap">
                        {row.label}
                      </td>
                      <td className="px-2.5 py-2 text-right font-bold text-rose-400">
                        {row.bankruptRatePct}%
                      </td>
                      <td className="px-2.5 py-2 text-right font-bold text-emerald-400">
                        {row.escapedProfitPct}%
                      </td>
                      <td className="px-2.5 py-2 text-right text-[#F9E7A8]">
                        ${row.avgFinalBalance.toFixed(0)}
                      </td>
                      <td
                        className={`px-2.5 py-2 text-right font-bold ${
                          row.avgHouseExtraction >= 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {row.avgHouseExtraction >= 0 ? '+' : '-'}${Math.abs(row.avgHouseExtraction).toFixed(0)}
                      </td>
                      <td className="px-2.5 py-2 text-right text-sky-300">{row.avgActiveTheories}</td>
                      <td className="px-3 py-2 text-right font-sans text-slate-300 whitespace-nowrap">
                        {houseMind.tacticArms[row.dominantTactic].label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Dual-System Smart Behavioral Intelligence */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* SYSTEM 1: Real-Time Behavioral Analyzer */}
        <section
          data-testid="behavioral-system-1"
          className="rounded-xl border border-emerald-500/30 bg-[#11161D] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  System 1 · Real-Time Behavioral Analyzer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Live sliding-window reaction, credit reload, tilt &amp; dopamine steering
                </p>
              </div>
            </div>
            <span
              data-testid="rt-micro-state"
              className="font-mono-num text-xs font-bold text-emerald-400"
            >
              {realtime.stateLabel}
            </span>
          </div>

          <p className="mt-3 rounded-lg border border-slate-800 bg-[#090C10] px-3 py-2 text-xs text-slate-300">
            {realtime.rationale}
          </p>

          <div className="mt-4 space-y-2.5">
            <MeterBar label="Tilt / Loss-Chase Pressure" value={realtime.tiltScore} colorClass="bg-rose-500" />
            <MeterBar label="Fatigue / Drift Risk" value={realtime.fatigueScore} colorClass="bg-amber-400" />
            <MeterBar label="Euphoria / Flow Momentum" value={realtime.euphoriaScore} colorClass="bg-emerald-400" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3 text-xs sm:grid-cols-4">
            <div>
              <div className="text-[11px] text-slate-400">Reaction Pace</div>
              <div className="font-mono-num mt-0.5 font-bold text-slate-100">
                {(realtime.avgReactionMs / 1000).toFixed(2)}s
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Bet Escalation</div>
              <div className="font-mono-num mt-0.5 font-bold text-[#F9E7A8]">
                {realtime.betEscalationRatio.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Reload Hook</div>
              <div
                className={`font-mono-num mt-0.5 font-bold ${
                  realtime.recentDepositBoostActive ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {realtime.recentDepositBoostActive ? 'ACTIVE' : 'Standby'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Live Deltas</div>
              <div className="font-mono-num mt-0.5 font-bold text-emerald-400">
                {realtime.winBiasDelta >= 0 ? '+' : ''}
                {(realtime.winBiasDelta * 100).toFixed(1)}% / +{realtime.bonusDelta.toFixed(2)}x
              </div>
            </div>
          </div>
        </section>

        {/* SYSTEM 2: Comprehensive Longitudinal Analyzer & Future Profile */}
        <section
          data-testid="behavioral-system-2"
          className="rounded-xl border border-[#D4AF37]/35 bg-[#11161D] p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  System 2 · Comprehensive Future Optimizer
                </h3>
                <p className="text-[11px] text-slate-400">
                  All-history credit, affinity &amp; elasticity model applied to future rounds
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRecomputeComprehensive}
              className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/60 bg-[#D4AF37]/15 px-3 py-1.5 text-[11px] font-bold text-[#F9E7A8] hover:bg-[#D4AF37]/25 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reprocess History</span>
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-slate-800 bg-[#090C10] px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span data-testid="comp-archetype" className="text-xs font-bold text-[#ECCB63]">
                Archetype: {comprehensive.archetype}
              </span>
              <span className="font-mono-num text-[11px] text-slate-400">
                {comprehensive.samplesProcessed} events analyzed
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">{comprehensive.archetypeSummary}</p>
            <p className="mt-1 text-[11px] text-emerald-400">
              Future Blueprint: {comprehensive.futureStrategyNote}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-400">Credits Added</div>
              <div data-testid="comp-credits-added" className="font-mono-num mt-0.5 font-bold text-[#F9E7A8]">
                ${comprehensive.totalCreditsAdded.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                {comprehensive.creditDepositCount} deposits (avg ${comprehensive.avgDepositSize.toFixed(0)})
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Applied RTP Floor</div>
              <div className="font-mono-num mt-0.5 font-bold text-emerald-400">
                {comprehensive.adaptedRtpFloor.toFixed(1)}%
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                Pity {comprehensive.adaptedPityThreshold} · Tease {comprehensive.adaptedTeaseMultiplier.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Favorite / Peak Hour</div>
              <div className="font-mono-num mt-0.5 font-bold capitalize text-slate-100">
                {comprehensive.favoriteGameId ?? 'Any'} · {formatHour(comprehensive.peakPlayHour)}
              </div>
              <div className="font-mono-num text-[10px] text-slate-500">
                Fav Boost +{(comprehensive.favoriteGameBonusBias * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-800 pt-3">
            <MeterBar label="Risk Appetite" value={comprehensive.riskAppetiteScore} colorClass="bg-[#D4AF37]" />
            <MeterBar label="Loss Chase" value={comprehensive.lossChaseIndex} colorClass="bg-rose-500" />
            <MeterBar
              label="Dopamine Gain"
              value={comprehensive.dopamineResponsiveness}
              colorClass="bg-emerald-400"
            />
          </div>
        </section>
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
              <div
                className={`font-mono-num mt-0.5 text-xs font-bold ${
                  modifiers.winBias < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {modifiers.winBias >= 0 ? '+' : ''}
                {(modifiers.winBias * 100).toFixed(1)}% · {modifiers.bonusBoost.toFixed(2)}x
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
                    { id: 'realistic_house', label: 'Realistic House (Battle)' },
                    { id: 'adaptive_ml', label: 'Adaptive ML' },
                    { id: 'dopamine_max', label: 'Dopamine Max' },
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'off', label: 'Off (Strict RNG)' },
                  ] as Array<{ id: DirectorMode; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateDirectorConfig({ mode: opt.id })}
                    className={`${
                      opt.id === 'realistic_house' ? 'col-span-2' : ''
                    } rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      directorState.mode === opt.id
                        ? opt.id === 'realistic_house'
                          ? 'border-rose-400 bg-rose-950/50 text-[#FEF08A]'
                          : 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
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

            {onPreviewCelebration && (
              <div className="border-t border-slate-800 pt-3">
                <div className="text-xs text-slate-400">Dramatic Win FX Showcase</div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { tier: 'BIG', label: 'Big', cls: 'border-amber-500/50 text-amber-300 hover:bg-amber-950/50' },
                      { tier: 'SUPER', label: 'Super', cls: 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/50' },
                      { tier: 'MEGA', label: 'Mega', cls: 'border-rose-500/50 text-rose-300 hover:bg-rose-950/50' },
                      { tier: 'JACKPOT', label: 'Jackpot', cls: 'border-[#ECCB63]/70 text-[#FEF08A] hover:bg-[#D4AF37]/20' },
                    ] as Array<{ tier: WinTier; label: string; cls: string }>
                  ).map((item) => (
                    <button
                      key={item.tier}
                      type="button"
                      onClick={() => onPreviewCelebration(item.tier)}
                      className={`rounded-lg border bg-[#090C10] py-1.5 text-[11px] font-bold transition-colors ${item.cls}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Procedural Web Audio DSP & Spatial SFX Studio */}
      <section
        data-testid="audio-dsp-studio"
        className="rounded-xl border border-slate-800 bg-[#11161D] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Procedural Audio DSP &amp; Spatial SFX Studio
              </h3>
              <p className="text-[11px] text-slate-400">
                Master DynamicsCompressor bus · StereoPanner dispersion · Filtered Harmonic Risers &amp; Metallic Coin Bells
              </p>
            </div>
          </div>

          <div className="flex min-w-[210px] items-center gap-3 text-xs">
            <label htmlFor="master-volume-slider" className="text-slate-400 whitespace-nowrap">
              Master Gain
            </label>
            <input
              id="master-volume-slider"
              type="range"
              min={0}
              max={100}
              step={2}
              value={masterVolume}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMasterVolume(next);
                audioEngine.setVolume(next / 100);
              }}
              className="w-full accent-[#D4AF37]"
            />
            <span className="font-mono-num w-10 text-right font-bold text-[#F9E7A8]">
              {masterVolume}%
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              {
                id: 'coin-shower',
                label: 'Stereo Coin Shower',
                note: 'Inharmonic bells',
                action: () => audioEngine.playCoinShower(18),
                cls: 'border-[#D4AF37]/50 text-[#FEF08A] hover:bg-[#D4AF37]/15',
              },
              {
                id: 'harmonic-riser',
                label: 'Harmonic Riser',
                note: 'LFO tremolo sweep',
                action: () => audioEngine.playHarmonicRiser(0.95),
                cls: 'border-rose-500/50 text-rose-300 hover:bg-rose-950/40',
              },
              {
                id: 'vault-tumbler',
                label: 'Vault Tumbler',
                note: 'Brass bolt lock',
                action: () => audioEngine.playVaultTumbler(5),
                cls: 'border-amber-500/50 text-amber-300 hover:bg-amber-950/40',
              },
              {
                id: 'collector-surge',
                label: 'Collector Surge',
                note: 'Emerald chord + coins',
                action: () => audioEngine.playCollectorSurge(),
                cls: 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/40',
              },
              {
                id: 'predator-lock',
                label: 'Predator Lock',
                note: 'House radar drone',
                action: () => audioEngine.playPredatorLock(),
                cls: 'border-rose-500/60 text-rose-300 hover:bg-rose-950/50',
              },
              {
                id: 'cashout-vault',
                label: 'Cash-Out Vault',
                note: 'Safe latch + escape',
                action: () => audioEngine.playCashOutVault(),
                cls: 'border-[#ECCB63]/60 text-[#FEF08A] hover:bg-[#D4AF37]/20',
              },
              {
                id: 'nearmiss-sting',
                label: 'Near-Miss Sting',
                note: 'Dissonant drop',
                action: () => audioEngine.playNearMissSting(),
                cls: 'border-amber-500/50 text-amber-200 hover:bg-amber-950/40',
              },
              {
                id: 'lifeline-pulse',
                label: 'Lifeline Pulse',
                note: 'Anti-quit shimmer',
                action: () => audioEngine.playLifelinePulse(),
                cls: 'border-sky-500/50 text-sky-300 hover:bg-sky-950/40',
              },
              {
                id: 'card-snap',
                label: 'Card Paper Snap',
                note: 'High-pass transient',
                action: () => audioEngine.playCardDeal(),
                cls: 'border-slate-700 text-slate-200 hover:border-slate-500',
              },
              {
                id: 'sub-bass-bust',
                label: 'Sub-Bass Impact',
                note: 'Low-pass drop',
                action: () => audioEngine.playBust(),
                cls: 'border-slate-700 text-slate-200 hover:border-slate-500',
              },
              {
                id: 'coin-flip-spin',
                label: 'Coin Flip Spin',
                note: 'Metallic air whistle',
                action: () => audioEngine.playCoinFlipSpin(),
                cls: 'border-[#D4AF37]/50 text-[#F9E7A8] hover:bg-[#D4AF37]/15',
              },
              {
                id: 'poker-hold-snap',
                label: 'Poker Hold Lock',
                note: 'Ivory latch click',
                action: () => audioEngine.playPokerHold(true),
                cls: 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/40',
              },
              {
                id: 'royal-hand-fanfare',
                label: 'Royal Hand Fanfare',
                note: 'Harp-brass chord',
                action: () => audioEngine.playRoyalHandFanfare(true),
                cls: 'border-[#ECCB63]/60 text-[#FEF08A] hover:bg-[#D4AF37]/20',
              },
            ] as const
          ).map((pad) => (
            <button
              key={pad.id}
              type="button"
              onClick={pad.action}
              className={`rounded-lg border bg-[#090C10] px-3 py-2.5 text-left transition-colors ${pad.cls}`}
            >
              <div className="text-xs font-bold">{pad.label}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{pad.note}</div>
            </button>
          ))}
        </div>
      </section>

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

      {/* Recorded Activity, Credit Deposit Ledger & Game Affinity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section
          data-testid="behavioral-event-ledger"
          className="rounded-xl border border-slate-800 bg-[#11161D] p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-100">
                Recorded Credit &amp; Play Ledger
              </h3>
            </div>
            <span className="font-mono-num text-[11px] text-slate-400">
              {behavioralStore.totalEventsRecorded} total events stored offline
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Game</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount / Payout</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {recentEvents.map((ev) => {
                  const timeStr = new Date(ev.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const isCredit = ev.type === 'CREDIT_ADDED' || ev.type === 'SESSION_START';
                  return (
                    <tr key={ev.id} className={isCredit ? 'bg-[#D4AF37]/8' : ''}>
                      <td className="font-mono-num py-2 pr-3 text-slate-400 whitespace-nowrap">{timeStr}</td>
                      <td className="py-2 pr-3 font-medium text-slate-200 whitespace-nowrap">
                        {EVENT_LABELS[ev.type]}
                      </td>
                      <td className="py-2 pr-3 capitalize text-slate-400">{ev.gameId ?? 'vault'}</td>
                      <td className="font-mono-num py-2 pr-3 text-right whitespace-nowrap">
                        {isCredit ? (
                          <span className="font-bold text-[#ECCB63]">+${ev.amount.toFixed(0)}</span>
                        ) : ev.type === 'ROUND_PLAYED' ? (
                          <span className={(ev.payout ?? 0) > ev.amount ? 'text-emerald-400' : 'text-slate-300'}>
                            ${ev.amount.toFixed(0)} → ${(ev.payout ?? 0).toFixed(2)}
                          </span>
                        ) : ev.amount > 0 ? (
                          <span className="text-rose-400">-${ev.amount.toFixed(0)}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="font-mono-num py-2 text-right text-slate-100 whitespace-nowrap">
                        ${ev.balanceAfter.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#11161D] p-5">
          <h3 className="text-sm font-semibold text-slate-100">Game Affinity Profile</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            System 2 directs extra favorite-game dopamine bias toward your highest-affinity tables.
          </p>

          {affinities.length === 0 ? (
            <div className="mt-6 rounded-lg border border-slate-800 bg-[#090C10] p-4 text-center text-xs text-slate-500">
              Play rounds across any of the 12 games to build your longitudinal affinity map.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {affinities.slice(0, 6).map((stat) => {
                const gameRtp =
                  stat.totalWagered > 0
                    ? ((stat.totalReturned / stat.totalWagered) * 100).toFixed(0)
                    : '—';
                return (
                  <div key={stat.gameId} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-slate-200">{stat.gameId}</span>
                      <span className="font-mono-num text-[11px] text-slate-400">
                        {stat.rounds} rds · avg ${stat.avgBet.toFixed(0)} · RTP {gameRtp}% ({stat.sharePct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-[#090C10]">
                      <div
                        className="h-full rounded bg-[#D4AF37]"
                        style={{ width: `${Math.max(4, Math.min(100, stat.sharePct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
