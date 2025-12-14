<?php

namespace App\Services;

use InvalidArgumentException;
use RuntimeException;

class SeriesManagerService implements SeriesManagerServiceInterface
{
    private const GAMES_TO_WIN = 2;
    private const MAX_GAMES = 3;

    private const RANK_THRESHOLDS = [
        'truyen_thuyet' => 5500,
        'ky_thanh' => 3000,
        'cao_ky' => 1500,
        'ky_lao' => 600,
        'hoc_ky' => 200,
        'tan_ky' => 50,
        'vo_danh' => 0,
    ];

    private ?\PDO $db = null;
    private $playerFetcher = null;
    private $seriesSaver = null;
    private $seriesFinder = null;
    private ?object $scoringEngine = null;
    private ?Swap2ManagerServiceInterface $swap2Manager = null;
    
    /** @var array<string, array> In-memory swap2 history storage for matches */
    private array $matchSwap2History = [];
    private $matchHistorySaver = null;

    public function __construct() {}

    public function setDatabase(\PDO $db): self
    {
        $this->db = $db;
        return $this;
    }

    public function setPlayerFetcher(callable $fetcher): self
    {
        $this->playerFetcher = $fetcher;
        return $this;
    }

    public function setSeriesSaver(callable $saver): self
    {
        $this->seriesSaver = $saver;
        return $this;
    }

    public function setSeriesFinder(callable $finder): self
    {
        $this->seriesFinder = $finder;
        return $this;
    }

    public function setScoringEngine(object $scoringEngine): self
    {
        $this->scoringEngine = $scoringEngine;
        return $this;
    }

    public function setSwap2Manager(Swap2ManagerServiceInterface $swap2Manager): self
    {
        $this->swap2Manager = $swap2Manager;
        return $this;
    }

    public function setMatchHistorySaver(callable $saver): self
    {
        $this->matchHistorySaver = $saver;
        return $this;
    }

    public function createSeries(string $player1Id, string $player2Id): array
    {
        if ($player1Id === $player2Id) {
            throw new InvalidArgumentException('Players must be different');
        }

        if (!$this->isValidUuid($player1Id) || !$this->isValidUuid($player2Id)) {
            throw new InvalidArgumentException('Invalid player UUID format');
        }

        $player1Data = $this->fetchPlayerData($player1Id);
        $player2Data = $this->fetchPlayerData($player2Id);

        if ($player1Data === null || $player2Data === null) {
            throw new InvalidArgumentException('One or both players not found');
        }

        $player1GetsX = (bool) random_int(0, 1);
        $player1Side = $player1GetsX ? 'X' : 'O';
        $player2Side = $player1GetsX ? 'O' : 'X';

        $player1MP = (int) ($player1Data['mindpoint'] ?? 0);
        $player2MP = (int) ($player2Data['mindpoint'] ?? 0);
        $player1Rank = $this->getRankFromMP($player1MP);
        $player2Rank = $this->getRankFromMP($player2MP);

        $seriesId = $this->generateUuid();
        $now = date('Y-m-d H:i:s');

        $series = [
            'id' => $seriesId,
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
            'player1_initial_mp' => $player1MP,
            'player2_initial_mp' => $player2MP,
            'player1_initial_rank' => $player1Rank,
            'player2_initial_rank' => $player2Rank,
            'player1_wins' => 0,
            'player2_wins' => 0,
            'games_to_win' => self::GAMES_TO_WIN,
            'current_game' => 1,
            'player1_side' => $player1Side,
            'player2_side' => $player2Side,
            'status' => 'in_progress',
            'winner_id' => null,
            'final_score' => null,
            'winner_mp_change' => null,
            'loser_mp_change' => null,
            'winner_coins' => null,
            'loser_coins' => null,
            'winner_exp' => null,
            'loser_exp' => null,
            'created_at' => $now,
            'started_at' => $now,
            'ended_at' => null,
            'updated_at' => $now,
        ];

        $this->saveSeries($series);

        // Initialize Swap 2 for the first game
        $swap2Init = $this->initializeGameSwap2($series['id']);
        $series['swap2State'] = $swap2Init['swap2State'];
        $series['gameId'] = $swap2Init['gameId'];

        return $series;
    }

    public function endGame(string $seriesId, string $matchId, ?string $winnerId, int $gameDuration): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        // Store Swap 2 history for this game if available
        $this->storeSwap2HistoryForGame($seriesId, $matchId);

        if ($winnerId === null) {
            return $this->advanceToNextGame($series);
        }

        if ($winnerId !== $series['player1_id'] && $winnerId !== $series['player2_id']) {
            throw new InvalidArgumentException('Winner is not part of this series');
        }

        if ($winnerId === $series['player1_id']) {
            $series['player1_wins'] = (int) $series['player1_wins'] + 1;
        } else {
            $series['player2_wins'] = (int) $series['player2_wins'] + 1;
        }

        if ($this->isSeriesComplete($series)) {
            return $this->markSeriesComplete($series, $winnerId);
        }

        return $this->advanceToNextGame($series);
    }

    /**
     * Store Swap 2 history for a completed game.
     * 
     * Automatically retrieves the Swap 2 state from the manager and stores it.
     * 
     * Requirements: 7.3
     * 
     * @param string $seriesId UUID of the series
     * @param string $matchId UUID of the match
     */
    private function storeSwap2HistoryForGame(string $seriesId, string $matchId): void
    {
        if ($this->swap2Manager === null) {
            return;
        }

        $series = $this->findSeries($seriesId);
        if ($series === null) {
            return;
        }

        $gameId = $seriesId . '_game_' . $series['current_game'];
        $swap2State = $this->swap2Manager->getState($gameId);

        if ($swap2State === null) {
            return;
        }

        // Get the complete history from the Swap 2 state
        $swap2History = $this->swap2Manager->getSwap2History($swap2State);
        
        // Store the history
        $this->storeSwap2History($seriesId, $matchId, $swap2History);
    }

    private function advanceToNextGame(array $series): array
    {
        // For ranked series, we use Swap 2 to determine sides
        // So we don't swap sides here anymore - Swap 2 will handle it
        $series['current_game'] = (int) $series['current_game'] + 1;
        $series['updated_at'] = date('Y-m-d H:i:s');

        $this->saveSeries($series);

        // Initialize fresh Swap 2 for the new game
        $swap2Init = $this->initializeGameSwap2($series['id']);

        return [
            'series' => $series,
            'isComplete' => false,
            'nextGameReady' => true,
            'swap2State' => $swap2Init['swap2State'],
            'gameId' => $swap2Init['gameId'],
        ];
    }

    private function markSeriesComplete(array $series, string $winnerId): array
    {
        $loserId = $winnerId === $series['player1_id']
            ? $series['player2_id']
            : $series['player1_id'];

        $series['status'] = 'completed';
        $series['winner_id'] = $winnerId;
        $series['final_score'] = $series['player1_wins'] . '-' . $series['player2_wins'];
        $series['ended_at'] = date('Y-m-d H:i:s');
        $series['updated_at'] = date('Y-m-d H:i:s');

        // Apply rewards to profiles
        $rankChanges = [];
        if ($this->scoringEngine !== null) {
            $applyResult = $this->scoringEngine->applyRewards($series);
            $rewards = $applyResult['rewards'] ?? [];
            $rankChanges = $applyResult['rankChanges'] ?? [];
            
            $series['winner_mp_change'] = $rewards['winner']['mp'] ?? null;
            $series['loser_mp_change'] = $rewards['loser']['mp'] ?? null;
            $series['winner_coins'] = $rewards['winner']['coins'] ?? null;
            $series['loser_coins'] = $rewards['loser']['coins'] ?? null;
            $series['winner_exp'] = $rewards['winner']['exp'] ?? null;
            $series['loser_exp'] = $rewards['loser']['exp'] ?? null;
        }

        $this->saveSeries($series);

        return [
            'series' => $series,
            'isComplete' => true,
            'nextGameReady' => false,
            'winnerId' => $winnerId,
            'loserId' => $loserId,
            'rewards' => [
                'winner' => [
                    'mp' => $series['winner_mp_change'] ?? 0,
                    'coins' => $series['winner_coins'] ?? 0,
                    'exp' => $series['winner_exp'] ?? 0,
                ],
                'loser' => [
                    'mp' => $series['loser_mp_change'] ?? 0,
                    'coins' => $series['loser_coins'] ?? 0,
                    'exp' => $series['loser_exp'] ?? 0,
                ],
            ],
            'rankChanges' => $rankChanges,
        ];
    }

    public function getSeriesState(string $seriesId): ?array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            return null;
        }

        return [
            'series' => $series,
            'isComplete' => $this->isSeriesComplete($series),
            'nextGameReady' => $series['status'] === 'in_progress',
        ];
    }

    public function completeSeries(string $seriesId): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        if (!$this->isSeriesComplete($series)) {
            throw new RuntimeException('Series is not ready to complete (no player has 2 wins)');
        }

        $winnerId = $series['player1_wins'] >= self::GAMES_TO_WIN
            ? $series['player1_id']
            : $series['player2_id'];

        $loserId = $winnerId === $series['player1_id']
            ? $series['player2_id']
            : $series['player1_id'];

        $series['status'] = 'completed';
        $series['winner_id'] = $winnerId;
        $series['final_score'] = $series['player1_wins'] . '-' . $series['player2_wins'];
        $series['ended_at'] = date('Y-m-d H:i:s');
        $series['updated_at'] = date('Y-m-d H:i:s');

        $rankChanges = [];
        if ($this->scoringEngine !== null) {
            // Calculate and apply rewards to profiles
            $applyResult = $this->scoringEngine->applyRewards($series);
            $rewards = $applyResult['rewards'] ?? [];
            $rankChanges = $applyResult['rankChanges'] ?? [];
            
            $series['winner_mp_change'] = $rewards['winner']['mp'] ?? null;
            $series['loser_mp_change'] = $rewards['loser']['mp'] ?? null;
            $series['winner_coins'] = $rewards['winner']['coins'] ?? null;
            $series['loser_coins'] = $rewards['loser']['coins'] ?? null;
            $series['winner_exp'] = $rewards['winner']['exp'] ?? null;
            $series['loser_exp'] = $rewards['loser']['exp'] ?? null;
        }

        $this->saveSeries($series);

        return [
            'series' => $series,
            'winnerId' => $winnerId,
            'loserId' => $loserId,
            'finalScore' => $series['final_score'],
            'rewards' => [
                'winner' => [
                    'mp' => $series['winner_mp_change'],
                    'coins' => $series['winner_coins'],
                    'exp' => $series['winner_exp'],
                ],
                'loser' => [
                    'mp' => $series['loser_mp_change'],
                    'coins' => $series['loser_coins'],
                    'exp' => $series['loser_exp'],
                ],
            ],
            'rankChanges' => $rankChanges,
        ];
    }

    public function forfeitGame(string $seriesId, string $forfeitingPlayerId): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        if ($forfeitingPlayerId !== $series['player1_id'] && $forfeitingPlayerId !== $series['player2_id']) {
            throw new InvalidArgumentException('Player is not part of this series');
        }

        $winnerId = $forfeitingPlayerId === $series['player1_id']
            ? $series['player2_id']
            : $series['player1_id'];

        if ($winnerId === $series['player1_id']) {
            $series['player1_wins'] = (int) $series['player1_wins'] + 1;
        } else {
            $series['player2_wins'] = (int) $series['player2_wins'] + 1;
        }

        if ($this->isSeriesComplete($series)) {
            return $this->markSeriesComplete($series, $winnerId);
        }

        return $this->advanceToNextGame($series);
    }

    public function abandonSeries(string $seriesId, string $abandoningPlayerId): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        if ($abandoningPlayerId !== $series['player1_id'] && $abandoningPlayerId !== $series['player2_id']) {
            throw new InvalidArgumentException('Player is not part of this series');
        }

        $winnerId = $abandoningPlayerId === $series['player1_id']
            ? $series['player2_id']
            : $series['player1_id'];

        $series['status'] = 'abandoned';
        $series['winner_id'] = $winnerId;
        
        if ($winnerId === $series['player1_id']) {
            $series['player1_wins'] = self::GAMES_TO_WIN;
        } else {
            $series['player2_wins'] = self::GAMES_TO_WIN;
        }
        $series['final_score'] = $series['player1_wins'] . '-' . $series['player2_wins'];
        $series['ended_at'] = date('Y-m-d H:i:s');
        $series['updated_at'] = date('Y-m-d H:i:s');
        $series['loser_mp_change'] = -25;

        $this->saveSeries($series);

        return [
            'series' => $series,
            'winnerId' => $winnerId,
            'loserId' => $abandoningPlayerId,
            'finalScore' => $series['final_score'],
            'isAbandoned' => true,
            'abandonPenalty' => -25,
        ];
    }

    public function getCurrentXPlayer(string $seriesId): ?string
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            return null;
        }

        return $series['player1_side'] === 'X'
            ? $series['player1_id']
            : $series['player2_id'];
    }

    public function isSeriesComplete(array $series): bool
    {
        return (int) $series['player1_wins'] >= self::GAMES_TO_WIN
            || (int) $series['player2_wins'] >= self::GAMES_TO_WIN;
    }

    public function getRankFromMP(int $mp): string
    {
        foreach (self::RANK_THRESHOLDS as $rank => $threshold) {
            if ($mp >= $threshold) {
                return $rank;
            }
        }
        return 'vo_danh';
    }

    protected function fetchPlayerData(string $playerId): ?array
    {
        if ($this->playerFetcher !== null) {
            return ($this->playerFetcher)($playerId);
        }

        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare('SELECT * FROM profiles WHERE user_id = ?');
                $stmt->execute([$playerId]);
                $row = $stmt->fetch(\PDO::FETCH_ASSOC);
                return $row ?: null;
            } catch (\Exception $e) {
                error_log("Failed to fetch player {$playerId}: " . $e->getMessage());
            }
        }

        return [
            'user_id' => $playerId,
            'mindpoint' => 0,
            'current_rank' => 'vo_danh',
        ];
    }

    protected function findSeries(string $seriesId): ?array
    {
        if ($this->seriesFinder !== null) {
            return ($this->seriesFinder)($seriesId);
        }

        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare('SELECT * FROM ranked_series WHERE id = ?');
                $stmt->execute([$seriesId]);
                $row = $stmt->fetch(\PDO::FETCH_ASSOC);
                return $row ?: null;
            } catch (\Exception $e) {
                error_log("Failed to find series {$seriesId}: " . $e->getMessage());
            }
        }

        return null;
    }

    protected function saveSeries(array $series): void
    {
        if ($this->seriesSaver !== null) {
            ($this->seriesSaver)($series);
            return;
        }

        if ($this->db !== null) {
            try {
                $id = $series['id'] ?? null;
                $stmt = $this->db->prepare('SELECT id FROM ranked_series WHERE id = ?');
                $stmt->execute([$id]);
                $exists = $stmt->fetch();

                if ($exists) {
                    $series['updated_at'] = date('Y-m-d H:i:s');
                    unset($series['id'], $series['created_at']);

                    $setClauses = [];
                    $values = [];
                    foreach ($series as $key => $value) {
                        $setClauses[] = "{$key} = ?";
                        $values[] = $value;
                    }
                    $values[] = $id;

                    $sql = 'UPDATE ranked_series SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
                    $stmt = $this->db->prepare($sql);
                    $stmt->execute($values);
                } else {
                    $columns = array_keys($series);
                    $placeholders = array_fill(0, count($columns), '?');

                    $sql = 'INSERT INTO ranked_series (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
                    $stmt = $this->db->prepare($sql);
                    $stmt->execute(array_values($series));
                }
            } catch (\Exception $e) {
                error_log("Failed to save series: " . $e->getMessage());
                throw new RuntimeException("Failed to save series: " . $e->getMessage());
            }
        }
    }

    private function generateUuid(): string
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

    private function isValidUuid(string $uuid): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid) === 1;
    }

    /**
     * Initialize Swap 2 for a new game in the series.
     * 
     * Requirements: 6.1, 6.3
     */
    public function initializeGameSwap2(string $seriesId): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        // Create fresh Swap 2 state for this game
        // Player 1 of the series always starts placing stones in Swap 2
        $gameId = $seriesId . '_game_' . $series['current_game'];
        
        if ($this->swap2Manager !== null) {
            $swap2State = $this->swap2Manager->initializeSwap2(
                $gameId,
                $series['player1_id'],
                $series['player2_id']
            );
            
            return [
                'gameId' => $gameId,
                'seriesId' => $seriesId,
                'currentGame' => $series['current_game'],
                'swap2State' => $swap2State->jsonSerialize(),
            ];
        }

        // Return minimal state if no Swap2Manager is set
        return [
            'gameId' => $gameId,
            'seriesId' => $seriesId,
            'currentGame' => $series['current_game'],
            'swap2State' => [
                'phase' => Swap2State::PHASE_PLACEMENT,
                'player1Id' => $series['player1_id'],
                'player2Id' => $series['player2_id'],
                'activePlayerId' => $series['player1_id'],
                'tentativeStones' => [],
                'finalChoice' => null,
                'blackPlayerId' => null,
                'whitePlayerId' => null,
                'actions' => [],
            ],
        ];
    }

    /**
     * Store Swap 2 history for a completed game.
     * 
     * Requirements: 6.2, 6.4
     */
    public function storeSwap2History(string $seriesId, string $matchId, array $swap2History): void
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        // Store in memory
        $this->matchSwap2History[$matchId] = $swap2History;

        // Persist if saver is available
        if ($this->matchHistorySaver !== null) {
            ($this->matchHistorySaver)($matchId, $swap2History);
            return;
        }

        // Persist to database if available
        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare(
                    'UPDATE matches SET swap2_history = ? WHERE id = ?'
                );
                $stmt->execute([json_encode($swap2History), $matchId]);
            } catch (\Exception $e) {
                error_log("Failed to store Swap 2 history for match {$matchId}: " . $e->getMessage());
            }
        }
    }

    /**
     * Prepare next game in series with fresh Swap 2.
     * 
     * Requirements: 6.3
     */
    public function prepareNextSeriesGame(string $seriesId): array
    {
        $series = $this->findSeries($seriesId);

        if ($series === null) {
            throw new RuntimeException('Series not found: ' . $seriesId);
        }

        if ($series['status'] !== 'in_progress') {
            throw new RuntimeException('Series is not in progress');
        }

        if ($this->isSeriesComplete($series)) {
            throw new RuntimeException('Series is already complete');
        }

        // Increment game number
        $series['current_game'] = (int) $series['current_game'] + 1;
        $series['updated_at'] = date('Y-m-d H:i:s');

        // Note: We do NOT swap sides here anymore
        // Swap 2 will determine sides for each game
        // The player1_side and player2_side fields are now only used
        // as fallback when Swap 2 is disabled

        $this->saveSeries($series);

        // Initialize fresh Swap 2 for the new game
        $swap2Init = $this->initializeGameSwap2($seriesId);

        return [
            'series' => $series,
            'isComplete' => false,
            'nextGameReady' => true,
            'swap2State' => $swap2Init['swap2State'],
            'gameId' => $swap2Init['gameId'],
        ];
    }

    /**
     * Get Swap 2 history for a match.
     * 
     * @param string $matchId UUID of the match
     * @return array|null Swap 2 history or null if not found
     */
    public function getSwap2History(string $matchId): ?array
    {
        // Check in-memory first
        if (isset($this->matchSwap2History[$matchId])) {
            return $this->matchSwap2History[$matchId];
        }

        // Try database
        if ($this->db !== null) {
            try {
                $stmt = $this->db->prepare(
                    'SELECT swap2_history FROM matches WHERE id = ?'
                );
                $stmt->execute([$matchId]);
                $row = $stmt->fetch(\PDO::FETCH_ASSOC);
                
                if ($row && !empty($row['swap2_history'])) {
                    return json_decode($row['swap2_history'], true);
                }
            } catch (\Exception $e) {
                error_log("Failed to get Swap 2 history for match {$matchId}: " . $e->getMessage());
            }
        }

        return null;
    }
}
