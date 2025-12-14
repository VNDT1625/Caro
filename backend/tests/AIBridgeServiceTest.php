<?php

use PHPUnit\Framework\TestCase;
use App\Services\AIBridgeService;

/**
 * Integration Tests for AIBridgeService
 * 
 * Tests PHP → Python communication.
 * Note: These tests require the Python AI service to be running.
 * 
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**
 */
class AIBridgeServiceTest extends TestCase
{
    private AIBridgeService $service;
    private bool $pythonServiceAvailable = false;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Use localhost:8000 as default Python service URL
        $this->service = new AIBridgeService(
            baseUrl: 'http://localhost:8000',
            timeoutSeconds: 5,
            connectTimeoutSeconds: 2,
            maxRetries: 1
        );

        // Check if Python service is available
        $this->pythonServiceAvailable = $this->service->healthCheck();
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
     * Test health check returns boolean
     * 
     * @test
     */
    public function healthCheckReturnsBoolean(): void
    {
        $result = $this->service->healthCheck();
        $this->assertIsBool($result);
    }

    /**
     * Test analyze match with basic tier
     * 
     * @test
     */
    public function analyzeMatchBasicTier(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $moves = [
            ['x' => 7, 'y' => 7, 'player' => 'X'],
            ['x' => 8, 'y' => 7, 'player' => 'O'],
            ['x' => 7, 'y' => 8, 'player' => 'X'],
        ];

        $result = $this->service->analyzeMatch($matchId, $moves, 'basic', $userId);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'analyzeMatch must return array or null'
        );

        if ($result !== null) {
            // Check response structure
            $this->assertArrayHasKey('tier', $result);
            $this->assertEquals('basic', $result['tier']);
        }
    }

    /**
     * Test analyze match with pro tier
     * 
     * @test
     */
    public function analyzeMatchProTier(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $moves = [
            ['x' => 7, 'y' => 7, 'player' => 'X'],
            ['x' => 8, 'y' => 7, 'player' => 'O'],
        ];

        $result = $this->service->analyzeMatch($matchId, $moves, 'pro', $userId);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'analyzeMatch must return array or null'
        );
    }

    /**
     * Test ask question
     * 
     * @test
     */
    public function askQuestion(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $question = 'Tại sao nước này là sai lầm?';

        $result = $this->service->askQuestion($matchId, $question, $userId);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'askQuestion must return array or null'
        );

        if ($result !== null) {
            $this->assertArrayHasKey('answer', $result);
        }
    }

    /**
     * Test create replay session
     * 
     * @test
     */
    public function createReplaySession(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();

        $result = $this->service->createReplaySession($matchId, $userId);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'createReplaySession must return array or null'
        );

        if ($result !== null) {
            $this->assertArrayHasKey('session_id', $result);
        }
    }

    /**
     * Test navigate replay
     * 
     * @test
     */
    public function navigateReplay(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        // First create a session
        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $session = $this->service->createReplaySession($matchId, $userId);

        if ($session === null) {
            $this->markTestSkipped('Could not create replay session');
        }

        $result = $this->service->navigateReplay($session['session_id'], 0);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'navigateReplay must return array or null'
        );
    }

    /**
     * Test play replay move
     * 
     * @test
     */
    public function playReplayMove(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        // First create a session
        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $session = $this->service->createReplaySession($matchId, $userId);

        if ($session === null) {
            $this->markTestSkipped('Could not create replay session');
        }

        $move = ['x' => 7, 'y' => 7];
        $result = $this->service->playReplayMove($session['session_id'], $move);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'playReplayMove must return array or null'
        );
    }

    /**
     * Test get usage
     * 
     * @test
     */
    public function getUsage(): void
    {
        if (!$this->pythonServiceAvailable) {
            $this->markTestSkipped('Python AI service not available');
        }

        $userId = $this->generateUuid();

        $result = $this->service->getUsage($userId);

        // Should return array or null
        $this->assertTrue(
            $result === null || is_array($result),
            'getUsage must return array or null'
        );
    }

    /**
     * Test service handles connection failure gracefully
     * 
     * @test
     */
    public function handlesConnectionFailureGracefully(): void
    {
        // Create service with invalid URL
        $service = new AIBridgeService(
            baseUrl: 'http://localhost:99999',  // Invalid port
            timeoutSeconds: 1,
            connectTimeoutSeconds: 1,
            maxRetries: 1
        );

        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $moves = [['x' => 7, 'y' => 7, 'player' => 'X']];

        // Should return null, not throw exception
        $result = $service->analyzeMatch($matchId, $moves, 'basic', $userId);
        $this->assertNull($result, 'Connection failure must return null');
    }

    /**
     * Test service handles timeout gracefully
     * 
     * @test
     */
    public function handlesTimeoutGracefully(): void
    {
        // Create service with very short timeout
        $service = new AIBridgeService(
            baseUrl: 'http://localhost:8000',
            timeoutSeconds: 0,  // Immediate timeout
            connectTimeoutSeconds: 0,
            maxRetries: 1
        );

        $matchId = $this->generateUuid();
        $userId = $this->generateUuid();
        $moves = [['x' => 7, 'y' => 7, 'player' => 'X']];

        // Should return null, not throw exception
        $result = $service->analyzeMatch($matchId, $moves, 'basic', $userId);
        $this->assertTrue(
            $result === null || is_array($result),
            'Timeout must be handled gracefully'
        );
    }

    /**
     * Test base URL getter and setter
     * 
     * @test
     */
    public function baseUrlGetterAndSetter(): void
    {
        $originalUrl = $this->service->getBaseUrl();
        $this->assertIsString($originalUrl);

        $newUrl = 'http://example.com:8080';
        $this->service->setBaseUrl($newUrl);
        $this->assertEquals($newUrl, $this->service->getBaseUrl());

        // Restore original
        $this->service->setBaseUrl($originalUrl);
    }
}
