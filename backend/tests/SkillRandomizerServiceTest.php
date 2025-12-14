<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use App\Services\SkillRandomizerService;
use App\Services\SkillServiceInterface;

class SkillRandomizerServiceTest extends TestCase
{
    public function testCooldownSkillsAreExcluded(): void
    {
        $skills = [];
        foreach (['1', '2', '3', '4', '5'] as $id) {
            $skills[$id] = ['id' => $id, 'rarity' => 'common'];
        }

        $service = new SkillRandomizerService(new FakeSkillService($skills));
        $result = $service->generateTurnSkills(
            array_keys($skills),
            ['2', '3'],
            1,
            'seed_abc',
            [],
            0
        );

        $this->assertCount(3, $result);
        $this->assertEmpty(array_intersect($result, ['2', '3']), 'Cooldown skills must not appear');
        $this->assertEmpty(array_diff($result, array_keys($skills)), 'All picks come from deck');
    }

    public function testHeldCardsAreFilteredAndCountStaysThree(): void
    {
        $skills = [
            '1' => ['id' => '1', 'rarity' => 'common'],
            '2' => ['id' => '2', 'rarity' => 'common'],
            '3' => ['id' => '3', 'rarity' => 'common'],
        ];

        $service = new SkillRandomizerService(new FakeSkillService($skills));
        $result = $service->generateTurnSkills(
            ['1', '2', '3'],
            ['2'],          // cooldown -> should be removed
            2,
            'seed_xyz',
            ['2', '3'],     // request hold 2 (cooldown) + 3 (valid)
            0
        );

        $this->assertCount(3, $result);
        $this->assertContains('3', $result, 'Valid held card must stay');
        $this->assertNotContains('2', $result, 'Cooldown card must not stay');
        $this->assertEmpty(array_diff($result, array_keys($skills)));
    }
}

class FakeSkillService implements SkillServiceInterface
{
    private array $skills;

    public function __construct(array $skills)
    {
        $this->skills = $skills;
    }

    public function getSkillsBySeason(string $seasonId): array
    {
        return [];
    }

    public function getSkillById(string $skillId): ?array
    {
        return $this->skills[(string) $skillId] ?? null;
    }

    public function getSkillsByIds(array $skillIds): array
    {
        $result = [];
        foreach ($skillIds as $id) {
            $key = (string) $id;
            if (isset($this->skills[$key])) {
                $result[] = $this->skills[$key];
            }
        }
        return $result;
    }

    public function getStarterSkills(): array
    {
        return [];
    }

    public function getUserUnlockedSkills(string $userId): array
    {
        return [];
    }

    public function unlockSkill(string $userId, string $skillId, string $method): bool
    {
        return true;
    }

    public function upgradeSkill(string $userId, string $skillId): array
    {
        return [];
    }
}
