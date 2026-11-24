import type { DirectorModifiers, DirectorState, RelicBonuses } from '../engine/mlDirector';
import type { HouseMindState, RitualSignalType, SpinSpeedMultiplier } from '../engine/houseMind';

export type GameId =
  | 'slots'
  | 'holdwin'
  | 'plinko'
  | 'crash'
  | 'roulette'
  | 'mines'
  | 'tower'
  | 'limbo'
  | 'blackjack'
  | 'baccarat'
  | 'poker'
  | 'hilo'
  | 'keno'
  | 'dice'
  | 'coinflip'
  | 'wheel'
  | 'analytics'
  | 'vault';

export type WinTier = 'BIG' | 'SUPER' | 'MEGA' | 'JACKPOT';

export interface WinCelebration {
  id: number;
  amount: number;
  multiplier: number;
  tier: WinTier;
  label: string;
}

export interface WinFlare {
  id: number;
  amount: number;
  multiplier: number;
}

export interface GameCommonProps {
  balance: number;
  modifiers: DirectorModifiers;
  directorState: DirectorState;
  relicBonuses: RelicBonuses;
  houseMind: HouseMindState;
  onWager: (amount: number) => boolean;
  onSettleRound: (params: {
    gameId: string;
    bet: number;
    payout: number;
    wasNearMiss?: boolean;
    celebrateTier?: WinTier;
    celebrateLabel?: string;
    turboActive?: boolean;
    autoSpinActive?: boolean;
    spinSpeedMultiplier?: SpinSpeedMultiplier;
  }) => void;
  onTriggerBurst: (intensity: 'light' | 'heavy') => void;
  onRitualSignal?: (
    type: RitualSignalType,
    detail: string,
    meta?: {
      turboActive?: boolean;
      autoSpinActive?: boolean;
      spinSpeedMultiplier?: SpinSpeedMultiplier;
    }
  ) => void;
}
