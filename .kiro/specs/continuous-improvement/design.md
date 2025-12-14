# Design Document

## Overview

This design document outlines the fixes and improvements for bugs discovered during the codebase audit. The focus is on critical issues that affect gameplay, particularly around the Swap 2 opening rule, series management, and AI analysis.

## Architecture

The system follows a microservices architecture:
- **Frontend (React)**: User interface and game board
- **Socket Server (Node.js)**: Real-time game events and matchmaking
- **PHP Backend**: REST API, game logic, series management
- **AI Service (Python)**: Match analysis and recommendations

## Components and Interfaces

### 1. Swap2ManagerService (PHP)
- Manages Swap 2 state machine
- Validates stone placements and choices
- Handles state recovery

### 2. Socket Server Swap2 Handlers (Node.js)
- Processes swap2_place_stone events
- Processes swap2_make_choice events
- Broadcasts state updates

### 3. useSeriesRealtime Hook (React)
- Subscribes to series updates
- Manages disconnect detection
- Handles presence tracking

### 4. BasicAnalyzer (Python)
- Analyzes game moves
- Detects mistakes and patterns
- Integrates VCF/VCT search

## Data Models

### Swap2State
```typescript
interface Swap2State {
  phase: 'swap2_placement' | 'swap2_choice' | 'swap2_extra' | 'swap2_final_choice' | 'complete'
  player1Id: string
  player2Id: string
  activePlayerId: string
  tentativeStones: TentativeStone[]
  blackPlayerId: string | null
  whitePlayerId: string | null
  actions: Swap2Action[]
}
```

### TentativeStone
```typescript
interface TentativeStone {
  x: number
  y: number
  placedBy: string
  placementOrder: number
  phase: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Swap2 State Machine Consistency
*For any* Swap2 game, the phase transitions SHALL follow the valid state machine: placement → choice → (extra → final_choice | complete)
**Validates: Requirements 1.1, 2.1**

### Property 2: Stone Count Invariant
*For any* Swap2 state, the number of tentative stones SHALL match the expected count for the current phase (3 for choice, 5 for final_choice)
**Validates: Requirements 1.2, 6.1**

### Property 3: Active Player Correctness
*For any* Swap2 state, the active player SHALL be the correct player for the current phase (player1 for placement/final_choice, player2 for choice/extra)
**Validates: Requirements 2.2, 8.1**

### Property 4: Memory Cleanup
*For any* completed or abandoned game, the Swap2 state SHALL be cleared from memory within a reasonable time
**Validates: Requirements 5.1, 5.2**

### Property 5: Error Recovery
*For any* exception in AI analysis, the system SHALL return a valid fallback response without crashing
**Validates: Requirements 4.1, 9.1**

## Error Handling

1. **Swap2 State Corruption**: Attempt recovery, log error, reset to safe state
2. **Socket Disconnection**: Start timeout timer, allow reconnection
3. **AI Service Timeout**: Return basic analysis fallback
4. **Database Errors**: Log and return appropriate error response

## Testing Strategy

### Unit Tests
- Test Swap2 state transitions
- Test stone placement validation
- Test color assignment logic

### Property-Based Tests (Hypothesis)
- Test state machine invariants
- Test stone count constraints
- Test active player correctness

### Integration Tests
- Test full Swap2 flow through socket server
- Test series creation with Swap2
- Test AI analysis with various game states

