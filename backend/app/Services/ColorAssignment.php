<?php

namespace App\Services;

/**
 * ColorAssignment - Represents the final color assignments after Swap 2 completion.
 * 
 * Requirements: 3.2, 3.3, 3.6
 */
class ColorAssignment implements \JsonSerializable
{
    private string $blackPlayerId;
    private string $whitePlayerId;

    public function __construct(string $blackPlayerId, string $whitePlayerId)
    {
        $this->blackPlayerId = $blackPlayerId;
        $this->whitePlayerId = $whitePlayerId;
    }

    public function getBlackPlayerId(): string
    {
        return $this->blackPlayerId;
    }

    public function getWhitePlayerId(): string
    {
        return $this->whitePlayerId;
    }

    /**
     * Get the first mover (always the black player).
     * 
     * Requirements: 3.6
     */
    public function getFirstMover(): string
    {
        return $this->blackPlayerId;
    }

    public function jsonSerialize(): array
    {
        return [
            'blackPlayerId' => $this->blackPlayerId,
            'whitePlayerId' => $this->whitePlayerId,
            'firstMover' => $this->getFirstMover(),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['blackPlayerId'],
            $data['whitePlayerId']
        );
    }
}
