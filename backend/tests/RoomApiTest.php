<?php
use PHPUnit\Framework\TestCase;

class RoomApiTest extends TestCase
{
    private static $proc;
    private static $pipes;
    private static $port = 8002;

    public static function setUpBeforeClass(): void
    {
        $cmd = sprintf("%s -S 127.0.0.1:%d -t %s", PHP_BINARY, self::$port, escapeshellarg(__DIR__ . '/../public'));
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w']
        ];
        self::$proc = proc_open($cmd, $descriptors, self::$pipes, __DIR__ . '/..');
        // wait briefly for server to start
        usleep(300000);
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
        $url = sprintf('http://127.0.0.1:%d%s', self::$port, $path);
        $opts = ['http' => ['method' => $method, 'header' => '', 'ignore_errors' => true]];
        $h = [];
        $h[] = 'Content-Type: application/json';
        foreach ($headers as $k => $v) $h[] = $k . ': ' . $v;
        $opts['http']['header'] = implode("\r\n", $h);
        if ($body !== null) {
            $opts['http']['content'] = is_string($body) ? $body : json_encode($body);
        }
        $ctx = stream_context_create($opts);
        $resp = @file_get_contents($url, false, $ctx);
        $status = 0;
        if (isset($http_response_header) && is_array($http_response_header)) {
            $m = [];
            if (preg_match('#HTTP/\d+\.\d+\s+(\d+)#', $http_response_header[0], $m)) $status = (int)$m[1];
        }
        $data = null;
        if ($resp) $data = json_decode($resp, true);
        return ['status' => $status, 'body' => $data, 'raw' => $resp];
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
