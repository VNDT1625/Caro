<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Quản lý state skill cho từng trận (mana, hiệu ứng, cờ trạng thái).
 * Ưu tiên lưu DB (match_skill_state) nếu có PDO, fallback file JSON.
 */
class MatchSkillStateService
{
    private string $storageFile;
    private ?\PDO $pdo;

    public function __construct(?\PDO $pdo = null, ?string $storageFile = null)
    {
        $this->pdo = $pdo;
        $this->storageFile = $storageFile ?? __DIR__ . '/../../storage/skill_state.json';
        if (!file_exists($this->storageFile)) {
            @mkdir(dirname($this->storageFile), 0777, true);
            file_put_contents($this->storageFile, json_encode(new \stdClass()));
        }
    }

    public function load(string $matchId): array
    {
        $dbState = $this->readFromDb($matchId);
        if ($dbState !== null) {
            return $dbState;
        }
        $all = $this->readAll();
        return $all[$matchId] ?? [
            'turn' => 1,
            'mana' => [],
            'effects' => [],
        ];
    }

    public function save(string $matchId, array $state): void
    {
        if ($this->writeToDb($matchId, $state)) {
            return;
        }
        $all = $this->readAll();
        $all[$matchId] = $state;
        file_put_contents($this->storageFile, json_encode($all));
    }

    /**
     * Tick state: hồi mana, giảm duration, trả về thay đổi để client áp dụng.
     * @return array{state: array, changes: array}
     */
    public function tick(string $matchId, string $playerId, array $boardState = []): array
    {
        $state = $this->load($matchId);
        $state['turn'] = ($state['turn'] ?? 0) + 1;
        $changes = [];

        $state['mana'][$playerId] = $this->regenMana($state['mana'][$playerId] ?? null);

        $effects = $state['effects'] ?? [];
        $newEffects = [];

        foreach ($effects as $effect) {
            $effect['remaining'] = ($effect['remaining'] ?? 0) - 1;
            if (($effect['remaining'] ?? 0) <= 0) {
                $this->appendExpireChange($changes, $effect);
                continue;
            }

            $changes = array_merge($changes, $this->tickEffect($effect, $boardState));
            $newEffects[] = $effect;
        }

        $state['effects'] = $newEffects;

        return ['state' => $state, 'changes' => $changes];
    }

    /**
     * Tính luck buff (tăng odds skill hiếm) và deck lock (số skill disable).
     */
    public function computeModifiers(array $state, string $playerId): array
    {
        $effects = $state['effects'] ?? [];
        $luckStacks = 0;
        $lockCount = 0;
        foreach ($effects as $eff) {
            if (($eff['type'] ?? '') === 'luck_buff' && $this->effectAppliesToPlayer($eff, $playerId, false)) {
                $luckStacks = max($luckStacks, (int)($eff['max_stack'] ?? 0));
            }
            if (($eff['type'] ?? '') === 'deck_lock' && $this->effectAppliesToPlayer($eff, $playerId, true)) {
                $lockCount = max($lockCount, (int)($eff['count'] ?? 0));
            }
        }
        return ['luck_stacks' => $luckStacks, 'lock_count' => $lockCount];
    }

    private function spreadOnce(array $effect, array $board): array
    {
        $positions = $effect['positions'] ?? [];
        $seen = [];
        foreach ($positions as $pos) {
            $seen[$pos['x'] . '_' . $pos['y']] = true;
        }
        $newPositions = [];
        foreach ($positions as $pos) {
            $neighbors = $this->getNeighbors($pos['x'], $pos['y']);
            foreach ($neighbors as $n) {
                $key = $n['x'] . '_' . $n['y'];
                if (isset($seen[$key])) continue;
                if (($board[$n['y']][$n['x']] ?? null) === null) continue;
                $seen[$key] = true;
                $newPositions[] = $n;
                if (count($newPositions) >= 1) break;
            }
            if (count($newPositions) >= 1) break;
        }

        $changes = [];
        if (!empty($newPositions)) {
            foreach ($newPositions as $np) {
                $changes[] = [
                    'type' => 'status_spread',
                    'status' => $effect['status'] ?? 'unknown',
                    'x' => $np['x'],
                    'y' => $np['y']
                ];
            }
            if (($effect['remaining'] ?? 1) <= 1) {
                foreach ($positions as $pos) {
                    $changes[] = ['type' => 'remove', 'x' => $pos['x'], 'y' => $pos['y']];
                }
                foreach ($newPositions as $pos) {
                    $changes[] = ['type' => 'remove', 'x' => $pos['x'], 'y' => $pos['y']];
                }
            }
        }

        return ['changes' => $changes, 'new_positions' => $newPositions];
    }

    private function getNeighbors(int $x, int $y): array
    {
        $dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
        $res = [];
        foreach ($dirs as [$dx,$dy]) {
            $nx = $x + $dx; $ny = $y + $dy;
            if ($nx >=0 && $nx < 15 && $ny >=0 && $ny < 15) {
                $res[] = ['x' => $nx, 'y' => $ny];
            }
        }
        return $res;
    }

    /**
     * Áp dụng effects mới từ SkillEffectResult vào state.
     */
    public function applyEffects(array $state, array $effects, string $ownerId): array
    {
        if (empty($effects)) {
            return $state;
        }
        $existing = $state['effects'] ?? [];
        $blockBuff = array_filter($existing, fn($e) => ($e['type'] ?? '') === 'block_future_buffs' && $this->effectAppliesToPlayer($e, $ownerId, false));

        foreach ($effects as $eff) {
            $eff['owner'] = $ownerId;
            $eff['remaining'] = $eff['remaining'] ?? ($eff['duration'] ?? 0);
            unset($eff['duration']);

            if ($this->isBuffEffect($eff) && !empty($blockBuff)) {
                continue;
            }

            if (($eff['type'] ?? '') === 'purge_buffs') {
                $existing = array_values(array_filter($existing, fn($e) => !$this->isBuffEffect($e)));
                continue;
            }

            if (($eff['type'] ?? '') === 'cleanse_element') {
                $status = $this->mapElementToStatus($eff['element'] ?? null);
                if ($status) {
                    $existing = array_values(array_filter(
                        $existing,
                        fn($e) => ($e['type'] ?? '') === 'status_spread' ? (($e['status'] ?? '') !== $status) : true
                    ));
                }
                continue;
            }

            $existing[] = $eff;
        }

        $state['effects'] = $existing;
        return $state;
    }

    /**
     * Trừ mana; trả lỗi nếu thiếu.
     */
    public function deductMana(array $state, string $playerId, int $cost): array
    {
        $current = $state['mana'][$playerId] ?? ManaServiceInterface::INITIAL_MANA;
        if ($current < $cost) {
            return ['state' => $state, 'error' => 'NOT_ENOUGH_MANA'];
        }
        $state['mana'][$playerId] = $current - $cost;
        return ['state' => $state, 'error' => null];
    }

    /**
     * Tính phí giữ bài và trừ mana.
     */
    public function applyHoldCost(array $state, string $playerId, array $skills): array
    {
        $holdCost = 0;
        $retentionCosts = ManaServiceInterface::RETENTION_COSTS;
        foreach ($skills as $skill) {
            $rarity = $skill['rarity'] ?? 'common';
            $holdCost += $retentionCosts[strtolower((string)$rarity)] ?? $retentionCosts['common'];
        }
        if ($holdCost > 0) {
            $res = $this->deductMana($state, $playerId, $holdCost);
            $state = $res['state'];
            if ($res['error']) {
                return ['state' => $state, 'error' => $res['error'], 'hold_cost' => $holdCost];
            }
        }
        return ['state' => $state, 'error' => null, 'hold_cost' => $holdCost];
    }

    private function readAll(): array
    {
        $raw = @file_get_contents($this->storageFile);
        if (!$raw) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function regenMana(?int $current): int
    {
        $cur = $current ?? ManaServiceInterface::INITIAL_MANA;
        return min(ManaServiceInterface::MANA_CAP, $cur + ManaServiceInterface::MANA_PER_TURN);
    }

    public function isSilenced(array $state, string $playerId): bool
    {
        foreach ($state['effects'] ?? [] as $eff) {
            if (($eff['type'] ?? '') === 'freeze_skills' && $this->effectAppliesToPlayer($eff, $playerId, true)) {
                return true;
            }
        }
        return false;
    }

    private function appendExpireChange(array &$changes, array $effect): void
    {
        $type = $effect['type'] ?? '';
        $owner = $effect['owner'] ?? null;

        switch ($type) {
            case 'status_spread':
                $changes[] = [
                    'type' => 'status_expire',
                    'status' => $effect['status'] ?? 'unknown',
                    'positions' => $effect['positions'] ?? []
                ];
                break;
            case 'two_skills_next_turn':
                $changes[] = ['type' => 'two_skills_expire', 'owner' => $owner];
                break;
            case 'redirect_damage':
                $changes[] = ['type' => 'redirect_expire', 'owner' => $owner];
                break;
            case 'protect_all':
            case 'shield_area':
            case 'protect_piece':
            case 'dual_protect':
                $changes[] = ['type' => 'protect_expire', 'owner' => $owner, 'effect' => $type, 'positions' => $effect['positions'] ?? null];
                break;
            case 'deck_lock':
                $changes[] = ['type' => 'deck_lock_expire', 'owner' => $owner];
                break;
            case 'luck_buff':
                $changes[] = ['type' => 'luck_expire', 'owner' => $owner];
                break;
            case 'freeze_skills':
                $changes[] = ['type' => 'freeze_expire', 'owner' => $owner];
                break;
            default:
                break;
        }
    }

    private function tickEffect(array &$effect, array $boardState): array
    {
        $changes = [];
        $type = $effect['type'] ?? '';

        if ($type === 'status_spread') {
            $spread = $this->spreadOnce($effect, $boardState);
            if (!empty($spread['changes'])) {
                $changes = array_merge($changes, $spread['changes']);
                if (!empty($spread['new_positions'])) {
                    $effect['positions'] = array_merge($effect['positions'] ?? [], $spread['new_positions']);
                }
            }
        }

        if ($type === 'trap_reflect') {
            $changes[] = ['type' => 'trap_active', 'positions' => $effect['positions'] ?? [], 'owner' => $effect['owner'] ?? null];
        }

        if ($type === 'deck_lock') {
            $changes[] = ['type' => 'deck_lock_active', 'owner' => $effect['owner'] ?? null, 'count' => $effect['count'] ?? 0];
        }

        if ($type === 'luck_buff') {
            $changes[] = ['type' => 'luck_active', 'owner' => $effect['owner'] ?? null, 'stacks' => $effect['max_stack'] ?? 0];
        }

        if ($type === 'protect_all' || $type === 'shield_area' || $type === 'protect_piece' || $type === 'dual_protect') {
            $changes[] = ['type' => 'protect_active', 'effect' => $type, 'owner' => $effect['owner'] ?? null, 'positions' => $effect['positions'] ?? null];
        }

        if ($type === 'cleanse_element') {
            $status = $this->mapElementToStatus($effect['element'] ?? null);
            if ($status) {
                $changes[] = ['type' => 'cleanse', 'status' => $status, 'owner' => $effect['owner'] ?? null];
            }
        }

        if ($type === 'purge_buffs') {
            $changes[] = ['type' => 'purge_buffs', 'owner' => $effect['owner'] ?? null];
        }

        if ($type === 'two_skills_next_turn') {
            $changes[] = ['type' => 'two_skills_ready', 'owner' => $effect['owner'] ?? null];
        }

        return $changes;
    }

    private function effectAppliesToPlayer(array $effect, string $playerId, bool $treatNullAsAll): bool
    {
        $target = $effect['target'] ?? null;
        if ($target === $playerId) {
            return true;
        }
        if ($treatNullAsAll && !$target) {
            return true;
        }
        if ($target === 'opponent') {
            return ($effect['owner'] ?? '') !== $playerId;
        }
        if ($target === 'self') {
            return ($effect['owner'] ?? '') === $playerId;
        }
        if ($target === 'all' && $treatNullAsAll) {
            return true;
        }
        return false;
    }

    private function isBuffEffect(array $effect): bool
    {
        return in_array($effect['type'] ?? '', [
            'attack_buff', 'buff_next', 'block_future_buffs', 'seal_buff', 'protect_all', 'protect_piece',
            'shield_area', 'dual_protect', 'redirect_damage', 'luck_buff', 'deck_lock', 'two_skills_next_turn',
            'destroy_immunity', 'immobilize', 'fake_piece', 'trap_reflect', 'burn_area'
        ], true);
    }

    /**
     * Kiểm tra xem một ô có được bảo vệ không
     */
    public function isCellProtected(array $state, int $x, int $y, ?string $side = null): bool
    {
        foreach ($state['effects'] ?? [] as $eff) {
            $type = $eff['type'] ?? '';
            $effSide = $eff['side'] ?? null;
            
            // Skip if side doesn't match
            if ($side !== null && $effSide !== null && $effSide !== $side) {
                continue;
            }
            
            if ($type === 'protect_all' && ($effSide === $side || $effSide === null)) {
                return true;
            }
            
            if ($type === 'protect_piece' && ($eff['x'] ?? -1) === $x && ($eff['y'] ?? -1) === $y) {
                return true;
            }
            
            if ($type === 'destroy_immunity' && ($eff['x'] ?? -1) === $x && ($eff['y'] ?? -1) === $y) {
                return true;
            }
            
            if ($type === 'dual_protect') {
                foreach ($eff['positions'] ?? [] as $pos) {
                    if (($pos['x'] ?? -1) === $x && ($pos['y'] ?? -1) === $y) {
                        return true;
                    }
                }
            }
            
            if ($type === 'shield_area') {
                $center = $eff['center'] ?? ['x' => -1, 'y' => -1];
                $size = $eff['size'] ?? 2;
                $radius = max(0, $size - 1);
                if (abs($x - ($center['x'] ?? -1)) <= $radius && abs($y - ($center['y'] ?? -1)) <= $radius) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Kiểm tra xem một ô có bị immobilize không
     */
    public function isCellImmobilized(array $state, int $x, int $y): bool
    {
        foreach ($state['effects'] ?? [] as $eff) {
            if (($eff['type'] ?? '') === 'immobilize' && ($eff['x'] ?? -1) === $x && ($eff['y'] ?? -1) === $y) {
                return true;
            }
        }
        return false;
    }

    /**
     * Kiểm tra xem một ô có bị burn không
     */
    public function isCellBurning(array $state, int $x, int $y): bool
    {
        foreach ($state['effects'] ?? [] as $eff) {
            if (($eff['type'] ?? '') === 'burn_area') {
                $center = $eff['center'] ?? ['x' => -1, 'y' => -1];
                $radius = $eff['radius'] ?? 1;
                if (abs($x - ($center['x'] ?? -1)) <= $radius && abs($y - ($center['y'] ?? -1)) <= $radius) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Lấy danh sách skill bị remove khỏi deck
     */
    public function getRemovedSkills(array $state, string $playerId): array
    {
        $removed = [];
        foreach ($state['effects'] ?? [] as $eff) {
            if (($eff['type'] ?? '') === 'remove_from_deck' && ($eff['owner'] ?? '') === $playerId) {
                $removed[] = $eff['skill_id'] ?? null;
            }
            if (($eff['type'] ?? '') === 'erase_enemy_skill' && ($eff['target'] ?? '') === $playerId) {
                $removed[] = $eff['target_skill_id'] ?? null;
            }
        }
        return array_filter($removed);
    }

    private function mapElementToStatus(?string $element): ?string
    {
        return match ($element) {
            'hoa' => 'burn',
            'thuy' => 'freeze',
            'moc' => 'root',
            'tho' => 'petrify',
            'kim' => 'rust',
            default => null,
        };
    }

    private function readFromDb(string $matchId): ?array
    {
        if (!$this->pdo) return null;
        try {
            $stmt = $this->pdo->prepare('SELECT state FROM match_skill_state WHERE match_id = :mid');
            $stmt->execute(['mid' => $matchId]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$row) {
                return null;
            }
            $decoded = json_decode($row['state'] ?? '{}', true);
            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function writeToDb(string $matchId, array $state): bool
    {
        if (!$this->pdo) return false;
        try {
            $stmt = $this->pdo->prepare('INSERT INTO match_skill_state (match_id, state) VALUES (:mid, :st)
                ON CONFLICT (match_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()');
            $stmt->execute(['mid' => $matchId, 'st' => json_encode($state)]);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
