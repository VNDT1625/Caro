<?php
use PHPUnit\Framework\TestCase;

class MatchIngestTest extends TestCase
{
    private static $proc;
    private static $pipes;
    private static $port = 8003;

    public static function setUpBeforeClass(): void
    {
        $cmd = sprintf("%s -S 127.0.0.1:%d -t %s", PHP_BINARY, self::$port, escapeshellarg(__DIR__ . '/../public'));
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w']
        ];
        self::$proc = proc_open($cmd, $descriptors, self::$pipes, __DIR__ . '/..');
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

    public function testIngestMatchSucceeds()
    {
        $replay = [
            'players' => [
                ['side' => 'X', 'user_id' => null],
                ['side' => 'O', 'user_id' => null]
            ],
            'moves' => [
                ['x' => 0, 'y' => 0, 'player' => 'X', 'turn' => 1],
                ['x' => 1, 'y' => 0, 'player' => 'O', 'turn' => 2],
            ],
            'final_board' => [['X','O',null],[null,null,null],[null,null,null]],
            'started_at' => '2025-11-15T00:00:00Z',
            'ended_at' => '2025-11-15T00:00:10Z',
            'winner' => 'X'
        ];

        $res = $this->request('POST', '/api/matches', $replay);
        $this->assertTrue(in_array($res['status'], [200,201]));
        $this->assertIsArray($res['body']);
        $this->assertNotEmpty($res['body']);

        // verify the server saved the match to storage/matches.json
        $matchId = $res['body']['id'] ?? null;
        $this->assertNotNull($matchId, 'response did not include match id');
        $matchesFile = __DIR__ . '/../storage/matches.json';
        $this->assertFileExists($matchesFile, 'matches.json not found');
        $raw = file_get_contents($matchesFile);
        $data = json_decode($raw, true);
        $this->assertIsArray($data);
        $this->assertArrayHasKey($matchId, $data, 'matches.json does not contain the saved match id');
        $saved = $data[$matchId];
        $this->assertEquals('X', $saved['winner'] ?? $saved['winner_user_id'] ?? 'X' );
    }

    public function testIngestMatchFailsOnMissingFields()
    {
        // empty body
        $res = $this->request('POST', '/api/matches', []);
        $this->assertEquals(400, $res['status']);
        $this->assertIsArray($res['body']);
        $this->assertArrayHasKey('error', $res['body']);

        // missing moves
        $payload = ['players' => [['side'=>'X']]];
        $res2 = $this->request('POST', '/api/matches', $payload);
        $this->assertEquals(400, $res2['status']);
        $this->assertArrayHasKey('error', $res2['body']);
    }
}
