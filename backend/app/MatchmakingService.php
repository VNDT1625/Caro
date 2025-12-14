<?php
namespace App;

use App\Services\SeriesManagerServiceInterface;

class MatchmakingService
{
    private ?SeriesManagerServiceInterface $seriesManager = null;
    private array $queues = [];
    private ?\PDO $db = null;

    public function __construct()
    {
    }

    public function setDatabase(\PDO $db): self
    {
        $this->db = $db;
        return $this;
    }

    public function setSeriesManager(SeriesManagerServiceInterface $seriesManager): self
    {
        $this->seriesManager = $seriesManager;
        return $this;
    }

    /**
     * Enqueue a player for matchmaking
     * @param array $player ['user_id' => string, 'mindpoint' => int, 'mode' => 'ranked'|'casual']
     * @return array|null Match result if found, null if queued
     */
    public function enqueuePlayer(array $player): ?array
    {
        $userId = $player['user_id'] ?? null;
        $mode = $player['mode'] ?? 'casual';
        $mindpoint = $player['mindpoint'] ?? 0;

        if (!$userId) {
            throw new \InvalidArgumentException('user_id is required');
        }

        // Initialize queue for mode if not exists
        if (!isset($this->queues[$mode])) {
            $this->queues[$mode] = [];
        }

        // Check if player already in queue
        foreach ($this->queues[$mode] as $queuedPlayer) {
            if ($queuedPlayer['user_id'] === $userId) {
                return null; // Already queued
            }
        }

        // Try to find a match
        $match = $this->findMatch($userId, $mindpoint, $mode);

        if ($match) {
            return $match;
        }

        // No match found, add to queue
        $this->queues[$mode][] = [
            'user_id' => $userId,
            'mindpoint' => $mindpoint,
            'queued_at' => time(),
        ];

        return null;
    }

    /**
     * Find a suitable opponent from the queue
     */
    private function findMatch(string $userId, int $mindpoint, string $mode): ?array
    {
        if (!isset($this->queues[$mode]) || empty($this->queues[$mode])) {
            return null;
        }

        $bestMatch = null;
        $bestMatchIndex = -1;
        $bestMpDiff = PHP_INT_MAX;

        // Find closest mindpoint match
        foreach ($this->queues[$mode] as $index => $queuedPlayer) {
            if ($queuedPlayer['user_id'] === $userId) {
                continue;
            }

            $mpDiff = abs($queuedPlayer['mindpoint'] - $mindpoint);

            // Accept match if within 200 MP range or waited > 30 seconds
            $waitTime = time() - $queuedPlayer['queued_at'];
            $acceptableRange = min(200 + ($waitTime * 10), 1000); // Expand range over time

            if ($mpDiff <= $acceptableRange && $mpDiff < $bestMpDiff) {
                $bestMatch = $queuedPlayer;
                $bestMatchIndex = $index;
                $bestMpDiff = $mpDiff;
            }
        }

        if ($bestMatch === null) {
            return null;
        }

        // Remove matched player from queue
        array_splice($this->queues[$mode], $bestMatchIndex, 1);

        // Create match result
        return $this->createMatch($userId, $bestMatch['user_id'], $mode);
    }

    /**
     * Create a match between two players
     */
    private function createMatch(string $player1Id, string $player2Id, string $mode): array
    {
        $roomId = $this->generateRoomId();
        $seriesId = null;

        // For ranked mode, create a series
        if ($mode === 'ranked' && $this->seriesManager !== null) {
            try {
                $series = $this->seriesManager->createSeries($player1Id, $player2Id);
                $seriesId = $series['id'];
            } catch (\Exception $e) {
                error_log('Failed to create series: ' . $e->getMessage());
                // Continue without series for now
            }
        }

        // Create room in database if available
        if ($this->db !== null) {
            try {
                $this->createRoom($roomId, $player1Id, $player2Id, $mode, $seriesId);
            } catch (\Exception $e) {
                error_log('Failed to create room: ' . $e->getMessage());
            }
        }

        return [
            'room_id' => $roomId,
            'series_id' => $seriesId,
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
            'mode' => $mode,
            'created_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Create room and room_players records
     * Note: series_id is stored in matches table, not rooms table
     */
    private function createRoom(string $roomId, string $player1Id, string $player2Id, string $mode, ?string $seriesId): void
    {
        if ($this->db === null) {
            return;
        }

        // Determine sides - if series exists, use series sides
        $player1Side = 'X';
        $player2Side = 'O';

        if ($seriesId !== null && $this->seriesManager !== null) {
            $seriesState = $this->seriesManager->getSeriesState($seriesId);
            if ($seriesState !== null) {
                $series = $seriesState['series'];
                $player1Side = $series['player1_side'];
                $player2Side = $series['player2_side'];
            }
        }

        // Insert room (series_id is stored in matches, not rooms)
        $stmt = $this->db->prepare(
            'INSERT INTO rooms (id, mode, status, created_at) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$roomId, $mode, 'waiting', date('Y-m-d H:i:s')]);

        // Insert room_players
        $stmt = $this->db->prepare(
            'INSERT INTO room_players (room_id, user_id, player_side) VALUES (?, ?, ?)'
        );
        $stmt->execute([$roomId, $player1Id, $player1Side]);
        $stmt->execute([$roomId, $player2Id, $player2Side]);
    }

    /**
     * Remove a player from the queue
     */
    public function dequeuePlayer(string $userId, string $mode = 'ranked'): bool
    {
        if (!isset($this->queues[$mode])) {
            return false;
        }

        foreach ($this->queues[$mode] as $index => $player) {
            if ($player['user_id'] === $userId) {
                array_splice($this->queues[$mode], $index, 1);
                return true;
            }
        }

        return false;
    }

    /**
     * Get queue status for a player
     */
    public function getQueueStatus(string $userId, string $mode = 'ranked'): ?array
    {
        if (!isset($this->queues[$mode])) {
            return null;
        }

        foreach ($this->queues[$mode] as $index => $player) {
            if ($player['user_id'] === $userId) {
                return [
                    'position' => $index + 1,
                    'total_in_queue' => count($this->queues[$mode]),
                    'wait_time' => time() - $player['queued_at'],
                ];
            }
        }

        return null;
    }

    /**
     * Get total players in queue for a mode
     */
    public function getQueueCount(string $mode = 'ranked'): int
    {
        return count($this->queues[$mode] ?? []);
    }

    /**
     * Generate a unique room ID
     */
    private function generateRoomId(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    /**
     * For testing: get current queues
     */
    public function getQueues(): array
    {
        return $this->queues;
    }

    /**
     * For testing: clear all queues
     */
    public function clearQueues(): void
    {
        $this->queues = [];
    }
}