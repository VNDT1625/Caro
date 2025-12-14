# Realtime Integration Guide - Ranked BO3 System

## Overview

The Ranked BO3 System uses Supabase Realtime to provide live updates for series events. This document describes the complete realtime integration including event types, subscriptions, and client-side handling.

**Requirements: 7.1, 7.2, 8.3, 8.5**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  useSeriesRealtime Hook                              │  │
│  │  - Subscribes to ranked_series table changes         │  │
│  │  - Tracks presence (player online/offline)           │  │
│  │  - Manages disconnect timeout countdown              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Supabase Realtime (WebSocket)                  │
│  - postgres_changes: ranked_series table updates            │
│  - presence: Player online/offline tracking                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Database                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ranked_series table                                 │  │
│  │  - Realtime enabled via supabase_realtime publication│  │
│  │  - RLS policies for player access                    │  │
│  │  - Triggers for updated_at timestamp                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (PHP)                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SeriesManager Service                               │  │
│  │  - Creates/updates series                            │  │
│  │  - Emits events via database updates                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Event Types

### 1. Series Created Event
**Type:** `series_created`
**Trigger:** When a new series is created via matchmaking
**Payload:**
```typescript
{
  type: 'series_created',
  seriesId: string,
  player1Id: string,
  player2Id: string,
  player1InitialMP: number,
  player2InitialMP: number,
  player1InitialRank: string,
  player2InitialRank: string,
  player1Side: 'X' | 'O',
  player2Side: 'X' | 'O',
  timestamp: string
}
```

### 2. Game Ended Event
**Type:** `series_game_ended`
**Trigger:** When a game in the series ends
**Payload:**
```typescript
{
  type: 'series_game_ended',
  seriesId: string,
  matchId: string,
  winnerId: string | null,
  gameNumber: number,
  score: string,  // e.g., "1-0"
  isSeriesComplete: boolean,
  timestamp: string
}
```

### 3. Score Updated Event
**Type:** `series_score_updated`
**Trigger:** When series score changes
**Payload:**
```typescript
{
  type: 'series_score_updated',
  seriesId: string,
  score: string,  // e.g., "1-0"
  player1Wins: number,
  player2Wins: number,
  gamesPlayed: number,
  timestamp: string
}
```

### 4. Side Swapped Event
**Type:** `series_side_swapped`
**Trigger:** When player sides are swapped between games
**Payload:**
```typescript
{
  type: 'series_side_swapped',
  seriesId: string,
  nextGameNumber: number,
  player1Side: 'X' | 'O',
  player2Side: 'X' | 'O',
  timestamp: string
}
```

### 5. Next Game Ready Event
**Type:** `series_next_game_ready`
**Trigger:** When the next game is ready to start
**Payload:**
```typescript
{
  type: 'series_next_game_ready',
  seriesId: string,
  gameNumber: number,
  player1Side: 'X' | 'O',
  player2Side: 'X' | 'O',
  currentScore: string,
  countdownSeconds: number,
  timestamp: string
}
```

### 6. Series Completed Event
**Type:** `series_completed`
**Trigger:** When a player wins 2 games
**Payload:**
```typescript
{
  type: 'series_completed',
  seriesId: string,
  winnerId: string,
  loserId: string,
  finalScore: string,  // e.g., "2-1"
  rewards: {
    winner: { mp: number, coins: number, exp: number },
    loser: { mp: number, coins: number, exp: number }
  } | null,
  timestamp: string
}
```

### 7. Player Disconnected Event
**Type:** `series_player_disconnected`
**Trigger:** When a player disconnects
**Payload:**
```typescript
{
  type: 'series_player_disconnected',
  seriesId: string,
  playerId: string,
  disconnectedAt: string,
  timeoutSeconds: number
}
```

### 8. Player Reconnected Event
**Type:** `series_player_reconnected`
**Trigger:** When a disconnected player reconnects
**Payload:**
```typescript
{
  type: 'series_player_reconnected',
  seriesId: string,
  playerId: string,
  reconnectedAt: string
}
```

### 9. Game Forfeited Event
**Type:** `series_game_forfeited`
**Trigger:** When a player forfeits a game
**Payload:**
```typescript
{
  type: 'series_game_forfeited',
  seriesId: string,
  forfeitingPlayerId: string,
  isSeriesComplete: boolean,
  seriesScore: string
}
```

### 10. Series Abandoned Event
**Type:** `series_abandoned`
**Trigger:** When a player abandons the series
**Payload:**
```typescript
{
  type: 'series_abandoned',
  seriesId: string,
  abandoningPlayerId: string,
  winnerId: string,
  abandonPenalty: number,
  finalScore: string
}
```

## Frontend Implementation

### useSeriesRealtime Hook

Located in `frontend/src/hooks/useSeriesRealtime.ts`

**Features:**
- Subscribes to ranked_series table changes
- Tracks player presence (online/offline)
- Manages disconnect timeout countdown
- Emits typed events for each series state change
- Handles reconnection logic

**Usage:**
```typescript
import { useSeriesRealtime, SeriesEvents } from '../hooks/useSeriesRealtime'

function MyComponent() {
  const {
    seriesData,
    isLoading,
    error,
    disconnectState,
    isSubscribed,
    refetch
  } = useSeriesRealtime({
    seriesId: 'series-uuid',
    userId: 'user-uuid',
    enabled: true,
    onGameEnded: (event) => {
      console.log('Game ended:', event)
    },
    onSeriesCompleted: (event) => {
      console.log('Series completed:', event)
    },
    onSideSwapped: (event) => {
      console.log('Sides swapped:', event)
    },
    onNextGameReady: (event) => {
      console.log('Next game ready:', event)
    },
    onPlayerDisconnected: (event) => {
      console.log('Player disconnected:', event)
    },
    onPlayerReconnected: (event) => {
      console.log('Player reconnected:', event)
    },
    onGameForfeited: (event) => {
      console.log('Game forfeited:', event)
    },
    onSeriesAbandoned: (event) => {
      console.log('Series abandoned:', event)
    },
    onSeriesDataChanged: (data) => {
      console.log('Series data changed:', data)
    }
  })

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {seriesData && (
        <div>
          <p>Score: {seriesData.player1_wins}-{seriesData.player2_wins}</p>
          <p>Game: {seriesData.current_game} of 3</p>
          {disconnectState.isDisconnected && (
            <p>Opponent disconnected. Reconnecting in {disconnectState.remainingSeconds}s</p>
          )}
        </div>
      )}
    </div>
  )
}
```

### Disconnect Handling

The hook automatically:
1. Detects when opponent disconnects via presence tracking
2. Starts a 60-second countdown timer
3. Emits `onPlayerDisconnected` event
4. Monitors for reconnection
5. Emits `onPlayerReconnected` event if opponent reconnects within timeout
6. Allows game to continue if reconnected

### Integration in InMatch Component

The `frontend/src/pages/InMatch.tsx` component uses the hook to:
- Display disconnect warning when opponent disconnects
- Show countdown timer for reconnection timeout
- Handle forfeit when timeout expires
- Display series score and game number
- Show rank-up animation when series is won
- Handle rematch requests

## Database Configuration

### Realtime Publication

The `ranked_series` table is enabled for realtime via:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranked_series;
```

### RLS Policies

Players can only see and update their own series:
```sql
-- View own series
CREATE POLICY "Users can view own series" ON public.ranked_series
    FOR SELECT
    USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Update own series
CREATE POLICY "Players can update own series" ON public.ranked_series
    FOR UPDATE
    USING (auth.uid() = player1_id OR auth.uid() = player2_id);
```

### Presence Tracking

The hook uses Supabase presence to track player online/offline status:
```typescript
// Track own presence
await channel.track({
  user_id: userId,
  online_at: new Date().toISOString()
})

// Listen for presence changes
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState()
  // Check if opponent is present
})
```

## Event Flow Example

### Typical Series Flow

1. **Series Created**
   - Matchmaking creates series
   - `series_created` event emitted
   - Frontend receives series data

2. **Game 1 Starts**
   - Players make moves
   - Game ends with winner

3. **Game 1 Ended**
   - `series_game_ended` event emitted
   - `series_score_updated` event emitted
   - Score is now 1-0

4. **Side Swap**
   - `series_side_swapped` event emitted
   - `series_next_game_ready` event emitted
   - 10-second countdown starts

5. **Game 2 Starts**
   - Players make moves
   - Game ends with winner

6. **Game 2 Ended**
   - `series_game_ended` event emitted
   - `series_score_updated` event emitted
   - Score is now 1-1

7. **Side Swap**
   - `series_side_swapped` event emitted
   - `series_next_game_ready` event emitted
   - 10-second countdown starts

8. **Game 3 Starts**
   - Players make moves
   - Game ends with winner

9. **Series Completed**
   - `series_completed` event emitted
   - Final score is 2-1
   - Rewards calculated and displayed

### Disconnect Flow

1. **Player Disconnects**
   - Presence tracking detects disconnect
   - `series_player_disconnected` event emitted
   - 60-second countdown starts

2. **Player Reconnects (within 60s)**
   - Presence tracking detects reconnect
   - `series_player_reconnected` event emitted
   - Game continues normally

3. **Timeout Expires (after 60s)**
   - Backend forfeits game
   - `series_game_forfeited` event emitted
   - Game ends with opponent as winner

## Testing

### Property-Based Tests

Located in `backend/tests/SeriesRealtimeIntegrationTest.php`

Tests verify:
- Event structure correctness
- Event emission order
- Data completeness for realtime
- Timestamp presence in all events
- Presence tracking data structure

### Running Tests

```bash
php backend/run_realtime_tests.php
```

## Performance Considerations

1. **Subscription Limits**
   - Each player subscribes to their own series channel
   - Presence tracking uses efficient delta updates
   - Realtime events are batched when possible

2. **Bandwidth Optimization**
   - Only changed fields are sent in updates
   - Presence tracking uses minimal payload
   - Events are structured to avoid redundancy

3. **Latency**
   - WebSocket connection provides <100ms latency
   - Presence updates are near-instantaneous
   - Disconnect detection is within 1-2 seconds

## Troubleshooting

### Events Not Received

1. Check Supabase realtime is enabled:
   ```sql
   SELECT schemaname, tablename 
   FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   ```

2. Verify RLS policies allow access:
   ```sql
   SELECT * FROM ranked_series WHERE id = 'series-id';
   ```

3. Check browser console for WebSocket errors

### Disconnect Not Detected

1. Verify presence tracking is enabled
2. Check network connectivity
3. Ensure 60-second timeout is configured

### Events Out of Order

1. Events are emitted in database transaction order
2. Frontend should handle events idempotently
3. Use timestamps to detect out-of-order events

## Future Enhancements

1. **Event Batching**
   - Batch multiple events into single update
   - Reduce network traffic

2. **Event Replay**
   - Store event history for late joiners
   - Allow series recovery after disconnect

3. **Offline Support**
   - Queue events while offline
   - Sync when connection restored

4. **Analytics**
   - Track event latency
   - Monitor realtime performance
   - Detect connection issues

## References

- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Supabase Presence: https://supabase.com/docs/guides/realtime/presence
- Requirements: 7.1, 7.2, 8.3, 8.5
