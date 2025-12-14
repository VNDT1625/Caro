<?php

namespace App\Services;

use RuntimeException;

/**
 * CurrencyService
 * 
 * Handles coin/gem purchases via VNPay
 */
class CurrencyService implements CurrencyServiceInterface
{
    private ?\PDO $db;
    private PaymentServiceInterface $paymentService;
    private string $storageFile;

    // VNPay config
    private string $tmnCode;
    private string $hashSecret;
    private string $returnUrl;
    private string $gatewayUrl;

    public function __construct(?\PDO $db = null, ?PaymentServiceInterface $paymentService = null)
    {
        $this->db = $db;
        $this->paymentService = $paymentService ?? new PaymentService($db);
        $this->storageFile = dirname(__DIR__, 2) . '/storage/currency_purchases.json';

        $envConfig = self::loadEnvConfig();
        $this->tmnCode = $envConfig['VNPAY_TMN_CODE'] ?? 'DEMO';
        $this->hashSecret = $envConfig['VNPAY_HASH_SECRET'] ?? 'DEMO_SECRET';
        $this->returnUrl = $envConfig['VNPAY_RETURN_URL'] ?? 'http://localhost:5173/#currency-result';
        $this->gatewayUrl = $envConfig['VNPAY_GATEWAY_URL'] ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    }

    private static function loadEnvConfig(): array
    {
        $config = [];
        $envFile = __DIR__ . '/../../.env';
        if (!file_exists($envFile)) return $config;

        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) continue;
            if (strpos($line, '=') === false) continue;
            $pos = strpos($line, '=');
            $key = trim(substr($line, 0, $pos));
            $value = trim(substr($line, $pos + 1), " \t\n\r\0\x0B\"'");
            if (strpos($key, 'VNPAY_') === 0 || strpos($key, 'SUPABASE_') === 0 || strpos($key, 'VITE_SUPABASE_') === 0) {
                $config[$key] = $value;
            }
        }
        return $config;
    }

    /**
     * Get currency-specific return URL
     * VNPay will redirect to backend /currency-return, which then redirects to frontend
     */
    private function getCurrencyReturnUrl(): string
    {
        // If VNPAY_RETURN_URL contains ngrok or external URL, replace path with /currency-return
        if (strpos($this->returnUrl, 'ngrok') !== false || strpos($this->returnUrl, 'http') === 0) {
            // Extract base URL and replace path
            $parsed = parse_url($this->returnUrl);
            if ($parsed && isset($parsed['scheme']) && isset($parsed['host'])) {
                $base = $parsed['scheme'] . '://' . $parsed['host'];
                if (isset($parsed['port'])) $base .= ':' . $parsed['port'];
                return $base . '/currency-return';
            }
        }
        // Fallback: use localhost backend
        return 'http://localhost:8001/currency-return';
    }

    public function getPackages(?string $currencyType = null): array
    {
        // Try database first
        if ($this->db) {
            try {
                $sql = 'SELECT * FROM currency_packages WHERE is_active = true';
                if ($currencyType) {
                    $sql .= ' AND currency_type = ?';
                }
                $sql .= ' ORDER BY sort_order ASC';

                $stmt = $this->db->prepare($sql);
                $stmt->execute($currencyType ? [$currencyType] : []);
                return $stmt->fetchAll(\PDO::FETCH_ASSOC);
            } catch (\Exception $e) {
                error_log("[CurrencyService] DB error: " . $e->getMessage());
            }
        }

        // Fallback to Supabase REST
        return $this->getPackagesFromSupabase($currencyType);
    }

    private function getPackagesFromSupabase(?string $currencyType): array
    {
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? $config['VITE_SUPABASE_ANON_KEY'] ?? null;

        if (!$url || !$key) {
            return $this->getDefaultPackages($currencyType);
        }

        $endpoint = rtrim($url, '/') . '/rest/v1/currency_packages?is_active=eq.true&order=sort_order.asc';
        if ($currencyType) {
            $endpoint .= '&currency_type=eq.' . urlencode($currencyType);
        }

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code === 200 && $resp) {
            $data = json_decode($resp, true);
            if (is_array($data) && count($data) > 0) {
                return $data;
            }
        }

        return $this->getDefaultPackages($currencyType);
    }

    private function getDefaultPackages(?string $currencyType): array
    {
        $packages = [
            ['id' => 'coin_100', 'package_code' => 'coin_100', 'name_vi' => '100 Tinh Thạch', 'name_en' => '100 Spirit Stones', 'currency_type' => 'coin', 'amount' => 100, 'bonus_amount' => 0, 'price_vnd' => 10000, 'discount_percent' => 0, 'is_featured' => false],
            ['id' => 'coin_500', 'package_code' => 'coin_500', 'name_vi' => '500 Tinh Thạch', 'name_en' => '500 Spirit Stones', 'currency_type' => 'coin', 'amount' => 500, 'bonus_amount' => 50, 'price_vnd' => 45000, 'discount_percent' => 10, 'is_featured' => false],
            ['id' => 'coin_1000', 'package_code' => 'coin_1000', 'name_vi' => '1000 Tinh Thạch', 'name_en' => '1000 Spirit Stones', 'currency_type' => 'coin', 'amount' => 1000, 'bonus_amount' => 150, 'price_vnd' => 80000, 'discount_percent' => 20, 'is_featured' => true],
            ['id' => 'coin_2500', 'package_code' => 'coin_2500', 'name_vi' => '2500 Tinh Thạch', 'name_en' => '2500 Spirit Stones', 'currency_type' => 'coin', 'amount' => 2500, 'bonus_amount' => 500, 'price_vnd' => 180000, 'discount_percent' => 25, 'is_featured' => false],
            ['id' => 'gem_10', 'package_code' => 'gem_10', 'name_vi' => '10 Nguyên Thần', 'name_en' => '10 Primordial Spirits', 'currency_type' => 'gem', 'amount' => 10, 'bonus_amount' => 0, 'price_vnd' => 20000, 'discount_percent' => 0, 'is_featured' => false],
            ['id' => 'gem_50', 'package_code' => 'gem_50', 'name_vi' => '50 Nguyên Thần', 'name_en' => '50 Primordial Spirits', 'currency_type' => 'gem', 'amount' => 50, 'bonus_amount' => 5, 'price_vnd' => 90000, 'discount_percent' => 10, 'is_featured' => false],
            ['id' => 'gem_100', 'package_code' => 'gem_100', 'name_vi' => '100 Nguyên Thần', 'name_en' => '100 Primordial Spirits', 'currency_type' => 'gem', 'amount' => 100, 'bonus_amount' => 15, 'price_vnd' => 160000, 'discount_percent' => 20, 'is_featured' => true],
        ];

        if ($currencyType) {
            return array_values(array_filter($packages, fn($p) => $p['currency_type'] === $currencyType));
        }
        return $packages;
    }

    public function getPackage(string $packageIdOrCode): ?array
    {
        $packages = $this->getPackages();
        foreach ($packages as $pkg) {
            if (($pkg['id'] ?? '') === $packageIdOrCode || ($pkg['package_code'] ?? '') === $packageIdOrCode) {
                return $pkg;
            }
        }
        return null;
    }

    public function createPurchase(string $userId, string $packageIdOrCode): array
    {
        $package = $this->getPackage($packageIdOrCode);
        if (!$package) {
            throw new RuntimeException('Package not found');
        }

        $txnRef = $this->generateTxnRef();
        $amount = (int)($package['price_vnd'] ?? 0);

        if ($amount <= 0) {
            throw new RuntimeException('Invalid package price');
        }

        // Build VNPay URL
        $vnpayTz = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $nowDt = new \DateTime('now', $vnpayTz);
        $expireDt = (clone $nowDt)->modify('+30 minutes');

        $params = [
            'vnp_Version' => '2.1.0',
            'vnp_Command' => 'pay',
            'vnp_TmnCode' => $this->tmnCode,
            'vnp_Amount' => $amount * 100,
            'vnp_CurrCode' => 'VND',
            'vnp_TxnRef' => $txnRef,
            'vnp_OrderInfo' => "Nap {$package['currency_type']} - {$package['name_vi']} cho user {$userId}",
            'vnp_OrderType' => 'other',
            'vnp_Locale' => 'vn',
            'vnp_ReturnUrl' => $this->getCurrencyReturnUrl(),
            'vnp_IpAddr' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'vnp_CreateDate' => $nowDt->format('YmdHis'),
            'vnp_ExpireDate' => $expireDt->format('YmdHis'),
        ];

        ksort($params);
        $query = http_build_query($params);
        $hashData = $this->buildHashData($params);
        $secureHash = hash_hmac('sha512', $hashData, $this->hashSecret);
        $payUrl = $this->gatewayUrl . '?' . $query . '&vnp_SecureHash=' . $secureHash;

        // Save purchase record
        $this->savePurchase($txnRef, $userId, $package, $expireDt->getTimestamp());

        return [
            'pay_url' => $payUrl,
            'txn_ref' => $txnRef,
            'expires_at' => $expireDt->getTimestamp(),
            'package' => $package,
        ];
    }

    private function savePurchase(string $txnRef, string $userId, array $package, int $expiresAt): void
    {
        $data = [
            'txn_ref' => $txnRef,
            'user_id' => $userId,
            'package_id' => $package['id'] ?? $package['package_code'],
            'package_code' => $package['package_code'] ?? '',
            'currency_type' => $package['currency_type'],
            'amount' => $package['amount'],
            'bonus_amount' => $package['bonus_amount'] ?? 0,
            'total_amount' => ($package['amount'] ?? 0) + ($package['bonus_amount'] ?? 0),
            'price_vnd' => $package['price_vnd'],
            'status' => 'pending',
            'created_at' => date('c'),
            'expires_at' => date('c', $expiresAt),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ];

        // Try Supabase
        $saved = $this->savePurchaseToSupabase($data);
        if (!$saved) {
            $this->savePurchaseToFile($data);
        }
    }

    private function savePurchaseToSupabase(array $data): bool
    {
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? null;

        if (!$url || !$key) return false;

        $endpoint = rtrim($url, '/') . '/rest/v1/currency_purchases';
        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
            'Prefer: return=minimal',
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $code >= 200 && $code < 300;
    }

    private function savePurchaseToFile(array $data): void
    {
        $purchases = $this->readFilePurchases();
        $purchases[$data['txn_ref']] = $data;
        $this->writeFilePurchases($purchases);
    }

    public function processPayment(array $params): array
    {
        $txnRef = $params['vnp_TxnRef'] ?? null;
        $responseCode = $params['vnp_ResponseCode'] ?? null;
        $secureHash = $params['vnp_SecureHash'] ?? null;

        if (!$txnRef || !$responseCode) {
            return ['valid' => false, 'status' => 'invalid', 'txn_ref' => $txnRef];
        }

        if (!$this->checkHash($params, $secureHash)) {
            return ['valid' => false, 'status' => 'invalid_signature', 'txn_ref' => $txnRef];
        }

        $purchase = $this->getPurchaseByTxn($txnRef);
        if (!$purchase) {
            return ['valid' => false, 'status' => 'unknown_txn', 'txn_ref' => $txnRef];
        }

        $newStatus = $responseCode === '00' ? 'paid' : 'failed';

        // Update purchase status
        $this->updatePurchaseStatus($txnRef, $newStatus, $params);

        // If paid, add currency to user
        if ($newStatus === 'paid') {
            $this->creditCurrencyToUser(
                $purchase['user_id'],
                $purchase['currency_type'],
                (int)$purchase['total_amount']
            );
        }

        return [
            'valid' => true,
            'status' => $newStatus,
            'txn_ref' => $txnRef,
            'user_id' => $purchase['user_id'],
            'currency_type' => $purchase['currency_type'],
            'amount' => $purchase['total_amount'],
        ];
    }

    private function getPurchaseByTxn(string $txnRef): ?array
    {
        // Try Supabase
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? null;

        if ($url && $key) {
            $endpoint = rtrim($url, '/') . '/rest/v1/currency_purchases?txn_ref=eq.' . urlencode($txnRef) . '&limit=1';
            $ch = curl_init($endpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'apikey: ' . $key,
                'Authorization: Bearer ' . $key,
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && $resp) {
                $data = json_decode($resp, true);
                if (is_array($data) && count($data) > 0) {
                    return $data[0];
                }
            }
        }

        // Fallback to file
        $purchases = $this->readFilePurchases();
        return $purchases[$txnRef] ?? null;
    }

    private function updatePurchaseStatus(string $txnRef, string $status, array $vnpData): void
    {
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? null;

        if ($url && $key) {
            $endpoint = rtrim($url, '/') . '/rest/v1/currency_purchases?txn_ref=eq.' . urlencode($txnRef);
            $payload = [
                'status' => $status,
                'vnp_data' => $vnpData,
                'paid_at' => $status === 'paid' ? date('c') : null,
            ];

            $ch = curl_init($endpoint);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'apikey: ' . $key,
                'Authorization: Bearer ' . $key,
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_exec($ch);
            curl_close($ch);
        }

        // Also update file
        $purchases = $this->readFilePurchases();
        if (isset($purchases[$txnRef])) {
            $purchases[$txnRef]['status'] = $status;
            $purchases[$txnRef]['vnp_data'] = $vnpData;
            $purchases[$txnRef]['paid_at'] = $status === 'paid' ? date('c') : null;
            $this->writeFilePurchases($purchases);
        }
    }

    private function creditCurrencyToUser(string $userId, string $currencyType, int $amount): void
    {
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? null;
        // Force skip SSL on Windows local dev to avoid certificate issues
        $skipVerify = true;

        if (!$url || !$key) {
            error_log("[CurrencyService] Cannot credit currency - no Supabase config. URL=" . ($url ? 'set' : 'missing') . ", KEY=" . ($key ? 'set' : 'missing'));
            return;
        }

        error_log("[CurrencyService] Crediting {$amount} {$currencyType} to user {$userId}");

        // Get current balance
        $endpoint = rtrim($url, '/') . '/rest/v1/profiles?user_id=eq.' . urlencode($userId) . '&select=coins,gems';
        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        // Force skip SSL on Windows local dev
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $resp = curl_exec($ch);
        $getCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $getErr = curl_error($ch);
        curl_close($ch);

        error_log("[CurrencyService] GET profile HTTP {$getCode}, err={$getErr}, resp=" . substr($resp ?: '', 0, 200));

        $data = json_decode($resp, true);
        $profile = (is_array($data) && count($data) > 0) ? $data[0] : ['coins' => 0, 'gems' => 0];
        $currentCoins = (int)($profile['coins'] ?? 0);
        $currentGems = (int)($profile['gems'] ?? 0);

        // Update balance
        $newCoins = $currencyType === 'coin' ? $currentCoins + $amount : $currentCoins;
        $newGems = $currencyType === 'gem' ? $currentGems + $amount : $currentGems;

        error_log("[CurrencyService] Updating: coins {$currentCoins} -> {$newCoins}, gems {$currentGems} -> {$newGems}");

        $updateEndpoint = rtrim($url, '/') . '/rest/v1/profiles?user_id=eq.' . urlencode($userId);
        $ch = curl_init($updateEndpoint);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
            'Prefer: return=representation',
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'coins' => $newCoins,
            'gems' => $newGems,
        ]));
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        // Force skip SSL on Windows local dev
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $updateResp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $updateErr = curl_error($ch);
        curl_close($ch);

        error_log("[CurrencyService] PATCH profile HTTP {$code}, err={$updateErr}, resp=" . substr($updateResp ?: '', 0, 200));
    }

    public function getPurchaseStatus(string $txnRef): ?array
    {
        return $this->getPurchaseByTxn($txnRef);
    }

    public function getUserPurchases(string $userId, int $limit = 20): array
    {
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? null;

        if ($url && $key) {
            $endpoint = rtrim($url, '/') . '/rest/v1/currency_purchases?user_id=eq.' . urlencode($userId) . '&order=created_at.desc&limit=' . $limit;
            $ch = curl_init($endpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'apikey: ' . $key,
                'Authorization: Bearer ' . $key,
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && $resp) {
                return json_decode($resp, true) ?? [];
            }
        }

        // Fallback to file
        $purchases = $this->readFilePurchases();
        $userPurchases = array_filter($purchases, fn($p) => ($p['user_id'] ?? '') === $userId);
        usort($userPurchases, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
        return array_slice($userPurchases, 0, $limit);
    }

    public function addCurrency(string $userId, string $currencyType, int $amount, string $reason = 'admin'): array
    {
        if (!in_array($currencyType, ['coin', 'gem'], true)) {
            return ['success' => false, 'error' => 'Invalid currency type'];
        }

        $this->creditCurrencyToUser($userId, $currencyType, $amount);
        $balance = $this->getBalance($userId);

        return [
            'success' => true,
            'new_balance' => $balance,
            'added' => $amount,
            'currency_type' => $currencyType,
        ];
    }

    public function getBalance(string $userId): array
    {
        $config = self::loadEnvConfig();
        $url = $config['SUPABASE_URL'] ?? $config['VITE_SUPABASE_URL'] ?? null;
        $key = $config['SUPABASE_SERVICE_KEY'] ?? $config['SUPABASE_SERVICE_ROLE_KEY'] ?? null;

        if ($url && $key) {
            $endpoint = rtrim($url, '/') . '/rest/v1/profiles?user_id=eq.' . urlencode($userId) . '&select=coins,gems';
            $ch = curl_init($endpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'apikey: ' . $key,
                'Authorization: Bearer ' . $key,
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            $resp = curl_exec($ch);
            curl_close($ch);

            $data = json_decode($resp, true);
            if (is_array($data) && count($data) > 0) {
                return [
                    'coins' => (int)($data[0]['coins'] ?? 0),
                    'gems' => (int)($data[0]['gems'] ?? 0),
                ];
            }
        }

        return ['coins' => 0, 'gems' => 0];
    }

    // Test method - simulate successful payment
    public function testPurchase(string $userId, string $packageIdOrCode): array
    {
        $package = $this->getPackage($packageIdOrCode);
        if (!$package) {
            return ['success' => false, 'error' => 'Package not found'];
        }

        $totalAmount = ($package['amount'] ?? 0) + ($package['bonus_amount'] ?? 0);
        $this->creditCurrencyToUser($userId, $package['currency_type'], $totalAmount);

        return [
            'success' => true,
            'package' => $package,
            'credited' => $totalAmount,
            'currency_type' => $package['currency_type'],
        ];
    }

    private function readFilePurchases(): array
    {
        if (!file_exists($this->storageFile)) return [];
        $content = file_get_contents($this->storageFile);
        return json_decode($content, true) ?? [];
    }

    private function writeFilePurchases(array $purchases): void
    {
        $dir = dirname($this->storageFile);
        if (!is_dir($dir)) mkdir($dir, 0777, true);
        file_put_contents($this->storageFile, json_encode($purchases, JSON_PRETTY_PRINT), LOCK_EX);
    }

    private function generateTxnRef(): string
    {
        return 'CUR' . date('ymdHis') . sprintf('%06d', random_int(100000, 999999));
    }

    private function buildHashData(array $params): string
    {
        $parts = [];
        foreach ($params as $key => $value) {
            $parts[] = urlencode($key) . '=' . urlencode((string)$value);
        }
        return implode('&', $parts);
    }

    private function checkHash(array $params, ?string $providedHash): bool
    {
        if (!$providedHash) return false;
        $data = $params;
        unset($data['vnp_SecureHash'], $data['vnp_SecureHashType']);
        ksort($data);
        $hashData = $this->buildHashData($data);
        $calculated = hash_hmac('sha512', $hashData, $this->hashSecret);
        return hash_equals($calculated, $providedHash);
    }
}
