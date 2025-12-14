<?php

namespace App\Middleware;

/**
 * AdminAuthorization Middleware
 * 
 * Handles admin authorization checks for protected endpoints.
 * Verifies that the authenticated user has admin privileges.
 * 
 * **Validates: Requirements 9.1** - Admin endpoints require admin role
 */
class AdminAuthorization
{
    /** @var string|null Supabase URL */
    private ?string $supabaseUrl;

    /** @var string|null Supabase service key */
    private ?string $supabaseServiceKey;

    /** @var array<string, bool> Cache of admin status checks */
    private static array $adminCache = [];

    /**
     * Create a new AdminAuthorization instance.
     * 
     * @param string|null $supabaseUrl Supabase URL
     * @param string|null $supabaseServiceKey Supabase service key
     */
    public function __construct(?string $supabaseUrl = null, ?string $supabaseServiceKey = null)
    {
        $this->supabaseUrl = $supabaseUrl ?? getenv('SUPABASE_URL') ?: null;
        $this->supabaseServiceKey = $supabaseServiceKey ?? getenv('SUPABASE_SERVICE_KEY') ?: null;
    }

    /**
     * Check if a user is an admin.
     * 
     * @param string $userId UUID of the user to check
     * @return bool True if user is admin
     */
    public function isAdmin(string $userId): bool
    {
        // Check cache first
        if (isset(self::$adminCache[$userId])) {
            return self::$adminCache[$userId];
        }

        // Validate UUID format
        if (!$this->isValidUuid($userId)) {
            self::$adminCache[$userId] = false;
            return false;
        }

        // Check against Supabase admins table
        $isAdmin = $this->checkAdminInDatabase($userId);
        
        // Cache the result
        self::$adminCache[$userId] = $isAdmin;
        
        return $isAdmin;
    }

    /**
     * Authorize an admin request.
     * Returns error response if not authorized.
     * 
     * @param string|null $userId UUID of the authenticated user
     * @return array|null Null if authorized, error response array if not
     */
    public function authorize(?string $userId): ?array
    {
        // Check if user is authenticated
        if ($userId === null) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHORIZED',
                    'message' => 'Đăng nhập để truy cập',
                    'details' => [],
                ],
                'status' => 401,
            ];
        }

        // Check if user is admin
        if (!$this->isAdmin($userId)) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'FORBIDDEN',
                    'message' => 'Chỉ admin mới có quyền truy cập',
                    'details' => [],
                ],
                'status' => 403,
            ];
        }

        return null; // Authorized
    }

    /**
     * Check admin status in database.
     * 
     * @param string $userId UUID of the user
     * @return bool True if user is admin
     */
    private function checkAdminInDatabase(string $userId): bool
    {
        if (!$this->supabaseUrl || !$this->supabaseServiceKey) {
            // If Supabase not configured, deny admin access
            return false;
        }

        $url = rtrim($this->supabaseUrl, '/') . "/rest/v1/admins?user_id=eq.{$userId}&select=id&limit=1";
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'apikey: ' . $this->supabaseServiceKey,
                'Authorization: Bearer ' . $this->supabaseServiceKey,
            ],
            CURLOPT_TIMEOUT => 5,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || $response === false) {
            return false;
        }

        $data = json_decode($response, true);
        return is_array($data) && count($data) > 0;
    }

    /**
     * Clear the admin cache.
     * Useful when admin status changes.
     * 
     * @param string|null $userId Specific user to clear (null = clear all)
     */
    public static function clearCache(?string $userId = null): void
    {
        if ($userId !== null) {
            unset(self::$adminCache[$userId]);
        } else {
            self::$adminCache = [];
        }
    }

    /**
     * Check if a string is a valid UUID.
     * 
     * @param string $uuid The string to check
     * @return bool True if valid UUID
     */
    private function isValidUuid(string $uuid): bool
    {
        return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $uuid) === 1;
    }
}
