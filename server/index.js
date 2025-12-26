const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const { registerFriendRoutes } = require('./friends');
const { 
  checkWinner, 
  SeriesEvents,
  processSeriesGameEnd,
  getPlayerSideInSeries,
  getXPlayerInSeries
} = require('./game/checkWinner');
const fetch = global.fetch || require('node-fetch');

// Lightweight .env loader (trÃ¡nh thÃªm dependency)
(() => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
})();

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim() || null;
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim() || null;
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() || null;

// Rate limiting for auth verification to prevent Supabase overload
const authRateLimiter = {
  requests: new Map(), // token -> { count, resetTime }
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  
  isAllowed(token) {
    const now = Date.now()
    const key = token.slice(-10) // Use last 10 chars as key
    const entry = this.requests.get(key)
    
    if (!entry || now > entry.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + this.windowMs })
      return true
    }
    
    if (entry.count >= this.maxRequests) {
      return false
    }
    
    entry.count++
    return true
  },
  
  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.requests) {
      if (now > entry.resetTime) {
        this.requests.delete(key)
      }
    }
  }
}

// Cleanup rate limiter every 5 minutes
setInterval(() => authRateLimiter.cleanup(), 300000)

async function verifySupabaseToken(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('⚠️ Missing token or SUPABASE credentials', { hasUrl: Boolean(SUPABASE_URL), hasAnon: Boolean(SUPABASE_ANON_KEY) })
    return null
  }

  // Check rate limit
  if (!authRateLimiter.isAllowed(token)) {
    console.log('⚠️ Auth rate limited for this token')
    return null
  }

  if (supabaseAdmin && SUPABASE_SERVICE_KEY) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token)
      if (error || !data?.user) {
        // Check if error is HTML response (Supabase service issue)
        const errMsg = error?.message || ''
        if (errMsg.includes('Unexpected token') || errMsg.includes('<html') || errMsg.includes('<!DOCTYPE')) {
          console.log('⚠️ Supabase returned HTML instead of JSON - service may be degraded')
          return null
        }
        console.log('❌ auth.getUser failed', errMsg)
        return null
      }
      console.log('✅ auth.getUser success')
      return data.user
    } catch (err) {
      // Check if error is HTML response
      const errMsg = err?.message || String(err)
      if (errMsg.includes('Unexpected token') || errMsg.includes('<html') || errMsg.includes('<!DOCTYPE')) {
        console.log('⚠️ Supabase returned HTML instead of JSON - service may be degraded')
      } else {
        console.error('auth.getUser exception', err)
      }
      // Don't fall through to fetch - if supabaseAdmin failed, fetch will likely fail too
      return null
    }
  }

  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`
    console.log('🔍 Verifying token at:', url)

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {})
      },
      timeout: 10000 // 10s timeout
    })

    console.log('ℹ️ Supabase auth response status:', res.status)

    if (!res.ok) {
      const errorText = await res.text()
      // Check if response is HTML (service issue)
      if (errorText.startsWith('<') || errorText.includes('<!DOCTYPE')) {
        console.log('⚠️ Supabase returned HTML error page - service may be degraded')
      } else {
        console.log('❌ Supabase auth failed:', errorText.slice(0, 200))
      }
      return null
    }

    // Check content-type before parsing JSON
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      console.log('⚠️ Supabase returned non-JSON response:', contentType)
      return null
    }

    const data = await res.json()
    console.log('✅ Token verified successfully')
    return data
  } catch (err) {
    const errMsg = err?.message || String(err)
    if (errMsg.includes('Unexpected token') || errMsg.includes('<html')) {
      console.log('⚠️ Supabase returned HTML instead of JSON - service may be degraded')
    } else {
      console.error('verifySupabaseToken error', err)
    }
    return null
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
  console.log('ðŸ” Auth middleware:', req.method, req.url, 'has auth header:', !!header);
  
  if (!header.startsWith('Bearer ')) {
    console.log('âŒ No Bearer token in header');
    return res.status(401).json({ error: 'Thiáº¿u token xÃ¡c thá»±c' });
  }
  const token = header.slice(7);
  console.log('ðŸ”‘ Token received (length):', token.length);
  
  try {
    const user = await verifySupabaseToken(token);
    console.log('ðŸ‘¤ Verified user:', user ? user.id : 'null');
    
    if (!user || !user.id) {
      console.log('âŒ Token verification failed');
      return res.status(401).json({ error: 'Token khÃ´ng há»£p lá»‡' });
    }
    req.user = user;
    console.log('âœ… Auth successful for user:', user.id);
    return next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(500).json({ error: 'KhÃ´ng thá»ƒ xÃ¡c thá»±c' });
  }
}

// In-memory rooms: { roomId: { board: {}, players: [], moves: [], started_at: timestamp } }
const rooms = {};
// PHP backend runs on port 8001 for reports, bans, appeals APIs
const PHP_BACKEND_API = process.env.PHP_BACKEND_URL || 'http://localhost:8001';
const BACKEND_API = process.env.BACKEND_API_URL || PHP_BACKEND_API;

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
// Enhanced to support series creation for ranked matches
const matchmaking = {
  queues: {}, // mode -> [{socketId, userId, mindpoint, queuedAt},...]
  socketToUser: {}, // socketId -> {userId, mindpoint}
};

// Ranked disconnect state tracking for auto-win feature
// Tracks active disconnects in ranked mode with countdown timers
const rankedDisconnectStates = new Map(); // roomId -> { seriesId, disconnectedPlayerId, remainingPlayerId, disconnectedAt, timeoutId, countdownInterval }

// Constants for ranked disconnect handling
const RANKED_DISCONNECT_GRACE_PERIOD_MS = 10000; // 10 seconds grace period
const RANKED_FORFEIT_MP_CHANGE = 20; // Fixed ±20 MP for forfeit

// Variant matchmaking queues (Dị Biến Kỳ)
// Standard config per variant type - custom & hidden modes have swap2 enabled
const variantMatchmaking = {
  queues: {}, // variantType -> [{socketId, userId, username, queuedAt},...]
  socketToUser: {}, // socketId -> {userId, username, variantType}
  CONFIGS: {
    custom: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: true },  // Tùy chỉnh: có swap2
    hidden: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: true },  // Caro Ẩn: có swap2
    skill: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: false },  // Caro Skill
    terrain: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: false } // Địa hình
  },
  getConfig(variantType) {
    return this.CONFIGS[variantType] || this.CONFIGS.custom;
  }
};

// Helper to create series via PHP backend for ranked matches
async function createSeriesViaBackend(player1Id, player2Id, authToken) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(`${PHP_BACKEND_API}/api/series/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ player1_id: player1Id, player2_id: player2Id })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Series created:', data.series?.id || data.id);
      return data.series || data;
    }
    const errText = await res.text();
    console.error('❌ Failed to create series:', errText);
    return null;
  } catch (err) {
    console.error('❌ createSeriesViaBackend error:', err.message);
    return null;
  }
}

// Helper to end game in series via PHP backend
async function endGameInSeries(seriesId, matchId, winnerId, gameDuration, authToken) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}/end-game`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ match_id: matchId, winner_id: winnerId, duration: gameDuration })
    });
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Game ended in series:', data);
      return data;
    }
    console.error('❌ Failed to end game in series:', await res.text());
    return null;
  } catch (err) {
    console.error('❌ endGameInSeries error:', err.message);
    return null;
  }
}

// Helper to get series state
async function getSeriesState(seriesId, authToken) {
  try {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
    const res = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}`, { headers });
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.error('getSeriesState error:', err.message);
    return null;
  }
}

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

    const { channel, room_id, target_user_id, limit = 20, cursor } = req.query;
    const userId = req.user?.id;

    let query = supabaseAdmin
      .from('chat_messages')
      .select('*, sender_profile:profiles!sender_user_id(display_name, username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (room_id) {
      query = query.eq('room_id', room_id);
    } else if (channel === 'friends') {
      query = query.eq('channel_scope', 'friends');
      if (target_user_id && userId) {
        query = query.or(`and(sender_user_id.eq.${userId},target_user_id.eq.${target_user_id}),and(sender_user_id.eq.${target_user_id},target_user_id.eq.${userId})`);
      } else if (userId) {
        query = query.or(`sender_user_id.eq.${userId},target_user_id.eq.${userId}`);
      }
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
      target_user_id: msg.target_user_id,
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

    const { content, message_type = 'text', room_id, channel = 'global', target_user_id } = req.body;
    const userId = req.user?.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > 300) {
      return res.status(400).json({ error: 'Message too long (max 300 characters)' });
    }

    if (channel === 'friends' && !target_user_id) {
      return res.status(400).json({ error: 'target_user_id required for friends chat' });
    }

    const messageData = {
      sender_user_id: userId,
      content: content.trim(),
      message_type: message_type,
      channel_scope: room_id ? 'room' : channel
    };

    if (room_id) {
      messageData.room_id = room_id;
    }
    if (target_user_id) {
      messageData.target_user_id = target_user_id;
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select('*, sender_profile:profiles!sender_user_id(display_name, username, avatar_url)')
      .single();

    if (error) {
      console.error('Chat send error:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    } else {
      console.log('Chat send ok', { id: data?.id, channel: data?.channel_scope, target: data?.target_user_id, room: data?.room_id });
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

// Get series state for a room (Requirements: 2.5)
app.get('/api/game/series/:roomId', authMiddleware, gameLogic.getSeriesStateForRoom);

// Prepare next game in series (Requirements: 2.4, 2.5)
app.post('/api/game/series/:roomId/next', authMiddleware, gameLogic.prepareNextSeriesGame);

console.log('✅ Game API endpoints registered (including series support)');

// =====================================================================
// END GAME API
// =====================================================================

// =====================================================================
// PROXY TO PHP BACKEND (Reports, Bans, Appeals)
// =====================================================================

// Proxy helper function
async function proxyToPhpBackend(req, res, method = req.method) {
  try {
    const url = `${PHP_BACKEND_API}${req.originalUrl}`;
    console.log(`[Proxy] ${method} ${url}`);
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Forward Authorization header
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const options = {
      method: method,
      headers: headers,
    };
    
    // Add body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
      options.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    // Forward response
    res.status(response.status);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err) {
    console.error('[Proxy] Error:', err.message);
    res.status(502).json({ 
      error: 'PHP backend không khả dụng', 
      details: err.message,
      hint: 'Hãy chạy: cd backend/public && php -S localhost:8001 router.php'
    });
  }
}

// Proxy /api/reports to PHP backend
app.post('/api/reports', (req, res) => proxyToPhpBackend(req, res, 'POST'));
app.get('/api/reports', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.get('/api/reports/:id', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.put('/api/reports/:id', (req, res) => proxyToPhpBackend(req, res, 'PUT'));

// Proxy /api/appeals to PHP backend
app.post('/api/appeals', (req, res) => proxyToPhpBackend(req, res, 'POST'));
app.get('/api/appeals', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.get('/api/appeals/:id', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.put('/api/appeals/:id', (req, res) => proxyToPhpBackend(req, res, 'PUT'));

// Proxy /api/bans to PHP backend
app.get('/api/bans/status', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.get('/api/admin/bans', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.post('/api/admin/bans', (req, res) => proxyToPhpBackend(req, res, 'POST')); // allow admin to create bans
app.get('/api/admin/bans/:id', (req, res) => proxyToPhpBackend(req, res, 'GET'));
app.post('/api/admin/bans/:id/lift', (req, res) => proxyToPhpBackend(req, res, 'POST'));
app.get('/api/admin/bans/user/:userId', (req, res) => proxyToPhpBackend(req, res, 'GET'));

console.log('✅ PHP Backend proxy routes registered (reports, appeals, bans)');

// =====================================================================
// END PHP BACKEND PROXY
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

  // Create room with optional swap2_enabled configuration
  // Requirements: 4.1, 4.2, 4.4, 4.5
  socket.on('create_room', (data) => {
    // Support both old format (just roomId string) and new format (object with config)
    let roomId, mode, swap2Enabled;
    
    if (typeof data === 'string') {
      // Legacy format: just roomId
      roomId = data;
      mode = 'casual';
      swap2Enabled = false;
    } else {
      // New format: { roomId, mode, swap2_enabled }
      roomId = data.roomId || data.room_id;
      mode = data.mode || 'casual';
      // For ranked mode, swap2_enabled is always true (Requirements: 4.1)
      swap2Enabled = mode === 'ranked' ? true : (data.swap2_enabled ?? data.swap2Enabled ?? false);
    }

    rooms[roomId] = { 
      board: {}, 
      players: [], 
      moves: [], 
      started_at: new Date().toISOString(),
      mode: mode,
      swap2_enabled: swap2Enabled,
      // Initialize swap2_state if enabled
      swap2_state: swap2Enabled ? {
        phase: 'swap2_placement',
        tentative_stones: [],
        actions: []
      } : null,
      game_phase: swap2Enabled ? 'swap2' : 'main_game'
    };
    socket.join(roomId);
    rooms[roomId].players.push({ socketId: socket.id, userId: socket.user ? socket.user.id : null });
    
    // Emit room state with swap2 info (Requirements: 4.5)
    io.to(roomId).emit('room_state', {
      ...rooms[roomId],
      swap2_enabled: rooms[roomId].swap2_enabled,
      swap2_state: rooms[roomId].swap2_state,
      game_phase: rooms[roomId].game_phase
    });
  });

  // Join room - inherit swap2 settings from existing room
  socket.on('join_room', (data) => {
    // Support both old format (just roomId string) and new format (object)
    let roomId;
    if (typeof data === 'string') {
      roomId = data;
    } else {
      roomId = data.roomId || data.room_id;
    }

    if (!rooms[roomId]) {
      // Create room with default settings if it doesn't exist
      rooms[roomId] = { 
        board: {}, 
        players: [], 
        moves: [], 
        started_at: new Date().toISOString(),
        mode: 'casual',
        swap2_enabled: false,
        swap2_state: null,
        game_phase: 'main_game'
      };
    }
    socket.join(roomId);
    rooms[roomId].players.push({ socketId: socket.id, userId: socket.user ? socket.user.id : null });
    
    // Emit room state with swap2 info (Requirements: 4.5)
    io.to(roomId).emit('room_state', {
      ...rooms[roomId],
      swap2_enabled: rooms[roomId].swap2_enabled,
      swap2_state: rooms[roomId].swap2_state,
      game_phase: rooms[roomId].game_phase
    });
  });

  // Join matchmaking queue - enhanced for series support
  // Supports swap2_enabled for all modes (ranked=mandatory, others=optional)
  socket.on('join_queue', async ({ mode = 'casual', mindpoint = 0, swap2_enabled = false } = {}) => {
    const userId = socket.user?.id;
    const authToken = socket.handshake?.auth?.token;
    console.log('🎮 join_queue:', { socketId: socket.id, userId, mode, mindpoint, swap2_enabled, hasToken: !!authToken });

    // Ranked queue requires authenticated user + token for backend API
    if (mode === 'ranked' && (!userId || !authToken)) {
      socket.emit('queue_error', { error: 'Cần đăng nhập để chơi rank' });
      return;
    }

    matchmaking.queues[mode] = matchmaking.queues[mode] || [];
    
    // Store user info for this socket
    if (userId) {
      matchmaking.socketToUser[socket.id] = { userId, mindpoint, swap2_enabled, authToken };
    }

    // Check if already in queue
    const alreadyQueued = matchmaking.queues[mode].some(p => p.socketId === socket.id);
    if (!alreadyQueued) {
      matchmaking.queues[mode].push({
        socketId: socket.id,
        userId: userId || null,
        mindpoint: mindpoint,
        swap2_enabled: swap2_enabled,
        authToken,
        queuedAt: Date.now()
      });
    }

    // Try to match two players
    if (matchmaking.queues[mode].length >= 2) {
      const playerA = matchmaking.queues[mode].shift();
      const playerB = matchmaking.queues[mode].shift();
      
      const roomId = Math.random().toString(36).slice(2, 10);
      let seriesId = null;
      let seriesData = null;

      // For ranked mode, create a series via PHP backend
      if (mode === 'ranked' && playerA.userId && playerB.userId) {
        console.log('🏆 Creating ranked series for:', playerA.userId, 'vs', playerB.userId);
        const tokenForSeries = playerA.authToken || playerB.authToken;
        seriesData = await createSeriesViaBackend(playerA.userId, playerB.userId, tokenForSeries);
        if (seriesData) {
          seriesId = seriesData.id;
          console.log('✅ Series created:', seriesId);
        }
      }

      // Create room with series info and swap2 configuration
      // Requirements: 4.1 - Ranked mode always has swap2_enabled=true
      // For other modes, use swap2 if BOTH players have it enabled
      const swap2Enabled = mode === 'ranked' ? true : (playerA.swap2_enabled && playerB.swap2_enabled);
      
      rooms[roomId] = {
        board: {},
        players: [
          { socketId: playerA.socketId, userId: playerA.userId },
          { socketId: playerB.socketId, userId: playerB.userId }
        ],
        moves: [],
        started_at: new Date().toISOString(),
        mode: mode,
        series_id: seriesId,
        series: seriesData,
        // Swap 2 configuration (Requirements: 4.1, 4.4)
        swap2_enabled: swap2Enabled,
        swap2_state: swap2Enabled ? {
          phase: 'swap2_placement',
          player1_id: playerA.userId,
          player2_id: playerB.userId,
          active_player_id: playerA.userId,
          tentative_stones: [],
          actions: []
        } : null,
        game_phase: swap2Enabled ? 'swap2' : 'main_game'
      };

      // Determine player sides from series or default
      let playerASide = 'X';
      let playerBSide = 'O';
      if (seriesData) {
        // Use series-assigned sides
        if (seriesData.player1_id === playerA.userId) {
          playerASide = seriesData.player1_side;
          playerBSide = seriesData.player2_side;
        } else {
          playerASide = seriesData.player2_side;
          playerBSide = seriesData.player1_side;
        }
      }

      // Emit match found to both players with series info and swap2 status (Requirements: 4.5)
      io.to(playerA.socketId).emit('queue_matched', {
        roomId,
        seriesId,
        series: seriesData,
        opponent: { socketId: playerB.socketId, userId: playerB.userId },
        yourSide: playerASide,
        mode,
        swap2_enabled: swap2Enabled,
        game_phase: rooms[roomId].game_phase
      });
      io.to(playerB.socketId).emit('queue_matched', {
        roomId,
        seriesId,
        series: seriesData,
        opponent: { socketId: playerA.socketId, userId: playerA.userId },
        yourSide: playerBSide,
        mode,
        swap2_enabled: swap2Enabled,
        game_phase: rooms[roomId].game_phase
      });

      console.log('✅ Players matched:', { roomId, seriesId, mode, playerA: playerA.userId, playerB: playerB.userId });
    } else {
      io.to(socket.id).emit('queue_waiting', { 
        position: matchmaking.queues[mode].length,
        mode 
      });
    }
  });

  // Leave matchmaking queue
  socket.on('leave_queue', ({ mode = 'casual' } = {}) => {
    if (matchmaking.queues[mode]) {
      matchmaking.queues[mode] = matchmaking.queues[mode].filter(p => p.socketId !== socket.id);
      console.log('🚪 Player left queue:', socket.id, mode);
    }
    delete matchmaking.socketToUser[socket.id];
  });

  // =====================================================================
  // SWAP 2 ACTION HANDLERS
  // Requirements: 1.2, 1.3, 2.1, 3.1
  // =====================================================================

  /**
   * Handle stone placement during Swap 2 phases.
   * Routes to PHP backend Swap2Manager for validation and state updates.
   * Requirements: 1.2, 2.1
   */
  socket.on('swap2_place_stone', async ({ roomId, x, y }) => {
    const r = rooms[roomId];
    if (!r) {
      socket.emit('swap2_error', { error: 'Room not found' });
      return;
    }

    // Check if game is in swap2 phase
    if (r.game_phase !== 'swap2') {
      socket.emit('swap2_error', { error: 'Game is not in Swap 2 phase' });
      return;
    }

    const userId = socket.user?.id;
    if (!userId) {
      socket.emit('swap2_error', { error: 'User not authenticated' });
      return;
    }

    // Validate it's the active player's turn
    const swap2State = r.swap2_state;
    if (!swap2State || swap2State.active_player_id !== userId) {
      socket.emit('swap2_error', { 
        error: 'Not your turn',
        active_player_id: swap2State?.active_player_id
      });
      return;
    }

    // Validate phase allows placement
    const phase = swap2State.phase;
    if (phase !== 'swap2_placement' && phase !== 'swap2_extra') {
      socket.emit('swap2_error', { error: `Cannot place stone in phase: ${phase}` });
      return;
    }

    // Validate position bounds
    if (x < 0 || x >= 15 || y < 0 || y >= 15) {
      socket.emit('swap2_error', { error: 'Position out of bounds' });
      return;
    }

    // Check if position is occupied
    const isOccupied = swap2State.tentative_stones?.some(s => s.x === x && s.y === y);
    if (isOccupied) {
      socket.emit('swap2_error', { error: 'Position already occupied' });
      return;
    }

    // Add tentative stone
    const placementOrder = (swap2State.tentative_stones?.length || 0) + 1;
    const stone = {
      x,
      y,
      placed_by: userId,
      placement_order: placementOrder,
      phase: phase
    };
    
    swap2State.tentative_stones = swap2State.tentative_stones || [];
    swap2State.tentative_stones.push(stone);

    // Record action
    swap2State.actions = swap2State.actions || [];
    swap2State.actions.push({
      type: 'place',
      player_id: userId,
      timestamp: new Date().toISOString(),
      data: { x, y }
    });

    // Check for phase transition
    const stoneCount = swap2State.tentative_stones.length;

    if (phase === 'swap2_placement' && stoneCount >= 3) {
      // After 3 stones, transition to choice phase
      swap2State.phase = 'swap2_choice';
      swap2State.active_player_id = swap2State.player2_id;
    } else if (phase === 'swap2_extra' && stoneCount >= 5) {
      // After 5 stones (3 + 2), transition to final choice
      swap2State.phase = 'swap2_final_choice';
      swap2State.active_player_id = swap2State.player1_id;
    }

    // Update room state
    r.swap2_state = swap2State;

    // Emit stone placed event to all players in room (Requirements: 5.1, 5.2)
    io.to(roomId).emit('swap2_stone_placed', {
      x,
      y,
      placed_by: userId,
      placement_order: placementOrder,
      phase: swap2State.phase,
      active_player_id: swap2State.active_player_id,
      stone_count: stoneCount,
      tentative_stones: swap2State.tentative_stones
    });

    console.log('🎯 Swap2 stone placed:', { roomId, x, y, userId, phase: swap2State.phase, stoneCount });
  });

  /**
   * Handle color choice during Swap 2 choice phases.
   * Requirements: 1.3, 3.1
   */
  socket.on('swap2_make_choice', async ({ roomId, choice }) => {
    const r = rooms[roomId];
    if (!r) {
      socket.emit('swap2_error', { error: 'Room not found' });
      return;
    }

    // Check if game is in swap2 phase
    if (r.game_phase !== 'swap2') {
      socket.emit('swap2_error', { error: 'Game is not in Swap 2 phase' });
      return;
    }

    const userId = socket.user?.id;
    if (!userId) {
      socket.emit('swap2_error', { error: 'User not authenticated' });
      return;
    }

    const swap2State = r.swap2_state;
    if (!swap2State || swap2State.active_player_id !== userId) {
      socket.emit('swap2_error', { 
        error: 'Not your turn',
        active_player_id: swap2State?.active_player_id
      });
      return;
    }

    const phase = swap2State.phase;

    // Validate phase allows choice
    if (phase !== 'swap2_choice' && phase !== 'swap2_final_choice') {
      socket.emit('swap2_error', { error: `Cannot make choice in phase: ${phase}` });
      return;
    }

    // Validate choice options
    const validChoices = phase === 'swap2_choice' 
      ? ['black', 'white', 'place_more']
      : ['black', 'white'];
    
    if (!validChoices.includes(choice)) {
      socket.emit('swap2_error', { 
        error: `Invalid choice: ${choice}. Valid options: ${validChoices.join(', ')}`
      });
      return;
    }

    // Record action
    swap2State.actions = swap2State.actions || [];
    swap2State.actions.push({
      type: 'choice',
      player_id: userId,
      timestamp: new Date().toISOString(),
      data: { choice }
    });

    // Process choice
    if (choice === 'place_more') {
      // Player 2 wants to place more stones
      swap2State.phase = 'swap2_extra';
      // Player 2 continues to place stones (active_player_id stays the same)
      
      io.to(roomId).emit('swap2_choice_made', {
        choice,
        chooser: userId,
        phase: swap2State.phase,
        active_player_id: swap2State.active_player_id
      });
    } else {
      // Color choice made (black or white)
      const player1Id = swap2State.player1_id;
      const player2Id = swap2State.player2_id;

      // Assign colors based on choice
      if (choice === 'black') {
        swap2State.black_player_id = userId;
        swap2State.white_player_id = userId === player1Id ? player2Id : player1Id;
      } else {
        swap2State.white_player_id = userId;
        swap2State.black_player_id = userId === player1Id ? player2Id : player1Id;
      }

      swap2State.final_choice = {
        chooser: userId,
        chosen_color: choice
      };
      swap2State.phase = 'complete';

      // Update room state
      r.swap2_state = swap2State;

      // Emit choice made event (Requirements: 5.3)
      io.to(roomId).emit('swap2_choice_made', {
        choice,
        chooser: userId,
        phase: swap2State.phase,
        black_player_id: swap2State.black_player_id,
        white_player_id: swap2State.white_player_id
      });

      // Transition to main game (Requirements: 1.6, 3.6)
      await transitionToMainGame(roomId, r, swap2State);
    }

    // Update room state
    r.swap2_state = swap2State;

    console.log('🎨 Swap2 choice made:', { roomId, choice, userId, phase: swap2State.phase });
  });

  /**
   * Transition from Swap 2 to main game.
   * Applies final color assignments and sets up main game state.
   * Requirements: 1.6, 3.6
   */
  async function transitionToMainGame(roomId, room, swap2State) {
    // Convert tentative stones to board positions
    // Stone pattern: B, W, B, [B, W] (if place_more)
    // Placement order 1, 2, 3 = B, W, B
    // Placement order 4, 5 = B, W
    const board = {};
    const moves = [];

    for (const stone of swap2State.tentative_stones || []) {
      const order = stone.placement_order;
      // Pattern: 1=B(X), 2=W(O), 3=B(X), 4=B(X), 5=W(O)
      const isBlack = [1, 3, 4].includes(order);
      const symbol = isBlack ? 'X' : 'O';
      const key = `${stone.x}_${stone.y}`;
      board[key] = symbol;

      moves.push({
        x: stone.x,
        y: stone.y,
        mark: symbol,
        player_user_id: stone.placed_by,
        created_at: new Date().toISOString(),
        swap2_phase: true
      });
    }

    // Update room state for main game
    room.board = board;
    room.moves = moves;
    room.game_phase = 'main_game';
    room.started_at = new Date().toISOString();

    // Store color assignments
    room.black_player_id = swap2State.black_player_id;
    room.white_player_id = swap2State.white_player_id;

    // Emit swap2 complete event (Requirements: 5.4, 5.5, 5.6)
    io.to(roomId).emit('swap2_complete', {
      black_player_id: swap2State.black_player_id,
      white_player_id: swap2State.white_player_id,
      first_mover: swap2State.black_player_id, // Black always moves first
      board,
      moves,
      swap2_history: {
        actions: swap2State.actions,
        final_choice: swap2State.final_choice,
        tentative_stones: swap2State.tentative_stones
      }
    });

    // Emit game started event for main game
    io.to(roomId).emit('game_started', {
      game_phase: 'main_game',
      current_turn: 'X', // Black (X) always starts
      black_player_id: swap2State.black_player_id,
      white_player_id: swap2State.white_player_id,
      board,
      moves
    });

    console.log('🎮 Transitioned to main game:', { 
      roomId, 
      blackPlayer: swap2State.black_player_id,
      whitePlayer: swap2State.white_player_id
    });
  }

  // =====================================================================
  // END SWAP 2 ACTION HANDLERS
  // =====================================================================

  socket.on('move', async ({ roomId, x, y, mark }) => {
    const r = rooms[roomId];
    if (!r) return;
    
    // Check if game is in main_game phase (not swap2)
    if (r.game_phase === 'swap2') {
      socket.emit('error', { message: 'Game is in Swap 2 phase. Use swap2_place_stone instead.' });
      return;
    }
    
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
      // Determine winner user ID based on mark
      let winnerUserId = null;
      if (r.series_id && r.series) {
        // For series games, get winner from series player mapping
        winnerUserId = winner === r.series.player1_side 
          ? r.series.player1_id 
          : r.series.player2_id;
      } else {
        // For casual games, find player with matching mark
        const winnerPlayer = r.players.find(p => {
          // This is a simplification - in real implementation, track player marks
          return p.userId && socket.user?.id === p.userId;
        });
        winnerUserId = winnerPlayer?.userId || null;
      }

      // Handle series game end (Requirements: 2.1, 2.4, 2.5)
      if (r.series_id && r.mode === 'ranked') {
        const authToken = socket.handshake?.auth?.token;
        const gameDuration = Math.floor((Date.now() - new Date(r.started_at).getTime()) / 1000);
        const matchId = randomUUID(); // Generate match ID
        
        console.log('🏆 Series game ended:', { seriesId: r.series_id, winner, winnerUserId, gameDuration });
        
        // Call backend to end game in series
        const seriesResult = await endGameInSeries(r.series_id, matchId, winnerUserId, gameDuration, authToken);
        
        if (seriesResult) {
          // Process series events
          const events = processSeriesGameEnd({
            seriesState: seriesResult,
            matchId,
            winnerId: winnerUserId
          });

          // Emit all series events to room
          for (const event of events) {
            io.to(roomId).emit(event.type, event);
            console.log(`📡 Emitted ${event.type}:`, event);
          }

          // Update room with new series state
          r.series = seriesResult.series;

          // Emit game end with series info
          io.to(roomId).emit('match_end', { 
            winner,
            winnerUserId,
            seriesId: r.series_id,
            isSeriesComplete: seriesResult.isComplete,
            seriesScore: `${seriesResult.series.player1_wins}-${seriesResult.series.player2_wins}`,
            nextGameReady: seriesResult.nextGameReady,
            rewards: seriesResult.rewards || null
          });

          // If series continues, prepare for next game
          if (!seriesResult.isComplete && seriesResult.nextGameReady) {
            // Reset board for next game
            r.board = {};
            r.moves = [];
            r.started_at = null; // Will be set when next game starts
            
            // Emit next game preparation event
            io.to(roomId).emit('series_next_game_preparing', {
              seriesId: r.series_id,
              gameNumber: seriesResult.series.current_game,
              player1Side: seriesResult.series.player1_side,
              player2Side: seriesResult.series.player2_side,
              countdownSeconds: 10
            });
          }
        } else {
          // Fallback if backend call fails
          io.to(roomId).emit('match_end', { winner, winnerUserId });
        }
      } else {
        // Casual game - original behavior
        io.to(roomId).emit('match_end', { winner });
      }
      
      // assemble replay and POST to backend for persistence (best-effort)
      // For ranked/series games, use series player IDs which are guaranteed to be valid
      let playersForReplay = r.players;
      if (r.series_id && r.series) {
        // Build players array with proper user IDs from series data
        playersForReplay = [
          { side: r.series.player1_side, userId: r.series.player1_id },
          { side: r.series.player2_side, userId: r.series.player2_id }
        ];
      }
      
      const replay = {
        roomId,
        match_type: r.mode || 'casual',
        series_id: r.series_id || null,
        players: playersForReplay,
        moves: r.moves,
        final_board: r.board,
        started_at: r.started_at,
        ended_at: new Date().toISOString(),
        winner: winner,
        winner_user_id: winnerUserId,
        // Include swap2 history if available
        swap2_history: r.swap2_state ? {
          actions: r.swap2_state.actions,
          final_choice: r.swap2_state.final_choice,
          tentative_stones: r.swap2_state.tentative_stones
        } : null
      };
      postMatchReplay(replay).then(ok => {
        if (!ok) console.warn('Failed to persist replay to backend');
      });

      // Clean up swap2 state after game ends to free memory (Requirements: 5.1)
      if (r.swap2_state) {
        console.log('🧹 Cleaning up Swap2 state for room:', roomId);
        r.swap2_state = null;
      }
    }
  });

  // Handle starting next game in series
  socket.on('series_start_next_game', async ({ roomId, seriesId }) => {
    const r = rooms[roomId];
    if (!r || r.series_id !== seriesId) {
      socket.emit('error', { message: 'Invalid room or series' });
      return;
    }

    // Get current series state
    const authToken = socket.handshake?.auth?.token;
    const seriesState = await getSeriesState(seriesId, authToken);
    if (!seriesState || seriesState.isComplete) {
      socket.emit('error', { message: 'Series is complete or not found' });
      return;
    }

    // Reset room for next game
    r.board = {};
    r.moves = [];
    r.started_at = new Date().toISOString();
    r.series = seriesState.series;

    // Emit game started event with new sides
    io.to(roomId).emit('series_game_started', {
      seriesId,
      gameNumber: seriesState.series.current_game,
      player1Side: seriesState.series.player1_side,
      player2Side: seriesState.series.player2_side,
      currentScore: `${seriesState.series.player1_wins}-${seriesState.series.player2_wins}`
    });

    console.log('🎮 Next game started in series:', { seriesId, gameNumber: seriesState.series.current_game });
  });

  // Handle series forfeit (player disconnected too long)
  socket.on('series_forfeit_game', async ({ roomId, seriesId, forfeitingPlayerId }) => {
    const r = rooms[roomId];
    if (!r || r.series_id !== seriesId) {
      socket.emit('error', { message: 'Invalid room or series' });
      return;
    }

    try {
      const authToken = socket.handshake?.auth?.token;
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}/forfeit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ player_id: forfeitingPlayerId })
      });

      if (res.ok) {
        const result = await res.json();
        
        // Process and emit series events
        const events = processSeriesGameEnd({
          seriesState: result,
          matchId: null,
          winnerId: result.series.winner_id
        });

        for (const event of events) {
          io.to(roomId).emit(event.type, event);
        }

        // Update room state
        r.series = result.series;

        io.to(roomId).emit('series_game_forfeited', {
          seriesId,
          forfeitingPlayerId,
          isSeriesComplete: result.isComplete,
          seriesScore: `${result.series.player1_wins}-${result.series.player2_wins}`
        });
      }
    } catch (err) {
      console.error('series_forfeit_game error:', err.message);
    }
  });

  // Handle series abandon (player leaves voluntarily)
  socket.on('series_abandon', async ({ roomId, seriesId, abandoningPlayerId }) => {
    const r = rooms[roomId];
    if (!r || r.series_id !== seriesId) {
      socket.emit('error', { message: 'Invalid room or series' });
      return;
    }

    try {
      const authToken = socket.handshake?.auth?.token;
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}/abandon`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ player_id: abandoningPlayerId })
      });

      if (res.ok) {
        const result = await res.json();

        io.to(roomId).emit('series_abandoned', {
          seriesId,
          abandoningPlayerId,
          winnerId: result.winnerId,
          abandonPenalty: result.abandonPenalty,
          finalScore: result.finalScore
        });

        // Clean up room
        delete rooms[roomId];
      }
    } catch (err) {
      console.error('series_abandon error:', err.message);
    }
  });

  socket.on('disconnecting', () => {
    const userId = socket.user?.id;
    
    // Handle ranked disconnect with auto-win logic
    for (const roomId of socket.rooms) {
      const r = rooms[roomId];
      if (!r) continue;
      
      // Check if this is a ranked room with active series
      if (r.mode === 'ranked' && r.series_id && userId) {
        const remainingPlayer = r.players.find(p => p.userId && p.userId !== userId);
        
        if (remainingPlayer) {
          console.log('🚨 Ranked player disconnecting:', { roomId, seriesId: r.series_id, disconnectedUserId: userId });
          
          // Start ranked disconnect handling
          handleRankedDisconnect(roomId, r.series_id, userId, remainingPlayer.userId, socket.handshake?.auth?.token);
        }
      }
      
      // Remove from room players
      if (r.players) {
        r.players = r.players.filter(p => p.socketId !== socket.id);
      }
    }
  });

  // =====================================================================
  // RANKED DISCONNECT AUTO-WIN HANDLERS
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.2
  // =====================================================================

  /**
   * Handle ranked player disconnect - start countdown for auto-win
   * Requirements: 1.1, 1.2, 1.3
   */
  function handleRankedDisconnect(roomId, seriesId, disconnectedPlayerId, remainingPlayerId, authToken) {
    // Check if already tracking this disconnect
    if (rankedDisconnectStates.has(roomId)) {
      const existingState = rankedDisconnectStates.get(roomId);
      // If the remaining player also disconnects, handle simultaneous disconnect
      if (existingState.disconnectedPlayerId !== disconnectedPlayerId) {
        console.log('🚨 Both players disconnected - declaring draw');
        handleSimultaneousDisconnect(roomId, seriesId, authToken);
        return;
      }
      return; // Already tracking this player's disconnect
    }

    const disconnectedAt = Date.now();
    let countdown = Math.floor(RANKED_DISCONNECT_GRACE_PERIOD_MS / 1000);

    // Emit opponent_disconnected to remaining player
    const remainingSocket = findSocketByUserId(remainingPlayerId);
    if (remainingSocket) {
      remainingSocket.emit('opponent_disconnected', {
        roomId,
        seriesId,
        disconnectedPlayerId,
        gracePeriodSeconds: countdown,
        message: 'Đối thủ đã thoát. Bạn sẽ thắng sau ' + countdown + ' giây nếu họ không quay lại.'
      });
    }

    // Start countdown interval
    const countdownInterval = setInterval(() => {
      countdown--;
      if (remainingSocket) {
        remainingSocket.emit('disconnect_countdown', {
          roomId,
          remainingSeconds: countdown
        });
      }
      if (countdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Set timeout for auto-win
    const timeoutId = setTimeout(async () => {
      // Check if player reconnected
      const state = rankedDisconnectStates.get(roomId);
      if (!state) return; // Player reconnected, state was cleared

      console.log('⏰ Ranked disconnect timeout - processing auto-win');
      await processRankedAutoWin(roomId, seriesId, remainingPlayerId, disconnectedPlayerId, authToken);
    }, RANKED_DISCONNECT_GRACE_PERIOD_MS);

    // Store disconnect state
    rankedDisconnectStates.set(roomId, {
      seriesId,
      disconnectedPlayerId,
      remainingPlayerId,
      disconnectedAt,
      timeoutId,
      countdownInterval,
      authToken
    });

    console.log('⏳ Started ranked disconnect countdown:', { roomId, seriesId, disconnectedPlayerId, gracePeriodMs: RANKED_DISCONNECT_GRACE_PERIOD_MS });
  }

  /**
   * Handle player reconnection during grace period
   * Requirements: 4.2
   */
  function handleRankedReconnect(roomId, reconnectedPlayerId) {
    const state = rankedDisconnectStates.get(roomId);
    if (!state || state.disconnectedPlayerId !== reconnectedPlayerId) {
      return false; // No active disconnect for this player
    }

    // Clear timers
    clearTimeout(state.timeoutId);
    clearInterval(state.countdownInterval);

    // Remove disconnect state
    rankedDisconnectStates.delete(roomId);

    // Notify remaining player
    const remainingSocket = findSocketByUserId(state.remainingPlayerId);
    if (remainingSocket) {
      remainingSocket.emit('opponent_reconnected', {
        roomId,
        reconnectedPlayerId,
        message: 'Đối thủ đã quay lại. Trận đấu tiếp tục.'
      });
    }

    console.log('✅ Ranked player reconnected:', { roomId, reconnectedPlayerId });
    return true;
  }

  /**
   * Process auto-win after disconnect timeout
   * Requirements: 1.3, 1.4, 1.5
   */
  async function processRankedAutoWin(roomId, seriesId, winnerId, loserId, authToken) {
    const state = rankedDisconnectStates.get(roomId);
    if (state) {
      clearInterval(state.countdownInterval);
      rankedDisconnectStates.delete(roomId);
    }

    let retries = 0;
    const maxRetries = 3;
    let result = null;

    while (retries < maxRetries && !result) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;

        const res = await fetch(`${PHP_BACKEND_API}/api/series/${seriesId}/forfeit-disconnect`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            disconnected_player_id: loserId,
            winner_id: winnerId,
            mp_change: RANKED_FORFEIT_MP_CHANGE
          })
        });

        if (res.ok) {
          result = await res.json();
        } else {
          const errText = await res.text();
          console.error(`❌ Forfeit API failed (attempt ${retries + 1}):`, errText);
          retries++;
          if (retries < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * retries)); // Exponential backoff
          }
        }
      } catch (err) {
        console.error(`❌ Forfeit API error (attempt ${retries + 1}):`, err.message);
        retries++;
        if (retries < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * retries));
        }
      }
    }

    if (!result) {
      console.error('❌ All forfeit retries failed for series:', seriesId);
      // Emit error to remaining player
      const winnerSocket = findSocketByUserId(winnerId);
      if (winnerSocket) {
        winnerSocket.emit('ranked_forfeit_error', {
          roomId,
          seriesId,
          message: 'Lỗi xử lý kết quả. Vui lòng liên hệ admin.'
        });
      }
      return;
    }

    // Emit auto-win to winner
    const winnerSocket = findSocketByUserId(winnerId);
    if (winnerSocket) {
      winnerSocket.emit('ranked_auto_win', {
        roomId,
        seriesId,
        winnerId,
        loserId,
        mpChange: RANKED_FORFEIT_MP_CHANGE,
        seriesComplete: result.isComplete || result.series_complete,
        finalScore: result.finalScore || `${result.series?.player1_wins || 0}-${result.series?.player2_wins || 0}`,
        seriesWinnerId: result.series?.winner_id,
        message: `Bạn thắng do đối thủ thoát! +${RANKED_FORFEIT_MP_CHANGE} MP`
      });
    }

    // Emit forfeit loss to loser (if they reconnect later)
    const loserSocket = findSocketByUserId(loserId);
    if (loserSocket) {
      loserSocket.emit('ranked_forfeit_loss', {
        roomId,
        seriesId,
        winnerId,
        loserId,
        mpChange: -RANKED_FORFEIT_MP_CHANGE,
        seriesComplete: result.isComplete || result.series_complete,
        message: `Bạn thua do thoát trận! -${RANKED_FORFEIT_MP_CHANGE} MP`
      });
    }

    // Emit to room for any spectators
    io.to(roomId).emit('ranked_game_forfeited', {
      roomId,
      seriesId,
      winnerId,
      loserId,
      reason: 'disconnect',
      mpChange: RANKED_FORFEIT_MP_CHANGE,
      seriesComplete: result.isComplete || result.series_complete,
      finalScore: result.finalScore || `${result.series?.player1_wins || 0}-${result.series?.player2_wins || 0}`
    });

    // Update room state and cleanup Swap2 state if forfeit during Swap2 phase
    // Requirements: 5.3 - Handle disconnect during Swap2 phase
    const r = rooms[roomId];
    if (r) {
      r.series = result.series;
      
      // Clean up Swap2 state on forfeit (Requirements: 5.3)
      if (r.swap2_state) {
        console.log('🧹 Cleaning up Swap2 state due to forfeit:', roomId);
        r.swap2_state = null;
        r.game_phase = 'main_game';
      }
      
      if (result.isComplete || result.series_complete) {
        // Clean up room after series complete
        setTimeout(() => {
          delete rooms[roomId];
          console.log('🧹 Cleaned up room after forfeit:', roomId);
        }, 5000);
      }
    }

    console.log('🏆 Ranked auto-win processed:', { roomId, seriesId, winnerId, loserId, mpChange: RANKED_FORFEIT_MP_CHANGE, wasInSwap2: r?.game_phase === 'swap2' });
  }

  /**
   * Handle simultaneous disconnect - declare draw
   * Requirements: 4.1, 5.3 (Swap2 cleanup)
   */
  function handleSimultaneousDisconnect(roomId, seriesId, authToken) {
    const state = rankedDisconnectStates.get(roomId);
    if (state) {
      clearTimeout(state.timeoutId);
      clearInterval(state.countdownInterval);
      rankedDisconnectStates.delete(roomId);
    }

    // Clean up Swap2 state if in Swap2 phase (Requirements: 5.3)
    const r = rooms[roomId];
    if (r && r.swap2_state) {
      console.log('🧹 Cleaning up Swap2 state due to simultaneous disconnect:', roomId);
      r.swap2_state = null;
      r.game_phase = 'main_game';
    }

    // Emit draw to room
    io.to(roomId).emit('ranked_simultaneous_disconnect', {
      roomId,
      seriesId,
      result: 'draw',
      mpChange: 0,
      message: 'Cả hai người chơi đều thoát. Trận đấu hòa.'
    });

    // Clean up room
    setTimeout(() => {
      delete rooms[roomId];
      console.log('🧹 Cleaned up room after simultaneous disconnect:', roomId);
    }, 5000);

    console.log('🤝 Simultaneous disconnect - draw:', { roomId, seriesId });
  }

  /**
   * Find socket by user ID
   */
  function findSocketByUserId(userId) {
    const sockets = userSockets[userId];
    if (sockets && sockets.size > 0) {
      const socketId = sockets.values().next().value;
      return io.sockets.sockets.get(socketId);
    }
    return null;
  }

  // Handle reconnection to ranked room
  socket.on('ranked_reconnect', ({ roomId }) => {
    const userId = socket.user?.id;
    if (!userId) return;

    const reconnected = handleRankedReconnect(roomId, userId);
    if (reconnected) {
      socket.emit('ranked_reconnect_success', { roomId });
    }
  });

  // =====================================================================
  // END RANKED DISCONNECT AUTO-WIN HANDLERS
  // =====================================================================

  // =====================================================================
  // VARIANT MODE HANDLERS (Dị Biến Kỳ)
  // =====================================================================
  
  // Join variant matchmaking queue (ghép trận online)
  socket.on('join_variant_queue', (data) => {
    const { userId, username, variantType } = data;
    
    if (!userId) {
      socket.emit('variant_error', { error: 'User ID required' });
      return;
    }
    
    const queueKey = variantType || 'custom';
    variantMatchmaking.queues[queueKey] = variantMatchmaking.queues[queueKey] || [];
    
    // Store user info
    variantMatchmaking.socketToUser[socket.id] = { userId, username, variantType: queueKey };
    
    // Check if already in queue
    const alreadyQueued = variantMatchmaking.queues[queueKey].some(p => p.socketId === socket.id);
    if (!alreadyQueued) {
      variantMatchmaking.queues[queueKey].push({
        socketId: socket.id,
        userId,
        username: username || 'Player',
        queuedAt: Date.now()
      });
      console.log('🎯 Player joined variant queue:', queueKey, username);
    }
    
    // Try to match two players
    if (variantMatchmaking.queues[queueKey].length >= 2) {
      const playerA = variantMatchmaking.queues[queueKey].shift();
      const playerB = variantMatchmaking.queues[queueKey].shift();
      
      const roomId = `variant_mm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const variantConfig = variantMatchmaking.getConfig(queueKey);
      
      // Create room with config based on variant type
      rooms[roomId] = {
        board: {},
        players: [
          { socketId: playerA.socketId, oderId: playerA.userId, username: playerA.username, side: 'X' },
          { socketId: playerB.socketId, oderId: playerB.userId, username: playerB.username, side: 'O' }
        ],
        moves: [],
        started_at: new Date().toISOString(),
        mode: 'variant',
        variant_type: queueKey,
        variant_config: variantConfig,
        swap2_enabled: variantConfig.swap2Enabled,
        swap2_state: variantConfig.swap2Enabled ? {
          phase: 'swap2_placement',
          tentative_stones: [],
          actions: []
        } : null,
        game_phase: variantConfig.swap2Enabled ? 'swap2' : 'main_game'
      };
      
      // Join both players to room
      const socketA = io.sockets.sockets.get(playerA.socketId);
      const socketB = io.sockets.sockets.get(playerB.socketId);
      
      if (socketA) socketA.join(roomId);
      if (socketB) socketB.join(roomId);
      
      // Notify both players
      io.to(playerA.socketId).emit('variant_match_found', {
        roomId,
        opponent: playerB.username,
        side: 'X',
        config: variantConfig
      });
      
      io.to(playerB.socketId).emit('variant_match_found', {
        roomId,
        opponent: playerA.username,
        side: 'O',
        config: variantConfig
      });
      
      console.log('🎮 Variant match created:', roomId, playerA.username, 'vs', playerB.username);
      
      // Clean up socket mappings
      delete variantMatchmaking.socketToUser[playerA.socketId];
      delete variantMatchmaking.socketToUser[playerB.socketId];
    } else {
      // Still waiting
      socket.emit('variant_queue_waiting', {
        position: variantMatchmaking.queues[queueKey].length
      });
    }
  });
  
  // Leave variant matchmaking queue
  socket.on('leave_variant_queue', (data) => {
    const { variantType } = data || {};
    const queueKey = variantType || 'custom';
    
    if (variantMatchmaking.queues[queueKey]) {
      variantMatchmaking.queues[queueKey] = variantMatchmaking.queues[queueKey].filter(p => p.socketId !== socket.id);
      console.log('🚪 Player left variant queue:', queueKey);
    }
    delete variantMatchmaking.socketToUser[socket.id];
  });
  
  // Create variant room (for private/friend games)
  socket.on('create_variant_room', (data) => {
    const { roomId, userId, username, config } = data;
    
    rooms[roomId] = {
      board: {},
      players: [{ socketId: socket.id, oderId: userId, username }],
      moves: [],
      started_at: new Date().toISOString(),
      mode: 'variant',
      variant_config: config,
      swap2_enabled: config.swap2Enabled || false,
      swap2_state: config.swap2Enabled ? {
        phase: 'swap2_placement',
        tentative_stones: [],
        actions: []
      } : null,
      game_phase: config.swap2Enabled ? 'swap2' : 'main_game'
    };
    
    socket.join(roomId);
    console.log('🎮 Variant room created:', roomId, config);
    
    socket.emit('variant_room_created', {
      roomId,
      config,
      waiting: true
    });
  });
  
  // Join variant room
  socket.on('join_variant_room', (data) => {
    const { roomId, userId, username } = data;
    const r = rooms[roomId];
    
    if (!r) {
      socket.emit('variant_error', { error: 'Room not found' });
      return;
    }
    
    if (r.players.length >= 2) {
      socket.emit('variant_error', { error: 'Room is full' });
      return;
    }
    
    socket.join(roomId);
    r.players.push({ socketId: socket.id, userId, username });
    
    // Notify host that opponent joined
    io.to(roomId).emit('variant_opponent_joined', {
      username: username || 'Opponent',
      userId
    });
    
    console.log('👥 Player joined variant room:', roomId, username);
  });
  
  // Variant move
  socket.on('variant_move', (data) => {
    const { roomId, x, y, player } = data;
    const r = rooms[roomId];
    
    if (!r) return;
    
    const key = `${x}_${y}`;
    if (r.board[key]) return; // occupied
    
    r.board[key] = player;
    r.moves.push({ x, y, player, created_at: new Date().toISOString() });
    
    // Broadcast to other players in room
    socket.to(roomId).emit('variant_move', { x, y, player });
  });
  
  // Variant game over
  socket.on('variant_game_over', (data) => {
    const { roomId, winner, isDraw } = data;
    
    // Broadcast to other players
    socket.to(roomId).emit('variant_game_over', { winner, isDraw });
  });
});

// =====================================================================
// NOTIFICATION REALTIME EVENTS
// Requirements: 5.1, 5.2, 5.3 (admin-notification-inbox)
// =====================================================================

// Store user socket mappings for targeted notifications
const userSockets = {}; // userId -> Set of socketIds

// Track user connections for notifications
io.on('connection', (socket) => {
  if (socket.user?.id) {
    if (!userSockets[socket.user.id]) {
      userSockets[socket.user.id] = new Set();
    }
    userSockets[socket.user.id].add(socket.id);
    console.log('📬 User connected for notifications:', socket.user.id);
  }

  socket.on('disconnect', () => {
    if (socket.user?.id && userSockets[socket.user.id]) {
      userSockets[socket.user.id].delete(socket.id);
      if (userSockets[socket.user.id].size === 0) {
        delete userSockets[socket.user.id];
      }
    }
  });
});

/**
 * Send notification to specific user(s) via socket
 * Called by PHP backend when notification is created
 */
function emitNotificationToUsers(userIds, notification) {
  for (const userId of userIds) {
    const sockets = userSockets[userId];
    if (sockets && sockets.size > 0) {
      for (const socketId of sockets) {
        io.to(socketId).emit('new_notification', {
          id: notification.id,
          title: notification.title,
          content_preview: notification.content_preview || notification.content?.substring(0, 100),
          sender_name: notification.sender_name || 'Admin',
          is_broadcast: notification.is_broadcast || false,
          created_at: notification.created_at || new Date().toISOString()
        });
      }
      console.log('📬 Notification sent to user:', userId);
    }
  }
}

// Endpoint for PHP backend to trigger notification events
app.post('/api/internal/notify', (req, res) => {
  const { user_ids, notification } = req.body;
  
  if (!user_ids || !notification) {
    return res.status(400).json({ error: 'user_ids and notification required' });
  }

  emitNotificationToUsers(user_ids, notification);
  
  res.json({ 
    success: true, 
    notified_count: user_ids.filter(id => userSockets[id]?.size > 0).length 
  });
});

// Broadcast notification to all connected users
app.post('/api/internal/notify-all', (req, res) => {
  const { notification } = req.body;
  
  if (!notification) {
    return res.status(400).json({ error: 'notification required' });
  }

  io.emit('new_notification', {
    id: notification.id,
    title: notification.title,
    content_preview: notification.content_preview || notification.content?.substring(0, 100),
    sender_name: notification.sender_name || 'Admin',
    is_broadcast: true,
    created_at: notification.created_at || new Date().toISOString()
  });
  
  console.log('📬 Broadcast notification sent to all users');
  res.json({ success: true, broadcast: true });
});

console.log('✅ Notification realtime endpoints registered');

// =====================================================================
// END NOTIFICATION REALTIME EVENTS
// =====================================================================

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log('Socket server listening on', PORT));



