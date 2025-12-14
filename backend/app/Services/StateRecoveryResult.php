<?php

namespace App\Services;

/**
 * StateRecoveryResult - Result of state validation and recovery attempt.
 * 
 * Contains recovery status, recovered state if applicable, and details.
 * 
 * Requirements: 8.5
 */
class StateRecoveryResult implements \JsonSerializable
{
    private bool $success;
    private string $status;
    private ?Swap2State $state;
    private ?string $message;

    /**
     * @param bool $success Whether validation/recovery succeeded
     * @param string $status Status code: 'valid', 'recovered', 'state_not_found', 'unrecoverable'
     * @param Swap2State|null $state The valid or recovered state
     * @param string|null $message Additional details
     */
    public function __construct(
        bool $success,
        string $status,
        ?Swap2State $state,
        ?string $message = null
    ) {
        $this->success = $success;
        $this->status = $status;
        $this->state = $state;
        $this->message = $message;
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getState(): ?Swap2State
    {
        return $this->state;
    }

    public function getMessage(): ?string
    {
        return $this->message;
    }

    /**
     * Check if state was recovered (had issues but was fixed).
     * 
     * @return bool
     */
    public function wasRecovered(): bool
    {
        return $this->status === 'recovered';
    }

    /**
     * Check if state was valid (no issues found).
     * 
     * @return bool
     */
    public function wasValid(): bool
    {
        return $this->status === 'valid';
    }

    /**
     * Check if state is unrecoverable.
     * 
     * @return bool
     */
    public function isUnrecoverable(): bool
    {
        return $this->status === 'unrecoverable';
    }

    public function jsonSerialize(): array
    {
        $result = [
            'success' => $this->success,
            'status' => $this->status,
        ];
        
        if ($this->message !== null) {
            $result['message'] = $this->message;
        }
        
        if ($this->state !== null) {
            $result['state'] = $this->state->jsonSerialize();
        }
        
        return $result;
    }

    /**
     * Create a result for valid state.
     * 
     * @param Swap2State $state Valid state
     * @return self
     */
    public static function valid(Swap2State $state): self
    {
        return new self(true, 'valid', $state);
    }

    /**
     * Create a result for recovered state.
     * 
     * @param Swap2State $state Recovered state
     * @param string $message Recovery details
     * @return self
     */
    public static function recovered(Swap2State $state, string $message): self
    {
        return new self(true, 'recovered', $state, $message);
    }

    /**
     * Create a result for unrecoverable state.
     * 
     * @param string $message Error details
     * @return self
     */
    public static function unrecoverable(string $message): self
    {
        return new self(false, 'unrecoverable', null, $message);
    }

    /**
     * Create a result for state not found.
     * 
     * @param string $gameId Game ID that was not found
     * @return self
     */
    public static function notFound(string $gameId): self
    {
        return new self(false, 'state_not_found', null, "No state found for game: {$gameId}");
    }
}
