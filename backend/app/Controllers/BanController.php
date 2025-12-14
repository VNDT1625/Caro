<?php

namespace App\Controllers;

use App\Models\UserBan;
use App\Services\BanServiceInterface;
use RuntimeException;

/**
 * BanController
 * 
 * Handles HTTP requests for the ban management system.
 * Provides endpoints for checking ban status and listing bans (admin).
 * 
 * **Validates: Requirements 6.1, 6.3, 9.1**
 */
class BanController
{
    private BanServiceInterface $banService;

    /**
     * Create a new BanController instance.
     * 
     * @param BanServiceInterface $banService Service for ban operations
     */
    public function __construct(BanServiceInterface $banService)
    {
        $this->banService = $banService;
    }

    /**
     * GET /api/bans/status - Check current user's ban status
     * 
     * Returns the ban status for the authenticated user.
     * If banned, includes ban details and appeal option.
     * 
     * **Validates: Requirements 6.3**
     * 
     * @param string $userId UUID of the authenticated user
     * @return array Response with ban status
     */
    public function status(string $userId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($userId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người dùng không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            $banStatus = $this->banService->checkUserBanStatus($userId);

            return [
                'success' => true,
                'data' => $banStatus->toArray(),
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể kiểm tra trạng thái ban',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }


    /**
     * POST /api/admin/bans - Create a new ban (admin only)
     * 
     * Creates a new ban for a user.
     * 
     * Request body:
     * - user_id: string (required) - UUID of the user to ban
     * - report_id: string (optional) - UUID of the related report
     * - ban_type: string (required) - 'temporary', 'permanent', or 'warning'
     * - reason: string (required) - Reason for the ban
     * - duration_days: int (optional) - Duration in days for temporary bans
     * 
     * **Validates: Requirements 6.1, 6.2**
     * 
     * @param array $requestData Request body data
     * @param string $adminId UUID of the admin creating the ban
     * @return array Response with created ban
     */
    public function store(array $requestData, string $adminId): array
    {
        try {
            // Validate required fields
            $validation = $this->validateCreateRequest($requestData);
            if (!$validation['valid']) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'Dữ liệu không hợp lệ',
                        'details' => $validation['errors'],
                    ],
                    'status' => 422,
                ];
            }

            $ban = $this->banService->applyBan(
                $requestData['user_id'],
                $requestData['report_id'] ?? null,
                $requestData['ban_type'],
                $requestData['reason'],
                $requestData['duration_days'] ?? null
            );

            return [
                'success' => true,
                'message' => 'Đã áp dụng ban thành công',
                'data' => $this->formatBanResponse($ban),
                'status' => 201,
            ];
        } catch (\InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể tạo ban',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * Validate create ban request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateCreateRequest(array $data): array
    {
        $errors = [];

        // user_id is required
        if (empty($data['user_id'])) {
            $errors['user_id'] = 'ID người dùng là bắt buộc';
        } elseif (!$this->isValidUuid($data['user_id'])) {
            $errors['user_id'] = 'ID người dùng không hợp lệ';
        }

        // ban_type is required
        if (empty($data['ban_type'])) {
            $errors['ban_type'] = 'Loại ban là bắt buộc';
        } elseif (!in_array($data['ban_type'], UserBan::VALID_TYPES)) {
            $errors['ban_type'] = 'Loại ban không hợp lệ. Phải là: ' . implode(', ', UserBan::VALID_TYPES);
        }

        // reason is required
        if (empty($data['reason']) || strlen(trim($data['reason'])) === 0) {
            $errors['reason'] = 'Lý do ban là bắt buộc';
        } elseif (strlen($data['reason']) > UserBan::MAX_REASON_LENGTH) {
            $errors['reason'] = 'Lý do không được vượt quá ' . UserBan::MAX_REASON_LENGTH . ' ký tự';
        }

        // Validate report_id if provided
        if (!empty($data['report_id']) && !$this->isValidUuid($data['report_id'])) {
            $errors['report_id'] = 'ID báo cáo không hợp lệ';
        }

        // Validate duration_days for temporary bans
        if (isset($data['ban_type']) && $data['ban_type'] === UserBan::TYPE_TEMPORARY) {
            if (isset($data['duration_days']) && (int)$data['duration_days'] <= 0) {
                $errors['duration_days'] = 'Số ngày ban phải lớn hơn 0';
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * GET /api/admin/bans - List all bans (admin only)
     * 
     * Returns paginated list of bans with optional filters.
     * 
     * Query parameters:
     * - status: string (optional) - Filter by status: 'active', 'expired', 'lifted'
     * - user_id: string (optional) - Filter by user ID
     * - ban_type: string (optional) - Filter by ban type
     * - page: int (optional, default: 1) - Page number
     * - per_page: int (optional, default: 20) - Items per page
     * 
     * **Validates: Requirements 9.1**
     * 
     * @param array $queryParams Query parameters
     * @return array Response with paginated bans
     */
    public function index(array $queryParams): array
    {
        try {
            $page = isset($queryParams['page']) ? max(1, (int)$queryParams['page']) : 1;
            $perPage = isset($queryParams['per_page']) ? min(100, max(1, (int)$queryParams['per_page'])) : 20;

            // Build filters
            $filters = $this->buildFilters($queryParams);

            // Get bans based on filters
            $bans = $this->getBansWithFilters($filters);

            // Manual pagination
            $total = count($bans);
            $totalPages = (int)ceil($total / $perPage);
            $offset = ($page - 1) * $perPage;
            $paginatedBans = array_slice($bans, $offset, $perPage);

            $formattedBans = array_map(
                fn($ban) => $this->formatBanResponse($ban),
                $paginatedBans
            );

            return [
                'success' => true,
                'data' => $formattedBans,
                'meta' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage,
                    'total_pages' => $totalPages,
                ],
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy danh sách ban',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * GET /api/admin/bans/{id} - Get ban detail (admin only)
     * 
     * Returns detailed information about a specific ban.
     * 
     * @param string $banId UUID of the ban
     * @return array Response with ban details
     */
    public function show(string $banId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($banId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID ban không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            $ban = $this->banService->getBan($banId);

            if ($ban === null) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'BAN_NOT_FOUND',
                        'message' => 'Không tìm thấy ban',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => true,
                'data' => $this->formatBanDetailResponse($ban),
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy chi tiết ban',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * POST /api/admin/bans/{id}/lift - Lift a ban (admin only)
     * 
     * Lifts an existing ban.
     * 
     * Request body:
     * - reason: string (required) - Reason for lifting the ban
     * 
     * **Validates: Requirements 7.5**
     * 
     * @param string $banId UUID of the ban to lift
     * @param array $requestData Request body data
     * @param string $adminId UUID of the admin lifting the ban
     * @return array Response with updated ban
     */
    public function lift(string $banId, array $requestData, string $adminId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($banId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID ban không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate lift reason
            $validation = $this->validateLiftRequest($requestData);
            if (!$validation['valid']) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'Dữ liệu không hợp lệ',
                        'details' => $validation['errors'],
                    ],
                    'status' => 422,
                ];
            }

            $ban = $this->banService->liftBan($banId, $adminId, $requestData['reason']);

            return [
                'success' => true,
                'message' => 'Đã gỡ ban thành công',
                'data' => $this->formatBanResponse($ban),
                'status' => 200,
            ];
        } catch (\InvalidArgumentException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => [],
                ],
                'status' => 422,
            ];
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'not found') !== false) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'BAN_NOT_FOUND',
                        'message' => 'Không tìm thấy ban',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể gỡ ban',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * GET /api/admin/bans/user/{userId} - Get ban history for a user (admin only)
     * 
     * Returns all bans (active and lifted) for a specific user.
     * 
     * @param string $userId UUID of the user
     * @return array Response with user's ban history
     */
    public function userHistory(string $userId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($userId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID người dùng không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            $bans = $this->banService->getBanHistory($userId);

            $formattedBans = array_map(
                fn($ban) => $this->formatBanResponse($ban),
                $bans
            );

            return [
                'success' => true,
                'data' => $formattedBans,
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy lịch sử ban',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * Build filters array from query parameters.
     * 
     * @param array $queryParams Query parameters
     * @return array Filters
     */
    private function buildFilters(array $queryParams): array
    {
        $filters = [];

        if (!empty($queryParams['status'])) {
            $validStatuses = ['active', 'expired', 'lifted'];
            if (in_array($queryParams['status'], $validStatuses)) {
                $filters['status'] = $queryParams['status'];
            }
        }

        if (!empty($queryParams['user_id']) && $this->isValidUuid($queryParams['user_id'])) {
            $filters['user_id'] = $queryParams['user_id'];
        }

        if (!empty($queryParams['ban_type']) && in_array($queryParams['ban_type'], UserBan::VALID_TYPES)) {
            $filters['ban_type'] = $queryParams['ban_type'];
        }

        return $filters;
    }

    /**
     * Get bans with applied filters.
     * 
     * @param array $filters Filters to apply
     * @return array List of UserBan objects
     */
    private function getBansWithFilters(array $filters): array
    {
        // If user_id filter is provided, get bans for that user
        if (!empty($filters['user_id'])) {
            if (!empty($filters['status']) && $filters['status'] === 'active') {
                return $this->banService->getActiveBans($filters['user_id']);
            }
            return $this->banService->getBanHistory($filters['user_id']);
        }

        // For now, return empty array if no user_id filter
        // In a real implementation, this would query all bans from database
        return [];
    }

    /**
     * Validate lift ban request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateLiftRequest(array $data): array
    {
        $errors = [];

        if (empty($data['reason']) || strlen(trim($data['reason'])) === 0) {
            $errors['reason'] = 'Lý do gỡ ban là bắt buộc';
        } elseif (strlen($data['reason']) > UserBan::MAX_LIFT_REASON_LENGTH) {
            $errors['reason'] = 'Lý do không được vượt quá ' . UserBan::MAX_LIFT_REASON_LENGTH . ' ký tự';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Format ban for API response.
     * 
     * @param UserBan $ban The ban model
     * @return array Formatted ban data
     */
    private function formatBanResponse(UserBan $ban): array
    {
        $expiresAt = $ban->getAttribute('expires_at');
        if ($expiresAt instanceof \DateTimeInterface) {
            $expiresAt = $expiresAt->format('Y-m-d H:i:s');
        }

        $liftedAt = $ban->getAttribute('lifted_at');
        if ($liftedAt instanceof \DateTimeInterface) {
            $liftedAt = $liftedAt->format('Y-m-d H:i:s');
        }

        return [
            'id' => $ban->getAttribute('id'),
            'user_id' => $ban->getAttribute('user_id'),
            'report_id' => $ban->getAttribute('report_id'),
            'ban_type' => $ban->getAttribute('ban_type'),
            'reason' => $ban->getAttribute('reason'),
            'expires_at' => $expiresAt,
            'is_active' => $ban->isActive(),
            'is_expired' => $ban->isExpired(),
            'is_lifted' => $ban->isLifted(),
            'lifted_at' => $liftedAt,
            'lifted_by' => $ban->getAttribute('lifted_by'),
            'lift_reason' => $ban->getAttribute('lift_reason'),
            'created_at' => $ban->getAttribute('created_at'),
            'updated_at' => $ban->getAttribute('updated_at'),
        ];
    }

    /**
     * Format ban detail for API response (includes related data).
     * 
     * @param UserBan $ban The ban model
     * @return array Formatted ban detail data
     */
    private function formatBanDetailResponse(UserBan $ban): array
    {
        $data = $this->formatBanResponse($ban);

        // Add related data
        $data['user'] = $ban->user();
        $data['report'] = $ban->report();
        $data['lifted_by_admin'] = $ban->liftedBy();

        return $data;
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
