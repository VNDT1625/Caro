<?php

namespace App\Services;

/**
 * ValidationResult - Result of action validation in Swap 2.
 * 
 * Contains validation status, error code, message, and additional context.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */
class ValidationResult implements \JsonSerializable
{
    private bool $isValid;
    private ?string $errorCode;
    private ?string $errorMessage;
    private array $context;

    public function __construct(
        bool $isValid,
        ?string $errorCode = null,
        ?string $errorMessage = null,
        array $context = []
    ) {
        $this->isValid = $isValid;
        $this->errorCode = $errorCode;
        $this->errorMessage = $errorMessage;
        $this->context = $context;
    }

    public function isValid(): bool
    {
        return $this->isValid;
    }

    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function getContext(): array
    {
        return $this->context;
    }

    /**
     * Get a specific context value.
     * 
     * @param string $key Context key
     * @param mixed $default Default value if key not found
     * @return mixed Context value or default
     */
    public function getContextValue(string $key, $default = null)
    {
        return $this->context[$key] ?? $default;
    }

    public function jsonSerialize(): array
    {
        $result = ['isValid' => $this->isValid];
        
        if (!$this->isValid) {
            $result['errorCode'] = $this->errorCode;
            $result['errorMessage'] = $this->errorMessage;
            
            if (!empty($this->context)) {
                $result['context'] = $this->context;
            }
        }
        
        return $result;
    }

    /**
     * Create a successful validation result.
     * 
     * @return self
     */
    public static function success(): self
    {
        return new self(true);
    }

    /**
     * Create a failed validation result.
     * 
     * @param string $errorCode Error code
     * @param string $errorMessage Human-readable error message
     * @param array $context Additional context
     * @return self
     */
    public static function failure(string $errorCode, string $errorMessage, array $context = []): self
    {
        return new self(false, $errorCode, $errorMessage, $context);
    }
}
