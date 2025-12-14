<?php

namespace App\Controllers;

use App\Services\CurrencyServiceInterface;
use RuntimeException;

/**
 * CurrencyController
 * 
 * API endpoints for coin/gem purchase
 */
class CurrencyController
{
    private CurrencyServiceInterface $currencyService;

    public function __construct(CurrencyServiceInterface $currencyService)
    {
        $this->currencyService = $currencyService;
    }

    /**
     * GET /api/currency/packages
     * Get all available currency packages
     */
    public function getPackages(array $query): array
    {
        try {
            $type = $query['type'] ?? null;
            if ($type && !in_array($type, ['coin', 'gem'], true)) {
                $type = null;
            }

            $packages = $this->currencyService->getPackages($type);

            return $this->ok($packages, 'Packages loaded');
        } catch (\Throwable $e) {
            $this->logError('getPackages', $e);
            return $this->error('SERVER_ERROR', 'Cannot load packages', [], 500);
        }
    }

    /**
     * POST /api/currency/purchase
     * Create a currency purchase (VNPay)
     * Body: { package_code: string }
     */
    public function createPurchase(array $requestData, string $userId): array
    {
        try {
            $packageCode = $requestData['package_code'] ?? $requestData['package_id'] ?? null;
            if (!$packageCode) {
                return $this->error('VALIDATION_ERROR', 'package_code is required', [], 422);
            }

            $result = $this->currencyService->createPurchase($userId, $packageCode);

            return $this->ok($result, 'Payment link created');
        } catch (RuntimeException $e) {
            return $this->error('VALIDATION_ERROR', $e->getMessage(), [], 422);
        } catch (\Throwable $e) {
            $this->logError('createPurchase', $e);
            return $this->error('SERVER_ERROR', 'Cannot create purchase', [], 500);
        }
    }

    /**
     * POST /api/currency/webhook
     * VNPay IPN callback
     */
    public function webhook(array $params): array
    {
        try {
            $result = $this->currencyService->processPayment($params);

            if (!$result['valid']) {
                return $this->error('INVALID', $result['status'], [], 400);
            }

            return $this->ok([
                'status' => $result['status'],
                'txn_ref' => $result['txn_ref'],
                'currency_type' => $result['currency_type'] ?? null,
                'amount' => $result['amount'] ?? null,
            ]);
        } catch (\Throwable $e) {
            $this->logError('webhook', $e);
            return $this->error('SERVER_ERROR', 'Webhook processing failed', [], 500);
        }
    }

    /**
     * GET /api/currency/status/{txnRef}
     * Get purchase status
     */
    public function getStatus(string $txnRef): array
    {
        try {
            $purchase = $this->currencyService->getPurchaseStatus($txnRef);
            if (!$purchase) {
                return $this->error('NOT_FOUND', 'Purchase not found', [], 404);
            }

            return $this->ok([
                'txn_ref' => $txnRef,
                'status' => $purchase['status'],
                'currency_type' => $purchase['currency_type'],
                'amount' => $purchase['total_amount'],
                'price_vnd' => $purchase['price_vnd'],
            ]);
        } catch (\Throwable $e) {
            $this->logError('getStatus', $e);
            return $this->error('SERVER_ERROR', 'Cannot get status', [], 500);
        }
    }

    /**
     * GET /api/currency/history
     * Get user's purchase history
     */
    public function getHistory(string $userId, array $query): array
    {
        try {
            $limit = min((int)($query['limit'] ?? 20), 100);
            $purchases = $this->currencyService->getUserPurchases($userId, $limit);

            return $this->ok($purchases, 'History loaded');
        } catch (\Throwable $e) {
            $this->logError('getHistory', $e);
            return $this->error('SERVER_ERROR', 'Cannot load history', [], 500);
        }
    }

    /**
     * GET /api/currency/balance
     * Get user's current balance
     */
    public function getBalance(string $userId): array
    {
        try {
            $balance = $this->currencyService->getBalance($userId);
            return $this->ok($balance, 'Balance loaded');
        } catch (\Throwable $e) {
            $this->logError('getBalance', $e);
            return $this->error('SERVER_ERROR', 'Cannot load balance', [], 500);
        }
    }

    /**
     * POST /api/currency/test
     * Test endpoint - simulate successful purchase (dev only)
     */
    public function testPurchase(array $requestData, string $userId): array
    {
        try {
            $packageCode = $requestData['package_code'] ?? $requestData['package_id'] ?? null;
            if (!$packageCode) {
                return $this->error('VALIDATION_ERROR', 'package_code is required', [], 422);
            }

            // Check if service has test method
            if (method_exists($this->currencyService, 'testPurchase')) {
                $result = $this->currencyService->testPurchase($userId, $packageCode);
                if (!$result['success']) {
                    return $this->error('VALIDATION_ERROR', $result['error'] ?? 'Test failed', [], 422);
                }
                return $this->ok($result, 'Test purchase successful');
            }

            return $this->error('NOT_AVAILABLE', 'Test mode not available', [], 400);
        } catch (\Throwable $e) {
            $this->logError('testPurchase', $e);
            return $this->error('SERVER_ERROR', 'Test purchase failed', [], 500);
        }
    }

    /**
     * GET /currency-return
     * VNPay return URL - redirect to frontend
     */
    public function returnPage(array $params): void
    {
        // Process payment
        $result = $this->currencyService->processPayment($params);

        // Build redirect URL
        $frontendUrl = 'http://localhost:5173/#currency-result';
        $queryParams = http_build_query([
            'vnp_ResponseCode' => $params['vnp_ResponseCode'] ?? '',
            'vnp_TxnRef' => $params['vnp_TxnRef'] ?? '',
            'status' => $result['status'] ?? 'unknown',
            'currency_type' => $result['currency_type'] ?? '',
            'amount' => $result['amount'] ?? 0,
        ]);

        header("Location: {$frontendUrl}?{$queryParams}");
        exit;
    }

    private function ok(array $data, string $message = 'OK'): array
    {
        return [
            'success' => true,
            'status' => 200,
            'message' => $message,
            'data' => $data,
        ];
    }

    private function error(string $code, string $message, array $details, int $status): array
    {
        return [
            'success' => false,
            'status' => $status,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ],
        ];
    }

    private function logError(string $context, \Throwable $e): void
    {
        $log = [
            'time' => date('c'),
            'context' => $context,
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ];
        $path = dirname(__DIR__, 2) . '/storage/currency_errors.log';
        $dir = dirname($path);
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        @file_put_contents($path, json_encode($log, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
        error_log("[CurrencyController][$context] " . $e->getMessage());
    }
}
