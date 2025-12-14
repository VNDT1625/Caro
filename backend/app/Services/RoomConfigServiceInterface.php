<?php

namespace App\Services;

/**
 * RoomConfigServiceInterface
 * 
 * Interface for managing room configuration including Swap 2 settings.
 * Handles room creation with proper mode-based configuration.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
interface RoomConfigServiceInterface
{
    /**
     * Create room configuration with proper Swap 2 settings.
     * 
     * - For ranked mode: swap2_enabled is always true (cannot be overridden)
     * - For other modes: swap2_enabled can be configured by room creator
     * 
     * Requirements: 4.1, 4.2, 4.4
     * 
     * @param string $roomId UUID of the room
     * @param string $mode Game mode ('ranked', 'tieu_dao', 'van_mon', 'di_bien_ky', 'custom', 'casual')
     * @param bool|null $swap2Enabled Whether Swap 2 is enabled (ignored for ranked mode)
     * @return array Room configuration with swap2_enabled properly set
     */
    public function createRoomConfig(string $roomId, string $mode, ?bool $swap2Enabled = null): array;

    /**
     * Get room configuration by room ID.
     * 
     * Requirements: 4.5
     * 
     * @param string $roomId UUID of the room
     * @return array|null Room configuration or null if not found
     */
    public function getRoomConfig(string $roomId): ?array;

    /**
     * Check if Swap 2 is enabled for a room.
     * 
     * Requirements: 4.3, 4.5
     * 
     * @param string $roomId UUID of the room
     * @return bool True if Swap 2 is enabled
     */
    public function isSwap2Enabled(string $roomId): bool;

    /**
     * Check if a mode requires Swap 2 to be enabled.
     * 
     * Requirements: 4.1
     * 
     * @param string $mode Game mode
     * @return bool True if mode requires Swap 2
     */
    public function isSwap2Required(string $mode): bool;

    /**
     * Get the effective swap2_enabled value for a mode and requested setting.
     * 
     * - For ranked mode: always returns true regardless of requested value
     * - For other modes: returns the requested value (defaults to false if null)
     * 
     * Requirements: 4.1, 4.2, 4.3
     * 
     * @param string $mode Game mode
     * @param bool|null $requestedSwap2Enabled Requested swap2_enabled value
     * @return bool Effective swap2_enabled value
     */
    public function getEffectiveSwap2Enabled(string $mode, ?bool $requestedSwap2Enabled): bool;

    /**
     * Clear room configuration (for cleanup).
     * 
     * @param string $roomId UUID of the room
     */
    public function clearRoomConfig(string $roomId): void;
}
