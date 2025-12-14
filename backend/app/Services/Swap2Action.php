<?php

namespace App\Services;

/**
 * Swap2Action - Represents an action taken during Swap 2 phase.
 * 
 * Actions are either stone placements or color choices.
 * Used for history tracking and replay.
 * 
 * Requirements: 7.1
 */
class Swap2Action implements \JsonSerializable
{
    public const TYPE_PLACE = 'place';
    public const TYPE_CHOICE = 'choice';

    private string $type;
    private string $playerId;
    private string $timestamp;
    private array $data;

    public function __construct(
        string $type,
        string $playerId,
        string $timestamp,
        array $data
    ) {
        $this->type = $type;
        $this->playerId = $playerId;
        $this->timestamp = $timestamp;
        $this->data = $data;
    }

    public static function createPlacement(string $playerId, int $x, int $y): self
    {
        return new self(
            self::TYPE_PLACE,
            $playerId,
            date('c'),
            ['x' => $x, 'y' => $y]
        );
    }

    public static function createChoice(string $playerId, string $choice): self
    {
        return new self(
            self::TYPE_CHOICE,
            $playerId,
            date('c'),
            ['choice' => $choice]
        );
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getPlayerId(): string
    {
        return $this->playerId;
    }

    public function getTimestamp(): string
    {
        return $this->timestamp;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function jsonSerialize(): array
    {
        return [
            'type' => $this->type,
            'playerId' => $this->playerId,
            'timestamp' => $this->timestamp,
            'data' => $this->data
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['type'],
            $data['playerId'],
            $data['timestamp'],
            $data['data']
        );
    }
}
