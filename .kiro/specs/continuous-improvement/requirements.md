# Requirements Document

## Introduction

This document captures bugs, issues, and improvement opportunities discovered during a comprehensive codebase audit of the MindPoint Arena Gomoku/Caro game platform. The system consists of a React frontend, PHP backend, Node.js socket server, and Python AI analysis service.

## Glossary

- **System**: The MindPoint Arena game platform
- **Swap2**: Opening rule where players can swap colors after initial stone placement
- **VCF**: Victory by Continuous Fours - a winning sequence
- **Series**: Best-of-3 ranked match format
- **Socket Server**: Node.js server handling real-time game events

## Requirements

### Requirement 1: Fix Swap2ManagerService Truncation Bug

**User Story:** As a developer, I want the Swap2ManagerService to handle all edge cases properly, so that the Swap 2 opening rule works correctly.

#### Acceptance Criteria

1. WHEN the Swap2ManagerService attempts state recovery THEN the system SHALL complete the `attemptStateRecovery` method without truncation
2. WHEN a stone count exceeds placement limit THEN the system SHALL properly handle the recovery case
3. WHEN state corruption is detected THEN the system SHALL log the issue and attempt recovery

### Requirement 2: Fix Server Index.js Incomplete Socket Handler

**User Story:** As a player, I want the socket server to handle all Swap 2 events correctly, so that the game flows smoothly.

#### Acceptance Criteria

1. WHEN a player chooses 'place_more' during Swap 2 THEN the system SHALL transition to the extra placement phase
2. WHEN a player makes a color choice THEN the system SHALL assign colors and transition to main game
3. WHEN Swap 2 completes THEN the system SHALL emit the completion event to all players in the room

### Requirement 3: Fix Race Condition in useSeriesRealtime Hook

**User Story:** As a player, I want the series realtime updates to work reliably, so that I see accurate game state.

#### Acceptance Criteria

1. WHEN the seriesData changes THEN the system SHALL update the disconnect state correctly
2. WHEN presence sync occurs THEN the system SHALL check opponent presence using current seriesData
3. WHEN the hook unmounts THEN the system SHALL clean up all timers and subscriptions

### Requirement 4: Improve Error Handling in AI Analysis

**User Story:** As a player, I want the AI analysis to handle errors gracefully, so that I always get useful feedback.

#### Acceptance Criteria

1. WHEN the AI service times out THEN the system SHALL return a fallback basic analysis
2. WHEN the VCF search fails THEN the system SHALL continue with basic analysis
3. WHEN the API key is missing THEN the system SHALL provide helpful fallback responses

### Requirement 5: Fix Memory Leak in Swap2 State Storage

**User Story:** As a system administrator, I want the server to manage memory efficiently, so that it can handle many concurrent games.

#### Acceptance Criteria

1. WHEN a game ends THEN the system SHALL clear the Swap2 state from memory
2. WHEN a room is deleted THEN the system SHALL clean up all associated state
3. WHEN the server restarts THEN the system SHALL not retain stale state

### Requirement 6: Improve GameBoard Swap2 Stone Rendering

**User Story:** As a player, I want to clearly see the tentative stones during Swap 2, so that I can make informed decisions.

#### Acceptance Criteria

1. WHEN tentative stones are placed THEN the system SHALL display them with clear visual distinction
2. WHEN the latest stone is placed THEN the system SHALL highlight it with animation
3. WHEN hovering over valid positions THEN the system SHALL show placement preview

### Requirement 7: Fix PHP Backend Swap2 API Endpoints

**User Story:** As a developer, I want the PHP backend to expose complete Swap2 API endpoints, so that the frontend can interact with the Swap2 system.

#### Acceptance Criteria

1. WHEN POST /api/swap2/place-stone is called THEN the system SHALL validate and process the stone placement
2. WHEN POST /api/swap2/make-choice is called THEN the system SHALL validate and process the color choice
3. WHEN POST /api/swap2/initialize is called THEN the system SHALL create a new Swap2 state

### Requirement 8: Improve Series Manager Side Assignment

**User Story:** As a player, I want the side assignment to work correctly with Swap 2, so that the game is fair.

#### Acceptance Criteria

1. WHEN Swap 2 completes THEN the system SHALL use the Swap 2 color assignment for player sides
2. WHEN a new game starts in series THEN the system SHALL initialize fresh Swap 2 state
3. WHEN Swap 2 is disabled THEN the system SHALL fall back to traditional side swapping

### Requirement 9: Fix AI Basic Analyzer Exception Handling

**User Story:** As a player, I want the AI analyzer to handle edge cases, so that analysis never crashes.

#### Acceptance Criteria

1. WHEN the `_check_missed_win` method encounters an exception THEN the system SHALL catch it and return None
2. WHEN the opening book lookup fails THEN the system SHALL continue without opening info
3. WHEN the endgame analyzer fails THEN the system SHALL fall back to basic evaluation

### Requirement 10: Improve Socket Server Matchmaking

**User Story:** As a player, I want matchmaking to work reliably, so that I can find opponents quickly.

#### Acceptance Criteria

1. WHEN a player disconnects while in queue THEN the system SHALL remove them from the queue
2. WHEN a match is found THEN the system SHALL create the room with correct Swap2 configuration
3. WHEN series creation fails THEN the system SHALL still allow casual play

