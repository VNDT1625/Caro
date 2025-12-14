<?php

namespace App\Services;

/**
 * AIBridgeServiceInterface
 * 
 * Interface for communicating with the Python AI analysis service.
 * Handles HTTP calls with timeouts, retries, and error handling.
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 16.1**
 */
interface AIBridgeServiceInterface
{
    /**
     * Analyze a match using the Python AI service.
     * 
     * Requirements: 4.1 - Multi-language support (vi, en, zh, ja)
     * 
     * @param string $matchId Match UUID
     * @param array $moves List of moves [{x, y, player}, ...]
     * @param string $tier Analysis tier ('basic' or 'pro')
     * @param string $userId User UUID
     * @param string|null $difficulty Optional training difficulty
     * @param string|null $language Language for comments (vi, en, zh, ja). Default: vi
     * @return array|null Analysis result with multi-language comments, or null on failure
     */
    public function analyzeMatch(
        string $matchId,
        array $moves,
        string $tier,
        string $userId,
        ?string $difficulty = null,
        ?string $language = 'vi'
    ): ?array;

    /**
     * Ask a question about a match using AI Q&A.
     * 
     * @param string $matchId Match UUID
     * @param string $question User's question
     * @param string $userId User UUID
     * @return array|null Answer result with actions, or null on failure
     */
    public function askQuestion(
        string $matchId,
        string $question,
        string $userId
    ): ?array;

    /**
     * Create a replay session for a match.
     * 
     * @param string $matchId Match UUID
     * @param string $userId User UUID
     * @return array|null Session info {session_id, total_moves}, or null on failure
     */
    public function createReplaySession(
        string $matchId,
        string $userId
    ): ?array;

    /**
     * Navigate to a specific move in a replay session.
     * 
     * @param string $sessionId Replay session ID
     * @param int $moveIndex Move index to navigate to
     * @return array|null Board state at move, or null on failure
     */
    public function navigateReplay(
        string $sessionId,
        int $moveIndex
    ): ?array;

    /**
     * Play an alternative move in replay mode.
     * 
     * @param string $sessionId Replay session ID
     * @param array $move Move to play {x, y}
     * @return array|null Updated state with AI response, or null on failure
     */
    public function playReplayMove(
        string $sessionId,
        array $move
    ): ?array;

    /**
     * Get usage information for a user.
     * 
     * @param string $userId User UUID
     * @return array|null Usage info, or null on failure
     */
    public function getUsage(string $userId): ?array;

    /**
     * Check if the Python AI service is healthy.
     * 
     * @return bool True if service is reachable and healthy
     */
    public function healthCheck(): bool;
}
