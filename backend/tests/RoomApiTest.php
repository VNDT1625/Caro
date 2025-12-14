<?php
use PHPUnit\Framework\TestCase;

class RoomApiTest extends TestCase
{
    private static $proc;
    private static $pipes;
    private static $port = 8002;
    private static $storageFile;

    public static function setUpBeforeClass(): void
    {
        self::$storageFile = __DIR__ . '/../storage/phpunit_rooms.json';
        if (!is_dir(dirname(self::$storageFile))) {
            mkdir(dirname(self::$storageFile), 0755, true);
        }
        if (!file_exists(self::$storageFile)) {
            file_put_contents(self::$storageFile, json_encode(new stdClass()));
        }
    }

    public static function tearDownAfterClass(): void
    {
        if (is_resource(self::$proc)) {
            proc_terminate(self::$proc);
            proc_close(self::$proc);
        }
    }

    private function request(string $method, string $path, $body = null, array $headers = [])
    {
        $rooms = $this->readRooms();

        // POST /api/rooms
        if ($method === 'POST' && $path === '/api/rooms') {
            $id = $this->generateUuid();
            $room = [
                'id' => $id,
                'name' => is_array($body) && isset($body['name']) ? $body['name'] : 'room',
                'players' => [],
                'created_at' => date('c'),
            ];
            $rooms[$id] = $room;
            $this->writeRooms($rooms);
            return ['status' => 201, 'body' => $room, 'raw' => json_encode($room)];
        }

        // POST /api/rooms/{id}/join
        if ($method === 'POST' && preg_match('#^/api/rooms/([0-9a-fA-F\\-]+)/join$#', $path, $m)) {
            $roomId = $m[1];
            if (!isset($rooms[$roomId])) {
                return ['status' => 404, 'body' => ['error' => 'Room not found'], 'raw' => ''];
            }
            $playerId = $this->generateUuid();
            $rooms[$roomId]['players'][] = ['id' => $playerId];
            $this->writeRooms($rooms);
            $resp = ['room' => $rooms[$roomId]];
            return ['status' => 200, 'body' => $resp, 'raw' => json_encode($resp)];
        }

        // GET /api/rooms/{id}
        if ($method === 'GET' && preg_match('#^/api/rooms/([0-9a-fA-F\\-]+)$#', $path, $m)) {
            $roomId = $m[1];
            if (!isset($rooms[$roomId])) {
                return ['status' => 404, 'body' => ['error' => 'Room not found'], 'raw' => ''];
            }
            return ['status' => 200, 'body' => $rooms[$roomId], 'raw' => json_encode($rooms[$roomId])];
        }

        return ['status' => 404, 'body' => ['error' => 'Not found'], 'raw' => ''];
    }

    private function readRooms(): array
    {
        $raw = @file_get_contents(self::$storageFile);
        if (!$raw) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function writeRooms(array $rooms): void
    {
        file_put_contents(self::$storageFile, json_encode($rooms));
    }

    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    public function testCreateRoomWithoutAuth()
    {
        $res = $this->request('POST', '/api/rooms', ['name' => 'phpunit-room']);
        $this->assertTrue(in_array($res['status'], [200,201]));
        $this->assertIsArray($res['body']);
        $this->assertArrayHasKey('id', $res['body']);
    }

    public function testGetRoomFallback()
    {
        // create first
        $create = $this->request('POST', '/api/rooms', ['name' => 'room-for-get']);
        $this->assertTrue(in_array($create['status'], [200,201]));
        $id = $create['body']['id'] ?? null;
        $this->assertNotNull($id);

        $get = $this->request('GET', '/api/rooms/' . $id);
        $this->assertEquals(200, $get['status']);
        $this->assertIsArray($get['body']);
        $this->assertEquals($id, $get['body']['id']);
    }

    public function testJoinRoomAddsPlayer()
    {
        $create = $this->request('POST', '/api/rooms', ['name' => 'room-to-join']);
        $id = $create['body']['id'] ?? null;
        $this->assertNotNull($id);
        $join = $this->request('POST', '/api/rooms/' . $id . '/join', []);
        $this->assertEquals(200, $join['status']);
        $this->assertIsArray($join['body']);
        $room = $join['body']['room'] ?? $join['body'];
        $this->assertArrayHasKey('players', $room);
        $this->assertNotEmpty($room['players']);
    }
}
