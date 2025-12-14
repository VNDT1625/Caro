<?php

use PHPUnit\Framework\TestCase;
use Eris\Generators;
use Eris\TestTrait;
use App\Services\RuleEngineService;
use App\Services\RuleAnalysisResult;

/**
 * Property-Based Tests for RuleEngineService
 * 
 * Tests rule-based detection of cheating patterns in match data.
 */
class RuleEnginePropertyTest extends TestCase
{
    use TestTrait;

    private RuleEngineService $ruleEngine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->erisSetup();
        $this->ruleEngine = new RuleEngineService(
            minTimeBetweenMoves: 100,
            maxTimeBetweenMoves: 300000
        );
    }

    /**
     * Compatibility method for Eris TestTrait with PHPUnit 9.x
     */
    public function name(): string
    {
        return $this->getName();
    }

    /**
     * Generate a valid player ('X' or 'O')
     */
    private function playerGenerator()
    {
        return Generators::elements(['X', 'O']);
    }

    /**
     * Generate a valid move with player and timestamp
     */
    private function moveGenerator(int $baseTimestamp = 1000000)
    {
        return Generators::bind(
            $this->playerGenerator(),
            function ($player) use ($baseTimestamp) {
                return Generators::map(
                    function ($offset) use ($player, $baseTimestamp) {
                        return [
                            'player' => $player,
                            'timestamp' => $baseTimestamp + $offset,
                            'x' => rand(0, 14),
                            'y' => rand(0, 14),
                        ];
                    },
                    Generators::choose(0, 100000)
                );
            }
        );
    }

    /**
     * **Feature: report-violation-system, Property 7: Multiple Moves Detection**
     * 
     * *For any* match move sequence where a player has consecutive moves 
     * without opponent's move in between, the rule engine SHALL detect 
     * and flag this as a violation.
     * 
     * **Validates: Requirements 3.2**
     * 
     * @test
     */
    public function detectsConsecutiveMovesBySamePlayer(): void
    {
        $this
            ->forAll(
                Generators::choose(2, 10),  // Number of consecutive moves
                $this->playerGenerator()    // The player making consecutive moves
            )
            ->withMaxSize(100)
            ->then(function (int $consecutiveCount, string $player) {
                // Create a sequence with consecutive moves by the same player
                $moves = [];
                $timestamp = 1000000;
                
                for ($i = 0; $i < $consecutiveCount; $i++) {
                    $moves[] = [
                        'player' => $player,
                        'timestamp' => $timestamp + ($i * 1000),
                        'x' => $i,
                        'y' => 0,
                    ];
                }

                $violations = $this->ruleEngine->checkMultipleMoves($moves);

                // Property: consecutive moves by same player MUST be detected
                $this->assertNotEmpty(
                    $violations,
                    "Should detect {$consecutiveCount} consecutive moves by player {$player}"
                );

                // All violations should be of type VIOLATION_MULTIPLE_MOVES
                foreach ($violations as $violation) {
                    $this->assertEquals(
                        RuleAnalysisResult::VIOLATION_MULTIPLE_MOVES,
                        $violation['type'],
                        'Violation type should be multiple_moves'
                    );
                    $this->assertEquals(
                        $player,
                        $violation['details']['player'],
                        'Violation should identify the correct player'
                    );
                }
            });
    }

    /**
     * **Feature: report-violation-system, Property 7: Multiple Moves Detection**
     * 
     * *For any* valid alternating move sequence (X, O, X, O, ...),
     * the rule engine SHALL NOT flag any violations.
     * 
     * **Validates: Requirements 3.2**
     * 
     * @test
     */
    public function noViolationsForAlternatingMoves(): void
    {
        $this
            ->forAll(
                Generators::choose(2, 20)  // Number of moves
            )
            ->withMaxSize(100)
            ->then(function (int $moveCount) {
                // Create a valid alternating sequence
                $moves = [];
                $timestamp = 1000000;
                $players = ['X', 'O'];
                
                for ($i = 0; $i < $moveCount; $i++) {
                    $moves[] = [
                        'player' => $players[$i % 2],
                        'timestamp' => $timestamp + ($i * 1000),
                        'x' => $i % 15,
                        'y' => intdiv($i, 15),
                    ];
                }

                $violations = $this->ruleEngine->checkMultipleMoves($moves);

                // Property: alternating moves should have NO violations
                $this->assertEmpty(
                    $violations,
                    "Alternating moves should not trigger violations. Got: " . json_encode($violations)
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 7: Multiple Moves Detection**
     * 
     * *For any* empty or single-move sequence,
     * the rule engine SHALL NOT flag any violations.
     * 
     * **Validates: Requirements 3.2**
     * 
     * @test
     */
    public function noViolationsForEmptyOrSingleMove(): void
    {
        // Test empty moves
        $violations = $this->ruleEngine->checkMultipleMoves([]);
        $this->assertEmpty($violations, 'Empty moves should have no violations');

        // Test single move
        $this
            ->forAll($this->playerGenerator())
            ->withMaxSize(100)
            ->then(function (string $player) {
                $moves = [
                    ['player' => $player, 'timestamp' => 1000000, 'x' => 0, 'y' => 0]
                ];

                $violations = $this->ruleEngine->checkMultipleMoves($moves);

                $this->assertEmpty(
                    $violations,
                    'Single move should have no violations'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 8: Impossible Win Detection**
     * 
     * *For any* board state where both players have winning conditions (5 in a row),
     * the rule engine SHALL detect and flag this as impossible.
     * 
     * **Validates: Requirements 3.3**
     * 
     * @test
     */
    public function detectsBothPlayersWinning(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 9),  // X winning line start column
                Generators::choose(0, 9)   // O winning line start column
            )
            ->withMaxSize(100)
            ->then(function (int $xStartCol, int $oStartCol) {
                // Create a board where both X and O have 5 in a row
                $boardState = [];
                
                // X wins horizontally on row 0 (row_col format)
                for ($i = 0; $i < 5; $i++) {
                    $col = $xStartCol + $i;
                    $boardState["0_{$col}"] = 'X';
                }
                
                // O wins horizontally on row 5 (different row to avoid overlap)
                for ($i = 0; $i < 5; $i++) {
                    $col = $oStartCol + $i;
                    $boardState["5_{$col}"] = 'O';
                }

                $violations = $this->ruleEngine->checkImpossibleWins($boardState);

                // Property: both players winning MUST be detected as violation
                $this->assertNotEmpty(
                    $violations,
                    'Should detect impossible win when both players have 5 in a row'
                );

                // Verify violation type
                $this->assertEquals(
                    RuleAnalysisResult::VIOLATION_IMPOSSIBLE_WIN,
                    $violations[0]['type'],
                    'Violation type should be impossible_win'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 8: Impossible Win Detection**
     * 
     * *For any* board state where only one player has a winning condition,
     * the rule engine SHALL NOT flag any violations.
     * 
     * **Validates: Requirements 3.3**
     * 
     * @test
     */
    public function noViolationsForSingleWinner(): void
    {
        $this
            ->forAll(
                $this->playerGenerator(),
                Generators::choose(0, 9)  // Start position
            )
            ->withMaxSize(100)
            ->then(function (string $winner, int $start) {
                // Create a board where only one player wins
                $boardState = [];
                
                // Winner has 5 in a row horizontally
                for ($i = 0; $i < 5; $i++) {
                    $boardState["{$start}_{$i}"] = $winner;
                }
                
                // Other player has only 3 in a row (not winning)
                $loser = $winner === 'X' ? 'O' : 'X';
                for ($i = 0; $i < 3; $i++) {
                    $boardState["10_{$i}"] = $loser;
                }

                $violations = $this->ruleEngine->checkImpossibleWins($boardState);

                // Property: single winner should have NO violations
                $this->assertEmpty(
                    $violations,
                    "Single winner ({$winner}) should not trigger impossible win violation"
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 8: Impossible Win Detection**
     * 
     * *For any* board state where no player has a winning condition,
     * the rule engine SHALL NOT flag any violations.
     * 
     * **Validates: Requirements 3.3**
     * 
     * @test
     */
    public function noViolationsForNoWinner(): void
    {
        $this
            ->forAll(
                Generators::choose(1, 4)  // Max consecutive pieces (less than 5)
            )
            ->withMaxSize(100)
            ->then(function (int $maxConsecutive) {
                // Create a board where no one wins
                $boardState = [];
                
                // X has some pieces but not 5 in a row
                for ($i = 0; $i < $maxConsecutive; $i++) {
                    $boardState["0_{$i}"] = 'X';
                }
                
                // O has some pieces but not 5 in a row
                for ($i = 0; $i < $maxConsecutive; $i++) {
                    $boardState["5_{$i}"] = 'O';
                }

                $violations = $this->ruleEngine->checkImpossibleWins($boardState);

                // Property: no winner should have NO violations
                $this->assertEmpty(
                    $violations,
                    'No winner should not trigger impossible win violation'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 8: Impossible Win Detection**
     * 
     * *For any* empty board state, the rule engine SHALL NOT flag any violations.
     * 
     * **Validates: Requirements 3.3**
     * 
     * @test
     */
    public function noViolationsForEmptyBoard(): void
    {
        $violations = $this->ruleEngine->checkImpossibleWins([]);
        
        $this->assertEmpty(
            $violations,
            'Empty board should have no violations'
        );
    }

    /**
     * **Feature: report-violation-system, Property 9: Timing Anomaly Detection**
     * 
     * *For any* move sequence with timestamps where consecutive moves have 
     * time difference less than 100ms, the rule engine SHALL flag as anomaly.
     * 
     * **Validates: Requirements 3.4**
     * 
     * @test
     */
    public function detectsTooFastMoves(): void
    {
        $this
            ->forAll(
                Generators::choose(0, 99),  // Time diff in ms (less than 100ms threshold)
                Generators::choose(2, 10)   // Number of fast moves
            )
            ->withMaxSize(100)
            ->then(function (int $timeDiff, int $moveCount) {
                $moves = [];
                $timestamp = 1000000;
                $players = ['X', 'O'];
                
                for ($i = 0; $i < $moveCount; $i++) {
                    $moves[] = [
                        'player' => $players[$i % 2],
                        'timestamp' => $timestamp,
                        'x' => $i,
                        'y' => 0,
                    ];
                    $timestamp += $timeDiff;  // Add small time diff (< 100ms)
                }

                $violations = $this->ruleEngine->checkTimingAnomalies($moves);

                // Property: moves faster than 100ms MUST be detected
                $this->assertNotEmpty(
                    $violations,
                    "Should detect moves with {$timeDiff}ms interval (< 100ms threshold)"
                );

                // All violations should be timing anomalies of type 'too_fast'
                foreach ($violations as $violation) {
                    $this->assertEquals(
                        RuleAnalysisResult::VIOLATION_TIMING_ANOMALY,
                        $violation['type'],
                        'Violation type should be timing_anomaly'
                    );
                    $this->assertEquals(
                        'too_fast',
                        $violation['details']['anomaly_type'],
                        'Anomaly type should be too_fast'
                    );
                }
            });
    }

    /**
     * **Feature: report-violation-system, Property 9: Timing Anomaly Detection**
     * 
     * *For any* move sequence with timestamps where consecutive moves have 
     * time difference greater than configured timeout (300000ms), 
     * the rule engine SHALL flag as anomaly.
     * 
     * **Validates: Requirements 3.4**
     * 
     * @test
     */
    public function detectsTooSlowMoves(): void
    {
        $this
            ->forAll(
                Generators::choose(300001, 500000)  // Time diff > 300000ms threshold
            )
            ->withMaxSize(100)
            ->then(function (int $timeDiff) {
                $moves = [
                    ['player' => 'X', 'timestamp' => 1000000, 'x' => 0, 'y' => 0],
                    ['player' => 'O', 'timestamp' => 1000000 + $timeDiff, 'x' => 1, 'y' => 0],
                ];

                $violations = $this->ruleEngine->checkTimingAnomalies($moves);

                // Property: moves slower than timeout MUST be detected
                $this->assertNotEmpty(
                    $violations,
                    "Should detect moves with {$timeDiff}ms interval (> 300000ms threshold)"
                );

                // Verify violation details
                $this->assertEquals(
                    RuleAnalysisResult::VIOLATION_TIMING_ANOMALY,
                    $violations[0]['type'],
                    'Violation type should be timing_anomaly'
                );
                $this->assertEquals(
                    'too_slow',
                    $violations[0]['details']['anomaly_type'],
                    'Anomaly type should be too_slow'
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 9: Timing Anomaly Detection**
     * 
     * *For any* move sequence with normal timing (100ms <= diff <= 300000ms),
     * the rule engine SHALL NOT flag any violations.
     * 
     * **Validates: Requirements 3.4**
     * 
     * @test
     */
    public function noViolationsForNormalTiming(): void
    {
        $this
            ->forAll(
                Generators::choose(100, 300000),  // Normal time diff
                Generators::choose(2, 10)         // Number of moves
            )
            ->withMaxSize(100)
            ->then(function (int $timeDiff, int $moveCount) {
                $moves = [];
                $timestamp = 1000000;
                $players = ['X', 'O'];
                
                for ($i = 0; $i < $moveCount; $i++) {
                    $moves[] = [
                        'player' => $players[$i % 2],
                        'timestamp' => $timestamp,
                        'x' => $i,
                        'y' => 0,
                    ];
                    $timestamp += $timeDiff;
                }

                $violations = $this->ruleEngine->checkTimingAnomalies($moves);

                // Property: normal timing should have NO violations
                $this->assertEmpty(
                    $violations,
                    "Normal timing ({$timeDiff}ms) should not trigger violations"
                );
            });
    }

    /**
     * **Feature: report-violation-system, Property 9: Timing Anomaly Detection**
     * 
     * *For any* empty or single-move sequence,
     * the rule engine SHALL NOT flag any timing violations.
     * 
     * **Validates: Requirements 3.4**
     * 
     * @test
     */
    public function noTimingViolationsForEmptyOrSingleMove(): void
    {
        // Test empty moves
        $violations = $this->ruleEngine->checkTimingAnomalies([]);
        $this->assertEmpty($violations, 'Empty moves should have no timing violations');

        // Test single move
        $violations = $this->ruleEngine->checkTimingAnomalies([
            ['player' => 'X', 'timestamp' => 1000000, 'x' => 0, 'y' => 0]
        ]);
        $this->assertEmpty($violations, 'Single move should have no timing violations');
    }
}
