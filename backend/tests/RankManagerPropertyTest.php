<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\RankManagerService;

/**
 * Property-Based Tests for RankManagerService
 * 
 * **Feature: ranked-bo3-system**
 * 
 * Tests the core properties of the RankManager service including
 * rank threshold consistency and rank history recording.
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 */
class RankManagerPropertyTest extends TestCase
{
    use TestTrait;

    private RankManagerService $service;
    private array $profiles = [];
    private array $rankHistory = [];

    private const RANKS = ['vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 'cao_ky', 'ky_thanh', 'truyen_thuyet'];
    
    private const RANK_THRESHOLDS = [
        'vo_danh' => 0,
        'tan_ky' => 50,
        'hoc_ky' => 200,
        'ky_lao' => 600,
        'cao_ky' => 1500,
        'ky_thanh' => 3000,
        'truyen_thuyet' => 5500,
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->service = new RankManagerService();
        $this->profiles = [];
        $this->rankHistory = [];
        
        // Set up mock profile fetcher for testing
        $this->service->setProfileFetcher(function (string $playerId) {
            return $this->profiles[$playerId] ?? null;
        });
        
        // Set up mock profile updater for testing
        $this->service->setProfileUpdater(function (string $playerId, int $newMP, string $newRank) {
            if (isset($this->profiles[$playerId])) {
                $this->profiles[$playerId]['mindpoint'] = $newMP;
                $this->profiles[$playerId]['current_rank'] = $newRank;
                return true;
            }
            return false;
        });

        
        // Set up mock history recorder for testing
        $this->service->setHistoryRecorder(function (
            string $playerId, 
            string $oldRank, 
            string $newRank, 
            int $mindpoint, 
            string $reason
        ) {
            $this->rankHistory[] = [
                'user_id' => $playerId,
                'old_rank' => $oldRank,
                'new_rank' => $newRank,
                'mindpoint' => $mindpoint,
                'reason' => $reason,
                'created_at' => date('Y-m-d H:i:s'),
            ];
            return true;
        });
    }

    protected function tearDown(): void
    {
        $this->profiles = [];
        $this->rankHistory = [];
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
     * Create a player profile for testing
     */
    private function createPlayer(int $mindpoint, string $rank = null): string
    {
        $playerId = $this->generateUuid();
        $this->profiles[$playerId] = [
            'user_id' => $playerId,
            'mindpoint' => $mindpoint,
            'current_rank' => $rank ?? $this->service->getRankFromMP($mindpoint),
        ];
        return $playerId;
    }

    /**
     * Get expected rank for a given MP value
     */
    private function getExpectedRank(int $mp): string
    {
        if ($mp >= 5500) return 'truyen_thuyet';
        if ($mp >= 3000) return 'ky_thanh';
        if ($mp >= 1500) return 'cao_ky';
        if ($mp >= 600) return 'ky_lao';
        if ($mp >= 200) return 'hoc_ky';
        if ($mp >= 50) return 'tan_ky';
        return 'vo_danh';
    }


    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* player with MP crossing a rank threshold, their rank SHALL be 
     * updated to match the new MP range.
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function rankThresholdConsistency(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 7000)  // MP values from 0 to 7000
            )
            ->withMaxSize(100)
            ->then(function (int $mp) {
                $rank = $this->service->getRankFromMP($mp);
                $expectedRank = $this->getExpectedRank($mp);
                
                // Property: getRankFromMP SHALL return correct rank for any MP value
                $this->assertEquals(
                    $expectedRank,
                    $rank,
                    "Rank for MP {$mp} should be {$expectedRank}, got {$rank}"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* MP value at exact threshold boundaries, the rank SHALL be 
     * the higher rank (threshold is inclusive).
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function rankThresholdBoundaries(): void
    {
        // Test exact threshold values
        $thresholds = [
            0 => 'vo_danh',
            50 => 'tan_ky',
            200 => 'hoc_ky',
            600 => 'ky_lao',
            1500 => 'cao_ky',
            3000 => 'ky_thanh',
            5500 => 'truyen_thuyet',
        ];
        
        foreach ($thresholds as $mp => $expectedRank) {
            $rank = $this->service->getRankFromMP($mp);
            
            // Property: At exact threshold, rank SHALL be the higher rank
            $this->assertEquals(
                $expectedRank,
                $rank,
                "At threshold {$mp}, rank should be {$expectedRank}, got {$rank}"
            );
        }
        
        // Test just below thresholds
        $belowThresholds = [
            49 => 'vo_danh',
            199 => 'tan_ky',
            599 => 'hoc_ky',
            1499 => 'ky_lao',
            2999 => 'cao_ky',
            5499 => 'ky_thanh',
        ];
        
        foreach ($belowThresholds as $mp => $expectedRank) {
            $rank = $this->service->getRankFromMP($mp);
            
            // Property: Just below threshold, rank SHALL be the lower rank
            $this->assertEquals(
                $expectedRank,
                $rank,
                "At {$mp} (below threshold), rank should be {$expectedRank}, got {$rank}"
            );
        }
    }


    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* player whose MP changes and crosses a threshold, updateMindpoint 
     * SHALL update their rank accordingly.
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function updateMindpointUpdatesRank(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 6000),   // Starting MP
                Generators::choose(-500, 500)  // MP change
            )
            ->withMaxSize(100)
            ->then(function (int $startMP, int $mpChange) {
                // Reset state
                $this->rankHistory = [];
                
                $playerId = $this->createPlayer($startMP);
                $oldRank = $this->service->getRankFromMP($startMP);
                
                $result = $this->service->updateMindpoint($playerId, $mpChange, 'test');
                
                $newMP = max(0, $startMP + $mpChange);
                $expectedNewRank = $this->service->getRankFromMP($newMP);
                
                // Property: After updateMindpoint, rank SHALL match new MP
                $this->assertEquals(
                    $expectedNewRank,
                    $result['newRank'],
                    "After MP change from {$startMP} to {$newMP}, rank should be {$expectedNewRank}"
                );
                
                // Property: newMP SHALL be correctly calculated (min 0)
                $this->assertEquals(
                    $newMP,
                    $result['newMP'],
                    "New MP should be {$newMP}"
                );
                
                // Property: rankChanged SHALL be true iff rank actually changed
                $expectedRankChanged = $oldRank !== $expectedNewRank;
                $this->assertEquals(
                    $expectedRankChanged,
                    $result['rankChanged'],
                    "rankChanged should be " . ($expectedRankChanged ? 'true' : 'false')
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 11: Rank History Recording**
     * 
     * *For any* rank change, a record SHALL be created in rank_history with 
     * correct old_rank, new_rank, and timestamp.
     * 
     * **Validates: Requirements 5.4**
     * 
     * @test
     */
    public function rankHistoryRecording(): void
    {
        $this
            ->forAll(
                Generators::elements(self::RANKS),  // Starting rank
                Generators::choose(-1000, 1000)     // MP change to trigger rank change
            )
            ->withMaxSize(100)
            ->then(function (string $startRank, int $mpChange) {
                // Reset state
                $this->rankHistory = [];
                
                // Get MP that corresponds to starting rank (middle of range)
                $startMP = $this->getMPForRank($startRank);
                $playerId = $this->createPlayer($startMP, $startRank);
                
                $result = $this->service->updateMindpoint($playerId, $mpChange, 'series_win');
                
                if ($result['rankChanged']) {
                    // Property: When rank changes, history SHALL be recorded
                    $this->assertCount(
                        1,
                        $this->rankHistory,
                        "Rank history should have exactly 1 record when rank changes"
                    );
                    
                    $historyRecord = $this->rankHistory[0];
                    
                    // Property: History record SHALL have correct old_rank
                    $this->assertEquals(
                        $startRank,
                        $historyRecord['old_rank'],
                        "History old_rank should be {$startRank}"
                    );
                    
                    // Property: History record SHALL have correct new_rank
                    $this->assertEquals(
                        $result['newRank'],
                        $historyRecord['new_rank'],
                        "History new_rank should be {$result['newRank']}"
                    );
                    
                    // Property: History record SHALL have correct mindpoint
                    $this->assertEquals(
                        $result['newMP'],
                        $historyRecord['mindpoint'],
                        "History mindpoint should be {$result['newMP']}"
                    );
                    
                    // Property: History record SHALL have correct user_id
                    $this->assertEquals(
                        $playerId,
                        $historyRecord['user_id'],
                        "History user_id should match player ID"
                    );
                } else {
                    // Property: When rank doesn't change, no history SHALL be recorded
                    $this->assertCount(
                        0,
                        $this->rankHistory,
                        "Rank history should be empty when rank doesn't change"
                    );
                }
            });
    }


    /**
     * Get a representative MP value for a given rank (middle of range)
     */
    private function getMPForRank(string $rank): int
    {
        $mpRanges = [
            'vo_danh' => 25,      // 0-49
            'tan_ky' => 125,      // 50-199
            'hoc_ky' => 400,      // 200-599
            'ky_lao' => 1050,     // 600-1499
            'cao_ky' => 2250,     // 1500-2999
            'ky_thanh' => 4250,   // 3000-5499
            'truyen_thuyet' => 6000, // 5500+
        ];
        return $mpRanges[$rank] ?? 0;
    }

    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* MP value, getRankFromMP SHALL be idempotent - calling it multiple 
     * times with the same value SHALL return the same rank.
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function getRankFromMPIdempotent(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 10000)
            )
            ->withMaxSize(100)
            ->then(function (int $mp) {
                $rank1 = $this->service->getRankFromMP($mp);
                $rank2 = $this->service->getRankFromMP($mp);
                $rank3 = $this->service->getRankFromMP($mp);
                
                // Property: getRankFromMP SHALL be idempotent
                $this->assertEquals($rank1, $rank2, "getRankFromMP should be idempotent");
                $this->assertEquals($rank2, $rank3, "getRankFromMP should be idempotent");
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* two MP values where mp1 < mp2, the rank for mp1 SHALL be 
     * less than or equal to the rank for mp2 (monotonic).
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function rankMonotonicity(): void
    {
        $rankOrder = array_flip(self::RANKS);
        
        $this
            ->forAll(
                Generators::choose(0, 7000),
                Generators::choose(0, 7000)
            )
            ->withMaxSize(100)
            ->then(function (int $mp1, int $mp2) use ($rankOrder) {
                $rank1 = $this->service->getRankFromMP($mp1);
                $rank2 = $this->service->getRankFromMP($mp2);
                
                if ($mp1 <= $mp2) {
                    // Property: Higher MP SHALL result in equal or higher rank
                    $this->assertLessThanOrEqual(
                        $rankOrder[$rank2],
                        $rankOrder[$rank1],
                        "MP {$mp1} (rank {$rank1}) should have rank <= MP {$mp2} (rank {$rank2})"
                    );
                } else {
                    // Property: Lower MP SHALL result in equal or lower rank
                    $this->assertGreaterThanOrEqual(
                        $rankOrder[$rank2],
                        $rankOrder[$rank1],
                        "MP {$mp1} (rank {$rank1}) should have rank >= MP {$mp2} (rank {$rank2})"
                    );
                }
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* player, MP SHALL never go below 0 after updateMindpoint.
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function mpNeverNegative(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 1000),    // Starting MP
                Generators::choose(-2000, 0)    // Negative MP change
            )
            ->withMaxSize(100)
            ->then(function (int $startMP, int $mpChange) {
                $playerId = $this->createPlayer($startMP);
                
                $result = $this->service->updateMindpoint($playerId, $mpChange, 'test');
                
                // Property: newMP SHALL never be negative
                $this->assertGreaterThanOrEqual(
                    0,
                    $result['newMP'],
                    "MP should never go below 0, got {$result['newMP']}"
                );
            });
    }

    /**
     * **Feature: ranked-bo3-system, Property 11: Rank History Recording**
     * 
     * *For any* rank up event, rankUp SHALL be true and rankDown SHALL be false.
     * 
     * **Validates: Requirements 5.2, 5.4**
     * 
     * @test
     */
    public function rankUpDetection(): void
    {
        // Test specific rank up scenarios
        $rankUpScenarios = [
            ['from' => 'vo_danh', 'to' => 'tan_ky', 'startMP' => 40, 'change' => 20],
            ['from' => 'tan_ky', 'to' => 'hoc_ky', 'startMP' => 190, 'change' => 20],
            ['from' => 'hoc_ky', 'to' => 'ky_lao', 'startMP' => 590, 'change' => 20],
            ['from' => 'ky_lao', 'to' => 'cao_ky', 'startMP' => 1490, 'change' => 20],
            ['from' => 'cao_ky', 'to' => 'ky_thanh', 'startMP' => 2990, 'change' => 20],
            ['from' => 'ky_thanh', 'to' => 'truyen_thuyet', 'startMP' => 5490, 'change' => 20],
        ];
        
        foreach ($rankUpScenarios as $scenario) {
            $this->rankHistory = [];
            $playerId = $this->createPlayer($scenario['startMP'], $scenario['from']);
            
            $result = $this->service->updateMindpoint($playerId, $scenario['change'], 'series_win');
            
            // Property: rankUp SHALL be true for rank up
            $this->assertTrue(
                $result['rankUp'],
                "rankUp should be true when going from {$scenario['from']} to {$scenario['to']}"
            );
            
            // Property: rankDown SHALL be false for rank up
            $this->assertFalse(
                $result['rankDown'],
                "rankDown should be false when going from {$scenario['from']} to {$scenario['to']}"
            );
            
            // Property: History SHALL be recorded for rank up
            $this->assertCount(1, $this->rankHistory, "History should be recorded for rank up");
        }
    }

    /**
     * **Feature: ranked-bo3-system, Property 11: Rank History Recording**
     * 
     * *For any* rank down event, rankDown SHALL be true and rankUp SHALL be false.
     * 
     * **Validates: Requirements 5.3, 5.4**
     * 
     * @test
     */
    public function rankDownDetection(): void
    {
        // Test specific rank down scenarios
        $rankDownScenarios = [
            ['from' => 'tan_ky', 'to' => 'vo_danh', 'startMP' => 60, 'change' => -20],
            ['from' => 'hoc_ky', 'to' => 'tan_ky', 'startMP' => 210, 'change' => -20],
            ['from' => 'ky_lao', 'to' => 'hoc_ky', 'startMP' => 610, 'change' => -20],
            ['from' => 'cao_ky', 'to' => 'ky_lao', 'startMP' => 1510, 'change' => -20],
            ['from' => 'ky_thanh', 'to' => 'cao_ky', 'startMP' => 3010, 'change' => -20],
            ['from' => 'truyen_thuyet', 'to' => 'ky_thanh', 'startMP' => 5510, 'change' => -20],
        ];
        
        foreach ($rankDownScenarios as $scenario) {
            $this->rankHistory = [];
            $playerId = $this->createPlayer($scenario['startMP'], $scenario['from']);
            
            $result = $this->service->updateMindpoint($playerId, $scenario['change'], 'series_loss');
            
            // Property: rankDown SHALL be true for rank down
            $this->assertTrue(
                $result['rankDown'],
                "rankDown should be true when going from {$scenario['from']} to {$scenario['to']}"
            );
            
            // Property: rankUp SHALL be false for rank down
            $this->assertFalse(
                $result['rankUp'],
                "rankUp should be false when going from {$scenario['from']} to {$scenario['to']}"
            );
            
            // Property: History SHALL be recorded for rank down
            $this->assertCount(1, $this->rankHistory, "History should be recorded for rank down");
        }
    }

    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* invalid player ID, updateMindpoint SHALL throw an exception.
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function updateMindpointValidatesPlayerId(): void
    {
        // Test empty player ID
        $this->expectException(\InvalidArgumentException::class);
        $this->service->updateMindpoint('', 100, 'test');
    }

    /**
     * **Feature: ranked-bo3-system, Property 10: Rank Threshold Consistency**
     * 
     * *For any* non-existent player, updateMindpoint SHALL throw an exception.
     * 
     * **Validates: Requirements 5.1**
     * 
     * @test
     */
    public function updateMindpointValidatesPlayerExists(): void
    {
        $nonExistentId = $this->generateUuid();
        
        $this->expectException(\InvalidArgumentException::class);
        $this->service->updateMindpoint($nonExistentId, 100, 'test');
    }
}
