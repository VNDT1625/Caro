<?php

namespace App\Controllers;

/**
 * AI Proxy Controller
 * 
 * Proxies requests to AI service to bypass browser extension interference.
 */
class AIProxyController
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = getenv('AI_SERVICE_URL') ?: 'http://localhost:8004';
    }

    /**
     * Proxy analyze request to AI service
     */
    public function analyze(): void
    {
        $this->proxyRequest('/analyze', 'POST');
    }

    /**
     * Proxy usage request to AI service
     */
    public function usage(): void
    {
        $queryString = $_SERVER['QUERY_STRING'] ?? '';
        $this->proxyRequest('/usage?' . $queryString, 'GET');
    }

    /**
     * Proxy ask request to AI service
     */
    public function ask(): void
    {
        $this->proxyRequest('/ask', 'POST');
    }

    /**
     * Proxy replay create request
     */
    public function replayCreate(): void
    {
        $this->proxyRequest('/replay/create', 'POST');
    }

    /**
     * Proxy replay navigate request
     */
    public function replayNavigate(): void
    {
        $this->proxyRequest('/replay/navigate', 'POST');
    }

    /**
     * Proxy replay play request
     */
    public function replayPlay(): void
    {
        $this->proxyRequest('/replay/play', 'POST');
    }

    /**
     * Proxy health check
     */
    public function health(): void
    {
        $this->proxyRequest('/health', 'GET');
    }

    /**
     * Generic proxy method
     */
    private function proxyRequest(string $path, string $method): void
    {
        $url = $this->aiServiceUrl . $path;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json'
        ]);

        if ($method === 'POST') {
            $body = file_get_contents('php://input');
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            http_response_code(502);
            echo json_encode([
                'error' => 'AI service unavailable',
                'details' => $error
            ]);
            return;
        }

        http_response_code($httpCode);
        header('Content-Type: application/json');
        echo $response;
    }
}
