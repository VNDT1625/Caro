<?php

namespace App\Services;

/**
 * SupabaseClient
 * 
 * Simple HTTP client for Supabase REST API.
 * Uses service_role key for admin operations.
 */
class SupabaseClient
{
    private string $url;
    private string $key;
    private int $timeout;

    public function __construct(
        ?string $url = null,
        ?string $key = null,
        int $timeout = 30
    ) {
        $this->url = $url ?: (getenv('SUPABASE_URL') ?: '');
        $this->key = $key ?: (getenv('SUPABASE_SERVICE_KEY') ?: getenv('SUPABASE_ANON_KEY') ?: '');
        $this->timeout = $timeout;
    }

    /**
     * Check if client is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->url) && !empty($this->key);
    }

    /**
     * Query a table with filters.
     * 
     * @param string $table Table name
     * @param array $filters Filters in format ['column' => 'eq.value']
     * @param string $select Columns to select (default: *)
     * @return array|null Query result or null on error
     */
    public function query(string $table, array $filters = [], string $select = '*'): ?array
    {
        if (!$this->isConfigured()) {
            error_log("SupabaseClient: Not configured");
            return null;
        }

        $endpoint = "{$this->url}/rest/v1/{$table}";
        
        // Build query params
        $params = ['select' => $select];
        foreach ($filters as $column => $filter) {
            $params[$column] = $filter;
        }
        
        $queryString = http_build_query($params);
        $fullUrl = "{$endpoint}?{$queryString}";

        return $this->request('GET', $fullUrl);
    }

    /**
     * Get a single row by ID.
     * 
     * @param string $table Table name
     * @param string $id UUID of the row
     * @param string $select Columns to select
     * @return array|null Single row or null
     */
    public function getById(string $table, string $id, string $select = '*'): ?array
    {
        $result = $this->query($table, ['id' => "eq.{$id}"], $select);
        
        if ($result !== null && count($result) > 0) {
            return $result[0];
        }
        
        return null;
    }

    /**
     * Insert a row.
     * 
     * @param string $table Table name
     * @param array $data Data to insert
     * @return array|null Inserted row or null on error
     */
    public function insert(string $table, array $data): ?array
    {
        if (!$this->isConfigured()) {
            return null;
        }

        $endpoint = "{$this->url}/rest/v1/{$table}";
        
        return $this->request('POST', $endpoint, $data, [
            'Prefer: return=representation'
        ]);
    }

    /**
     * Update rows matching filters.
     * 
     * @param string $table Table name
     * @param array $data Data to update
     * @param array $filters Filters
     * @return array|null Updated rows or null on error
     */
    public function update(string $table, array $data, array $filters): ?array
    {
        if (!$this->isConfigured()) {
            return null;
        }

        $endpoint = "{$this->url}/rest/v1/{$table}";
        
        // Build query params for filters
        $params = [];
        foreach ($filters as $column => $filter) {
            $params[$column] = $filter;
        }
        
        $queryString = http_build_query($params);
        $fullUrl = "{$endpoint}?{$queryString}";

        return $this->request('PATCH', $fullUrl, $data, [
            'Prefer: return=representation'
        ]);
    }

    /**
     * Make HTTP request to Supabase.
     * 
     * @param string $method HTTP method
     * @param string $url Full URL
     * @param array|null $data Request body
     * @param array $extraHeaders Additional headers
     * @return array|null Response data or null on error
     */
    private function request(string $method, string $url, ?array $data = null, array $extraHeaders = []): ?array
    {
        $ch = curl_init($url);
        
        if ($ch === false) {
            error_log("SupabaseClient: Failed to init cURL");
            return null;
        }

        $headers = [
            'apikey: ' . $this->key,
            'Authorization: Bearer ' . $this->key,
            'Content-Type: application/json',
        ];
        $headers = array_merge($headers, $extraHeaders);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => getenv('SUPABASE_SKIP_SSL_VERIFY') !== '1',
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            if ($data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        
        curl_close($ch);

        if ($curlError) {
            error_log("SupabaseClient: cURL error - {$curlError}");
            return null;
        }

        if ($httpCode >= 400) {
            error_log("SupabaseClient: HTTP {$httpCode} - {$response}");
            return null;
        }

        $result = json_decode($response, true);
        
        if ($result === null && $response !== '[]' && $response !== '') {
            error_log("SupabaseClient: Failed to parse response - {$response}");
            return null;
        }

        return $result ?? [];
    }
}
