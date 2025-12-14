<?php

namespace App\Controllers;

use App\Models\Report;
use App\Models\ReportAction;
use App\Services\ReportServiceInterface;
use App\Services\BanServiceInterface;
use InvalidArgumentException;
use RuntimeException;

/**
 * ReportController
 * 
 * Handles HTTP requests for the report violation system.
 * Provides endpoints for creating, listing, viewing, and updating reports.
 * 
 * **Validates: Requirements 8.1, 1.1, 1.5, 9.1, 9.2, 9.3, 9.4**
 */
class ReportController
{
    private ReportServiceInterface $reportService;
    private ?BanServiceInterface $banService;

    /**
     * Create a new ReportController instance.
     * 
     * @param ReportServiceInterface $reportService Service for report operations
     * @param BanServiceInterface|null $banService Service for ban operations (optional)
     */
    public function __construct(
        ReportServiceInterface $reportService,
        ?BanServiceInterface $banService = null
    ) {
        $this->reportService = $reportService;
        $this->banService = $banService;
    }

    /**
     * POST /api/reports - Create a new report
     * 
     * Creates a new violation report from the authenticated user.
     * 
     * Request body:
     * - type: string (required) - One of: 'gian_lan_trong_tran', 'toxic', 'bug', 'khac'
     * - reported_user_id: string (optional) - UUID of the reported user
     * - match_id: string (optional) - UUID of the related match
     * - description: string (optional) - Description up to 1000 characters
     * 
     * **Validates: Requirements 1.1, 1.5**
     * 
     * @param array $requestData Request body data
     * @param string $reporterId UUID of the authenticated user
     * @return array Response with created report or error
     */
    public function store(array $requestData, string $reporterId): array
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

            // Create the report
            $report = $this->reportService->createReport($requestData, $reporterId);

            // Return success response with confirmation message
            // **Validates: Requirements 1.5** - Display confirmation message
            return [
                'success' => true,
                'message' => 'Đã gửi report, hệ thống sẽ kiểm tra',
                'data' => $this->formatReportResponse($report),
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
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể tạo báo cáo',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * GET /api/reports - List reports (admin only)
     * 
     * Returns paginated list of reports with optional filters.
     * 
     * Query parameters:
     * - status: string (optional) - Filter by status
     * - type: string (optional) - Filter by type
     * - date_from: string (optional) - Filter by start date (ISO 8601)
     * - date_to: string (optional) - Filter by end date (ISO 8601)
     * - page: int (optional, default: 1) - Page number
     * - per_page: int (optional, default: 20) - Items per page
     * 
     * **Validates: Requirements 9.1**
     * 
     * @param array $queryParams Query parameters
     * @return array Response with paginated reports
     */
    public function index(array $queryParams): array
    {
        try {
            // Build filters from query params
            $filters = $this->buildFilters($queryParams);
            $page = isset($queryParams['page']) ? max(1, (int)$queryParams['page']) : 1;
            $perPage = isset($queryParams['per_page']) ? min(100, max(1, (int)$queryParams['per_page'])) : 20;

            // Get reports from service
            $result = $this->reportService->getReports($filters, $page, $perPage);

            return [
                'success' => true,
                'data' => $result['data'],
                'meta' => [
                    'total' => $result['total'],
                    'page' => $result['page'],
                    'per_page' => $result['per_page'],
                    'total_pages' => $result['total_pages'],
                ],
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy danh sách báo cáo',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * GET /api/reports/{id} - Get report detail (admin only)
     * 
     * Returns detailed information about a specific report including
     * related data (reporter, reported user, match, appeals, actions).
     * 
     * **Validates: Requirements 9.2**
     * 
     * @param string $reportId UUID of the report
     * @return array Response with report details
     */
    public function show(string $reportId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($reportId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID báo cáo không hợp lệ',
                        'details' => [],
                    ],
                    'status' => 422,
                ];
            }

            $report = $this->reportService->getReportDetail($reportId);

            if ($report === null) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'REPORT_NOT_FOUND',
                        'message' => 'Không tìm thấy báo cáo',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => true,
                'data' => $this->formatReportDetailResponse($report),
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể lấy chi tiết báo cáo',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * PUT /api/reports/{id} - Update report (admin only)
     * 
     * Updates report status and/or admin notes. Logs the action.
     * 
     * Request body:
     * - status: string (optional) - New status
     * - admin_notes: string (optional) - Admin notes
     * 
     * **Validates: Requirements 9.3, 9.4**
     * 
     * @param string $reportId UUID of the report
     * @param array $requestData Request body data
     * @param string $adminId UUID of the admin making the update
     * @return array Response with updated report
     */
    public function update(string $reportId, array $requestData, string $adminId): array
    {
        try {
            // Validate UUID format
            if (!$this->isValidUuid($reportId)) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'ID báo cáo không hợp lệ',
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

            $report = $this->reportService->updateReport($reportId, $requestData, $adminId);

            return [
                'success' => true,
                'message' => 'Đã cập nhật báo cáo',
                'data' => $this->formatReportResponse($report),
                'status' => 200,
            ];
        } catch (RuntimeException $e) {
            if (strpos($e->getMessage(), 'not found') !== false) {
                return [
                    'success' => false,
                    'error' => [
                        'code' => 'REPORT_NOT_FOUND',
                        'message' => 'Không tìm thấy báo cáo',
                        'details' => [],
                    ],
                    'status' => 404,
                ];
            }

            return [
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Không thể cập nhật báo cáo',
                    'details' => [],
                ],
                'status' => 500,
            ];
        }
    }

    /**
     * Validate create report request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateCreateRequest(array $data): array
    {
        $errors = [];

        // Type is required
        if (empty($data['type'])) {
            $errors['type'] = 'Loại báo cáo là bắt buộc';
        } elseif (!in_array($data['type'], Report::VALID_TYPES)) {
            $errors['type'] = 'Loại báo cáo không hợp lệ. Phải là một trong: ' . implode(', ', Report::VALID_TYPES);
        }

        // Validate reported_user_id if provided
        if (!empty($data['reported_user_id']) && !$this->isValidUuid($data['reported_user_id'])) {
            $errors['reported_user_id'] = 'ID người bị báo cáo không hợp lệ';
        }

        // Validate match_id if provided
        if (!empty($data['match_id']) && !$this->isValidUuid($data['match_id'])) {
            $errors['match_id'] = 'ID trận đấu không hợp lệ';
        }

        // Validate description length
        if (!empty($data['description']) && strlen($data['description']) > Report::MAX_DESCRIPTION_LENGTH) {
            $errors['description'] = 'Mô tả không được vượt quá ' . Report::MAX_DESCRIPTION_LENGTH . ' ký tự';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Validate update report request data.
     * 
     * @param array $data Request data
     * @return array Validation result ['valid' => bool, 'errors' => array]
     */
    private function validateUpdateRequest(array $data): array
    {
        $errors = [];

        // Validate status if provided
        if (isset($data['status']) && !in_array($data['status'], Report::VALID_STATUSES)) {
            $errors['status'] = 'Trạng thái không hợp lệ. Phải là một trong: ' . implode(', ', Report::VALID_STATUSES);
        }

        // Validate admin_notes length if provided
        if (isset($data['admin_notes']) && strlen($data['admin_notes']) > 2000) {
            $errors['admin_notes'] = 'Ghi chú admin không được vượt quá 2000 ký tự';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Build filters array from query parameters.
     * 
     * @param array $queryParams Query parameters
     * @return array Filters for the service
     */
    private function buildFilters(array $queryParams): array
    {
        $filters = [];

        if (!empty($queryParams['status']) && in_array($queryParams['status'], Report::VALID_STATUSES)) {
            $filters['status'] = $queryParams['status'];
        }

        if (!empty($queryParams['type']) && in_array($queryParams['type'], Report::VALID_TYPES)) {
            $filters['type'] = $queryParams['type'];
        }

        if (!empty($queryParams['date_from'])) {
            $filters['date_from'] = $queryParams['date_from'];
        }

        if (!empty($queryParams['date_to'])) {
            $filters['date_to'] = $queryParams['date_to'];
        }

        return $filters;
    }

    /**
     * Format report for API response.
     * 
     * @param Report $report The report model
     * @return array Formatted report data
     */
    private function formatReportResponse(Report $report): array
    {
        return [
            'id' => $report->getAttribute('id'),
            'reporter_id' => $report->getAttribute('reporter_id'),
            'reported_user_id' => $report->getAttribute('reported_user_id'),
            'match_id' => $report->getAttribute('match_id'),
            'type' => $report->getAttribute('type'),
            'description' => $report->getAttribute('description'),
            'status' => $report->getAttribute('status'),
            'created_at' => $report->getAttribute('created_at'),
            'updated_at' => $report->getAttribute('updated_at'),
        ];
    }

    /**
     * Format report detail for API response (includes related data).
     * 
     * **Validates: Requirements 9.2** - Show reporter info, reported user info,
     * match_id, player description, reason_result, AI JSON
     * 
     * @param Report $report The report model
     * @return array Formatted report detail data
     */
    private function formatReportDetailResponse(Report $report): array
    {
        $data = $this->formatReportResponse($report);

        // Add analysis data
        $data['rule_analysis'] = $report->getAttribute('rule_analysis');
        $data['reason_result'] = $report->getAttribute('reason_result');
        $data['ai_analysis'] = $report->getAttribute('ai_analysis');
        $data['ai_summary_player'] = $report->getAttribute('ai_summary_player');
        $data['ai_details_admin'] = $report->getAttribute('ai_details_admin');

        // Add processing info
        $data['processed_at'] = $report->getAttribute('processed_at');
        $data['processed_by'] = $report->getAttribute('processed_by');
        $data['admin_notes'] = $report->getAttribute('admin_notes');

        // Add related data
        $data['reporter'] = $report->reporter();
        $data['reported_user'] = $report->reportedUser();
        $data['match'] = $report->match();
        $data['appeals'] = $report->appeals();
        $data['actions'] = $report->actions();

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
