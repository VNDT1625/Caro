<?php

namespace App\Services;

/**
 * Swap2State - Represents the current state of Swap 2 opening phase.
 * 
 * Requirements: 2.2, 7.1
 */
class Swap2State implements \JsonSerializable
{
    public const PHASE_PLACEMENT = 'swap2_placement';
    public const PHASE_CHOICE = 'swap2_choice';
    public const PHASE_EXTRA = 'swap2_extra';
    public const PHASE_FINAL_CHOICE = 'swap2_final_choice';
    public const PHASE_COMPLETE = 'complete';

    private string $phase;
    private string $player1Id;
    private string $player2Id;
    private string $activePlayerId;
    /** @var TentativeStone[] */
    private array $tentativeStones;
    private ?array $finalChoice;
    private ?string $blackPlayerId;
    private ?string $whitePlayerId;
    /** @var Swap2Action[] */
    private array $actions;

    public function __construct(
        string $phase,
        string $player1Id,
        string $player2Id,
        string $activePlayerId,
        array $tentativeStones = [],
        ?array $finalChoice = null,
        ?string $blackPlayerId = null,
        ?string $whitePlayerId = null,
        array $actions = []
    ) {
        $this->phase = $phase;
        $this->player1Id = $player1Id;
        $this->player2Id = $player2Id;
        $this->activePlayerId = $activePlayerId;
        $this->tentativeStones = $tentativeStones;
        $this->finalChoice = $finalChoice;
        $this->blackPlayerId = $blackPlayerId;
        $this->whitePlayerId = $whitePlayerId;
        $this->actions = $actions;
    }


    public function getPhase(): string
    {
        return $this->phase;
    }

    public function setPhase(string $phase): self
    {
        $this->phase = $phase;
        return $this;
    }

    public function getPlayer1Id(): string
    {
        return $this->player1Id;
    }

    public function getPlayer2Id(): string
    {
        return $this->player2Id;
    }

    public function getActivePlayerId(): string
    {
        return $this->activePlayerId;
    }

    public function setActivePlayerId(string $activePlayerId): self
    {
        $this->activePlayerId = $activePlayerId;
        return $this;
    }

    /**
     * @return TentativeStone[]
     */
    public function getTentativeStones(): array
    {
        return $this->tentativeStones;
    }

    public function addTentativeStone(TentativeStone $stone): self
    {
        $this->tentativeStones[] = $stone;
        return $this;
    }

    public function getFinalChoice(): ?array
    {
        return $this->finalChoice;
    }

    public function setFinalChoice(string $chooser, string $chosenColor): self
    {
        $this->finalChoice = [
            'chooser' => $chooser,
            'chosenColor' => $chosenColor
        ];
        return $this;
    }

    public function getBlackPlayerId(): ?string
    {
        return $this->blackPlayerId;
    }

    public function setBlackPlayerId(string $blackPlayerId): self
    {
        $this->blackPlayerId = $blackPlayerId;
        return $this;
    }

    public function getWhitePlayerId(): ?string
    {
        return $this->whitePlayerId;
    }

    public function setWhitePlayerId(string $whitePlayerId): self
    {
        $this->whitePlayerId = $whitePlayerId;
        return $this;
    }

    /**
     * @return Swap2Action[]
     */
    public function getActions(): array
    {
        return $this->actions;
    }

    public function addAction(Swap2Action $action): self
    {
        $this->actions[] = $action;
        return $this;
    }

    public function getStoneCount(): int
    {
        return count($this->tentativeStones);
    }

    public function isPositionOccupied(int $x, int $y): bool
    {
        foreach ($this->tentativeStones as $stone) {
            if ($stone->getX() === $x && $stone->getY() === $y) {
                return true;
            }
        }
        return false;
    }

    public function jsonSerialize(): array
    {
        return [
            'phase' => $this->phase,
            'player1Id' => $this->player1Id,
            'player2Id' => $this->player2Id,
            'activePlayerId' => $this->activePlayerId,
            'tentativeStones' => array_map(fn($s) => $s->jsonSerialize(), $this->tentativeStones),
            'finalChoice' => $this->finalChoice,
            'blackPlayerId' => $this->blackPlayerId,
            'whitePlayerId' => $this->whitePlayerId,
            'actions' => array_map(fn($a) => $a->jsonSerialize(), $this->actions)
        ];
    }

    public static function fromArray(array $data): self
    {
        $tentativeStones = [];
        if (isset($data['tentativeStones'])) {
            foreach ($data['tentativeStones'] as $stoneData) {
                $tentativeStones[] = TentativeStone::fromArray($stoneData);
            }
        }

        $actions = [];
        if (isset($data['actions'])) {
            foreach ($data['actions'] as $actionData) {
                $actions[] = Swap2Action::fromArray($actionData);
            }
        }

        return new self(
            $data['phase'],
            $data['player1Id'],
            $data['player2Id'],
            $data['activePlayerId'],
            $tentativeStones,
            $data['finalChoice'] ?? null,
            $data['blackPlayerId'] ?? null,
            $data['whitePlayerId'] ?? null,
            $actions
        );
    }
}
