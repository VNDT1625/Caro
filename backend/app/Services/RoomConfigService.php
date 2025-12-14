<?php

namespace App\Services;

/**
 * RoomConfigService - Implementation of room configuration management.
 * 
 * Manages room configuration including Swap 2 settings with proper
 * mode-based enforcement (ranked mode always has Swap 2 enabled).
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
class RoomConfigService implements RoomConfigServiceInterface
{
    /** @var string Mode that requires Swap 2 */
    public const MODE_RANKED = 'ranked';

    /** @var string[] All supported game modes */
    public const SUPPORTED_MODES = [
        'ranked',
        'tieu_dao',
        'van_mon',
        'di_bien_ky',
        'custom',
        'casual',
    ];

    /** @var array<string, array> In-memory room configuration storage */
    private array $roomConfigs = [];

    /**
     * {@inheritdoc}
     */
    public function createRoomConfig(string $roomId, string $mode, ?bool $swap2Enabled = null): array
    {
        // Validate mode
        if (!in_array($mode, self::SUPPORTED_MODES, true)) {
            throw new \InvalidArgumentException("Unsupported game mode: {$mode}");
        }

        // Determine effective swap2_enabled value
        $effectiveSwap2Enabled = $this->getEffectiveSwap2Enabled($mode, $swap2Enabled);

        $config = [
            'room_id' => $roomId,
            'mode' => $mode,
            'swap2_enabled' => $effectiveSwap2Enabled,
            'swap2_required' => $this->isSwap2Required($mode),
            'created_at' => date('c'),
        ];

        $this->roomConfigs[$roomId] = $config;

        return $config;
    }

    /**
     * {@inheritdoc}
     */
    public function getRoomConfig(string $roomId): ?array
    {
        return $this->roomConfigs[$roomId] ?? null;
    }

    /**
     * {@inheritdoc}
     */
    public function isSwap2Enabled(string $roomId): bool
    {
        $config = $this->getRoomConfig($roomId);
        return $config !== null ? $config['swap2_enabled'] : false;
    }

    /**
     * {@inheritdoc}
     */
    public function isSwap2Required(string $mode): bool
    {
        return $mode === self::MODE_RANKED;
    }

    /**
     * {@inheritdoc}
     */
    public function getEffectiveSwap2Enabled(string $mode, ?bool $requestedSwap2Enabled): bool
    {
        // For ranked mode, Swap 2 is always enabled regardless of request
        if ($this->isSwap2Required($mode)) {
            return true;
        }

        // For other modes, use requested value or default to false
        return $requestedSwap2Enabled ?? false;
    }

    /**
     * {@inheritdoc}
     */
    public function clearRoomConfig(string $roomId): void
    {
        unset($this->roomConfigs[$roomId]);
    }

    /**
     * Load room configuration from array (for persistence).
     * 
     * @param string $roomId Room ID
     * @param array $data Configuration data
     * @return array Loaded configuration
     */
    public function loadRoomConfig(string $roomId, array $data): array
    {
        $this->roomConfigs[$roomId] = $data;
        return $data;
    }

    /**
     * Get all room configurations (for testing/debugging).
     * 
     * @return array<string, array> All room configurations
     */
    public function getAllRoomConfigs(): array
    {
        return $this->roomConfigs;
    }
}
