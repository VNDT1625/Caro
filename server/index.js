const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const { registerFriendRoutes } = require('./friends');
const { checkWinner } = require('./game/checkWinner');
const fetch = global.fetch || require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;

async function verifySupabaseToken(token) {
  if (!token || !SUPABASE_URL) {
    console.log('⚠️ Missing token or SUPABASE_URL');
    return null;
  }
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;
    console.log('🌐 Verifying token at:', url);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {})
      }
    });
    
    console.log('📡 Supabase auth response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.log('❌ Supabase auth failed:', errorText);
      return null;
    }
    
    const data = await res.json();
    console.log('✅ Token verified successfully');
    return data;
  } catch (err) {
    console.error('💥 verifySupabaseToken error', err);
    return null;
  }
}

const app = express();

// CORS middleware to allow frontend calls
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL.replace(/\/$/, ''), SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
} else {
  console.warn('Supabase admin client not configured - friend APIs disabled');
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  console.log('🔐 Auth middleware:', req.method, req.url, 'has auth header:', !!header);
  
  if (!header.startsWith('Bearer ')) {
    console.log('❌ No Bearer token in header');
    return res.status(401).json({ error: 'Thiếu token xác thực' });
  }
  const token = header.slice(7);
  console.log('🔑 Token received (length):', token.length);
  
  try {
    const user = await verifySupabaseToken(token);
    console.log('👤 Verified user:', user ? user.id : 'null');
    
    if (!user || !user.id) {
      console.log('❌ Token verification failed');
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    req.user = user;
    console.log('✅ Auth successful for user:', user.id);
    return next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(500).json({ error: 'Không thể xác thực' });
  }
}

// In-memory rooms: { roomId: { board: {}, players: [], moves: [], started_at: timestamp } }
const rooms = {};
const BACKEND_API = process.env.BACKEND_API_URL || 'http://localhost:8000';

async function postMatchReplay(replay) {
  try {
    const res = await fetch(BACKEND_API + '/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replay),
      timeout: 5000
    });
    return res.ok;
  } catch (err) {
    console.error('postMatchReplay error', err);
    return false;
  }
}

// Simple matchmaking queue (in-memory) per mode
const matchmaking = {
  queues: {} // mode -> [socketId,...]
};

// Simple store items (mock)
const storeItems = [
  { id: 'skin-001', name: 'Cherry Skin', price: 100 },
  { id: 'board-wood', name: 'Wooden Board', price: 200 }
];

// Express endpoints for store (mock)
app.get('/store/items', (req, res) => {
  res.json(storeItems);
});

app.post('/store/purchase', (req, res) => {
  const { userId, itemId } = req.body || {};
  if (!userId || !itemId) return res.status(400).json({ error: 'userId and itemId required' });
  const item = storeItems.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  // mock success
  res.json({ ok: true, purchased: item, userId });
});

registerFriendRoutes(app, { supabaseAdmin, requireAuth: authMiddleware });

// =====================================================================
// CHAT API ENDPOINTS
// =====================================================================

// Fetch chat history
app.get('/api/chat/history', authMiddleware, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Chat service unavailable' });
    }

    const { channel, room_id, limit = 20, cursor } = req.query;
    let query = supabaseAdmin
      .from('chat_messages')
      .select('*, sender_profile:profiles!sender_user_id(display_name, username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (room_id) {
      query = query.eq('room_id', room_id);
    } else if (channel) {
      query = query.eq('channel_scope', channel);
    }

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Chat history error:', error);
      return res.status(500).json({ error: 'Failed to fetch chat history' });
    }

    // Format messages
    const messages = (data || []).reverse().map(msg => ({
      id: msg.id,
      sender_user_id: msg.sender_user_id,
      room_id: msg.room_id,
      match_id: msg.match_id,
      message_type: msg.message_type,
      content: msg.content,
      channel_scope: msg.channel_scope,
      created_at: msg.created_at,
      sender_profile: msg.sender_profile
    }));

    const nextCursor = messages.length > 0 ? messages[0].created_at : null;

    res.json({ messages, nextCursor });
  } catch (err) {
    console.error('Chat history exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send chat message
app.post('/api/chat/send', authMiddleware, async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Chat service unavailable' });
    }

    const { content, message_type = 'text', room_id, channel = 'global' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > 300) {
      return res.status(400).json({ error: 'Message too long (max 300 characters)' });
    }

    const messageData = {
      sender_user_id: req.user.id,
      content: content.trim(),
      message_type: message_type,
      channel_scope: room_id ? 'room' : channel
    };

    if (room_id) {
      messageData.room_id = room_id;
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select('*, sender_profile:profiles!sender_user_id(display_name, username, avatar_url)')
      .single();

    if (error) {
      console.error('Chat send error:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }

    res.json({
      message: {
        id: data.id,
        sender_user_id: data.sender_user_id,
        room_id: data.room_id,
        match_id: data.match_id,
        message_type: data.message_type,
        content: data.content,
        channel_scope: data.channel_scope,
        created_at: data.created_at,
        sender_profile: data.sender_profile
      }
    });
  } catch (err) {
    console.error('Chat send exception:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================================
// END CHAT API
// =====================================================================

// =====================================================================
// GAME API ENDPOINTS
// =====================================================================
const gameLogic = require('./game');

// Make a move (server validates)
app.post('/api/game/move', authMiddleware, gameLogic.makeMove);

// Get current game state
app.get('/api/game/state/:roomId', authMiddleware, gameLogic.getGameState);

console.log('✅ Game API endpoints registered');

// =====================================================================
// END GAME API
// =====================================================================

io.use(async (socket, next) => {
  // Expect token in handshake.auth.token
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    const user = await verifySupabaseToken(token).catch(() => null);
    if (user && user.id) {
      socket.user = { id: user.id, email: user.email || null };
    }
  }
  return next();
});

io.on('connection', (socket) => {
  console.log('conn', socket.id, 'user=', socket.user ? socket.user.id : 'guest');

  socket.on('create_room', (roomId) => {
    rooms[roomId] = { board: {}, players: [], moves: [], started_at: new Date().toISOString() };
    socket.join(roomId);
    rooms[roomId].players.push({ socketId: socket.id, userId: socket.user ? socket.user.id : null });
    io.to(roomId).emit('room_state', rooms[roomId]);
  });

  socket.on('join_room', (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = { board: {}, players: [], moves: [], started_at: new Date().toISOString() };
    socket.join(roomId);
    rooms[roomId].players.push({ socketId: socket.id, userId: socket.user ? socket.user.id : null });
    io.to(roomId).emit('room_state', rooms[roomId]);
  });

  // Join matchmaking queue
  socket.on('join_queue', ({ mode = 'casual' } = {}) => {
    matchmaking.queues[mode] = matchmaking.queues[mode] || [];
    if (!matchmaking.queues[mode].includes(socket.id)) matchmaking.queues[mode].push(socket.id);
    // if two players available, match them
    if (matchmaking.queues[mode].length >= 2) {
      const a = matchmaking.queues[mode].shift();
      const b = matchmaking.queues[mode].shift();
      const roomId = Math.random().toString(36).slice(2,8);
      rooms[roomId] = { board: {}, players: [a,b] };
      io.to(a).emit('queue_matched', { roomId, opponent: b });
      io.to(b).emit('queue_matched', { roomId, opponent: a });
    } else {
      io.to(socket.id).emit('queue_waiting', { position: matchmaking.queues[mode].length });
    }
  });

  socket.on('move', ({ roomId, x, y, mark }) => {
    const r = rooms[roomId];
    if (!r) return;
    const key = `${x}_${y}`;
    if (r.board[key]) return; // occupied
    r.board[key] = mark;

    // record move with player_user_id if available
    const move = {
      x,
      y,
      mark,
      player_user_id: socket.user ? socket.user.id : null,
      created_at: new Date().toISOString()
    };
    r.moves = r.moves || [];
    r.moves.push(move);

    const winner = checkWinner(r.board);
    io.to(roomId).emit('move_made', { x, y, mark, winner });
    if (winner) {
      io.to(roomId).emit('match_end', { winner });
      // assemble replay and POST to backend for persistence (best-effort)
      const replay = {
        roomId,
        match_type: 'casual',
        players: r.players,
        moves: r.moves,
        final_board: r.board,
        started_at: r.started_at,
        ended_at: new Date().toISOString(),
        winner: winner
      };
      postMatchReplay(replay).then(ok => {
        if (!ok) console.warn('Failed to persist replay to backend');
      });
    }
  });

  socket.on('disconnecting', () => {
    // remove from rooms
    for (const roomId of socket.rooms) {
      if (rooms[roomId]) rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log('Socket server listening on', PORT));
