import type { DirectorModifiers, DirectorState } from '../engine/mlDirector';
import type { RelicBonuses } from '../engine/mlDirector';

export type GameId =
  | 'slots'
  | 'plinko'
  | 'crash'
  | 'roulette'
  | 'mines'
  | 'blackjack'
  | 'dice'
  | 'wheel'
  | 'analytics'
  | 'vault';

export interface WinCelebration {
  id: number;
  amount: number;
  multiplier: number;
  tier: 'BIG' | 'SUPER' | 'MEGA';
  label: string;
}

export interface GameCommonProps {
  balance: number;
  modifiers: DirectorModifiers;
  directorState: DirectorState;
  relicBonuses: RelicBonuses;
  onWager: (amount: number) => boolean;
  onSettleRound: (params: {
    gameId: string;
    bet: number;
    payout: number;
    wasNearMiss?: boolean;
    celebrateTier?: 'BIG' | 'SUPER' | 'MEGA';
    celebrateLabel?: string;
  }) => void;
  onTriggerBurst: (intensity: 'light' | 'heavy') => void;
}
