<?php

namespace App\Services;

use RuntimeException;

/**
 * PaymentService
 * 
 * VNPay payment session builder with HMAC verify.
 * Luu session trong DB hoac file de khong mat du lieu khi backend restart.
 */
class PaymentService implements PaymentServiceInterface
{
    private string $tmnCode;
    private string $hashSecret;
    private string $returnUrl;
    private string $ipnUrl;
    private string $gatewayUrl;
    private ?\PDO $db;
    private string $storageFile;

    public function __construct(
        ?string $tmnCode = null,
        ?string $hashSecret = null,
        ?string $returnUrl = null,
        ?string $ipnUrl = null,
        ?string $gatewayUrl = null,
        ?\PDO $db = null,
        ?string $storageFile = null
    ) {
        // Load tu .env neu getenv() khong chay duoi PHP built-in server
        $envConfig = self::loadEnvConfig();
        
        $this->tmnCode = $tmnCode ?? $envConfig['VNPAY_TMN_CODE'] ?? 'DEMO';
        $this->hashSecret = $hashSecret ?? $envConfig['VNPAY_HASH_SECRET'] ?? 'DEMO_SECRET';
        $this->returnUrl = $returnUrl ?? $envConfig['VNPAY_RETURN_URL'] ?? 'http://localhost:5173/#subscription';
        $this->ipnUrl = $ipnUrl ?? $envConfig['VNPAY_IPN_URL'] ?? 'http://localhost:8001/api/payment/webhook';
        $this->gatewayUrl = $gatewayUrl ?? $envConfig['VNPAY_GATEWAY_URL'] ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
        $this->db = $db;
        $this->storageFile = $storageFile ?? dirname(__DIR__, 2) . '/storage/payment_sessions.json';
        
        // Debug log
        error_log("[PaymentService] TMN_CODE: {$this->tmnCode}, ReturnURL: {$this->returnUrl}");
    }
    
    /**
     * Load config tu .env file
     */
    private static function loadEnvConfig(): array
    {
        $config = [];
        $envFile = __DIR__ . '/../../.env';
        
        if (!file_exists($envFile)) {
            error_log("[PaymentService] .env file not found at: $envFile");
            return $config;
        }
        
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, '=') === false || strpos(trim($line), '#') === 0) continue;
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (strpos($key, 'VNPAY_') === 0) {
                $config[$key] = $value;
            }
        }
        
        return $config;
    }

    /**
     * {@inheritdoc}
     */
    public function createPaymentSession(string $userId, string $plan, int $amount, array $meta = []): array
    {
        if (!in_array($plan, ['trial', 'pro', 'pro_plus'], true)) {
            throw new RuntimeException('Plan khong hop le');
        }

        $txnRef = $this->generateTxnRef();
        
        // VNPay yeu cau timezone GMT+7 (Asia/Ho_Chi_Minh)
        $vnpayTz = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $nowDt = new \DateTime('now', $vnpayTz);
        $expireDt = (clone $nowDt)->modify('+30 minutes'); // Tang len 30 phut de tranh timeout
        
        $expire = $expireDt->getTimestamp();

        $params = [
            'vnp_Version' => '2.1.0',
            'vnp_Command' => 'pay',
            'vnp_TmnCode' => $this->tmnCode,
            'vnp_Amount' => $amount * 100, // vnpay yeu cau nhan 100
            'vnp_CurrCode' => 'VND',
            'vnp_TxnRef' => $txnRef,
            'vnp_OrderInfo' => "Thanh toan plan {$plan} cho user {$userId}",
            'vnp_OrderType' => 'other',
            'vnp_Locale' => 'vn',
            'vnp_ReturnUrl' => $this->returnUrl,
            'vnp_IpAddr' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'vnp_CreateDate' => $nowDt->format('YmdHis'),
            'vnp_ExpireDate' => $expireDt->format('YmdHis'),
        ];

        ksort($params);
        $query = http_build_query($params);
        $hashData = $this->buildHashData($params);
        $secureHash = hash_hmac('sha512', $hashData, $this->hashSecret);
        $payUrl = $this->gatewayUrl . '?' . $query . '&vnp_SecureHash=' . $secureHash;

        // Luu vao database hoac file fallback
        $saved = $this->saveSessionToDb($txnRef, $userId, $plan, $amount, $expire, $meta);
        if (!$saved) {
            $this->saveSessionToFile($txnRef, $userId, $plan, $amount, $expire, $meta);
        }

        return [
            'pay_url' => $payUrl,
            'txn_ref' => $txnRef,
            'expires_at' => $expire,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function verifyWebhook(array $params): array
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

        $session = $this->getSession($txnRef);
        if ($session === null) {
            return ['valid' => false, 'status' => 'unknown_txn', 'txn_ref' => $txnRef];
        }

        // responseCode 00 = success
        $newStatus = $responseCode === '00' ? 'paid' : 'failed';
        
        // Update session status trong database hoac file
        if (($session['source'] ?? 'db') === 'db') {
            $this->updateSessionStatusDb($txnRef, $newStatus, $params);
        } else {
            $this->updateSessionStatusFile($txnRef, $newStatus, $params);
        }

        return [
            'valid' => true,
            'status' => $newStatus,
            'txn_ref' => $txnRef,
            'plan' => $session['plan'],
            'user_id' => $session['user_id'],
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function getSession(string $txnRef): ?array
    {
        $session = $this->getSessionFromDb($txnRef);
        if ($session !== null) {
            $session['source'] = 'db';
            return $session;
        }

        $session = $this->getSessionFromFile($txnRef);
        if ($session !== null) {
            $session['source'] = 'file';
        }

        return $session;
    }

    private function saveSessionToDb(string $txnRef, string $userId, string $plan, int $amount, int $expiresAt, array $meta): bool
    {
        if (!$this->db) {
            return false; // Skip if no DB connection
        }

        try {
            $stmt = $this->db->prepare('
                INSERT INTO payment_sessions (txn_ref, user_id, plan, amount, status, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ');
            
            $stmt->execute([
                $txnRef,
                $userId,
                $plan,
                $amount,
                'pending',
                date('c', $expiresAt),
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                $_SERVER['HTTP_USER_AGENT'] ?? '',
            ]);
            return true;
        } catch (\Exception $e) {
            error_log("Failed to save payment session: " . $e->getMessage());
            return false;
        }
    }

    private function saveSessionToFile(string $txnRef, string $userId, string $plan, int $amount, int $expiresAt, array $meta): void
    {
        $sessions = $this->readFileSessions();
        $sessions[$txnRef] = [
            'txn_ref' => $txnRef,
            'user_id' => $userId,
            'plan' => $plan,
            'amount' => $amount,
            'status' => 'pending',
            'created_at' => date('c'),
            'expires_at' => date('c', $expiresAt),
            'meta' => $meta,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        ];

        $this->writeFileSessions($sessions);
    }

    private function getSessionFromDb(string $txnRef): ?array
    {
        if (!$this->db) {
            return null;
        }

        try {
            $stmt = $this->db->prepare('
                SELECT id, txn_ref, user_id, plan, amount, status, vnp_data, created_at, expires_at
                FROM payment_sessions
                WHERE txn_ref = ?
                LIMIT 1
            ');
            
            $stmt->execute([$txnRef]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$row) {
                return null;
            }

            return [
                'id' => $row['id'],
                'txn_ref' => $row['txn_ref'],
                'user_id' => $row['user_id'],
                'plan' => $row['plan'],
                'amount' => $row['amount'],
                'status' => $row['status'],
                'vnp_data' => $row['vnp_data'] ? json_decode($row['vnp_data'], true) : null,
                'created_at' => $row['created_at'],
                'expires_at' => $row['expires_at'],
            ];
        } catch (\Exception $e) {
            error_log("Failed to get payment session: " . $e->getMessage());
            return null;
        }
    }

    private function getSessionFromFile(string $txnRef): ?array
    {
        $sessions = $this->readFileSessions();
        return $sessions[$txnRef] ?? null;
    }

    private function updateSessionStatusDb(string $txnRef, string $status, array $vnpData): void
    {
        if (!$this->db) {
            return;
        }

        try {
            $stmt = $this->db->prepare('
                UPDATE payment_sessions
                SET status = ?, vnp_data = ?, updated_at = NOW()
                WHERE txn_ref = ?
            ');
            
            $stmt->execute([
                $status,
                json_encode($vnpData),
                $txnRef,
            ]);
        } catch (\Exception $e) {
            error_log("Failed to update payment session: " . $e->getMessage());
        }
    }

    private function updateSessionStatusFile(string $txnRef, string $status, array $vnpData): void
    {
        $sessions = $this->readFileSessions();
        if (!isset($sessions[$txnRef])) {
            return;
        }

        $sessions[$txnRef]['status'] = $status;
        $sessions[$txnRef]['vnp_data'] = $vnpData;
        $sessions[$txnRef]['updated_at'] = date('c');

        $this->writeFileSessions($sessions);
    }

    private function readFileSessions(): array
    {
        $file = $this->storageFile;
        if (!file_exists($file)) {
            return [];
        }

        $content = file_get_contents($file);
        $data = json_decode($content, true);
        return is_array($data) ? $data : [];
    }

    private function writeFileSessions(array $sessions): void
    {
        $dir = dirname($this->storageFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        file_put_contents(
            $this->storageFile,
            json_encode($sessions, JSON_PRETTY_PRINT),
            LOCK_EX
        );
    }

    private function checkHash(array $params, ?string $providedHash): bool
    {
        if (!$providedHash) {
            return false;
        }

        $data = $params;
        unset($data['vnp_SecureHash'], $data['vnp_SecureHashType']);
        ksort($data);
        $hashData = $this->buildHashData($data);
        $calculated = hash_hmac('sha512', $hashData, $this->hashSecret);
        return hash_equals($calculated, $providedHash);
    }

    private function generateTxnRef(): string
    {
        return sprintf('%s%06d', date('ymdHis'), random_int(100000, 999999));
    }

    private function buildHashData(array $params): string
    {
        $hashParts = [];
        foreach ($params as $key => $value) {
            $hashParts[] = urlencode($key) . '=' . urlencode((string)$value);
        }
        return implode('&', $hashParts);
    }
}
