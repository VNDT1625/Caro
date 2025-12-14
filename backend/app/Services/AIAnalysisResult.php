<?php

namespace App\Services;

/**
 * AIAnalysisResult DTO
 * 
 * Data Transfer Object containing the results of AI-based cheat analysis.
 * 
 * **Validates: Requirements 4.3**
 */
class AIAnalysisResult
{
    /**
     * AI determination: 'co' (cheating detected) or 'khong' (no cheating)
     */
    public string $reportResult;

    /**
     * Summary message for the player (shown in ban notification)
     */
    public string $summaryForPlayer;

    /**
     * Detailed analysis for admin review
     */
    public string $detailsForAdmin;

    /**
     * Valid report result values
     */
    public const RESULT_CHEATING = 'co';
    public const RESULT_NO_CHEATING = 'khong';

    public const VALID_RESULTS = [
        self::RESULT_CHEATING,
        self::RESULT_NO_CHEATING,
    ];

    public function __construct(
        string $reportResult,
        string $summaryForPlayer,
        string $detailsForAdmin
    ) {
        $this->reportResult = $reportResult;
        $this->summaryForPlayer = $summaryForPlayer;
        $this->detailsForAdmin = $detailsForAdmin;
    }

    /**
     * Check if cheating was detected
     */
    public function isCheating(): bool
    {
        return $this->reportResult === self::RESULT_CHEATING;
    }

    /**
     * Convert to array for JSON serialization
     */
    public function toArray(): array
    {
        return [
            'report_result' => $this->reportResult,
            'summary_for_player' => $this->summaryForPlayer,
            'details_for_admin' => $this->detailsForAdmin,
        ];
    }

    /**
     * Create from array (e.g., from AI response)
     * 
     * @param array $data Array with report_result, summary_for_player, details_for_admin
     * @return self|null Returns null if data is invalid
     */
    public static function fromArray(array $data): ?self
    {
        $reportResult = $data['report_result'] ?? null;
        $summaryForPlayer = $data['summary_for_player'] ?? null;
        $detailsForAdmin = $data['details_for_admin'] ?? null;

        if (!self::isValidData($reportResult, $summaryForPlayer, $detailsForAdmin)) {
            return null;
        }

        return new self(
            reportResult: $reportResult,
            summaryForPlayer: $summaryForPlayer,
            detailsForAdmin: $detailsForAdmin
        );
    }

    /**
     * Validate that all required fields are present and valid
     */
    public static function isValidData(
        mixed $reportResult,
        mixed $summaryForPlayer,
        mixed $detailsForAdmin
    ): bool {
        // Check report_result is valid
        if (!is_string($reportResult) || !in_array($reportResult, self::VALID_RESULTS, true)) {
            return false;
        }

        // Check summary_for_player is a non-empty string
        if (!is_string($summaryForPlayer) || trim($summaryForPlayer) === '') {
            return false;
        }

        // Check details_for_admin is a non-empty string
        if (!is_string($detailsForAdmin) || trim($detailsForAdmin) === '') {
            return false;
        }

        return true;
    }
}
