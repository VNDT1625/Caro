<?php

namespace App\Services;

/**
 * AIAnalysisServiceInterface
 * 
 * Interface for AI-based cheat detection and analysis.
 * The AI analyzes match data and rule-based findings to determine
 * if cheating occurred.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */
interface AIAnalysisServiceInterface
{
    /**
     * Analyze a cheat report using AI.
     * 
     * @param array $information Match data including moves, players, timestamps
     * @param string $reasonResult Rule-based analysis findings
     * @return AIAnalysisResult|null Analysis result, or null if AI fails
     */
    public function analyzeCheatReport(array $information, string $reasonResult): ?AIAnalysisResult;

    /**
     * Build the prompt to send to the AI model.
     * 
     * @param array $information Match data
     * @param string $reasonResult Rule-based findings
     * @return string The formatted prompt
     */
    public function buildPrompt(array $information, string $reasonResult): string;

    /**
     * Validate that an AI response has the required format.
     * 
     * Expected format:
     * {
     *   "report_result": "co" | "khong",
     *   "summary_for_player": string,
     *   "details_for_admin": string
     * }
     * 
     * @param array $response The parsed AI response
     * @return bool True if valid, false otherwise
     */
    public function validateResponse(array $response): bool;
}
