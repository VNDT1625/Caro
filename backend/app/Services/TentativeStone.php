<?php

namespace App\Services;

/**
 * TentativeStone - Represents a stone placed during Swap 2 phase.
 * 
 * Requirements: 2.2
 */
class TentativeStone implements \JsonSerializable
{
    private int $x;
    private int $y;
    private string $placedBy;
    private int $placementOrder;
    private string $phase;

    public function __construct(
        int $x,
        int $y,
        string $placedBy,
        int $placementOrder,
        string $phase
    ) {
        $this->x = $x;
        $this->y = $y;
        $this->placedBy = $placedBy;
        $this->placementOrder = $placementOrder;
        $this->phase = $phase;
    }

    public function getX(): int
    {
        return $this->x;
    }

    public function getY(): int
    {
        return $this->y;
    }

    public function getPlacedBy(): string
    {
        return $this->placedBy;
    }

    public function getPlacementOrder(): int
    {
        return $this->placementOrder;
    }

    public function getPhase(): string
    {
        return $this->phase;
    }

    public function jsonSerialize(): array
    {
        return [
            'x' => $this->x,
            'y' => $this->y,
            'placedBy' => $this->placedBy,
            'placementOrder' => $this->placementOrder,
            'phase' => $this->phase,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['x'],
            $data['y'],
            $data['placedBy'],
            $data['placementOrder'],
            $data['phase']
        );
    }
}
