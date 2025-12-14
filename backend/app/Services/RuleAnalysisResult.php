<?php

namespace App\Services;

/**
 * RuleAnalysisResult DTO
 * 
 * Data Transfer Object containing the results of rule-based match analysis.
 */
class RuleAnalysisResult
{
    /**
     * Whether any violations were detected
     */
    public bool $hasViolations;

    /**
     * List of detected violations
     * Each violation is an array with: type, description, details
     */
    public array $violations;

    /**
     * Confidence level of the analysis: 'low', 'medium', 'high'
     */
    public string $confidence;

    /**
     * Human-readable description of all violations
     */
    public string $reasonResult;

    /**
     * Additional metadata about the analysis
     */
    public array $metadata;

    /**
     * Valid confidence levels
     */
    public const CONFIDENCE_LOW = 'low';
    public const CONFIDENCE_MEDIUM = 'medium';
    public const CONFIDENCE_HIGH = 'high';

    public const VALID_CONFIDENCE_LEVELS = [
        self::CONFIDENCE_LOW,
        self::CONFIDENCE_MEDIUM,
        self::CONFIDENCE_HIGH,
    ];

    /**
     * Violation types
     */
    public const VIOLATION_MULTIPLE_MOVES = 'multiple_moves';
    public const VIOLATION_IMPOSSIBLE_WIN = 'impossible_win';
    public const VIOLATION_TIMING_ANOMALY = 'timing_anomaly';

    public function __construct(
        bool $hasViolations = false,
        array $violations = [],
        string $confidence = self::CONFIDENCE_LOW,
        string $reasonResult = '',
        array $metadata = []
    ) {
        $this->hasViolations = $hasViolations;
        $this->violations = $violations;
        $this->confidence = $confidence;
        $this->reasonResult = $reasonResult;
        $this->metadata = $metadata;
    }

    /**
     * Create an empty result (no violations)
     */
    public static function noViolations(): self
    {
        return new self(
            hasViolations: false,
            violations: [],
            confidence: self::CONFIDENCE_HIGH,
            reasonResult: 'Không phát hiện bất thường trong trận đấu.',
            metadata: []
        );
    }

    /**
     * Convert to array for JSON serialization
     */
    public function toArray(): array
    {
        return [
            'has_violations' => $this->hasViolations,
            'violations' => $this->violations,
            'confidence' => $this->confidence,
            'reason_result' => $this->reasonResult,
            'metadata' => $this->metadata,
        ];
    }
}
