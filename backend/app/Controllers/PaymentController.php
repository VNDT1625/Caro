<?php

namespace App\Controllers;

use App\Services\PaymentServiceInterface;
use App\Services\SubscriptionServiceInterface;
use RuntimeException;

/**
 * PaymentController
 * 
 * Demo payment flow (VNPay style) with in-memory session + subscription update.
 */
class PaymentController
{
    private PaymentServiceInterface $payments;
    private SubscriptionServiceInterface $subscriptions;

    public function __construct(
        PaymentServiceInterface $payments,
        SubscriptionServiceInterface $subscriptions
    ) {
        $this->payments = $payments;
        $this->subscriptions = $subscriptions;
    }

    /**
     * POST /api/payment/create
     * Body: { plan: 'trial'|'pro'|'pro_plus', amount: number }
     */
    public function create(array $requestData, string $userId): array
    {
        try {
            $plan = $requestData['plan'] ?? null;
            $amount = isset($requestData['amount']) ? (int)$requestData['amount'] : 0;
            if (!$plan || !in_array($plan, ['trial', 'pro', 'pro_plus'], true)) {
                return $this->error('VALIDATION_ERROR', 'plan khong hop le', [], 422);
            }
            if ($amount <= 0) {
                return $this->error('VALIDATION_ERROR', 'amount phai > 0', [], 422);
            }

            $session = $this->payments->createPaymentSession($userId, $plan, $amount, [
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            ]);

            return $this->ok($session, 'Tao lien ket thanh toan thanh cong');
        } catch (RuntimeException $e) {
            $this->logError('create_runtime', $e);
            return $this->error('SERVER_ERROR', 'Khong tao duoc giao dich', [], 500);
        } catch (\Throwable $e) {
            $this->logError('create_fatal', $e);
            return $this->error('SERVER_ERROR', 'Payment create gap loi he thong', ['hint' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/payment/webhook (VNPay IPN) or GET return URL.
     */
    public function webhook(array $params): array
    {
        $result = $this->payments->verifyWebhook($params);

        if (!$result['valid']) {
            return $this->error('INVALID', 'Chu ky khong hop le hoac giao dich khong ton tai', [], 400);
        }

        // Update subscription on success
        if ($result['status'] === 'paid' && !empty($result['user_id'])) {
            // Lấy amount từ session để ghi payment
            $session = $this->payments->getSession($result['txn_ref']);
            $amount = $session['amount'] ?? 0;
            $this->applyPlanForUser($result['user_id'], $result['plan'], $amount, $result['txn_ref']);
        }

        return $this->ok([
            'status' => $result['status'],
            'txn_ref' => $result['txn_ref'],
            'plan' => $result['plan'] ?? null,
        ]);
    }

    /**
     * GET /api/payment/status/{txnRef}
     */
    public function status(string $txnRef): array
    {
        $session = $this->payments->getSession($txnRef);
        if ($session === null) {
            return $this->error('NOT_FOUND', 'Khong tim thay giao dich', [], 404);
        }
        return $this->ok([
            'txn_ref' => $txnRef,
            'status' => $session['status'],
            'plan' => $session['plan'],
            'amount' => $session['amount'],
        ]);
    }

    /**
     * POST /api/payment/test
     * Test endpoint to activate subscription without real payment (dev only)
     * Vẫn ghi payment record để admin thấy doanh thu (test mode)
     */
    public function testActivate(array $requestData, string $userId): array
    {
        $plan = $requestData['plan'] ?? null;
        if (!$plan || !in_array($plan, ['trial', 'pro', 'pro_plus'], true)) {
            return $this->error('VALIDATION_ERROR', 'plan khong hop le', [], 422);
        }

        // Giá test theo plan
        $testPrices = [
            'trial' => 50000,
            'pro' => 150000,
            'pro_plus' => 390000,
        ];
        $amount = $testPrices[$plan] ?? 0;
        $txnRef = 'TEST_' . date('ymdHis') . '_' . random_int(1000, 9999);

        try {
            $this->applyPlanForUser($userId, $plan, $amount, $txnRef);
            return $this->ok([
                'plan' => $plan,
                'user_id' => $userId,
                'activated' => true,
                'amount' => $amount,
                'txn_ref' => $txnRef,
            ], 'Test activation thanh cong - payment da duoc ghi nhan');
        } catch (\Exception $e) {
            return $this->error('SERVER_ERROR', 'Khong the kich hoat: ' . $e->getMessage(), [], 500);
        }
    }

    /**
     * GET /payment-return
     * VNPay redirects user here after payment - process and redirect to frontend
     */
    public function returnPage(array $params): void
    {
        // Process webhook first
        $result = $this->payments->verifyWebhook($params);
        
        if ($result['valid'] && $result['status'] === 'paid' && !empty($result['user_id'])) {
            // Lấy amount từ session để ghi payment
            $session = $this->payments->getSession($result['txn_ref']);
            $amount = $session['amount'] ?? 0;
            $this->applyPlanForUser($result['user_id'], $result['plan'], $amount, $result['txn_ref']);
        }

        // Build redirect URL to frontend with params
        $frontendUrl = 'http://localhost:5173/#payment-result';
        $queryParams = http_build_query([
            'vnp_ResponseCode' => $params['vnp_ResponseCode'] ?? '',
            'vnp_TxnRef' => $params['vnp_TxnRef'] ?? '',
            'status' => $result['status'] ?? 'unknown',
        ]);
        
        // Redirect to frontend
        header("Location: {$frontendUrl}?{$queryParams}");
        exit;
    }

    private function applyPlanForUser(string $userId, string $plan, ?int $amount = null, ?string $txnRef = null): void
    {
        // Trial -> bật trial 7 ngày, Pro -> expires +30d, Pro+ -> +90d
        if ($plan === 'trial') {
            $this->subscriptions->activateTrial($userId);
            $trialSub = $this->subscriptions->getSubscription($userId);
            $this->updateSupabaseProfile($userId, 'trial', $trialSub['expires_at'] ?? null, null);
            // Ghi payment record cho trial
            if ($amount && $amount > 0) {
                $this->recordPayment($userId, $plan, $amount, $txnRef);
            }
            return;
        }

        $now = new \DateTimeImmutable();
        $days = $plan === 'pro_plus' ? 90 : 30;
        $expires = $now->modify("+{$days} days");

        $sub = $this->subscriptions->getSubscription($userId) ?? $this->subscriptions->createDefaultSubscription($userId);
        $sub['tier'] = $plan === 'pro_plus' ? SubscriptionServiceInterface::TIER_PRO_PLUS : SubscriptionServiceInterface::TIER_PRO;
        $sub['expires_at'] = $expires->format('c');
        $sub['status'] = 'active';
        $sub['updated_at'] = $now->format('c');
        $this->subscriptions->setSubscription($userId, $sub);

        // Frontend dang doc plan/pro_expires_at -> luu plan=pro de unlock
        $this->updateSupabaseProfile($userId, 'pro', null, $expires->format('c'));
        
        // Ghi payment record để admin thu tiền
        if ($amount && $amount > 0) {
            $this->recordPayment($userId, $plan, $amount, $txnRef);
        }
    }
    
    /**
     * Ghi payment vào bảng payments để admin thu tiền
     * owner_cut_percent mặc định 40% (có thể config trong packages)
     */
    private function recordPayment(string $userId, string $plan, int $amountVnd, ?string $txnRef = null): void
    {
        $supabaseUrl = getenv('SUPABASE_URL') ?: getenv('VITE_SUPABASE_URL');
        $serviceKey = getenv('SUPABASE_SERVICE_KEY') ?: getenv('SUPABASE_SERVICE_ROLE_KEY');
        if (!$supabaseUrl || !$serviceKey) {
            $fromEnvFile = $this->loadEnvValues(['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
            if (!$supabaseUrl) {
                $supabaseUrl = $fromEnvFile['SUPABASE_URL'] ?? $fromEnvFile['VITE_SUPABASE_URL'] ?? null;
            }
            if (!$serviceKey) {
                $serviceKey = $fromEnvFile['SUPABASE_SERVICE_KEY'] ?? $fromEnvFile['SUPABASE_SERVICE_ROLE_KEY'] ?? null;
            }
        }
        if (!$supabaseUrl || !$serviceKey) {
            error_log("[PaymentController][recordPayment] Missing SUPABASE_URL or service key, skip");
            return;
        }

        // Tính owner_cut: mặc định 40% cho admin
        $ownerCutPercent = 40;
        $ownerCutVnd = (int) round($amountVnd * $ownerCutPercent / 100);
        
        // Tính credits dựa trên plan
        $creditsAwarded = match($plan) {
            'trial' => 50,
            'pro' => 200,
            'pro_plus' => 600,
            default => 0
        };

        $payload = [
            'user_id' => $userId,
            'amount_vnd' => $amountVnd,
            'credits_awarded' => $creditsAwarded,
            'owner_cut_vnd' => $ownerCutVnd,
            'provider' => 'vnpay',
            'provider_txid' => $txnRef,
            'status' => 'paid',
            'raw_payload' => json_encode([
                'plan' => $plan,
                'owner_cut_percent' => $ownerCutPercent,
                'recorded_at' => date('c'),
            ]),
        ];

        $url = rtrim($supabaseUrl, '/') . '/rest/v1/payments';
        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $serviceKey,
            'Authorization: Bearer ' . $serviceKey,
            'Prefer: return=representation',
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err || $code >= 300) {
            $log = [
                'time' => date('c'),
                'user_id' => $userId,
                'plan' => $plan,
                'amount' => $amountVnd,
                'owner_cut' => $ownerCutVnd,
                'code' => $code,
                'error' => $err,
                'resp' => $resp,
            ];
            $path = dirname(__DIR__, 2) . '/storage/payment_errors.log';
            if (!is_dir(dirname($path))) @mkdir(dirname($path), 0777, true);
            @file_put_contents($path, json_encode($log, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
            error_log("[PaymentController][recordPayment] Insert failed HTTP {$code}: " . ($err ?: substr((string)$resp, 0, 200)));
        } else {
            error_log("[PaymentController][recordPayment] OK - user={$userId}, amount={$amountVnd}, owner_cut={$ownerCutVnd}");
        }
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
            'trace' => $e->getTraceAsString(),
        ];
        $path = dirname(__DIR__, 2) . '/storage/payment_errors.log';
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        @file_put_contents($path, json_encode($log, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
        error_log("[PaymentController][$context] " . $e->getMessage());
    }

    private function updateSupabaseProfile(string $userId, string $plan, ?string $trialExpiresAt, ?string $proExpiresAt): void
    {
        $supabaseUrl = getenv('SUPABASE_URL') ?: getenv('VITE_SUPABASE_URL');
        $serviceKey = getenv('SUPABASE_SERVICE_KEY') ?: getenv('SUPABASE_SERVICE_ROLE_KEY');
        if (!$supabaseUrl || !$serviceKey) {
            $fromEnvFile = $this->loadEnvValues(['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
            if (!$supabaseUrl) {
                $supabaseUrl = $fromEnvFile['SUPABASE_URL'] ?? $fromEnvFile['VITE_SUPABASE_URL'] ?? null;
            }
            if (!$serviceKey) {
                $serviceKey = $fromEnvFile['SUPABASE_SERVICE_KEY'] ?? $fromEnvFile['SUPABASE_SERVICE_ROLE_KEY'] ?? null;
            }
        }
        if (!$supabaseUrl || !$serviceKey) {
            error_log("[PaymentController][supabase] Missing SUPABASE_URL or service key, skip update");
            return;
        }

        $payload = [
            'plan' => $plan,
            'trial_expires_at' => $trialExpiresAt,
            'pro_expires_at' => $proExpiresAt,
        ];

        $url = rtrim($supabaseUrl, '/') . '/rest/v1/profiles?user_id=eq.' . urlencode($userId);
        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $serviceKey,
            'Authorization: Bearer ' . $serviceKey,
            'Prefer: return=representation',
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        // Force skip SSL on Windows local dev to avoid certificate issues
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err || $code >= 300) {
            $log = [
                'time' => date('c'),
                'user_id' => $userId,
                'plan' => $plan,
                'code' => $code,
                'error' => $err,
                'resp' => $resp,
            ];
            $path = dirname(__DIR__, 2) . '/storage/payment_errors.log';
            if (!is_dir(dirname($path))) @mkdir(dirname($path), 0777, true);
            @file_put_contents($path, json_encode($log, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
            error_log("[PaymentController][supabase] Update failed HTTP {$code}: " . ($err ?: substr((string)$resp, 0, 200)));
        }
    }

    private function loadEnvValues(array $keys): array
    {
        $envFile = dirname(__DIR__, 2) . '/.env';
        $values = [];
        if (!file_exists($envFile)) {
            return $values;
        }
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, '=') === false || strpos(trim($line), '#') === 0) continue;
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            if (!in_array($k, $keys, true)) continue;
            $values[$k] = trim($v, " \t\n\r\0\x0B\"'");
        }
        return $values;
    }
}
