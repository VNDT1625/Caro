<?php

declare(strict_types=1);

namespace App;

/**
 * Database wrapper class for PDO operations.
 * Provides a simple interface for database queries.
 */
class Database
{
    private ?\PDO $pdo;

    public function __construct(?\PDO $pdo = null)
    {
        $this->pdo = $pdo;
    }

    /**
     * Execute a query and return results.
     * 
     * @param string $sql SQL query with $1, $2, etc. placeholders (PostgreSQL style)
     * @param array $params Parameters to bind
     * @return array Query results
     */
    public function query(string $sql, array $params = []): array
    {
        if (!$this->pdo) {
            return [];
        }

        try {
            // Convert PostgreSQL-style placeholders ($1, $2) to PDO-style (?, ?)
            $convertedSql = $this->convertPlaceholders($sql);
            
            $stmt = $this->pdo->prepare($convertedSql);
            $stmt->execute(array_values($params));
            
            return $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            error_log("Database query error: " . $e->getMessage());
            error_log("SQL: " . $sql);
            return [];
        }
    }

    /**
     * Execute an insert/update/delete and return affected rows.
     * 
     * @param string $sql SQL statement
     * @param array $params Parameters to bind
     * @return int Number of affected rows
     */
    public function execute(string $sql, array $params = []): int
    {
        if (!$this->pdo) {
            return 0;
        }

        try {
            $convertedSql = $this->convertPlaceholders($sql);
            
            $stmt = $this->pdo->prepare($convertedSql);
            $stmt->execute(array_values($params));
            
            return $stmt->rowCount();
        } catch (\PDOException $e) {
            error_log("Database execute error: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Get the last inserted ID.
     * 
     * @return string|false
     */
    public function lastInsertId(): string|false
    {
        if (!$this->pdo) {
            return false;
        }
        return $this->pdo->lastInsertId();
    }

    /**
     * Get the underlying PDO instance.
     * 
     * @return \PDO|null
     */
    public function getPdo(): ?\PDO
    {
        return $this->pdo;
    }

    /**
     * Convert PostgreSQL-style placeholders ($1, $2) to PDO-style (?)
     */
    private function convertPlaceholders(string $sql): string
    {
        // Replace $1, $2, etc. with ?
        return preg_replace('/\$\d+/', '?', $sql);
    }
}
