// Game logic module - Server authority
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

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

    // 9. Save move record
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('id')
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

    // 10. Return updated state
    res.json({
      success: true,
      gameState: newState,
      winner,
      nextTurn
    });

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

module.exports = {
  makeMove,
  getGameState,
  checkWinner
};
