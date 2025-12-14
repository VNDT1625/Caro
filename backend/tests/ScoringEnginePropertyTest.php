<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\ScoringEngineService;

/**
 * Property-Based Tests for ScoringEngineService
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests the core properties of the ScoringEngine service including
 * MP calculations, coin rewards, and EXP distribution.
 * 
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4**
 */
class ScoringEnginePropertyTest extends TestCase
{
    use TestTrait;

    private ScoringEngineService $service;
    private array $updatedProfiles = [];

    private const RANKS = ['vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 'cao_ky', 'ky_thanh', 'truyen_thuyet'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->service = new ScoringEngineService();
        $this->updatedProfiles = [];
        
        // Set up mock profile updater for testing
        $this->service->setProfileUpdater(function (string $playerId, int $mpChange, int $coins, int $exp) {
            $this->updatedProfiles[$playerId] = [
                'mpChange' => $mpChange,
                'coins' => $coins,
                'exp' => $exp,
            ];
            return null; // No rank change for simplicity
        });
    }

    protected function tearDown(): void
    {
        $this->updatedProfiles = [];
        parent::tearDown();
    }

    /**
     * Compatibility method for Eris TestTrait with PHPUnit 9.x
     */
    public function name(): string
    {
        return $this->getName();
    }

    /**
     * Generate a valid UUID string
     */
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

    /**
     * Create a completed series for testing
     */
    private function createCompletedSeries(
        int $player1Wins,
        int $player2Wins,
        string $player1Rank,
        string $player2Rank,
        string $status = 'completed'
    ): array {
        $player1Id = $this->generateUuid();
        $player2Id = $this->generateUuid();
        
        // Determine winner based on wins
        $winnerId = $player1Wins > $player2Wins ? $player1Id : $player2Id;
        
        return [
            'id' => $this->generateUuid(),
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
            'player1_initial_mp' => rand(0, 6000),
            'player2_initial_mp' => rand(0, 6000),
            'player1_initial_rank' => $player1Rank,
            'player2_initial_rank' => $player2Rank,
            'player1_wins' => $player1Wins,
            'player2_wins' => $player2Wins,
            'games_to_win' => 2,
            'current_game' => $player1Wins + $player2Wins,
            'player1_side' => 'X',
            'player2_side' => 'O',
            'status' => $status,
            'winner_id' => $winnerId,
            'final_score' => "{$player1Wins}-{$player2Wins}",
        ];
    }


    /**
     * **Feature: ranked-bo3-system, Property 6: Winner MP Range**
     * 
     * *For any* completed series, the winner's MP gain SHALL be in range [5, 50]
     * (minimum 5 due to floor, max 50 with all bonuses).
     * 
     * **Validates: Requirements 3.3, 4.5**
     * 
     * @test
     */
    public function winnerMPRange(): void
    {
        $this
            ->forAll(
                Generators::elements([2]),           // winner wins (always 2 for completed)
                Generators::elements([0, 1]),        // loser wins
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $winnerWins, int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries($winnerWins, $loserWins, $winnerRank, $loserRank);
                
                $winnerMP = $this->service->calculateWinnerMP($series);
                
                // Property: Winner MP SHALL be in range [5, 50]
                $this->assertGreaterThanOrEqual(
                    5,
                    $winnerMP,
                    "Winner MP ({$winnerMP}) must be >= 5 (minimum floor)"
                );
                $this->assertLessThanOrEqual(
                    50,
                    $winnerMP,
                    "Winner MP ({$winnerMP}) must be <= 50 (maximum cap)"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 7: Loser MP Fixed Penalty**
     * 
     * *For any* completed series (non-abandoned), the loser's MP loss SHALL be exactly 15.
     * 
     * **Validates: Requirements 3.4**
     * 
     * @test
     */
    public function loserMPFixedPenalty(): void
    {
        $this
            ->forAll(
                Generators::elements([0, 1]),        // loser wins
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries(2, $loserWins, $winnerRank, $loserRank, 'completed');
                
                $loserMP = $this->service->calculateLoserMP($series);
                
                // Property: Loser MP SHALL be exactly -15 for non-abandoned series
                $this->assertEquals(
                    -15,
                    $loserMP,
                    "Loser MP must be exactly -15 for completed (non-abandoned) series"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 8: MP Calculation Formula**
     * 
     * *For any* series result, winner MP = 20 (base) + sweep_bonus + time_bonus + rank_diff_modifier,
     * with minimum floor of 5.
     * 
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
     * 
     * @test
     */
    public function mpCalculationFormula(): void
    {
        $this
            ->forAll(
                Generators::elements([0, 1]),        // loser wins (0 = sweep, 1 = close)
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries(2, $loserWins, $winnerRank, $loserRank);
                
                $winnerMP = $this->service->calculateWinnerMP($series);
                
                // Calculate expected MP manually
                $expectedMP = 20; // Base (Req 4.1)
                
                // Sweep bonus (Req 4.2)
                if ($loserWins === 0) {
                    $expectedMP += 10;
                }
                
                // Rank difference modifier (Req 4.4, 4.5)
                $rankValues = [
                    'vo_danh' => 0, 'tan_ky' => 1, 'hoc_ky' => 2,
                    'ky_lao' => 3, 'cao_ky' => 4, 'ky_thanh' => 5, 'truyen_thuyet' => 6
                ];
                $rankDiff = $rankValues[$loserRank] - $rankValues[$winnerRank];
                
                if ($rankDiff > 0) {
                    // Beat higher rank: +5 per rank
                    $expectedMP += $rankDiff * 5;
                } elseif ($rankDiff < 0) {
                    // Beat lower rank: -3 per rank
                    $expectedMP += $rankDiff * 3; // rankDiff is negative
                }
                
                // Apply bounds
                $expectedMP = max(5, min(50, $expectedMP));
                
                // Property: Calculated MP SHALL match formula
                $this->assertEquals(
                    $expectedMP,
                    $winnerMP,
                    "Winner MP ({$winnerMP}) must match formula result ({$expectedMP}) " .
                    "for winner rank {$winnerRank} vs loser rank {$loserRank}, loser wins {$loserWins}"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 9: Sweep Bonus Application**
     * 
     * *For any* series ending 2-0, the winner SHALL receive exactly 10 bonus MP.
     * 
     * **Validates: Requirements 4.2**
     * 
     * @test
     */
    public function sweepBonusApplication(): void
    {
        $this
            ->forAll(
                Generators::elements(self::RANKS)    // same rank for both to isolate sweep bonus
            )
            ->withMaxSize(100)
            ->then(function (string $rank) {
                // Create 2-0 sweep series (same rank to isolate sweep bonus)
                $sweepSeries = $this->createCompletedSeries(2, 0, $rank, $rank);
                $sweepMP = $this->service->calculateWinnerMP($sweepSeries);
                
                // Create 2-1 close series (same rank)
                $closeSeries = $this->createCompletedSeries(2, 1, $rank, $rank);
                $closeMP = $this->service->calculateWinnerMP($closeSeries);
                
                // Property: Sweep (2-0) SHALL give exactly 10 more MP than close (2-1)
                $this->assertEquals(
                    10,
                    $sweepMP - $closeMP,
                    "Sweep bonus must be exactly 10 MP (sweep: {$sweepMP}, close: {$closeMP})"
                );
            });
    }


    /**
     * **Feature: ranked-bo3-system, Property 12: Winner Coins Calculation**
     * 
     * *For any* series winner, coins earned SHALL equal 50 + (games_won × 10),
     * resulting in 70 for 2-0 or 70 for 2-1.
     * 
     * **Validates: Requirements 6.2**
     * 
     * @test
     */
    public function winnerCoinsCalculation(): void
    {
        $this
            ->forAll(
                Generators::elements([0, 1]),        // loser wins
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries(2, $loserWins, $winnerRank, $loserRank);
                $winnerId = $series['winner_id'];
                
                $coins = $this->service->calculateCoins($winnerId, $series);
                
                // Winner always wins 2 games, so coins = 50 + (2 * 10) = 70
                $expectedCoins = 50 + (2 * 10);
                
                // Property: Winner coins SHALL equal 50 + (games_won × 10)
                $this->assertEquals(
                    $expectedCoins,
                    $coins,
                    "Winner coins ({$coins}) must equal 50 + (2 × 10) = {$expectedCoins}"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 13: Loser Coins Fixed**
     * 
     * *For any* series loser, coins earned SHALL be exactly 20.
     * 
     * **Validates: Requirements 6.3**
     * 
     * @test
     */
    public function loserCoinsFixed(): void
    {
        $this
            ->forAll(
                Generators::elements([0, 1]),        // loser wins
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries(2, $loserWins, $winnerRank, $loserRank);
                
                // Get loser ID (opposite of winner)
                $loserId = $series['winner_id'] === $series['player1_id'] 
                    ? $series['player2_id'] 
                    : $series['player1_id'];
                
                $coins = $this->service->calculateCoins($loserId, $series);
                
                // Property: Loser coins SHALL be exactly 20
                $this->assertEquals(
                    20,
                    $coins,
                    "Loser coins ({$coins}) must be exactly 20"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 14: EXP Distribution**
     * 
     * *For any* completed series, winner SHALL receive 100 EXP and loser SHALL receive 40 EXP.
     * 
     * **Validates: Requirements 6.4**
     * 
     * @test
     */
    public function expDistribution(): void
    {
        $this
            ->forAll(
                Generators::elements([0, 1]),        // loser wins
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries(2, $loserWins, $winnerRank, $loserRank);
                $winnerId = $series['winner_id'];
                $loserId = $winnerId === $series['player1_id'] 
                    ? $series['player2_id'] 
                    : $series['player1_id'];
                
                $winnerExp = $this->service->calculateEXP($winnerId, $series);
                $loserExp = $this->service->calculateEXP($loserId, $series);
                
                // Property: Winner EXP SHALL be 100
                $this->assertEquals(
                    100,
                    $winnerExp,
                    "Winner EXP ({$winnerExp}) must be exactly 100"
                );
                
                // Property: Loser EXP SHALL be 40
                $this->assertEquals(
                    40,
                    $loserExp,
                    "Loser EXP ({$loserExp}) must be exactly 40"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 17: Abandon Penalty**
     * 
     * *For any* abandoned series, the abandoning player SHALL lose 25 MP
     * (15 standard + 10 abandon penalty).
     * 
     * **Validates: Requirements 7.5**
     * 
     * @test
     */
    public function abandonPenalty(): void
    {
        $this
            ->forAll(
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (string $winnerRank, string $loserRank) {
                // Create abandoned series
                $series = $this->createCompletedSeries(2, 0, $winnerRank, $loserRank, 'abandoned');
                
                $loserMP = $this->service->calculateLoserMP($series);
                
                // Property: Abandon penalty SHALL be -25 MP
                $this->assertEquals(
                    -25,
                    $loserMP,
                    "Abandon penalty ({$loserMP}) must be exactly -25 MP"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 6: Winner MP Range**
     * 
     * *For any* series where winner beats a much higher-ranked opponent,
     * the MP gain SHALL still be capped at 50.
     * 
     * **Validates: Requirements 3.3**
     * 
     * @test
     */
    public function winnerMPCappedAt50(): void
    {
        // Test extreme case: lowest rank beats highest rank with sweep
        $series = $this->createCompletedSeries(2, 0, 'vo_danh', 'truyen_thuyet');
        
        $winnerMP = $this->service->calculateWinnerMP($series);
        
        // Property: Winner MP SHALL be capped at 50
        $this->assertLessThanOrEqual(
            50,
            $winnerMP,
            "Winner MP ({$winnerMP}) must be capped at 50 even with maximum bonuses"
        );
    }

    /**
     * **Feature: ranked-bo3-system, Property 6: Winner MP Range**
     * 
     * *For any* series where winner beats a much lower-ranked opponent,
     * the MP gain SHALL still be at least 5.
     * 
     * **Validates: Requirements 4.5**
     * 
     * @test
     */
    public function winnerMPFlooredAt5(): void
    {
        // Test extreme case: highest rank beats lowest rank (close game)
        $series = $this->createCompletedSeries(2, 1, 'truyen_thuyet', 'vo_danh');
        
        $winnerMP = $this->service->calculateWinnerMP($series);
        
        // Property: Winner MP SHALL be at least 5
        $this->assertGreaterThanOrEqual(
            5,
            $winnerMP,
            "Winner MP ({$winnerMP}) must be at least 5 even with maximum penalties"
        );
    }

    /**
     * **Feature: ranked-bo3-system, Property 8: MP Calculation Formula**
     * 
     * *For any* series, calculateRewards SHALL return consistent values
     * with individual calculation methods.
     * 
     * **Validates: Requirements 3.2, 3.5, 6.1**
     * 
     * @test
     */
    public function calculateRewardsConsistency(): void
    {
        $this
            ->forAll(
                Generators::elements([0, 1]),        // loser wins
                Generators::elements(self::RANKS),   // winner rank
                Generators::elements(self::RANKS)    // loser rank
            )
            ->withMaxSize(100)
            ->then(function (int $loserWins, string $winnerRank, string $loserRank) {
                $series = $this->createCompletedSeries(2, $loserWins, $winnerRank, $loserRank);
                $winnerId = $series['winner_id'];
                $loserId = $winnerId === $series['player1_id'] 
                    ? $series['player2_id'] 
                    : $series['player1_id'];
                
                // Get rewards from calculateRewards
                $rewards = $this->service->calculateRewards($series);
                
                // Get individual calculations
                $expectedWinnerMP = $this->service->calculateWinnerMP($series);
                $expectedLoserMP = $this->service->calculateLoserMP($series);
                $expectedWinnerCoins = $this->service->calculateCoins($winnerId, $series);
                $expectedLoserCoins = $this->service->calculateCoins($loserId, $series);
                $expectedWinnerExp = $this->service->calculateEXP($winnerId, $series);
                $expectedLoserExp = $this->service->calculateEXP($loserId, $series);
                
                // Property: calculateRewards SHALL be consistent with individual methods
                $this->assertEquals($expectedWinnerMP, $rewards['winner']['mp'], 'Winner MP mismatch');
                $this->assertEquals($expectedLoserMP, $rewards['loser']['mp'], 'Loser MP mismatch');
                $this->assertEquals($expectedWinnerCoins, $rewards['winner']['coins'], 'Winner coins mismatch');
                $this->assertEquals($expectedLoserCoins, $rewards['loser']['coins'], 'Loser coins mismatch');
                $this->assertEquals($expectedWinnerExp, $rewards['winner']['exp'], 'Winner EXP mismatch');
                $this->assertEquals($expectedLoserExp, $rewards['loser']['exp'], 'Loser EXP mismatch');
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 8: MP Calculation Formula**
     * 
     * *For any* series with missing required fields, calculateWinnerMP SHALL throw exception.
     * 
     * **Validates: Requirements 3.2**
     * 
     * @test
     */
    public function calculateWinnerMPValidatesInput(): void
    {
        $requiredFields = ['winner_id', 'player1_id', 'player2_id', 'player1_wins', 
                          'player2_wins', 'player1_initial_rank', 'player2_initial_rank'];
        
        foreach ($requiredFields as $field) {
            $series = $this->createCompletedSeries(2, 0, 'vo_danh', 'vo_danh');
            unset($series[$field]);
            
            $this->expectException(\InvalidArgumentException::class);
            $this->service->calculateWinnerMP($series);
        }
    }
}
