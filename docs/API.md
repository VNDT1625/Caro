# API Reference

## REST API (PHP Backend - :8001)

### Series (Ranked Bo3)
```
POST /api/series           # Create series
GET  /api/series/:id       # Get series details
POST /api/series/:id/game  # Record game result
```

### Swap2
```
POST /api/swap2/place      # Place stones
POST /api/swap2/choice     # Make choice (black/white/place_more)
GET  /api/swap2/:id/state  # Get current state
```

### Analysis
```
POST /api/analysis/analyze # Analyze match
GET  /api/analysis/usage   # Get usage stats
```

### Payment (VNPAY)
```
POST /api/payment/create   # Create payment session
GET  /api/payment/callback # VNPAY callback
GET  /api/payment/status   # Check payment status
```

### Currency
```
POST /api/currency/purchase # Purchase coins/gems
GET  /api/currency/packages # List available packages
```

### Skills
```
GET  /api/skills           # List all skills
GET  /api/skills/user      # Get user's skills
POST /api/skills/use       # Use skill in match
```

### Titles
```
GET  /api/titles           # List all titles
GET  /api/titles/user      # Get user's titles
POST /api/titles/equip     # Equip title
```

### Reports & Bans
```
POST /api/reports          # Submit report
GET  /api/reports          # List reports (admin)
POST /api/reports/:id/action  # Take action (admin)
GET  /api/appeals          # List appeals (admin)
POST /api/appeals          # Submit appeal
GET  /api/bans/check       # Check user ban status
```

### Notifications
```
GET  /api/notifications    # Get user notifications
POST /api/notifications    # Send notification (admin)
POST /api/notifications/:id/read  # Mark as read
```

## Socket Events (Node.js - :8000)

### Client → Server
```javascript
socket.emit('join_room', { roomId, userId })
socket.emit('make_move', { roomId, x, y, userId })
socket.emit('chat_message', { roomId, message })
socket.emit('rematch_request', { roomId, userId })
```

### Server → Client
```javascript
socket.on('player_joined', { userId, side })
socket.on('move_made', { x, y, player, moveNumber })
socket.on('game_over', { winner, reason })
socket.on('chat_message', { userId, message, timestamp })
socket.on('rematch_accepted', { newRoomId })
```

### Presence
```javascript
socket.on('player_online', { userId })
socket.on('player_offline', { userId })
```

## AI Service (Python FastAPI - :8004)

### Analysis
```
POST /analyze
Body: { match_id, moves, tier }
Response: { evaluation, mistakes, suggestions, timeline }

POST /ask
Body: { session_id, question }
Response: { answer, context }
```

### Replay
```
POST /replay/create
Body: { match_id, moves }
Response: { session_id }

POST /replay/navigate
Body: { session_id, move_number }
Response: { board_state, evaluation }

POST /replay/play
Body: { session_id, x, y }
Response: { ai_response, evaluation }
```

### Health
```
GET /health
Response: { status: "ok" }
```

## Supabase Realtime

### Subscriptions
```typescript
// Subscribe to series changes
supabase
  .channel('series:' + seriesId)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'ranked_series',
    filter: `id=eq.${seriesId}`
  }, handleChange)
  .subscribe()
```

### Events
- `series_created`
- `series_game_ended`
- `series_score_updated`
- `series_side_swapped`
- `series_next_game_ready`
- `series_completed`
- `series_player_disconnected`
- `series_player_reconnected`
