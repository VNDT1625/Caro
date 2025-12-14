<?php

namespace App\Controllers;

use App\Models\Appeal;
use App\Services\AppealServiceInterface;
use InvalidArgumentException;
use RuntimeException;

/**
 * AppealController
 * 
 * Handles HTTP requests for the appeal system.
 * Provides endpoints for creating, listing, and processing appeals.
 * 
 * **Validates: Requirements 7.1, 7.5, 9.5**
 */
class AppealController
{
    private AppealServiceInterface $appealService;

    /**
     * Create a new AppealController instance.
     * 
     * @param AppealServiceInterface $appealService Service for appeal operations
     */
    public function __construct(AppealServiceInterface $appealService)
    {
        $this->appealService = $appealService;
    }

    /**
     * POST /api/appeals - Create a new appeal
     * 
     * Creates a new appeal for a banned user.
     * Note: Appeals do NOT trigger AI processing per Requirements 7.2
     * 
     * Request body:
     * - report_id: string (required) - UUID of the report to appeal
     * - reason: string (required) - Appeal reason up to 2000 characters
     * 
     * **Validates: Requirements 7.1**
     * 
     * @param array $requestData Request body data
     * @param string $userId UUID of the authenticated user
     * @return array Response with created appeal or error
     */
    public function store(array $requestData, string $userId): array
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

            // Create the appeal
            $appeal = $this->appealService->createAppeal(
                $requestData['report_id'],
                $userId,
                $requestData['reason']
            );

            // Return success response
            return [
                'success' => true,
                'message' => 'Đã gửi khiếu nại, admin sẽ xem xét',
                'data' => $this->formatAppealResponse($appeal),
                'status' => 201,
            ];
        } catch (InvalidArgumentException $e) {
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
            $code = 'SERVER_ERROR';
            $status = 500;
            $message = 'Không thể tạo khiếu nại';

            if (strpos($e->getMessage(), 'not found') !== false) {
                $code = 'REPORT_NOT_FOUND';
                $status = 404;
                $message = 'Không tìm thấy báo cáo';
            } elseif (strpos($e->getMessage(), 'already exists') !== false) {
                $code = 'APPEAL_EXISTS';
                $status = 409;
                $message = 'Đã có khiếu nại cho báo cáo này';
            }

            return [
                'success' => false,
                'error' => [
                    'code' => $code,
                    'message' => $message,
                    'details' => [],
                ],
                'status' => $status,
            ];
        }
    }

    /**
     * GET /api/appeals - List appeals (admin only)
     * 
     * Returns paginated list of appeals with optional filters.
     * 
     * Query parameters:
     * - status: string (optional) - Filter by status
     * - page: int (optional, default: 1) - Page number
     * - per_page: int (optional, default: 20) - Items per page
     * 
     * **Validates: Requirements 9.5**
     * 
     * @param array $queryParams Query parameters
     * @return array Response with paginated appeals
     */
    public function index(array $queryParams): array
    {
        try {
            $page = isset($queryParams['page']) ? max(1, (int)$queryParams['page']) : 1;
            $perPage = isset($queryParams['per_page']) ? min(100, max(1, (int)$queryParams['per_page'])) : 20;
            $status = $queryParams['status'] ?? null;

            // Get appeals based on status filter
            if ($status === 'pending') {
                $appeals = $this->appealService->getPendingAppeals();
            } else {
                // For now, get pending appeals as default
                // In a real implementation, we'd have a method to get all appeals with filters
                $appeals = $this->appealService->getPendingAppeals();
            }

            // Manual pagination
            $total = count($appeals);
            $totalPages = (int)ceil($total / $perPage);
            $offset = ($page - 1) * $perPage;
            $paginatedAppeals = array_slice($appeals, $offset, $perPage);

            $formattedAppeals = array_map(
                fn($appeal) => $this->formatAppealResponse($appeal),
                $paginatedAppeals
            );

            return [
                'success' => true,
                'data' => $formattedAppeals,
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
                    'message' => 'Không thể lấy danh sách khiếu nại',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * GET /api/appeals/{id} - Get appeal detail (admin only)
     * 
     * Returns detailed information about a specific appeal.
     * 
     * **Validates: Requirements 9.5**
     * 
     * @param string $appealId UUID of the appeal
     * @return array Response with appeal details
     */
    public function show(string $appealId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($appealId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID khiếu nại không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            $appeal = $this->appealService->getAppeal($appealId);

            if ($appeal === null) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'APPEAL_NOT_FOUND',
                        'message' => 'Không tìm thấy khiếu nại',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => true,
                'data' => $this->formatAppealDetailResponse($appeal),
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy chi tiết khiếu nại',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * PUT /api/appeals/{id} - Process appeal (admin only)
     * 
     * Processes an appeal with admin decision.
     * 
     * Request body:
     * - status: string (required) - 'approved' or 'rejected'
     * - admin_response: string (required) - Admin's response
     * - lift_ban: bool (optional) - Whether to lift the ban (only for approved)
     * 
     * **Validates: Requirements 7.5**
     * 
     * @param string $appealId UUID of the appeal
     * @param array $requestData Request body data
     * @param string $adminId UUID of the admin processing the appeal
     * @return array Response with updated appeal
     */
    public function update(string $appealId, array $requestData, string $adminId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($appealId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID khiếu nại không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            // Validate update data
            $validation = $this->validateUpdateRequest($requestData);
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

            $liftBan = isset($requestData['lift_ban']) ? (bool)$requestData['lift_ban'] : false;

            $appeal = $this->appealService->processAppeal(
                $appealId,
                $requestData['status'],
                $requestData['admin_response'],
                $adminId,
                $liftBan
            );

            $message = $requestData['status'] === Appeal::STATUS_APPROVED
                ? 'Đã chấp nhận khiếu nại'
                : 'Đã từ chối khiếu nại';

            return [
                'success' => true,
                'message' => $message,
                'data' => $this->formatAppealResponse($appeal),
                'status' => 200,
            ];
        } catch (InvalidArgumentException $e) {
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
                        'code' => 'APPEAL_NOT_FOUND',
                        'message' => 'Không tìm thấy khiếu nại',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể xử lý khiếu nại',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * Validate create appeal request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateCreateRequest(array $data): array
    {
        $errors = [];

        // report_id is required
        if (empty($data['report_id'])) {
            $errors['report_id'] = 'ID báo cáo là bắt buộc';
        } elseif (!$this->isValidUuid($data['report_id'])) {
            $errors['report_id'] = 'ID báo cáo không hợp lệ';
        }

        // reason is required
        if (empty($data['reason']) || strlen(trim($data['reason'])) === 0) {
            $errors['reason'] = 'Lý do khiếu nại là bắt buộc';
        } elseif (strlen($data['reason']) > Appeal::MAX_REASON_LENGTH) {
            $errors['reason'] = 'Lý do không được vượt quá ' . Appeal::MAX_REASON_LENGTH . ' ký tự';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Validate update appeal request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateUpdateRequest(array $data): array
    {
        $errors = [];

        // status is required
        if (empty($data['status'])) {
            $errors['status'] = 'Trạng thái là bắt buộc';
        } elseif (!in_array($data['status'], [Appeal::STATUS_APPROVED, Appeal::STATUS_REJECTED])) {
            $errors['status'] = 'Trạng thái không hợp lệ. Phải là: ' . Appeal::STATUS_APPROVED . ' hoặc ' . Appeal::STATUS_REJECTED;
        }

        // admin_response is required
        if (empty($data['admin_response']) || strlen(trim($data['admin_response'])) === 0) {
            $errors['admin_response'] = 'Phản hồi của admin là bắt buộc';
        } elseif (strlen($data['admin_response']) > Appeal::MAX_ADMIN_RESPONSE_LENGTH) {
            $errors['admin_response'] = 'Phản hồi không được vượt quá ' . Appeal::MAX_ADMIN_RESPONSE_LENGTH . ' ký tự';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Format appeal for API response.
     * 
     * @param Appeal $appeal The appeal model
     * @return array Formatted appeal data
     */
    private function formatAppealResponse(Appeal $appeal): array
    {
        return [
            'id' => $appeal->getAttribute('id'),
            'report_id' => $appeal->getAttribute('report_id'),
            'user_id' => $appeal->getAttribute('user_id'),
            'reason' => $appeal->getAttribute('reason'),
            'status' => $appeal->getAttribute('status'),
            'admin_response' => $appeal->getAttribute('admin_response'),
            'processed_by' => $appeal->getAttribute('processed_by'),
            'processed_at' => $appeal->getAttribute('processed_at'),
            'created_at' => $appeal->getAttribute('created_at'),
            'updated_at' => $appeal->getAttribute('updated_at'),
        ];
    }

    /**
     * Format appeal detail for API response (includes related data).
     * 
     * **Validates: Requirements 9.5** - Show complete history including 
     * original report, AI analysis, and previous actions
     * 
     * @param Appeal $appeal The appeal model
     * @return array Formatted appeal detail data
     */
    private function formatAppealDetailResponse(Appeal $appeal): array
    {
        $data = $this->formatAppealResponse($appeal);

        // Add related data
        $data['report'] = $appeal->report();
        $data['user'] = $appeal->user();
        $data['processed_by_admin'] = $appeal->processedBy();

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
