// Game logic module - Server authority
// Requirements: 2.1, 2.4, 2.5 - Game Engine integration with Series
const { createClient } = require('@supabase/supabase-js');
const fetch = global.fetch || require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PHP_BACKEND_API = process.env.PHP_BACKEND_URL || 'http://localhost:8001';

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

/**
 * End game in series via PHP backend
 * Requirements: 2.1
 */
async function endGameInSeriesBackend(seriesId, matchId, winnerId, gameDuration) {
  try {
    const res = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}/end-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        match_id: matchId, 
        winner_id: winnerId, 
        game_duration: gameDuration 
      })
    });
    if (res.ok) {
      return await res.json();
    }
    console.error('Failed to end game in series:', await res.text());
    return null;
  } catch (err) {
    console.error('endGameInSeriesBackend error:', err.message);
    return null;
  }
}

// Check winner on 15x15 board
function checkWinner(board, lastX, lastY) {
  const player = board[lastY]?.[lastX];
  if (!player) return null;

  const directions = [
    [1, 0],   // horizontal
    [0, 1],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ];

  for (const [dx, dy] of directions) {
    let count = 1;

    // Check forward
    for (let i = 1; i < 5; i++) {
      const nx = lastX + dx * i;
      const ny = lastY + dy * i;
      if (ny < 0 || ny >= 15 || nx < 0 || nx >= 15) break;
      if (board[ny]?.[nx] !== player) break;
      count++;
    }

    // Check backward
    for (let i = 1; i < 5; i++) {
      const nx = lastX - dx * i;
      const ny = lastY - dy * i;
      if (ny < 0 || ny >= 15 || nx < 0 || nx >= 15) break;
      if (board[ny]?.[nx] !== player) break;
      count++;
    }

    if (count >= 5) return player;
  }

  return null;
}

// Make a move (server validates everything)
async function makeMove(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const { roomId, x, y } = req.body;
    const userId = req.user.id;

    console.log('🎮 Move request:', { roomId, x, y, userId });

    // 1. Get room and current game state
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('game_state, status')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.status === 'finished') {
      return res.status(400).json({ error: 'Game already finished' });
    }

    // 2. Get player info
    const { data: roomPlayer } = await supabaseAdmin
      .from('room_players')
      .select('player_side')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (!roomPlayer) {
      return res.status(403).json({ error: 'You are not in this room' });
    }

    const playerSymbol = roomPlayer.player_side;
    const gameState = room.game_state || {
      board: Array(15).fill(null).map(() => Array(15).fill(null)),
      moves: [],
      currentTurn: 'X',
      currentGame: 1,
      scores: { X: 0, O: 0 },
      totalTimeX: 300,
      totalTimeO: 300,
      gameStartedAt: new Date().toISOString(),
      lastMoveAt: null
    };

    // 3. Validate turn
    if (gameState.currentTurn !== playerSymbol) {
      console.log('❌ Not your turn:', gameState.currentTurn, 'vs', playerSymbol);
      return res.status(400).json({ 
        error: 'Not your turn',
        currentTurn: gameState.currentTurn,
        yourSymbol: playerSymbol
      });
    }

    // 4. Validate position
    if (x < 0 || x >= 15 || y < 0 || y >= 15) {
      return res.status(400).json({ error: 'Invalid position' });
    }

    if (gameState.board[y][x] !== null) {
      return res.status(400).json({ error: 'Cell already occupied' });
    }

    // 5. Apply move
    const newBoard = gameState.board.map(row => [...row]);
    newBoard[y][x] = playerSymbol;

    const newMove = { x, y, player: playerSymbol, timestamp: Date.now() };
    const newMoves = [...gameState.moves, newMove];

    // 6. Check winner
    const winner = checkWinner(newBoard, x, y);
    console.log('🏆 Winner check:', winner);

    // 7. Update game state
    const nextTurn = winner ? gameState.currentTurn : (playerSymbol === 'X' ? 'O' : 'X');
    
    const newState = {
      ...gameState,
      board: newBoard,
      moves: newMoves,
      currentTurn: nextTurn,
      lastMoveAt: new Date().toISOString()
    };

    // 8. Save to database
    const { error: updateError } = await supabaseAdmin
      .from('rooms')
      .update({ game_state: newState })
      .eq('id', roomId);

    if (updateError) {
      console.error('❌ Failed to update room:', updateError);
      return res.status(500).json({ error: 'Failed to save move' });
    }

    // 9. Save move record and get match info
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('id, series_id, game_number')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (match) {
      await supabaseAdmin
        .from('moves')
        .insert({
          match_id: match.id,
          player_user_id: userId,
          move_number: newMoves.length,
          position_x: x,
          position_y: y,
          turn_player: playerSymbol,
          is_winning_move: !!winner
        });
    }

    console.log('✅ Move successful:', { x, y, player: playerSymbol, nextTurn });

    // 10. Handle series game end if this is a ranked match (Requirements: 2.1, 2.4, 2.5)
    let seriesResult = null;
    if (winner && match?.series_id) {
      const gameDuration = gameState.gameStartedAt 
        ? Math.floor((Date.now() - new Date(gameState.gameStartedAt).getTime()) / 1000)
        : 0;
      
      console.log('🏆 Series game ended:', { seriesId: match.series_id, winner, userId, gameDuration });
      
      // Call backend to end game in series
      seriesResult = await endGameInSeriesBackend(match.series_id, match.id, userId, gameDuration);
      
      if (seriesResult) {
        console.log('📊 Series result:', {
          isComplete: seriesResult.isComplete,
          score: `${seriesResult.series?.player1_wins}-${seriesResult.series?.player2_wins}`,
          nextGameReady: seriesResult.nextGameReady
        });
      }
    }

    // 11. Return updated state with series info
    const response = {
      success: true,
      gameState: newState,
      winner,
      nextTurn
    };

    // Add series info if available
    if (seriesResult) {
      response.series = {
        id: match.series_id,
        isComplete: seriesResult.isComplete,
        score: `${seriesResult.series?.player1_wins || 0}-${seriesResult.series?.player2_wins || 0}`,
        nextGameReady: seriesResult.nextGameReady,
        currentGame: seriesResult.series?.current_game,
        player1Side: seriesResult.series?.player1_side,
        player2Side: seriesResult.series?.player2_side,
        rewards: seriesResult.rewards || null
      };
    }

    res.json(response);

  } catch (error) {
    console.error('💥 Move error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get current game state
async function getGameState(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const { roomId } = req.params;

    const { data: room, error } = await supabaseAdmin
      .from('rooms')
      .select('game_state, status')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      gameState: room.game_state,
      status: room.status
    });

  } catch (error) {
    console.error('Get state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get series state for a room
 * Requirements: 2.5
 */
async function getSeriesStateForRoom(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const { roomId } = req.params;

    // Get match with series info
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, series_id, game_number')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (matchError || !match || !match.series_id) {
      return res.status(404).json({ error: 'No series found for this room' });
    }

    // Get series state from PHP backend
    try {
      const seriesRes = await fetch(`${PHP_BACKEND_API}/api/series/${match.series_id}`);
      if (seriesRes.ok) {
        const seriesData = await seriesRes.json();
        return res.json({
          seriesId: match.series_id,
          gameNumber: match.game_number,
          series: seriesData.series || seriesData,
          isComplete: seriesData.isComplete || false,
          nextGameReady: seriesData.nextGameReady || false
        });
      }
    } catch (err) {
      console.error('Failed to get series state:', err.message);
    }

    return res.status(500).json({ error: 'Failed to get series state' });

  } catch (error) {
    console.error('Get series state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Prepare next game in series - reset board and swap sides
 * Requirements: 2.4, 2.5
 */
async function prepareNextSeriesGame(req, res) {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const { roomId } = req.params;
    const { seriesId } = req.body;

    if (!seriesId) {
      return res.status(400).json({ error: 'seriesId is required' });
    }

    // Get series state from PHP backend
    let seriesData;
    try {
      const seriesRes = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}`);
      if (seriesRes.ok) {
        seriesData = await seriesRes.json();
      } else {
        return res.status(404).json({ error: 'Series not found' });
      }
    } catch (err) {
      console.error('Failed to get series state:', err.message);
      return res.status(500).json({ error: 'Failed to get series state' });
    }

    const series = seriesData.series || seriesData;

    if (seriesData.isComplete) {
      return res.status(400).json({ error: 'Series is already complete' });
    }

    // Reset game state for next game
    const newGameState = {
      board: Array(15).fill(null).map(() => Array(15).fill(null)),
      moves: [],
      currentTurn: 'X', // X always starts
      currentGame: series.current_game,
      scores: { X: 0, O: 0 },
      totalTimeX: 300,
      totalTimeO: 300,
      gameStartedAt: new Date().toISOString(),
      lastMoveAt: null,
      seriesId: seriesId,
      player1Side: series.player1_side,
      player2Side: series.player2_side
    };

    // Update room with new game state
    const { error: updateError } = await supabaseAdmin
      .from('rooms')
      .update({ 
        game_state: newGameState,
        status: 'playing'
      })
      .eq('id', roomId);

    if (updateError) {
      console.error('Failed to update room for next game:', updateError);
      return res.status(500).json({ error: 'Failed to prepare next game' });
    }

    // Update room_players with new sides
    const { data: roomPlayers } = await supabaseAdmin
      .from('room_players')
      .select('user_id')
      .eq('room_id', roomId);

    if (roomPlayers) {
      for (const player of roomPlayers) {
        let newSide;
        if (player.user_id === series.player1_id) {
          newSide = series.player1_side;
        } else if (player.user_id === series.player2_id) {
          newSide = series.player2_side;
        }

        if (newSide) {
          await supabaseAdmin
            .from('room_players')
            .update({ player_side: newSide })
            .eq('room_id', roomId)
            .eq('user_id', player.user_id);
        }
      }
    }

    // Create new match record for this game
    const { data: newMatch, error: matchError } = await supabaseAdmin
      .from('matches')
      .insert({
        room_id: roomId,
        series_id: seriesId,
        game_number: series.current_game,
        status: 'in_progress'
      })
      .select()
      .single();

    if (matchError) {
      console.error('Failed to create match for next game:', matchError);
    }

    console.log('✅ Next game prepared:', { 
      roomId, 
      seriesId, 
      gameNumber: series.current_game,
      player1Side: series.player1_side,
      player2Side: series.player2_side
    });

    res.json({
      success: true,
      gameState: newGameState,
      series: {
        id: seriesId,
        currentGame: series.current_game,
        score: `${series.player1_wins}-${series.player2_wins}`,
        player1Side: series.player1_side,
        player2Side: series.player2_side
      },
      matchId: newMatch?.id
    });

  } catch (error) {
    console.error('Prepare next game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  makeMove,
  getGameState,
  checkWinner,
  getSeriesStateForRoom,
  prepareNextSeriesGame,
  endGameInSeriesBackend
};
