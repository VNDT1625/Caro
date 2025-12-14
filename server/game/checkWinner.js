// Minimal JS port of the checkWinner algorithm used by frontend/backend.
// board: object with keys like "x_y" -> 'X'|'O'
function checkWinner(board) {
  if (!board || Object.keys(board).length === 0) return null;

  const positions = { X: new Set(), O: new Set() };
  for (const k of Object.keys(board)) {
    const v = board[k];
    if (v === 'X' || v === 'O') positions[v].add(k);
  }

  const dirs = [ [1,0], [0,1], [1,1], [1,-1] ];
  for (const player of ['X','O']) {
    const set = positions[player];
    for (const key of set) {
      const [xs, ys] = key.split('_');
      const x0 = parseInt(xs,10); const y0 = parseInt(ys,10);
      for (const d of dirs) {
        const dx = d[0], dy = d[1];
        let count = 1;
        let i = 1;
        while (set.has(`${x0 + dx*i}_${y0 + dy*i}`)) { count++; i++; }
        i = 1;
        while (set.has(`${x0 - dx*i}_${y0 - dy*i}`)) { count++; i++; }
        if (count >= 5) return player;
      }
    }
  }

  return null;
}

/**
 * Series event types for BO3 ranked matches
 * Requirements: 2.1, 2.4, 2.5
 */
const SeriesEvents = {
  GAME_ENDED: 'series_game_ended',
  SERIES_COMPLETED: 'series_completed',
  SIDE_SWAPPED: 'series_side_swapped',
  NEXT_GAME_READY: 'series_next_game_ready',
  SCORE_UPDATED: 'series_score_updated'
};

/**
 * Create series event payload for game end
 * Requirements: 2.1, 2.3
 * 
 * @param {Object} params Event parameters
 * @param {string} params.seriesId Series UUID
 * @param {string} params.matchId Match UUID
 * @param {string|null} params.winnerId Winner UUID (null for draw)
 * @param {number} params.gameNumber Current game number (1, 2, or 3)
 * @param {Object} params.score Current series score {player1: number, player2: number}
 * @param {boolean} params.isSeriesComplete Whether series is now complete
 * @returns {Object} Event payload
 */
function createGameEndedEvent({ seriesId, matchId, winnerId, gameNumber, score, isSeriesComplete }) {
  return {
    type: SeriesEvents.GAME_ENDED,
    seriesId,
    matchId,
    winnerId,
    gameNumber,
    score: `${score.player1}-${score.player2}`,
    isSeriesComplete,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create series event payload for series completion
 * Requirements: 3.1
 * 
 * @param {Object} params Event parameters
 * @param {string} params.seriesId Series UUID
 * @param {string} params.winnerId Series winner UUID
 * @param {string} params.loserId Series loser UUID
 * @param {string} params.finalScore Final score (e.g., "2-1")
 * @param {Object} params.rewards Rewards for winner and loser
 * @returns {Object} Event payload
 */
function createSeriesCompletedEvent({ seriesId, winnerId, loserId, finalScore, rewards }) {
  return {
    type: SeriesEvents.SERIES_COMPLETED,
    seriesId,
    winnerId,
    loserId,
    finalScore,
    rewards,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create series event payload for side swap
 * Requirements: 2.4
 * 
 * @param {Object} params Event parameters
 * @param {string} params.seriesId Series UUID
 * @param {number} params.nextGameNumber Next game number
 * @param {Object} params.newSides New player sides {player1: 'X'|'O', player2: 'X'|'O'}
 * @returns {Object} Event payload
 */
function createSideSwappedEvent({ seriesId, nextGameNumber, newSides }) {
  return {
    type: SeriesEvents.SIDE_SWAPPED,
    seriesId,
    nextGameNumber,
    player1Side: newSides.player1,
    player2Side: newSides.player2,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create series event payload for next game ready
 * Requirements: 2.5
 * 
 * @param {Object} params Event parameters
 * @param {string} params.seriesId Series UUID
 * @param {number} params.gameNumber Next game number
 * @param {Object} params.playerSides Player sides for next game
 * @param {string} params.currentScore Current series score
 * @returns {Object} Event payload
 */
function createNextGameReadyEvent({ seriesId, gameNumber, playerSides, currentScore }) {
  return {
    type: SeriesEvents.NEXT_GAME_READY,
    seriesId,
    gameNumber,
    player1Side: playerSides.player1,
    player2Side: playerSides.player2,
    currentScore,
    countdownSeconds: 10, // 10 second countdown before next game
    timestamp: new Date().toISOString()
  };
}

/**
 * Create series event payload for score update
 * Requirements: 2.1, 2.3
 * 
 * @param {Object} params Event parameters
 * @param {string} params.seriesId Series UUID
 * @param {Object} params.score Current score {player1: number, player2: number}
 * @param {number} params.gameNumber Game that just ended
 * @returns {Object} Event payload
 */
function createScoreUpdatedEvent({ seriesId, score, gameNumber }) {
  return {
    type: SeriesEvents.SCORE_UPDATED,
    seriesId,
    score: `${score.player1}-${score.player2}`,
    player1Wins: score.player1,
    player2Wins: score.player2,
    gamesPlayed: gameNumber,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process game end in a series and generate appropriate events
 * Requirements: 2.1, 2.4, 2.5
 * 
 * @param {Object} params Parameters
 * @param {Object} params.seriesState Current series state from backend
 * @param {string} params.matchId Match UUID
 * @param {string|null} params.winnerId Game winner UUID
 * @returns {Object[]} Array of events to emit
 */
function processSeriesGameEnd({ seriesState, matchId, winnerId }) {
  const events = [];
  const series = seriesState.series;
  const isComplete = seriesState.isComplete;

  // Always emit game ended event
  events.push(createGameEndedEvent({
    seriesId: series.id,
    matchId,
    winnerId,
    gameNumber: series.current_game,
    score: {
      player1: series.player1_wins,
      player2: series.player2_wins
    },
    isSeriesComplete: isComplete
  }));

  // Emit score updated event
  events.push(createScoreUpdatedEvent({
    seriesId: series.id,
    score: {
      player1: series.player1_wins,
      player2: series.player2_wins
    },
    gameNumber: series.current_game
  }));

  if (isComplete) {
    // Series is complete - emit completion event
    const seriesWinnerId = series.winner_id;
    const seriesLoserId = seriesWinnerId === series.player1_id 
      ? series.player2_id 
      : series.player1_id;

    events.push(createSeriesCompletedEvent({
      seriesId: series.id,
      winnerId: seriesWinnerId,
      loserId: seriesLoserId,
      finalScore: series.final_score,
      rewards: seriesState.rewards || null
    }));
  } else if (seriesState.nextGameReady) {
    // Series continues - emit side swap and next game ready events
    events.push(createSideSwappedEvent({
      seriesId: series.id,
      nextGameNumber: series.current_game,
      newSides: {
        player1: series.player1_side,
        player2: series.player2_side
      }
    }));

    events.push(createNextGameReadyEvent({
      seriesId: series.id,
      gameNumber: series.current_game,
      playerSides: {
        player1: series.player1_side,
        player2: series.player2_side
      },
      currentScore: `${series.player1_wins}-${series.player2_wins}`
    }));
  }

  return events;
}

/**
 * Get player side for a specific player in a series
 * 
 * @param {Object} series Series data
 * @param {string} playerId Player UUID
 * @returns {string|null} 'X' or 'O', or null if player not in series
 */
function getPlayerSideInSeries(series, playerId) {
  if (playerId === series.player1_id) {
    return series.player1_side;
  } else if (playerId === series.player2_id) {
    return series.player2_side;
  }
  return null;
}

/**
 * Get the player who should play X in the current game
 * 
 * @param {Object} series Series data
 * @returns {string} Player UUID who plays X
 */
function getXPlayerInSeries(series) {
  return series.player1_side === 'X' ? series.player1_id : series.player2_id;
}

/**
 * Get the player who should play O in the current game
 * 
 * @param {Object} series Series data
 * @returns {string} Player UUID who plays O
 */
function getOPlayerInSeries(series) {
  return series.player1_side === 'O' ? series.player1_id : series.player2_id;
}

module.exports = { 
  checkWinner,
  SeriesEvents,
  createGameEndedEvent,
  createSeriesCompletedEvent,
  createSideSwappedEvent,
  createNextGameReadyEvent,
  createScoreUpdatedEvent,
  processSeriesGameEnd,
  getPlayerSideInSeries,
  getXPlayerInSeries,
  getOPlayerInSeries
};
