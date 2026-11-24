import React, { useState } from 'react';
import { Crown, Flame, ShieldAlert, Skull, Sparkles, Wand2 } from 'lucide-react';
import type { GameCommonProps } from '../types/casino';
import {
  TOWER_DIFFICULTY_CONFIGS,
  calculateTowerMultiplier,
  generateTowerBoard,
  resolveTowerStep,
  type DragonTowerDifficulty,
} from '../engine/gameEngines';
import { audioEngine } from '../engine/audioEngine';
import { WagerBar } from '../components/WagerBar';

type TowerPhase = 'IDLE' | 'CLIMBING' | 'BUSTED' | 'CASHED';

export const DragonTower: React.FC<GameCommonProps> = ({
  balance,
  modifiers,
  onWager,
  onSettleRound,
  onTriggerBurst,
}) => {
  const [bet, setBet] = useState(25);
  const [activeBet, setActiveBet] = useState(25);
  const [difficulty, setDifficulty] = useState<DragonTowerDifficulty>('medium');
  const [phase, setPhase] = useState<TowerPhase>('IDLE');
  const [board, setBoard] = useState<boolean[][]>(() => generateTowerBoard('medium'));
  const [currentRow, setCurrentRow] = useState(0); // 0 = bottom floor, 8 = summit
  const [pickedCols, setPickedCols] = useState<Record<number, number>>({});
  const [bustedCell, setBustedCell] = useState<{ row: number; col: number } | null>(null);
  const [statusText, setStatusText] = useState(
    'Climb 9 vaulted floors. Reveal golden Dragon Eggs and cash out before triggering a trap.'
  );

  const cfg = TOWER_DIFFICULTY_CONFIGS[difficulty];
  const clearedRows = Object.keys(pickedCols).length - (phase === 'BUSTED' ? 1 : 0);
  const currentMult = calculateTowerMultiplier(difficulty, Math.max(0, clearedRows));
  const potentialPayout = Number((activeBet * currentMult).toFixed(2));

  const startClimb = () => {
    const effectiveBet = Math.min(bet, Math.max(1, Math.floor(balance)));
    if (balance < effectiveBet || !onWager(effectiveBet)) {
      setStatusText('Insufficient bankroll for this tower climb.');
      return;
    }
    audioEngine.playChipPlace();
    setActiveBet(effectiveBet);
    setBoard(generateTowerBoard(difficulty));
    setCurrentRow(0);
    setPickedCols({});
    setBustedCell(null);
    setPhase('CLIMBING');
    setStatusText(`Floor 1 active (${cfg.label}). Pick a tile to begin your ascent.`);
  };

  const handleTileClick = (rowIdx: number, colIdx: number) => {
    if (phase !== 'CLIMBING' || rowIdx !== currentRow) return;

    const { updatedRow, isSafe } = resolveTowerStep(board[rowIdx], colIdx, rowIdx, modifiers);
    const nextBoard = board.map((r, idx) => (idx === rowIdx ? updatedRow : r));
    setBoard(nextBoard);
    setPickedCols((prev) => ({ ...prev, [rowIdx]: colIdx }));

    if (!isSafe) {
      setBustedCell({ row: rowIdx, col: colIdx });
      setPhase('BUSTED');
      audioEngine.playBust();
      setStatusText(`Skull Trap sprung on Floor ${rowIdx + 1}! Lost $${activeBet.toFixed(2)}.`);
      onSettleRound({
        gameId: 'tower',
        bet: activeBet,
        payout: 0,
        wasNearMiss: rowIdx >= 2,
      });
      return;
    }

    const nextCleared = rowIdx + 1;
    const nextMult = calculateTowerMultiplier(difficulty, nextCleared);
    audioEngine.playComboChime(rowIdx);

    if (nextCleared >= cfg.rows) {
      // Conquered Floor 9 summit!
      const summitPayout = Number((activeBet * nextMult).toFixed(2));
      setPhase('CASHED');
      onTriggerBurst('heavy');
      setStatusText(`SUMMIT CONQUERED! Floor 9 paid $${summitPayout.toFixed(2)} (${nextMult.toFixed(2)}x)!`);
      onSettleRound({
        gameId: 'tower',
        bet: activeBet,
        payout: summitPayout,
        celebrateTier: nextMult >= 35 ? 'JACKPOT' : nextMult >= 15 ? 'MEGA' : 'SUPER',
        celebrateLabel: 'DRAGON TOWER SUMMIT',
      });
    } else {
      setCurrentRow(nextCleared);
      if (nextCleared >= 3) onTriggerBurst('light');
      setStatusText(
        `Floor ${nextCleared} cleared (${nextMult.toFixed(2)}x · $${(activeBet * nextMult).toFixed(
          2
        )}). Climb higher or Cash Out!`
      );
    }
  };

  const handleAutoPick = () => {
    if (phase !== 'CLIMBING') return;
    const randomCol = Math.floor(Math.random() * cfg.cols);
    handleTileClick(currentRow, randomCol);
  };

  const handleCashOut = () => {
    if (phase !== 'CLIMBING' || clearedRows <= 0) return;
    setPhase('CASHED');
    const celebrateTier =
      currentMult >= 30
        ? 'JACKPOT'
        : currentMult >= 12
        ? 'MEGA'
        : currentMult >= 5
        ? 'SUPER'
        : currentMult >= 2.5
        ? 'BIG'
        : undefined;

    if (!celebrateTier) {
      audioEngine.playWinFanfare('WIN');
      onTriggerBurst('light');
    } else {
      onTriggerBurst('heavy');
    }

    setStatusText(`Cashed out at Floor ${clearedRows} for $${potentialPayout.toFixed(2)} (${currentMult.toFixed(2)}x)!`);
    onSettleRound({
      gameId: 'tower',
      bet: activeBet,
      payout: potentialPayout,
      celebrateTier,
      celebrateLabel: 'DRAGON TOWER ESCAPE',
    });
  };

  // Render rows top-down (Floor 9 at top, Floor 1 at bottom)
  const displayRows = Array.from({ length: cfg.rows }, (_, i) => cfg.rows - 1 - i);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#11161D] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold text-[#F9E7A8]">Dragon Tower</h2>
          <span className="text-xs text-slate-400">
            9-Floor Vault Ascent · Up to {calculateTowerMultiplier(difficulty, 9).toLocaleString()}x
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(Object.keys(TOWER_DIFFICULTY_CONFIGS) as DragonTowerDifficulty[]).map((diff) => (
            <button
              key={diff}
              type="button"
              disabled={phase === 'CLIMBING'}
              onClick={() => {
                audioEngine.playClick();
                setDifficulty(diff);
                setBoard(generateTowerBoard(diff));
                setPickedCols({});
                setBustedCell(null);
                setPhase('IDLE');
              }}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap disabled:opacity-45 ${
                difficulty === diff
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#F9E7A8]'
                  : 'border-slate-700 bg-[#0D1218] text-slate-300 hover:border-slate-500'
              }`}
            >
              {TOWER_DIFFICULTY_CONFIGS[diff].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tower Stage */}
      <div
        data-testid="dragon-tower-stage"
        className="grid grid-cols-1 gap-4 rounded-xl border border-[#D4AF37]/25 bg-[#0A0E14] p-4 sm:p-5 lg:grid-cols-[1fr_250px]"
      >
        {/* 9-Row Interactive Vault Grid */}
        <div className="flex flex-col gap-1.5">
          {displayRows.map((rowIdx) => {
            const rowMult = calculateTowerMultiplier(difficulty, rowIdx + 1);
            const isActiveRow = phase === 'CLIMBING' && currentRow === rowIdx;
            const isRevealedRow =
              phase === 'BUSTED' || phase === 'CASHED' || rowIdx < currentRow;
            const pickedCol = pickedCols[rowIdx];

            return (
              <div
                key={rowIdx}
                className={`grid items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                  isActiveRow
                    ? 'border border-[#ECCB63]/65 bg-[#1D170B]'
                    : 'border border-transparent bg-[#0D1219]/65'
                }`}
                style={{ gridTemplateColumns: `72px repeat(${cfg.cols}, minmax(0, 1fr))` }}
              >
                <div className="font-mono-num text-right pr-2 text-xs">
                  <div
                    className={`font-bold ${
                      isActiveRow
                        ? 'text-[#FEF08A]'
                        : rowIdx < currentRow
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {rowMult.toFixed(2)}x
                  </div>
                  <div className="text-[10px] text-slate-600">F{rowIdx + 1}</div>
                </div>

                {board[rowIdx].map((isSafe, colIdx) => {
                  const wasPicked = pickedCol === colIdx;
                  const isBustedHere = bustedCell?.row === rowIdx && bustedCell?.col === colIdx;
                  const showContent = isRevealedRow || wasPicked;

                  return (
                    <button
                      key={`${rowIdx}-${colIdx}`}
                      type="button"
                      disabled={!isActiveRow}
                      aria-label={`Floor ${rowIdx + 1} Tile ${colIdx + 1}`}
                      onClick={() => handleTileClick(rowIdx, colIdx)}
                      className={`flex h-11 items-center justify-center rounded-md border text-xs font-bold transition-all ${
                        isBustedHere
                          ? 'animate-tile-flip-3d border-rose-500 bg-rose-950/80 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                          : wasPicked && isSafe
                          ? 'animate-tile-flip-3d border-emerald-400/80 bg-emerald-950/60 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.28)]'
                          : showContent
                          ? isSafe
                            ? 'border-emerald-800/50 bg-[#0D1A16] text-emerald-500/75'
                            : 'border-rose-900/40 bg-[#180E12] text-rose-500/55'
                          : isActiveRow
                          ? 'border-[#D4AF37]/50 bg-[#181F2A] text-[#ECCB63] hover:border-[#FEF08A] hover:bg-[#242014] active:scale-95 cursor-pointer'
                          : 'border-slate-800/80 bg-[#10151D] text-slate-600'
                      }`}
                    >
                      {showContent ? (
                        isSafe ? (
                          <span className="flex items-center gap-1">
                            <Crown className="h-4 w-4" aria-hidden="true" />
                            {wasPicked && <span>SAFE</span>}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Skull className="h-4 w-4" aria-hidden="true" />
                            {isBustedHere && <span>TRAP</span>}
                          </span>
                        )
                      ) : isActiveRow ? (
                        <Flame className="h-4 w-4 opacity-80" aria-hidden="true" />
                      ) : (
                        <span className="h-1.5 w-6 rounded-full bg-slate-800" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Right Telemetry & Tactical Climb Controls */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#11161D] p-4">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-semibold text-slate-200">Ascent Telemetry</span>
              <span className="font-mono-num text-[#ECCB63]">Floor {Math.min(9, currentRow + 1)}/9</span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#090C10] p-3">
              <div className="text-[11px] text-slate-400">Current Multiplier</div>
              <div className="font-mono-num mt-0.5 text-2xl font-black text-[#FEF08A]">
                {currentMult.toFixed(2)}x
              </div>
              <div className="font-mono-num mt-1 text-emerald-400">
                Cash-Out Value: ${potentialPayout.toFixed(2)}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#090C10] p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Next Floor Target</span>
                <span className="font-mono-num text-slate-200">
                  {calculateTowerMultiplier(difficulty, Math.min(9, clearedRows + 1)).toFixed(2)}x
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Safe Odds / Floor</span>
                <span className="font-mono-num text-sky-300">
                  {Math.round((cfg.safePerRow / cfg.cols) * 100)}%
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>House Edge Shift</span>
                <span
                  className={`font-mono-num font-bold ${
                    modifiers.winBias < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {modifiers.winBias >= 0 ? '+' : ''}
                  {(modifiers.winBias * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-300">{statusText}</p>
          </div>

          <div className="space-y-2">
            {phase === 'CLIMBING' && (
              <>
                <button
                  type="button"
                  onClick={handleAutoPick}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1218] py-2.5 text-xs font-bold text-slate-200 hover:border-[#D4AF37]"
                >
                  <Wand2 className="h-3.5 w-3.5 text-[#ECCB63]" aria-hidden="true" />
                  <span>Auto-Pick Floor {currentRow + 1}</span>
                </button>
                <button
                  type="button"
                  disabled={clearedRows <= 0}
                  onClick={handleCashOut}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-3 text-xs font-black text-[#05140E] hover:bg-emerald-400 disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {clearedRows > 0
                      ? `Cash Out $${potentialPayout.toFixed(2)}`
                      : 'Clear Floor 1 to Cash Out'}
                  </span>
                </button>
              </>
            )}

            {modifiers.winBias < -0.1 && (
              <div className="flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-950/35 px-2.5 py-2 text-[10px] text-rose-200">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                <span>Predator Harvest active — upper floors carry elevated trap pressure.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wager Bar */}
      <WagerBar
        bet={bet}
        balance={balance}
        disabled={phase === 'CLIMBING'}
        onChangeBet={setBet}
        actionLabel={phase === 'CLIMBING' ? 'Climb In Progress...' : 'Start Tower Climb'}
        onAction={startClimb}
        actionDisabled={phase === 'CLIMBING'}
      />
    </div>
  );
};
