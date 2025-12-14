<?php

declare(strict_types=1);

namespace App\Services;

class SkillEffectResult
{
    public bool $success;
    public string $message;
    public array $changes;
    public array $newBoardState;
    public array $stateEffects;

    public function __construct(bool $success, string $message, array $changes, array $newBoardState, array $stateEffects = [])
    {
        $this->success = $success;
        $this->message = $message;
        $this->changes = $changes;
        $this->newBoardState = $newBoardState;
        $this->stateEffects = $stateEffects;
    }

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'message' => $this->message,
            'changes' => $this->changes,
            'board' => $this->newBoardState,
            'effects' => $this->stateEffects,
        ];
    }
}
