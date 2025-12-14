<?php

namespace App\Controllers;

/**
 * DatasetController - Server-side dataset search
 * 
 * Thay vì load toàn bộ dataset ở frontend, user gửi query lên server
 * Server search và trả về kết quả phù hợp nhất
 */
class DatasetController
{
    private array $dataset = [];
    private bool $loaded = false;
    private string $datasetPath;
    
    public function __construct()
    {
        // Dataset path - có thể là file gộp hoặc folder chứa parts
        $this->datasetPath = dirname(__DIR__, 3) . '/frontend/public/datasets';
    }
    
    /**
     * Load dataset từ các file parts
     */
    private function loadDataset(?string $language = null): void
    {
        if ($this->loaded) {
            return;
        }
        
        $indexPath = $this->datasetPath . '/index.json';
        if (!file_exists($indexPath)) {
            return;
        }
        
        $index = json_decode(file_get_contents($indexPath), true);
        if (!$index || !isset($index['parts'])) {
            return;
        }
        
        foreach ($index['parts'] as $part) {
            $partPath = $this->datasetPath . '/' . $part['file'];
            if (!file_exists($partPath)) {
                continue;
            }
            
            $lines = file($partPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $entry = json_decode($line, true);
                if (!$entry || !isset($entry['question']) || !isset($entry['answer'])) {
                    continue;
                }
                
                // Filter by language if specified
                $entryLang = $entry['language'] ?? 'vi';
                if ($language && $entryLang !== $language) {
                    continue;
                }
                
                $this->dataset[] = $entry;
            }
        }
        
        $this->loaded = true;
    }
    
    /**
     * Normalize text for matching
     */
    private function normalizeText(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        // Remove diacritics (Vietnamese)
        $text = preg_replace('/[\x{0300}-\x{036f}]/u', '', normalizer_normalize($text, \Normalizer::NFD));
        // Keep only alphanumeric and spaces
        $text = preg_replace('/[^a-z0-9\s]/u', ' ', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }
    
    /**
     * Tokenize text
     */
    private function tokenize(string $text): array
    {
        $normalized = $this->normalizeText($text);
        return array_filter(explode(' ', $normalized));
    }
    
    /**
     * Calculate overlap score between query and candidate
     */
    private function overlapScore(array $queryTokens, array $candidateTokens): float
    {
        if (empty($queryTokens) || empty($candidateTokens)) {
            return 0.0;
        }
        
        $candidateSet = array_flip($candidateTokens);
        $overlap = 0;
        
        foreach ($queryTokens as $token) {
            if (isset($candidateSet[$token])) {
                $overlap++;
            }
        }
        
        $coverageQuery = $overlap / count($queryTokens);
        $coverageCandidate = $overlap / count($candidateTokens);
        
        $lengthDiff = abs(count($queryTokens) - count($candidateTokens));
        $maxLen = max(count($queryTokens), count($candidateTokens), 1);
        $balancePenalty = 1 - min($lengthDiff / $maxLen, 0.5);
        
        $score = ($coverageQuery * 0.6 + $coverageCandidate * 0.4) * $balancePenalty;
        
        // Bonus for substring match
        $joinedQuery = implode(' ', $queryTokens);
        $joinedCandidate = implode(' ', $candidateTokens);
        if (strpos($joinedCandidate, $joinedQuery) !== false || strpos($joinedQuery, $joinedCandidate) !== false) {
            $score += 0.08;
        }
        
        return min($score, 1.0);
    }
    
    /**
     * Search dataset for best matching answer
     * 
     * POST /api/dataset/search
     * Body: { "query": "...", "language": "vi" }
     */
    public function search(): void
    {
        header('Content-Type: application/json');
        
        $input = json_decode(file_get_contents('php://input'), true);
        $query = $input['query'] ?? '';
        $language = $input['language'] ?? null;
        
        if (empty($query)) {
            http_response_code(400);
            echo json_encode(['error' => 'Query is required']);
            return;
        }
        
        $this->loadDataset($language);
        
        if (empty($this->dataset)) {
            echo json_encode([
                'found' => false,
                'message' => 'Dataset not available'
            ]);
            return;
        }
        
        $queryTokens = $this->tokenize($query);
        if (empty($queryTokens)) {
            echo json_encode([
                'found' => false,
                'message' => 'Invalid query'
            ]);
            return;
        }
        
        $best = null;
        $bestScore = 0;
        $bestMatchedText = '';
        
        foreach ($this->dataset as $entry) {
            $candidates = array_merge([$entry['question']], $entry['paraphrases'] ?? []);
            
            foreach ($candidates as $text) {
                $candidateTokens = $this->tokenize($text);
                $score = $this->overlapScore($queryTokens, $candidateTokens);
                
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best = $entry;
                    $bestMatchedText = $text;
                }
            }
        }
        
        if ($best === null || $bestScore < 0.14) {
            echo json_encode([
                'found' => false,
                'message' => 'No matching answer found',
                'score' => $bestScore
            ]);
            return;
        }
        
        echo json_encode([
            'found' => true,
            'answer' => $best['answer'],
            'score' => round($bestScore, 3),
            'matchedText' => $bestMatchedText,
            'topic' => $best['topic'] ?? null,
            'difficulty' => $best['difficulty'] ?? null
        ]);
    }
    
    /**
     * Get dataset stats
     * 
     * GET /api/dataset/stats
     */
    public function stats(): void
    {
        header('Content-Type: application/json');
        
        $indexPath = $this->datasetPath . '/index.json';
        if (!file_exists($indexPath)) {
            echo json_encode([
                'available' => false,
                'message' => 'Dataset index not found'
            ]);
            return;
        }
        
        $index = json_decode(file_get_contents($indexPath), true);
        
        echo json_encode([
            'available' => true,
            'totalParts' => $index['totalParts'] ?? 0,
            'totalEntries' => $index['totalEntries'] ?? 0,
            'parts' => array_map(function($p) {
                return [
                    'file' => $p['file'],
                    'entries' => $p['entries']
                ];
            }, $index['parts'] ?? [])
        ]);
    }
}
