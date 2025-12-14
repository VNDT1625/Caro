<?php

namespace App\Services;

/**
 * CurrencyServiceInterface
 * 
 * Interface for coin/gem purchase and management
 */
interface CurrencyServiceInterface
{
    /**
     * Get all active currency packages
     * @param string|null $currencyType 'coin' or 'gem' or null for all
     * @return array
     */
    public function getPackages(?string $currencyType = null): array;

    /**
     * Get a specific package by ID or code
     * @param string $packageIdOrCode
     * @return array|null
     */
    public function getPackage(string $packageIdOrCode): ?array;

    /**
     * Create a currency purchase session (VNPay)
     * @param string $userId
     * @param string $packageIdOrCode
     * @return array ['pay_url', 'txn_ref', 'expires_at']
     */
    public function createPurchase(string $userId, string $packageIdOrCode): array;

    /**
     * Process webhook/callback from payment gateway
     * @param array $params VNPay params
     * @return array ['valid', 'status', 'txn_ref', ...]
     */
    public function processPayment(array $params): array;

    /**
     * Get purchase status
     * @param string $txnRef
     * @return array|null
     */
    public function getPurchaseStatus(string $txnRef): ?array;

    /**
     * Get user's purchase history
     * @param string $userId
     * @param int $limit
     * @return array
     */
    public function getUserPurchases(string $userId, int $limit = 20): array;

    /**
     * Add currency to user (admin/reward)
     * @param string $userId
     * @param string $currencyType 'coin' or 'gem'
     * @param int $amount
     * @param string $reason
     * @return array ['success', 'new_balance']
     */
    public function addCurrency(string $userId, string $currencyType, int $amount, string $reason = 'admin'): array;

    /**
     * Get user's current balance
     * @param string $userId
     * @return array ['coins', 'gems']
     */
    public function getBalance(string $userId): array;
}
