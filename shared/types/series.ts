/**
 * Ranked BO3 Series Types
 * 
 * TypeScript interfaces and constants for the Ranked Best-of-3 system.
 * Requirements: 9.1, 9.2
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Rank names as specified in design document
 */
export type Rank = 'vo_danh' | 'tan_ky' | 'hoc_ky' | 'ky_lao' | 'cao_ky' | 'ky_thanh' | 'truyen_thuyet';

/**
 * Rank thresholds - MP required to reach each rank
 * Requirements: 5.1
 */
export const RANK_THRESHOLDS: Record<Rank, number> = {
  vo_danh: 0,
  tan_ky: 50,
  hoc_ky: 200,
  ky_lao: 600,
  cao_ky: 1500,
  ky_thanh: 3000,
  truyen_thuyet: 5500,
};

/**
 * Rank numeric values for comparison
 */
export const RANK_VALUES: Record<Rank, number> = {
  vo_danh: 0,
  tan_ky: 1,
  hoc_ky: 2,
  ky_lao: 3,
  cao_ky: 4,
  ky_thanh: 5,
  truyen_thuyet: 6,
};

/**
 * Rank display info (names and colors)
 */
export const RANK_DISPLAY: Record<Rank, { name: string; nameVi: string; color: string; icon: string }> = {
  vo_danh: { name: 'Unknown', nameVi: 'Vô Danh', color: '#808080', icon: '⚪' },
  tan_ky: { name: 'Novice', nameVi: 'Tân Kỳ', color: '#CD7F32', icon: '🥉' },
  hoc_ky: { name: 'Student', nameVi: 'Học Kỳ', color: '#C0C0C0', icon: '🥈' },
  ky_lao: { name: 'Veteran', nameVi: 'Kỳ Lão', color: '#FFD700', icon: '🥇' },
  cao_ky: { name: 'Expert', nameVi: 'Cao Kỳ', color: '#E5E4E2', icon: '💎' },
  ky_thanh: { name: 'Master', nameVi: 'Kỳ Thánh', color: '#9B59B6', icon: '👑' },
  truyen_thuyet: { name: 'Legend', nameVi: 'Truyền Thuyết', color: '#E74C3C', icon: '🏆' },
};

/**
 * MP reward constants
 * Requirements: 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const MP_REWARDS = {
  BASE_WIN: 20,           // Base MP for winning (Req 4.1)
  SWEEP_BONUS: 10,        // Bonus for 2-0 sweep (Req 4.2)
  TIME_BONUS: 5,          // Bonus for faster average move time (Req 4.3)
  RANK_DIFF_UP_MULT: 5,   // MP per rank when beating higher rank (Req 4.4)
  RANK_DIFF_DOWN_MULT: 3, // MP reduction per rank when beating lower rank (Req 4.5)
  MIN_WIN_MP: 5,          // Minimum MP for winner (Req 4.5)
  MAX_WIN_MP: 50,         // Maximum MP for winner (Req 3.3)
  LOSS_PENALTY: -15,      // Fixed loss penalty (Req 3.4)
  ABANDON_PENALTY: -25,   // Penalty for abandoning (-15 standard + -10 abandon) (Req 7.5)
} as const;

/**
 * Coin reward constants
 * Requirements: 6.2, 6.3
 */
export const COIN_REWARDS = {
  WINNER_BASE: 50,        // Base coins for winner (Req 6.2)
  WINNER_PER_GAME: 10,    // Additional coins per game won (Req 6.2)
  LOSER_FIXED: 20,        // Fixed coins for loser (Req 6.3)
} as const;

/**
 * EXP reward constants
 * Requirements: 6.4
 */
export const EXP_REWARDS = {
  WINNER: 100,
  LOSER: 40,
} as const;

/**
 * Timing constants
 * Requirements: 7.1, 7.2, 8.5, 10.3
 */
export const TIMING = {
  DISCONNECT_TIMEOUT_MS: 60000,   // 60 seconds to reconnect (Req 7.1)
  NEXT_GAME_COUNTDOWN_S: 10,      // 10 seconds between games (Req 8.5)
  REMATCH_TIMEOUT_S: 15,          // 15 seconds to accept rematch (Req 10.3)
} as const;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Player side in a game
 */
export type PlayerSide = 'X' | 'O';

/**
 * Series status
 */
export type SeriesStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * Game result within a series
 * Requirements: 9.2
 */
export interface GameResult {
  matchId: string;
  seriesId: string;
  gameNumber: 1 | 2 | 3;
  winnerId: string;
  loserId: string;
  totalMoves: number;
  durationSeconds: number;
  winCondition: string;
}

/**
 * Full series data model
 * Requirements: 9.1, 9.2, 9.3
 */
export interface Series {
  id: string;
  player1Id: string;
  player2Id: string;
  player1InitialMP: number;
  player2InitialMP: number;
  player1InitialRank: Rank;
  player2InitialRank: Rank;
  player1Wins: number;
  player2Wins: number;
  gamesToWin: number;  // Always 2 for BO3
  currentGame: number; // 1, 2, or 3
  player1Side: PlayerSide;
  player2Side: PlayerSide;
  status: SeriesStatus;
  winnerId?: string;
  finalScore?: string;
  winnerMPChange?: number;
  loserMPChange?: number;
  winnerCoins?: number;
  loserCoins?: number;
  winnerExp?: number;
  loserExp?: number;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

/**
 * Series state for real-time updates
 */
export interface SeriesState {
  series: Series;
  games: GameResult[];
  isComplete: boolean;
  nextGameReady: boolean;
}

/**
 * Series result with all rewards
 * Requirements: 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 9.3
 */
export interface SeriesResult {
  series: Series;
  winnerId: string;
  loserId: string;
  finalScore: string;
  games: GameResult[];
  rewards: {
    winner: { mp: number; coins: number; exp: number };
    loser: { mp: number; coins: number; exp: number };
  };
  rankChanges: RankChange[];
}

/**
 * Rank change event
 * Requirements: 5.2, 5.3, 5.4
 */
export interface RankChange {
  playerId: string;
  oldRank: Rank;
  newRank: Rank;
  newMP: number;
}

/**
 * Disconnect state for a player
 * Requirements: 7.1, 7.2
 */
export interface DisconnectState {
  playerId: string;
  disconnectedAt: Date;
  timeoutAt: Date;
  isReconnected: boolean;
}

/**
 * Rematch request
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export interface RematchRequest {
  seriesId: string;
  requesterId: string;
  requestedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get rank from MP value
 * Requirements: 5.1
 */
export function getRankFromMP(mp: number): Rank {
  const ranks: Rank[] = ['truyen_thuyet', 'ky_thanh', 'cao_ky', 'ky_lao', 'hoc_ky', 'tan_ky', 'vo_danh'];
  for (const rank of ranks) {
    if (mp >= RANK_THRESHOLDS[rank]) {
      return rank;
    }
  }
  return 'vo_danh';
}

/**
 * Get MP needed for next rank
 */
export function getMPForNextRank(currentRank: Rank): number | null {
  const ranks: Rank[] = ['vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 'cao_ky', 'ky_thanh', 'truyen_thuyet'];
  const currentIndex = ranks.indexOf(currentRank);
  if (currentIndex === ranks.length - 1) return null; // Already max rank
  return RANK_THRESHOLDS[ranks[currentIndex + 1]];
}

/**
 * Calculate rank difference (positive = opponent higher rank)
 */
export function getRankDifference(playerRank: Rank, opponentRank: Rank): number {
  return RANK_VALUES[opponentRank] - RANK_VALUES[playerRank];
}

/**
 * Get opposite side
 */
export function getOppositeSide(side: PlayerSide): PlayerSide {
  return side === 'X' ? 'O' : 'X';
}
