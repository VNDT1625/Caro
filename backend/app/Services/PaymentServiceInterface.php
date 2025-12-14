<?php

namespace App\Services;

/**
 * PaymentServiceInterface
 * 
 * Handles payment session creation and webhook verification.
 * Designed to work with VNPay-style redirect + IPN.
 */
interface PaymentServiceInterface
{
    /**
     * Create a payment session and return redirect URL.
     * 
     * @param string $userId UUID of user
     * @param string $plan   Plan code (free|trial|pro|pro_plus)
     * @param int    $amount Amount in smallest currency unit (e.g., VND)
     * @param array  $meta   Extra metadata
     * @return array {pay_url, txn_ref, expired_at}
     */
    public function createPaymentSession(string $userId, string $plan, int $amount, array $meta = []): array;

    /**
     * Verify webhook/return data and mark session status.
     * 
     * @param array $params Raw query/body data
     * @return array {valid: bool, status: string, txn_ref: string|null, plan?: string, user_id?: string}
     */
    public function verifyWebhook(array $params): array;

    /**
     * Get stored session info (testing/monitoring).
     */
    public function getSession(string $txnRef): ?array;
}
