<?php

declare(strict_types=1);

namespace App;

use App\Services\SupabaseClient;

/**
 * SupabaseDatabase - Database wrapper using Supabase REST API.
 * Provides same interface as Database class but uses HTTP instead of PDO.
 * Fallback when PDO drivers are not available.
 */
class SupabaseDatabase extends Database
{
    private SupabaseClient $client;

    public function __construct(?SupabaseClient $client = null)
    {
        parent::__construct(null);
        $this->client = $client ?? new SupabaseClient();
    }

    /**
     * Execute a query and return results.
     * Converts simple SQL to Supabase REST API calls.
     * 
     * @param string $sql SQL query (limited support)
     * @param array $params Parameters
     * @return array Query results
     */
    public function query(string $sql, array $params = []): array
    {
        if (!$this->client->isConfigured()) {
            error_log("SupabaseDatabase: Client not configured");
            return [];
        }

        try {
            // Parse simple SELECT queries
            if (preg_match('/SELECT\s+(.+?)\s+FROM\s+(\w+)/i', $sql, $matches)) {
                $select = trim($matches[1]);
                $table = trim($matches[2]);
                
                // Build filters from WHERE clause
                $filters = $this->parseWhereClause($sql, $params);
                
                // Handle ORDER BY
                $orderBy = $this->parseOrderBy($sql);
                if ($orderBy) {
                    $filters['order'] = $orderBy;
                }
                
                // Handle LIMIT
                $limit = $this->parseLimit($sql);
                if ($limit) {
                    $filters['limit'] = $limit;
                }
                
                $result = $this->client->query($table, $filters, $select);
                return $result ?? [];
            }
            
            // For INSERT/UPDATE/DELETE, log and return empty
            error_log("SupabaseDatabase: Unsupported query type: " . substr($sql, 0, 50));
            return [];
            
        } catch (\Exception $e) {
            error_log("SupabaseDatabase query error: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Parse WHERE clause and convert to Supabase filters.
     */
    private function parseWhereClause(string $sql, array $params): array
    {
        $filters = [];
        
        // Extract WHERE clause
        if (!preg_match('/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/is', $sql, $whereMatch)) {
            return $filters;
        }
        
        $whereClause = trim($whereMatch[1]);
        
        // Split by AND
        $conditions = preg_split('/\s+AND\s+/i', $whereClause);
        
        $paramIndex = 0;
        foreach ($conditions as $condition) {
            $condition = trim($condition);
            
            // Handle: column = $1 or column = ?
            if (preg_match('/(\w+)\s*=\s*(?:\$\d+|\?|true|false)/i', $condition, $m)) {
                $column = $m[1];
                
                // Check for boolean literals
                if (preg_match('/=\s*(true|false)/i', $condition, $boolMatch)) {
                    $filters[$column] = 'eq.' . strtolower($boolMatch[1]);
                } elseif (isset($params[$paramIndex])) {
                    $filters[$column] = 'eq.' . $params[$paramIndex];
                    $paramIndex++;
                }
            }
            // Handle: column > $1
            elseif (preg_match('/(\w+)\s*>\s*(?:\$\d+|\?)/i', $condition, $m)) {
                $column = $m[1];
                if (isset($params[$paramIndex])) {
                    $filters[$column] = 'gt.' . $params[$paramIndex];
                    $paramIndex++;
                }
            }
            // Handle: column < $1
            elseif (preg_match('/(\w+)\s*<\s*(?:\$\d+|\?)/i', $condition, $m)) {
                $column = $m[1];
                if (isset($params[$paramIndex])) {
                    $filters[$column] = 'lt.' . $params[$paramIndex];
                    $paramIndex++;
                }
            }
            // Handle: column <= NOW() or column > NOW()
            elseif (preg_match('/(\w+)\s*(<=|>=|<|>)\s*NOW\(\)/i', $condition, $m)) {
                $column = $m[1];
                $op = $m[2];
                $now = date('c'); // ISO 8601 format
                $opMap = ['<=' => 'lte', '>=' => 'gte', '<' => 'lt', '>' => 'gt'];
                $filters[$column] = ($opMap[$op] ?? 'eq') . '.' . $now;
            }
            // Handle: column IN (...)
            elseif (preg_match('/(\w+)\s+IN\s*\(([^)]+)\)/i', $condition, $m)) {
                $column = $m[1];
                $inValues = $m[2];
                
                // Check if it's placeholders
                if (preg_match_all('/\$\d+|\?/', $inValues, $placeholders)) {
                    $values = [];
                    foreach ($placeholders[0] as $_) {
                        if (isset($params[$paramIndex])) {
                            $values[] = $params[$paramIndex];
                            $paramIndex++;
                        }
                    }
                    if (!empty($values)) {
                        $filters[$column] = 'in.(' . implode(',', $values) . ')';
                    }
                }
            }
            // Handle: column IS NULL
            elseif (preg_match('/(\w+)\s+IS\s+NULL/i', $condition, $m)) {
                $filters[$m[1]] = 'is.null';
            }
            // Handle: column IS NOT NULL
            elseif (preg_match('/(\w+)\s+IS\s+NOT\s+NULL/i', $condition, $m)) {
                $filters[$m[1]] = 'not.is.null';
            }
        }
        
        return $filters;
    }

    /**
     * Parse ORDER BY clause.
     */
    private function parseOrderBy(string $sql): ?string
    {
        if (preg_match('/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/is', $sql, $m)) {
            $orderParts = [];
            $columns = explode(',', $m[1]);
            foreach ($columns as $col) {
                $col = trim($col);
                if (preg_match('/(\w+)(?:\s+(ASC|DESC))?/i', $col, $cm)) {
                    $dir = isset($cm[2]) && strtoupper($cm[2]) === 'DESC' ? '.desc' : '.asc';
                    $orderParts[] = $cm[1] . $dir;
                }
            }
            return implode(',', $orderParts);
        }
        return null;
    }

    /**
     * Parse LIMIT clause.
     */
    private function parseLimit(string $sql): ?string
    {
        if (preg_match('/LIMIT\s+(\d+)/i', $sql, $m)) {
            return $m[1];
        }
        return null;
    }

    /**
     * Execute is not fully supported via REST API.
     */
    public function execute(string $sql, array $params = []): int
    {
        error_log("SupabaseDatabase: execute() not supported via REST API");
        return 0;
    }

    /**
     * Get underlying PDO (not available).
     */
    public function getPdo(): ?\PDO
    {
        return null;
    }
}
