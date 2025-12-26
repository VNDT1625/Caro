<?php
// Simple front controller (placeholder). Replace with framework entry (Laravel/ Symfony) when ready.

// CORS headers - cho phép frontend gọi API từ localhost:5173
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

if (in_array($origin, $allowedOrigins)) {
  header("Access-Control-Allow-Origin: $origin");
} else {
  // Fallback: cho phép tất cả origins trong dev mode
  header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400'); // Cache preflight for 24 hours

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// Load Composer autoload neu co (bo qua neu thieu de tranh 500 trong dev)
$autoloadPath = __DIR__ . '/../vendor/autoload.php';
if (file_exists($autoloadPath)) {
  require $autoloadPath;
} else {
  error_log('[bootstrap] vendor/autoload.php not found, skipping autoload');
}

// Minimal lightweight API for rooms (create / join) using JSON file storage.
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Debug: log URI for troubleshooting (remove in production)
// error_log("API Request: $method $uri");

$storageDir = __DIR__ . '/../storage';
if (!is_dir($storageDir)) mkdir($storageDir, 0755, true);
$roomsFile = $storageDir . '/rooms.json';
if (!file_exists($roomsFile)) file_put_contents($roomsFile, json_encode(new stdClass()));

// Load .env file FIRST and set environment variables for PHP built-in server
$envFile = __DIR__ . '/../.env';
$envLoaded = false;
if (file_exists($envFile)) {
	$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
	foreach ($lines as $line) {
		if (strpos($line, '=') === false || strpos(trim($line), '#') === 0) continue;
		list($key, $value) = explode('=', $line, 2);
		$key = trim($key);
		$value = trim($value, " \t\n\r\0\x0B\"'");
		// Set to environment so getenv() works throughout the app
		putenv("$key=$value");
		if ($key === 'SUPABASE_SKIP_SSL_VERIFY') {
			error_log("[ENV] Loaded SUPABASE_SKIP_SSL_VERIFY=$value");
			$envLoaded = true;
		}
	}
	if (!$envLoaded) {
		error_log("[ENV] WARNING: SUPABASE_SKIP_SSL_VERIFY not found in .env file");
	}
} else {
	error_log("[ENV] ERROR: .env file not found at $envFile");
}

// Supabase config (optional) - now getenv() will work after .env is loaded
$SUPABASE_URL = getenv('SUPABASE_URL') ?: getenv('VITE_SUPABASE_URL') ?: null;
$SUPABASE_ANON_KEY = getenv('SUPABASE_ANON_KEY') ?: getenv('VITE_SUPABASE_ANON_KEY') ?: null;
// Service role key for server-side writes to Supabase REST (keep secret)
$SUPABASE_SERVICE_KEY = getenv('SUPABASE_SERVICE_KEY') ?: null;

function verifySupabaseToken(?string $token) {
	global $SUPABASE_URL, $SUPABASE_ANON_KEY;
	// Force skip SSL verify on Windows dev environment (PHP built-in server lacks CA certs)
	$isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
	$skipVerifyRaw = getenv('SUPABASE_SKIP_SSL_VERIFY');
	$skipVerify = $isWindows || $skipVerifyRaw === '1' || $skipVerifyRaw === 'true';
	error_log("[verifySupabaseToken] SSL skip verify: " . ($skipVerify ? 'YES' : 'NO') . " (Windows: " . ($isWindows ? 'YES' : 'NO') . ", env: " . var_export($skipVerifyRaw, true) . ")");
	if (!$token) {
		error_log("[verifySupabaseToken] No token provided");
		return null;
	}
	if (!$SUPABASE_URL) {
		error_log("[verifySupabaseToken] SUPABASE_URL not configured");
		return null;
	}
	$url = rtrim($SUPABASE_URL, '/') . '/auth/v1/user';
	$ch = curl_init($url);
	$headers = ["Authorization: Bearer {$token}"];
	if ($SUPABASE_ANON_KEY) $headers[] = "apikey: {$SUPABASE_ANON_KEY}";
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	// Always skip SSL verify on Windows or when env var is set
	if ($skipVerify) {
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
	}
	$resp = curl_exec($ch);
	$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$curlError = curl_error($ch);
	curl_close($ch);
	if ($curlError) {
		$msg = "[verifySupabaseToken] cURL error: " . $curlError;
		if ($skipVerify) $msg .= " (SUPABASE_SKIP_SSL_VERIFY=1)";
		error_log($msg);
		return null;
	}
	if ($code === 200 && $resp) {
		$data = json_decode($resp, true);
		if (is_array($data) && isset($data['id'])) {
			error_log("[verifySupabaseToken] Success - user ID: " . $data['id']);
			return $data;
		} else {
			error_log("[verifySupabaseToken] Invalid response format or missing user ID");
			return null;
		}
	} else {
		error_log("[verifySupabaseToken] HTTP $code - Response: " . substr($resp, 0, 200));
		return null;
	}
}

function supabaseRequest(string $method, string $path, $body = null, bool $useService = true) {
	global $SUPABASE_URL, $SUPABASE_ANON_KEY, $SUPABASE_SERVICE_KEY;
	// Force skip SSL verify on Windows dev environment
	$isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
	$skipVerifyRaw = getenv('SUPABASE_SKIP_SSL_VERIFY');
	$skipVerify = $isWindows || $skipVerifyRaw === '1' || $skipVerifyRaw === 'true';
	if (!$SUPABASE_URL) return null;
	$url = rtrim($SUPABASE_URL, '/') . '/rest/v1/' . ltrim($path, '/');
	$ch = curl_init($url);
	$headers = [
		'Content-Type: application/json',
	];
	// prefer service key for writes
	if ($useService && $SUPABASE_SERVICE_KEY) {
		$headers[] = 'apikey: ' . $SUPABASE_SERVICE_KEY;
		$headers[] = 'Authorization: Bearer ' . $SUPABASE_SERVICE_KEY;
	} elseif ($SUPABASE_ANON_KEY) {
		$headers[] = 'apikey: ' . $SUPABASE_ANON_KEY;
	}
	// prefer representation on inserts
	if (in_array(strtoupper($method), ['POST','PATCH','PUT'])) {
		$headers[] = 'Prefer: return=representation';
	}
	curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
	// Always skip SSL verify on Windows or when env var is set
	if ($skipVerify) {
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
	}
	if ($body !== null) {
		curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
	}
	curl_setopt($ch, CURLOPT_TIMEOUT, 8);
	$resp = curl_exec($ch);
	$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	curl_close($ch);
	if ($resp === false) return null;
	$data = json_decode($resp, true);
	// Log non-2xx responses for debugging
	if ($code < 200 || $code >= 300) {
		$err = [
			'time' => date('c'),
			'method' => $method,
			'path' => $path,
			'status' => $code,
			'body' => $data,
			'raw' => $resp
		];
		$logFile = __DIR__ . '/../storage/supabase_errors.log';
		@file_put_contents($logFile, json_encode($err, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
	}
	return ['status' => $code, 'body' => $data, 'raw' => $resp];
}

function getAuthorizationHeaderValue(): ?string {
	// Check HTTP_AUTHORIZATION first (standard)
	if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
		return $_SERVER['HTTP_AUTHORIZATION'];
	}
	// Check REDIRECT_HTTP_AUTHORIZATION (some PHP setups)
	if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
		return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
	}
	// Try getallheaders() as fallback
	if (function_exists('getallheaders')) {
		$headers = getallheaders();
		if (!empty($headers['Authorization'])) return $headers['Authorization'];
		// Case-insensitive check
		foreach ($headers as $key => $value) {
			if (strtolower($key) === 'authorization') {
				return $value;
			}
		}
	}
	return null;
}

function getSupabaseAuthContext(): array {
	$header = getAuthorizationHeaderValue();
	if (!$header) {
		error_log("[getSupabaseAuthContext] No Authorization header found");
		return [null, null];
	}
	if (!preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
		error_log("[getSupabaseAuthContext] Failed to extract Bearer token from header");
		return [null, null];
	}
	$token = $matches[1];
	$user = verifySupabaseToken($token);
	if (!$user || empty($user['id'])) {
		error_log("[getSupabaseAuthContext] Token verification failed or user has no ID");
		return [null, null];
	}
	return [$user, $token];
}

function isValidUuid(?string $id) {
	if (!$id) return false;
	return preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $id) === 1;
}

function uuidv4() {
	$data = random_bytes(16);
	$data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
	$data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
	return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function fetchFriendUserIds(string $userId): array {
	$ids = [$userId];
	$res1 = supabaseRequest('GET', "friendships?select=friend_id&user_id=eq.$userId&status=eq.accepted", null, true);
	if ($res1 && is_array($res1['body'])) {
		foreach ($res1['body'] as $row) {
			if (!empty($row['friend_id'])) $ids[] = $row['friend_id'];
		}
	}
	$res2 = supabaseRequest('GET', "friendships?select=user_id&friend_id=eq.$userId&status=eq.accepted", null, true);
	if ($res2 && is_array($res2['body'])) {
		foreach ($res2['body'] as $row) {
			if (!empty($row['user_id'])) $ids[] = $row['user_id'];
		}
	}
	return array_values(array_unique(array_filter($ids)));
}

function isUserInRoom(string $userId, string $roomId): bool {
	if (!isValidUuid($roomId)) return false;
	$res = supabaseRequest('GET', "room_players?room_id=eq.$roomId&user_id=eq.$userId&select=id&limit=1", null, true);
	return $res && is_array($res['body']) && count($res['body']) > 0;
}

function readRooms($file) {
	$raw = file_get_contents($file);
	$data = json_decode($raw, true);
	return is_array($data) ? $data : [];
}

function writeRooms($file, $data) {
	file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

// POST /api/rooms -> create a room, returns {id, room}
if ($method === 'POST' && preg_match('#^/api/rooms$#', $uri)) {
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	// try to identify authenticated user via Supabase token
	$authHeader = null;
	if (isset($_SERVER['HTTP_AUTHORIZATION'])) $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
	elseif (function_exists('getallheaders')) {
		$headers = getallheaders();
		if (!empty($headers['Authorization'])) $authHeader = $headers['Authorization'];
	}

	$owner_user_id = null;
	$owner_name = null;
	if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $m)) {
		$token = $m[1];
		$user = verifySupabaseToken($token);
		if ($user && isset($user['id'])) {
			$owner_user_id = $user['id'];
			$owner_name = $user['email'] ?? ($user['user_metadata']['full_name'] ?? null);
			// ensure profile exists (server-side upsert)
			try {
				$q = supabaseRequest('GET', "profiles?user_id=eq." . $owner_user_id, null, true);
				if (!$q || !is_array($q['body']) || count($q['body']) === 0) {
					// create profile
					$p = [
						'user_id' => $owner_user_id,
						'username' => strtolower(preg_replace('/[^a-z0-9_]/','', ($owner_name ?: 'user_' . substr($owner_user_id,0,8)))),
						'display_name' => $owner_name ?? null,
						'created_at' => date('c')
					];
					supabaseRequest('POST', 'profiles', $p, true);
				}
			} catch (Exception $e) {
				// ignore
			}
		}
	}

	// If service key configured, persist to Supabase; otherwise fallback to file storage
	if ($SUPABASE_SERVICE_KEY && $SUPABASE_URL) {
		$roomPayload = [
			'room_code' => $body['room_code'] ?? null,
			'room_name' => $body['name'] ?? null,
			'mode' => $body['mode'] ?? 'casual',
			'is_private' => isset($body['is_private']) ? (bool)$body['is_private'] : false,
			'max_players' => isset($body['max_players']) ? (int)$body['max_players'] : 2,
			'board_size' => isset($body['board_size']) ? (int)$body['board_size'] : 15,
			'win_length' => isset($body['win_length']) ? (int)$body['win_length'] : 5,
			'owner_user_id' => $owner_user_id,
			'created_at' => date('c')
		];
		$res = supabaseRequest('POST', 'rooms', $roomPayload, true);
		if ($res && ($res['status'] === 201 || $res['status'] === 200) && is_array($res['body'])) {
			// PostgREST returns array of created rows when Prefer: return=representation
			$created = is_array($res['body']) ? $res['body'][0] : null;
			// create room_player for owner
			if ($created && $owner_user_id) {
				$rp = [
					'room_id' => $created['id'],
					'user_id' => $owner_user_id,
					'player_side' => null,
					'is_ready' => false,
					'joined_at' => date('c')
				];
				supabaseRequest('POST', 'room_players', $rp, true);
			}
			http_response_code(201);
			echo json_encode(['id' => $created['id'] ?? null, 'room' => $created]);
			exit;
		}
		// if supabase failed, fall through to file fallback
	}

	// fallback: file storage
	$roomId = uuidv4();
	$room = [
		'id' => $roomId,
		'name' => $body['name'] ?? 'Room ' . $roomId,
		'mode' => $body['mode'] ?? 'casual',
		'created_at' => date('c'),
		'players' => []
	];
	if ($owner_user_id) {
		$player = ['id' => $owner_user_id, 'name' => $owner_name ?? 'supabase-user'];
		$room['players'][] = $player;
	}
	$rooms = readRooms($roomsFile);
	$rooms[$roomId] = $room;
	writeRooms($roomsFile, $rooms);
	http_response_code(201);
	echo json_encode(['id' => $roomId, 'room' => $room]);
	exit;
}

// POST /api/rooms/{id}/join -> join a room
if ($method === 'POST' && preg_match('#^/api/rooms/([0-9a-fA-F\-]+?)/join$#', $uri, $m)) {
	$roomId = $m[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$player = $body['player'] ?? null;

	// If Authorization header with Supabase token present, resolve user and use its id
	$authHeader = null;
	if (isset($_SERVER['HTTP_AUTHORIZATION'])) $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
	elseif (function_exists('getallheaders')) {
		$headers = getallheaders();
		if (!empty($headers['Authorization'])) $authHeader = $headers['Authorization'];
	}
	$foundUserId = null;
	$foundUserName = null;
	if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $m2)) {
		$token = $m2[1];
		$user = verifySupabaseToken($token);
		if ($user && isset($user['id'])) {
			$foundUserId = $user['id'];
			$foundUserName = $user['email'] ?? ($user['user_metadata']['full_name'] ?? null);
			$player = ['id' => $foundUserId, 'name' => $foundUserName ?? 'supabase-user'];
		}
	}
	if (!$player) $player = ['id' => bin2hex(random_bytes(4)), 'name' => 'guest'];

	// If service key available, attempt to add player via Supabase
	if ($SUPABASE_SERVICE_KEY && $SUPABASE_URL && isValidUuid($roomId)) {
		// check room exists
		$q = supabaseRequest('GET', "rooms?id=eq." . $roomId, null, true);
		if (!$q || !is_array($q['body']) || count($q['body']) === 0) {
			http_response_code(404);
			echo json_encode(['error' => 'Room not found']);
			exit;
		}
		// prevent duplicate room_players for authenticated users
		if (isset($player['id'])) {
			$check = supabaseRequest('GET', "room_players?room_id=eq." . $roomId . "&user_id=eq." . $player['id'], null, true);
			if ($check && is_array($check['body']) && count($check['body']) > 0) {
				echo json_encode(['room' => $q['body'][0]]);
				exit;
			}
		}
		// insert room_player
		$rp = [
			'room_id' => $roomId,
			'user_id' => $player['id'],
			'player_side' => null,
			'is_ready' => false,
			'joined_at' => date('c')
		];
		supabaseRequest('POST', 'room_players', $rp, true);
		$fresh = supabaseRequest('GET', "rooms?id=eq." . $roomId, null, true);
		echo json_encode(['room' => $fresh['body'][0] ?? null]);
		exit;
	}

	// fallback file storage
	$rooms = readRooms($roomsFile);
	if (!isset($rooms[$roomId])) {
		http_response_code(404);
		echo json_encode(['error' => 'Room not found']);
		exit;
	}

	// prevent duplicates
	$exists = false;
	foreach ($rooms[$roomId]['players'] as $p) {
		if (isset($p['id']) && $p['id'] === $player['id']) { $exists = true; break; }
	}
	if (!$exists) $rooms[$roomId]['players'][] = $player;

	writeRooms($roomsFile, $rooms);
	echo json_encode(['room' => $rooms[$roomId]]);
	exit;
}

// GET /api/rooms/{id}
if ($method === 'GET' && preg_match('#^/api/rooms/([0-9a-fA-F\-]+?)$#', $uri, $m)) {
	$roomId = $m[1];
	if ($SUPABASE_SERVICE_KEY && $SUPABASE_URL && isValidUuid($roomId)) {
		$q = supabaseRequest('GET', "rooms?id=eq." . $roomId, null, true);
		if (!$q || !is_array($q['body']) || count($q['body']) === 0) {
			http_response_code(404);
			echo json_encode(['error' => 'Room not found']);
			exit;
		}
		echo json_encode($q['body'][0]);
		exit;
	}
	$rooms = readRooms($roomsFile);
	if (!isset($rooms[$roomId])) {
		http_response_code(404);
		echo json_encode(['error' => 'Room not found']);
		exit;
	}
	echo json_encode($rooms[$roomId]);
	exit;
}

// POST /api/matches -> accept match replay (from socket server)
if ($method === 'POST' && preg_match('#^/api/matches$#', $uri)) {
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	if (empty($body)) {
		http_response_code(400);
		echo json_encode(['error' => 'empty body']);
		exit;
	}

	// Basic validation: require players and moves arrays
	if (!isset($body['players']) || !is_array($body['players']) || count($body['players']) < 1) {
		http_response_code(400);
		echo json_encode(['error' => 'players array required']);
		exit;
	}
	if (!isset($body['moves']) || !is_array($body['moves']) || count($body['moves']) < 1) {
		http_response_code(400);
		echo json_encode(['error' => 'moves array required']);
		exit;
	}

	$storageDir = __DIR__ . '/../storage';
	if (!is_dir($storageDir)) mkdir($storageDir, 0755, true);
	$matchesFile = $storageDir . '/matches.json';
	if (!file_exists($matchesFile)) file_put_contents($matchesFile, json_encode([]));
	$raw = file_get_contents($matchesFile);
	$data = json_decode($raw, true) ?: [];

	$matchId = uuidv4();
	$entry = array_merge($body, ['id' => $matchId, 'received_at' => date('c')]);
	$data[$matchId] = $entry;
	file_put_contents($matchesFile, json_encode($data, JSON_PRETTY_PRINT));

	// Try to persist to Supabase (best-effort)
	if ($SUPABASE_SERVICE_KEY && $SUPABASE_URL) {
		try {
			// Extract player IDs from players array, respecting side assignment
			function extractPlayersByRole(array $players) {
				$result = ['X' => null, 'O' => null];
				foreach ($players as $p) {
					if (!is_array($p)) continue;
					$uid = $p['userId'] ?? $p['user_id'] ?? $p['id'] ?? null;
					$side = $p['side'] ?? null;
					
					if ($uid && $side) {
						// Player has explicit side assignment
						if ($side === 'X') $result['X'] = $uid;
						elseif ($side === 'O') $result['O'] = $uid;
					} elseif ($uid) {
						// Fallback: assign by order (first = X, second = O)
						if ($result['X'] === null) $result['X'] = $uid;
						elseif ($result['O'] === null) $result['O'] = $uid;
					}
				}
				return $result;
			}
			// Insert into matches table (attempt). The schema may require UUID player ids; only send UUIDs.
			$player_x = null; $player_o = null;
			if (!empty($body['players']) && is_array($body['players'])) {
				$playersByRole = extractPlayersByRole($body['players']);
				if ($playersByRole['X'] && isValidUuid($playersByRole['X'])) $player_x = $playersByRole['X'];
				if ($playersByRole['O'] && isValidUuid($playersByRole['O'])) $player_o = $playersByRole['O'];
			}

					$matchPayload = [
						'room_id' => (isset($body['roomId']) && isValidUuid($body['roomId'])) ? $body['roomId'] : null,
						'match_type' => $body['match_type'] ?? 'casual',
						'player_x_user_id' => $player_x,
						'player_o_user_id' => $player_o,
						'total_moves' => isset($body['moves']) ? count($body['moves']) : ($body['total_moves'] ?? 0),
						'final_board_state' => $body['final_board'] ?? null,
						'started_at' => $body['started_at'] ?? null,
						'ended_at' => $body['ended_at'] ?? null,
						'winner_user_id' => null,
						'result' => null,
						'win_condition' => $body['win_condition'] ?? null,
						'created_at' => date('c')
					];
					// map winner -> winner_user_id and result
					if (!empty($body['winner'])) {
						if (in_array($body['winner'], ['X','O'])) {
							if ($body['winner'] === 'X' && $player_x) {
								$matchPayload['winner_user_id'] = $player_x;
								$matchPayload['result'] = 'win_x';
							} elseif ($body['winner'] === 'O' && $player_o) {
								$matchPayload['winner_user_id'] = $player_o;
								$matchPayload['result'] = 'win_o';
							}
						} else {
							// winner might be a user id
							$matchPayload['winner_user_id'] = $body['winner'];
							// determine result side if possible
							if ($player_x && $player_x === $body['winner']) $matchPayload['result'] = 'win_x';
							elseif ($player_o && $player_o === $body['winner']) $matchPayload['result'] = 'win_o';
							else $matchPayload['result'] = 'win_x';
						}
					}
			$res = supabaseRequest('POST', 'matches', $matchPayload, true);
			// If created and we have moves, try to write moves linked to match id
					if ($res && is_array($res['body']) && count($res['body'])>0) {
						$created = $res['body'][0];
						$mid = $created['id'] ?? null;
						if ($mid && !empty($body['moves']) && is_array($body['moves'])) {
							foreach ($body['moves'] as $i => $mv) {
								$playerUid = null;
								if (!empty($mv['player_user_id'])) $playerUid = $mv['player_user_id'];
								elseif (!empty($mv['player_user'])) $playerUid = $mv['player_user'];
								else {
									// try to map by turn_player or player field
									if (!empty($mv['player']) && in_array($mv['player'], ['X','O'])) {
										$playerUid = ($mv['player'] === 'X') ? $player_x : $player_o;
									}
								}
								$mp = [
									'match_id' => $mid,
									'player_user_id' => $playerUid,
									'move_number' => $i+1,
									'position_x' => isset($mv['x']) ? $mv['x'] : ($mv['position_x'] ?? null),
									'position_y' => isset($mv['y']) ? $mv['y'] : ($mv['position_y'] ?? null),
									'time_taken' => $mv['time_taken'] ?? null,
									'created_at' => $mv['created_at'] ?? date('c')
								];
								supabaseRequest('POST', 'moves', $mp, true);
							}
						}
					} else {
						// Log Supabase insertion failure for debugging
						$err = [
							'time' => date('c'),
							'request' => $matchPayload,
							'result' => $res
						];
						$logFile = __DIR__ . '/../storage/supabase_errors.log';
						@file_put_contents($logFile, json_encode($err, JSON_PRETTY_PRINT) . "\n", FILE_APPEND);
					}
		} catch (Exception $e) {
			// ignore errors (we already saved file)
		}
	}

	http_response_code(201);
	echo json_encode(['ok' => true, 'id' => $matchId]);
	exit;
}

// POST /api/chat/send -> insert chat message (global/friends/room)
if ($method === 'POST' && preg_match('#^/api/chat/send$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['error' => 'Supabase service key not configured']);
		exit;
	}
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['error' => 'Unauthorized']);
		exit;
	}
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$content = isset($body['content']) ? trim($body['content']) : '';
	if ($content === '') {
		http_response_code(422);
		echo json_encode(['error' => 'Content is required']);
		exit;
	}
	$roomId = $body['room_id'] ?? null;
	$requestedChannel = isset($body['channel']) ? strtolower((string)$body['channel']) : null;
	$messageType = isset($body['message_type']) && in_array($body['message_type'], ['text','emote','system','sticker'], true)
		? $body['message_type']
		: 'text';
	$channelScope = $roomId ? 'room' : (in_array($requestedChannel, ['friends']) ? 'friends' : 'global');
	if ($channelScope === 'room') {
		if (!$roomId || !isValidUuid($roomId)) {
			http_response_code(422);
			echo json_encode(['error' => 'room_id is invalid']);
			exit;
		}
		if (!isUserInRoom($authUser['id'], $roomId)) {
			http_response_code(403);
			echo json_encode(['error' => 'You are not a member of this room']);
			exit;
		}
	} else {
		$roomId = null;
	}
	// Lightweight server-side rate limiting (1.5s per message)
	$recent = supabaseRequest('GET', "chat_messages?select=created_at&sender_user_id=eq." . $authUser['id'] . '&order=created_at.desc&limit=1', null, true);
	if ($recent && is_array($recent['body']) && count($recent['body']) > 0) {
		$last = $recent['body'][0];
		if (!empty($last['created_at'])) {
			$lastTs = strtotime($last['created_at']);
			if ($lastTs && (microtime(true) - $lastTs) < 1.5) {
				http_response_code(429);
				echo json_encode(['error' => 'Đạo hữu chậm lại một nhịp']);
				exit;
			}
		}
	}
	$cleanContent = preg_replace("/[\r\n]+/", ' ', $content);
	$cleanContent = trim($cleanContent);
	$wasTruncated = mb_strlen($cleanContent) > 300;
	if ($wasTruncated) {
		$cleanContent = mb_substr($cleanContent, 0, 300);
	}
	$payload = [
		'sender_user_id' => $authUser['id'],
		'room_id' => $roomId,
		'content' => $cleanContent,
		'message_type' => $messageType,
		'channel_scope' => $channelScope,
		'created_at' => date('c')
	];
	$insert = supabaseRequest('POST', 'chat_messages', $payload, true);
	if (!$insert || !in_array($insert['status'], [200, 201], true)) {
		http_response_code(500);
		echo json_encode(['error' => 'Failed to persist chat message']);
		exit;
	}
	$message = null;
	if (is_array($insert['body'])) {
		$message = $insert['body'][0] ?? $insert['body'];
	}
	if (!$message || !is_array($message)) {
		$message = $payload;
		$message['id'] = $insert['body']['id'] ?? null;
	}
	$profile = supabaseRequest('GET', 'profiles?user_id=eq.' . $authUser['id'] . '&select=display_name,username,avatar_url&limit=1', null, true);
	if ($profile && is_array($profile['body']) && count($profile['body']) > 0) {
		$message['sender_profile'] = $profile['body'][0];
	}
	if (isset($message['sender'])) {
		$message['sender_profile'] = $message['sender'];
		unset($message['sender']);
	}
	http_response_code(201);
	echo json_encode(['message' => $message, 'truncated' => $wasTruncated]);
	exit;
}

// GET /api/chat/history -> fetch chat feed
if ($method === 'GET' && preg_match('#^/api/chat/history$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['error' => 'Supabase service key not configured']);
		exit;
	}
	$channel = isset($_GET['channel']) ? strtolower((string)$_GET['channel']) : 'global';
	$roomId = $_GET['room_id'] ?? null;
	$limit = isset($_GET['limit']) ? max(1, min(50, intval($_GET['limit']))) : 20;
	$cursor = $_GET['cursor'] ?? null;
	[$authUser, $token] = getSupabaseAuthContext();
	$scope = $roomId ? 'room' : (in_array($channel, ['friends']) ? 'friends' : 'global');
	if ($scope === 'room') {
		if (!$roomId || !isValidUuid($roomId)) {
			http_response_code(422);
			echo json_encode(['error' => 'room_id is invalid']);
			exit;
		}
		if (!$authUser || !isUserInRoom($authUser['id'], $roomId)) {
			http_response_code(403);
			echo json_encode(['error' => 'Room access denied']);
			exit;
		}
	}
	if ($scope === 'friends' && !$authUser) {
		http_response_code(401);
		echo json_encode(['error' => 'Login required for friends channel']);
		exit;
	}
	$params = [
		'order' => 'created_at.desc',
		'limit' => $limit,
		'select' => 'id,sender_user_id,room_id,match_id,message_type,content,channel_scope,created_at,sender:profiles!chat_messages_sender_user_id_fkey(display_name,username,avatar_url)'
	];
	if ($scope === 'room') {
		$params['room_id'] = 'eq.' . $roomId;
	} else {
		$params['channel_scope'] = 'eq.' . $scope;
	}
	if ($cursor) {
		$params['created_at'] = 'lt.' . $cursor;
	}
	if ($scope === 'friends') {
		$friendIds = fetchFriendUserIds($authUser['id']);
		if (count($friendIds) === 0) {
			echo json_encode(['messages' => [], 'nextCursor' => null]);
			exit;
		}
		$params['sender_user_id'] = 'in.(' . implode(',', $friendIds) . ')';
	}
	$path = 'chat_messages?' . http_build_query($params);
	$res = supabaseRequest('GET', $path, null, true);
	if (!$res || $res['status'] !== 200 || !is_array($res['body'])) {
		http_response_code(500);
		echo json_encode(['error' => 'Failed to load chat history']);
		exit;
	}
	$messages = $res['body'];
	foreach ($messages as &$msg) {
		if (isset($msg['sender'])) {
			$msg['sender_profile'] = $msg['sender'];
			unset($msg['sender']);
		}
	}
	unset($msg);
	$nextCursor = null;
	if (count($messages) === $limit) {
		$last = end($messages);
		if ($last && isset($last['created_at'])) $nextCursor = $last['created_at'];
	}
	echo json_encode(['messages' => $messages, 'nextCursor' => $nextCursor]);
	exit;
}

// ============================================================================
// REPORT VIOLATION SYSTEM API ENDPOINTS
// ============================================================================

use App\Controllers\ReportController;
use App\Services\ReportService;
use App\Services\RuleEngineService;
use App\Services\AIAnalysisService;
use App\Services\BanService;
use App\Services\SupabaseClient;

/**
 * Helper function to create ReportController with dependencies
 */
function createReportController(): ReportController {
	global $SUPABASE_URL, $SUPABASE_SERVICE_KEY;
	
	$ruleEngine = new RuleEngineService();
	$aiService = new AIAnalysisService();
	$banService = new BanService();
	
	// Create Supabase client for database operations
	$supabase = null;
	if ($SUPABASE_URL && $SUPABASE_SERVICE_KEY) {
		$supabase = new SupabaseClient($SUPABASE_URL, $SUPABASE_SERVICE_KEY);
	}
	
	$reportService = new ReportService($ruleEngine, $aiService, $banService);
	
	// Inject Supabase client for report processing
	if ($supabase) {
		$reportService->setSupabase($supabase);
	}
	
	// Also inject into BanService
	if ($supabase) {
		// BanService doesn't have setSupabase yet, but has setDatabase
		// For now, skip - BanService uses in-memory or PDO
	}
	
	return new ReportController($reportService, $banService);
}

/**
 * Helper function to check if user is admin
 */
function isUserAdmin(string $userId): bool {
	global $SUPABASE_URL, $SUPABASE_SERVICE_KEY;
	if (!$SUPABASE_URL || !$SUPABASE_SERVICE_KEY) {
		return false;
	}
	// Query table 'admin' (not 'admins') - check is_active = true
	$res = supabaseRequest('GET', "admin?user_id=eq.$userId&is_active=eq.true&select=user_id&limit=1", null, true);
	return $res && is_array($res['body']) && count($res['body']) > 0;
}

// POST /api/reports -> Create a new report
// **Validates: Requirements 1.1, 1.5**
if ($method === 'POST' && preg_match('#^/api/reports$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để gửi báo cáo']]);
		exit;
	}
	
	// Rate limiting for report creation
	// **Validates: Non-functional requirements for rate limiting**
	$rateLimiter = createRateLimiter();
	$rateCheck = $rateLimiter->check($authUser['id'], 'report');
	if (!$rateCheck['allowed']) {
		http_response_code(429);
		echo json_encode([
			'success' => false,
			'error' => [
				'code' => 'RATE_LIMITED',
				'message' => $rateCheck['message'],
				'retry_after' => $rateCheck['retry_after'],
			],
		]);
		exit;
	}
	
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	
	// Validate required fields
	if (empty($body['type'])) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Loại báo cáo là bắt buộc']]);
		exit;
	}
	
	$validTypes = ['gian_lan_trong_tran', 'toxic', 'bug', 'khac'];
	if (!in_array($body['type'], $validTypes)) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Loại báo cáo không hợp lệ']]);
		exit;
	}
	
	// Validate description length
	if (!empty($body['description']) && strlen($body['description']) > 1000) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Mô tả không được vượt quá 1000 ký tự']]);
		exit;
	}
	
	// Build report payload for Supabase
	$reportPayload = [
		'reporter_id' => $authUser['id'],
		'type' => $body['type'],
		'status' => 'pending',
		'created_at' => date('c')
	];
	
	// Optional fields
	if (!empty($body['reported_user_id']) && isValidUuid($body['reported_user_id'])) {
		$reportPayload['reported_user_id'] = $body['reported_user_id'];
	}
	if (!empty($body['match_id']) && isValidUuid($body['match_id'])) {
		$reportPayload['match_id'] = $body['match_id'];
	}
	if (!empty($body['description'])) {
		$reportPayload['description'] = trim($body['description']);
	}
	
	// Insert into Supabase
	$result = supabaseRequest('POST', 'reports', $reportPayload, true);
	
	if (!$result || !in_array($result['status'], [200, 201])) {
		error_log('[POST /api/reports] Supabase insert failed: ' . json_encode($result));
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Không thể lưu báo cáo']]);
		exit;
	}
	
	// Record the request for rate limiting
	$rateLimiter->record($authUser['id'], 'report');
	
	// Get created report
	$createdReport = is_array($result['body']) && count($result['body']) > 0 ? $result['body'][0] : $result['body'];
	
	// ============================================================================
	// AUTO-PROCESSING: Trigger cheat detection for 'gian_lan_trong_tran' reports
	// ============================================================================
	if ($body['type'] === 'gian_lan_trong_tran' && !empty($createdReport['id'])) {
		try {
			$reportId = $createdReport['id'];
			$matchId = $createdReport['match_id'] ?? null;
			
			// Fetch match data if available
			$matchData = null;
			if ($matchId) {
				$matchResult = supabaseRequest('GET', "matches?id=eq.$matchId&select=*", null, true);
				if ($matchResult && $matchResult['status'] === 200 && is_array($matchResult['body']) && count($matchResult['body']) > 0) {
					$matchData = $matchResult['body'][0];
					
					// Get player IDs for mapping
					$playerX = $matchData['player_x_user_id'] ?? null;
					$playerO = $matchData['player_o_user_id'] ?? null;
					
					// Fetch moves for this match
					$movesResult = supabaseRequest('GET', "moves?match_id=eq.$matchId&select=*&order=move_number.asc", null, true);
					if ($movesResult && $movesResult['status'] === 200 && is_array($movesResult['body'])) {
						// Transform moves to include 'player' field (X/O) for RuleEngineService
						$transformedMoves = [];
						foreach ($movesResult['body'] as $move) {
							$playerUserId = $move['player_user_id'] ?? null;
							// Map player_user_id to X/O
							if ($playerUserId === $playerX) {
								$move['player'] = 'X';
							} elseif ($playerUserId === $playerO) {
								$move['player'] = 'O';
							}
							// Convert created_at to timestamp for timing analysis
							if (!empty($move['created_at'])) {
								$move['timestamp'] = strtotime($move['created_at']) * 1000;
							}
							$transformedMoves[] = $move;
						}
						$matchData['moves'] = $transformedMoves;
					}
					
					// Build board_state from moves for impossible win detection
					$boardState = [];
					foreach ($matchData['moves'] ?? [] as $move) {
						$x = $move['position_x'] ?? null;
						$y = $move['position_y'] ?? null;
						$player = $move['player'] ?? null;
						if ($x !== null && $y !== null && $player !== null) {
							$boardState["{$x}_{$y}"] = $player;
						}
					}
					$matchData['board_state'] = $boardState;
				}
			}
			
			// Run auto-processing if we have match data
			if ($matchData && !empty($matchData['moves'])) {
				// Create services for processing
				$ruleEngine = new RuleEngineService();
				$aiService = new AIAnalysisService();
				$banService = new BanService();
				$reportService = new ReportService($ruleEngine, $aiService, $banService);
				
				// Create Report model from data
				$report = new \App\Models\Report();
				$report->fill($createdReport);
				
				// Process the report with match data
				$processedReport = $reportService->processCheatReportWithData($report, $matchData);
				
				// Update report in Supabase with analysis results
				$updatePayload = [
					'status' => $processedReport->getAttribute('status'),
					'rule_analysis' => $processedReport->getAttribute('rule_analysis'),
					'reason_result' => $processedReport->getAttribute('reason_result'),
					'ai_analysis' => $processedReport->getAttribute('ai_analysis'),
					'ai_summary_player' => $processedReport->getAttribute('ai_summary_player'),
					'ai_details_admin' => $processedReport->getAttribute('ai_details_admin'),
					'processed_at' => $processedReport->getAttribute('processed_at'),
				];
				
				// Encode JSON fields
				if (is_array($updatePayload['rule_analysis'])) {
					$updatePayload['rule_analysis'] = json_encode($updatePayload['rule_analysis']);
				}
				if (is_array($updatePayload['ai_analysis'])) {
					$updatePayload['ai_analysis'] = json_encode($updatePayload['ai_analysis']);
				}
				
				supabaseRequest('PATCH', "reports?id=eq.$reportId", $updatePayload, true);
				
				// If auto_flagged, apply ban
				if ($processedReport->getAttribute('status') === 'auto_flagged') {
					$reportedUserId = $createdReport['reported_user_id'] ?? null;
					if ($reportedUserId) {
						$reasonResult = $processedReport->getAttribute('reason_result') ?? 'Phát hiện gian lận tự động';
						$aiDetails = $processedReport->getAttribute('ai_details_admin') ?? 'AI không có chi tiết';
						$aiSummary = $processedReport->getAttribute('ai_summary_player') ?? 'Tài khoản bị cấm do gian lận';
						
						// Apply ban
						$ban = $banService->applyBanForAutoFlagged(
							$reportedUserId,
							$reportId,
							$reasonResult,
							$aiDetails
						);
						
						// Save ban to Supabase
						if ($ban) {
							$banPayload = [
								'id' => $ban->getAttribute('id'),
								'user_id' => $ban->getAttribute('user_id'),
								'report_id' => $ban->getAttribute('report_id'),
								'ban_type' => $ban->getAttribute('ban_type'),
								'reason' => $ban->getAttribute('reason'),
								'expires_at' => $ban->getAttribute('expires_at'),
								'is_active' => true,
								'created_at' => date('c'),
							];
							supabaseRequest('POST', 'user_bans', $banPayload, true);
							
							// Send notification (store in notifications table if exists)
							$notificationPayload = [
								'user_id' => $reportedUserId,
								'type' => 'ban_notification',
								'title' => 'Tài khoản bị cấm',
								'message' => $aiSummary,
								'data' => json_encode([
									'ban_id' => $ban->getAttribute('id'),
									'ban_type' => $ban->getAttribute('ban_type'),
									'expires_at' => $ban->getAttribute('expires_at'),
								]),
								'created_at' => date('c'),
							];
							// Try to insert notification (ignore if table doesn't exist)
							@supabaseRequest('POST', 'notifications', $notificationPayload, true);
						}
					}
				}
				
				// Update createdReport with processed data for response
				$createdReport['status'] = $processedReport->getAttribute('status');
				$createdReport['processed_at'] = $processedReport->getAttribute('processed_at');
			} else {
				// No match data available - escalate for manual review
				$updatePayload = [
					'status' => 'escalated',
					'reason_result' => $matchId 
						? 'Không tìm thấy dữ liệu nước đi của trận đấu để phân tích tự động. Cần admin xem xét thủ công.'
						: 'Báo cáo không có thông tin trận đấu (match_id). Cần admin xem xét thủ công.',
					'processed_at' => date('c'),
				];
				supabaseRequest('PATCH', "reports?id=eq.$reportId", $updatePayload, true);
				$createdReport['status'] = 'escalated';
				$createdReport['reason_result'] = $updatePayload['reason_result'];
			}
		} catch (Exception $e) {
			// Log error but don't fail the report creation
			error_log('[POST /api/reports] Auto-processing failed: ' . $e->getMessage());
		}
	}
	// ============================================================================
	// END AUTO-PROCESSING
	// ============================================================================
	
	http_response_code(201);
	echo json_encode([
		'success' => true,
		'message' => 'Đã gửi report, hệ thống sẽ kiểm tra',
		'data' => $createdReport
	]);
	exit;
}

// GET /api/reports -> List reports (admin only)
// **Validates: Requirements 9.1**
if ($method === 'GET' && preg_match('#^/api/reports$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem báo cáo']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem danh sách báo cáo']]);
		exit;
	}
	
	// Build query with filters
	$queryParams = [];
	$queryParams['select'] = '*,reporter:profiles!reporter_id(display_name,username),reported_user:profiles!reported_user_id(display_name,username)';
	$queryParams['order'] = 'created_at.desc';
	
	// Apply filters
	if (!empty($_GET['status'])) {
		$queryParams['status'] = 'eq.' . $_GET['status'];
	}
	if (!empty($_GET['type'])) {
		$queryParams['type'] = 'eq.' . $_GET['type'];
	}
	
	// Pagination
	$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
	$perPage = isset($_GET['per_page']) ? min(100, max(1, (int)$_GET['per_page'])) : 20;
	$offset = ($page - 1) * $perPage;
	$queryParams['limit'] = $perPage;
	$queryParams['offset'] = $offset;
	
	$path = 'reports?' . http_build_query($queryParams);
	$result = supabaseRequest('GET', $path, null, true);
	
	if (!$result || $result['status'] !== 200) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Không thể lấy danh sách báo cáo']]);
		exit;
	}
	
	// Get total count for pagination
	$countResult = supabaseRequest('GET', 'reports?select=id', null, true);
	$total = is_array($countResult['body']) ? count($countResult['body']) : 0;
	
	echo json_encode([
		'success' => true,
		'data' => $result['body'] ?? [],
		'meta' => [
			'total' => $total,
			'page' => $page,
			'per_page' => $perPage,
			'total_pages' => ceil($total / $perPage)
		]
	]);
	exit;
}

// GET /api/reports/{id} -> Get report detail (admin only)
// **Validates: Requirements 9.2**
if ($method === 'GET' && preg_match('#^/api/reports/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem chi tiết báo cáo']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem chi tiết báo cáo']]);
		exit;
	}
	
	$reportId = $matches[1];
	
	// Fetch report with related data from Supabase
	$select = '*,reporter:profiles!reporter_id(display_name,username,avatar_url),reported_user:profiles!reported_user_id(display_name,username,avatar_url)';
	$result = supabaseRequest('GET', "reports?id=eq.$reportId&select=$select", null, true);
	
	if (!$result || $result['status'] !== 200 || !is_array($result['body']) || count($result['body']) === 0) {
		http_response_code(404);
		echo json_encode(['success' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Không tìm thấy báo cáo']]);
		exit;
	}
	
	$report = $result['body'][0];
	
	// Fetch match data if available
	if (!empty($report['match_id'])) {
		$matchResult = supabaseRequest('GET', "matches?id=eq.{$report['match_id']}&select=*", null, true);
		if ($matchResult && $matchResult['status'] === 200 && is_array($matchResult['body']) && count($matchResult['body']) > 0) {
			$report['match'] = $matchResult['body'][0];
		}
	}
	
	echo json_encode(['success' => true, 'data' => $report]);
	exit;
}

// POST /api/reports/{id}/reprocess -> Trigger analysis for existing report (admin only)
if ($method === 'POST' && preg_match('#^/api/reports/([0-9a-fA-F\-]+)/reprocess$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser || !isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền']]);
		exit;
	}
	
	$reportId = $matches[1];
	
	// Fetch report
	$reportResult = supabaseRequest('GET', "reports?id=eq.$reportId&select=*", null, true);
	if (!$reportResult || $reportResult['status'] !== 200 || empty($reportResult['body'])) {
		http_response_code(404);
		echo json_encode(['success' => false, 'error' => ['code' => 'NOT_FOUND', 'message' => 'Không tìm thấy báo cáo']]);
		exit;
	}
	
	$report = $reportResult['body'][0];
	$matchId = $report['match_id'] ?? null;
	
	if (!$matchId) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'NO_MATCH', 'message' => 'Báo cáo không có match_id, không thể phân tích tự động']]);
		exit;
	}
	
	// Fetch match data
	$matchResult = supabaseRequest('GET', "matches?id=eq.$matchId&select=*", null, true);
	if (!$matchResult || $matchResult['status'] !== 200 || empty($matchResult['body'])) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'NO_MATCH_DATA', 'message' => 'Không tìm thấy dữ liệu trận đấu']]);
		exit;
	}
	
	$matchData = $matchResult['body'][0];
	$playerX = $matchData['player_x_user_id'] ?? null;
	$playerO = $matchData['player_o_user_id'] ?? null;
	
	// Fetch moves
	$movesResult = supabaseRequest('GET', "moves?match_id=eq.$matchId&select=*&order=move_number.asc", null, true);
	$transformedMoves = [];
	if ($movesResult && $movesResult['status'] === 200 && is_array($movesResult['body'])) {
		foreach ($movesResult['body'] as $move) {
			$playerUserId = $move['player_user_id'] ?? null;
			if ($playerUserId === $playerX) {
				$move['player'] = 'X';
			} elseif ($playerUserId === $playerO) {
				$move['player'] = 'O';
			}
			if (!empty($move['created_at'])) {
				$move['timestamp'] = strtotime($move['created_at']) * 1000;
			}
			$transformedMoves[] = $move;
		}
	}
	$matchData['moves'] = $transformedMoves;
	
	// Build board_state
	$boardState = [];
	foreach ($matchData['moves'] as $move) {
		$x = $move['position_x'] ?? null;
		$y = $move['position_y'] ?? null;
		$player = $move['player'] ?? null;
		if ($x !== null && $y !== null && $player !== null) {
			$boardState["{$x}_{$y}"] = $player;
		}
	}
	$matchData['board_state'] = $boardState;
	
	if (empty($matchData['moves'])) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'NO_MOVES', 'message' => 'Trận đấu không có dữ liệu nước đi']]);
		exit;
	}
	
	// Process the report
	$ruleEngine = new RuleEngineService();
	$aiService = new AIAnalysisService();
	$banService = new BanService();
	$reportService = new ReportService($ruleEngine, $aiService, $banService);
	
	$reportModel = new \App\Models\Report();
	$reportModel->fill($report);
	
	$processedReport = $reportService->processCheatReportWithData($reportModel, $matchData);
	
	// Update report in Supabase
	$updatePayload = [
		'status' => $processedReport->getAttribute('status'),
		'rule_analysis' => $processedReport->getAttribute('rule_analysis'),
		'reason_result' => $processedReport->getAttribute('reason_result'),
		'ai_analysis' => $processedReport->getAttribute('ai_analysis'),
		'ai_summary_player' => $processedReport->getAttribute('ai_summary_player'),
		'ai_details_admin' => $processedReport->getAttribute('ai_details_admin'),
		'processed_at' => $processedReport->getAttribute('processed_at'),
	];
	
	if (is_array($updatePayload['rule_analysis'])) {
		$updatePayload['rule_analysis'] = json_encode($updatePayload['rule_analysis']);
	}
	if (is_array($updatePayload['ai_analysis'])) {
		$updatePayload['ai_analysis'] = json_encode($updatePayload['ai_analysis']);
	}
	
	supabaseRequest('PATCH', "reports?id=eq.$reportId", $updatePayload, true);
	
	echo json_encode([
		'success' => true,
		'message' => 'Đã phân tích lại báo cáo',
		'data' => [
			'status' => $processedReport->getAttribute('status'),
			'reason_result' => $processedReport->getAttribute('reason_result'),
			'ai_summary_player' => $processedReport->getAttribute('ai_summary_player'),
		]
	]);
	exit;
}

// PUT /api/reports/{id} -> Update report (admin only)
// **Validates: Requirements 9.3, 9.4**
if ($method === 'PUT' && preg_match('#^/api/reports/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để cập nhật báo cáo']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền cập nhật báo cáo']]);
		exit;
	}
	
	$reportId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createReportController();
	$response = $controller->update($reportId, $body, $authUser['id']);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// ============================================================================
// APPEAL SYSTEM API ENDPOINTS
// ============================================================================

use App\Controllers\AppealController;
use App\Services\AppealService;

/**
 * Helper function to create AppealController with dependencies
 */
function createAppealController(): AppealController {
	$banService = new BanService();
	$appealService = new AppealService($banService);
	return new AppealController($appealService);
}

// POST /api/appeals -> Create a new appeal
// **Validates: Requirements 7.1**
if ($method === 'POST' && preg_match('#^/api/appeals$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để gửi khiếu nại']]);
		exit;
	}
	
	// Rate limiting for appeal creation (more lenient than reports)
	// **Validates: Non-functional requirements for rate limiting**
	$rateLimiter = createRateLimiter();
	$rateCheck = $rateLimiter->check($authUser['id'], 'appeal', 3, 10); // 3 per hour, 10 per day
	if (!$rateCheck['allowed']) {
		http_response_code(429);
		echo json_encode([
			'success' => false,
			'error' => [
				'code' => 'RATE_LIMITED',
				'message' => $rateCheck['message'],
				'retry_after' => $rateCheck['retry_after'],
			],
		]);
		exit;
	}
	
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createAppealController();
	$response = $controller->store($body, $authUser['id']);
	
	// Record the request for rate limiting if successful
	if ($response['status'] === 201) {
		$rateLimiter->record($authUser['id'], 'appeal');
	}
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/appeals -> List appeals (admin only)
// **Validates: Requirements 9.5**
if ($method === 'GET' && preg_match('#^/api/appeals$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem khiếu nại']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem danh sách khiếu nại']]);
		exit;
	}
	
	$controller = createAppealController();
	$response = $controller->index($_GET);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/appeals/{id} -> Get appeal detail (admin only)
// **Validates: Requirements 9.5**
if ($method === 'GET' && preg_match('#^/api/appeals/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem chi tiết khiếu nại']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem chi tiết khiếu nại']]);
		exit;
	}
	
	$appealId = $matches[1];
	$controller = createAppealController();
	$response = $controller->show($appealId);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// PUT /api/appeals/{id} -> Process appeal (admin only)
// **Validates: Requirements 7.5**
if ($method === 'PUT' && preg_match('#^/api/appeals/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xử lý khiếu nại']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xử lý khiếu nại']]);
		exit;
	}
	
	$appealId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createAppealController();
	$response = $controller->update($appealId, $body, $authUser['id']);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// ============================================================================
// END APPEAL SYSTEM API ENDPOINTS
// ============================================================================

// ============================================================================
// BAN SYSTEM API ENDPOINTS
// ============================================================================

use App\Controllers\BanController;
use App\Middleware\RateLimiter;
use App\Middleware\AdminAuthorization;

/**
 * Helper function to create BanController with dependencies
 */
function createBanController(): BanController {
	$banService = new BanService();
	return new BanController($banService);
}

/**
 * Helper function to create RateLimiter middleware
 */
function createRateLimiter(): RateLimiter {
	return new RateLimiter();
}

/**
 * Helper function to create AdminAuthorization middleware
 */
function createAdminAuthorization(): AdminAuthorization {
	global $SUPABASE_URL, $SUPABASE_SERVICE_KEY;
	return new AdminAuthorization($SUPABASE_URL, $SUPABASE_SERVICE_KEY);
}

// GET /api/bans/status - Check current user's ban status
// **Validates: Requirements 6.3**
if ($method === 'GET' && preg_match('#^/api/bans/status$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để kiểm tra trạng thái ban']]);
		exit;
	}
	
	$controller = createBanController();
	$response = $controller->status($authUser['id']);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/admin/bans - Create a new ban (admin only)
// **Validates: Requirements 6.1, 6.2**
if ($method === 'POST' && preg_match('#^/api/admin/bans$#', $uri)) {
	error_log("[POST /api/admin/bans] Endpoint hit!");
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser || !isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền']]);
		exit;
	}
	
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	
	// Validate required fields
	if (empty($body['user_id']) || !isValidUuid($body['user_id'])) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'user_id là bắt buộc']]);
		exit;
	}
	
	$banType = $body['ban_type'] ?? 'temporary';
	if (!in_array($banType, ['warning', 'temporary', 'permanent'])) {
		http_response_code(422);
		echo json_encode(['success' => false, 'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'ban_type không hợp lệ']]);
		exit;
	}
	
	$reason = $body['reason'] ?? 'Vi phạm quy định';
	$durationDays = isset($body['duration_days']) ? (int)$body['duration_days'] : 7;
	
	// Calculate expires_at for temporary bans
	$expiresAt = null;
	if ($banType === 'temporary') {
		$expiresAt = date('c', strtotime("+{$durationDays} days"));
	}
	
	// Create ban record in Supabase
	$banPayload = [
		'user_id' => $body['user_id'],
		'report_id' => $body['report_id'] ?? null,
		'ban_type' => $banType,
		'reason' => $reason,
		'expires_at' => $expiresAt,
		'is_active' => true,
		'created_at' => date('c'),
	];
	
	$result = supabaseRequest('POST', 'user_bans', $banPayload, true);
	
	if (!$result || !in_array($result['status'], [200, 201])) {
		error_log('[POST /api/admin/bans] Supabase insert failed: ' . json_encode($result));
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Không thể tạo ban']]);
		exit;
	}
	
	$createdBan = is_array($result['body']) && count($result['body']) > 0 ? $result['body'][0] : $result['body'];
	
	http_response_code(201);
	echo json_encode([
		'success' => true,
		'message' => 'Đã áp dụng hình phạt',
		'data' => $createdBan
	]);
	exit;
}

// GET /api/admin/bans - List all bans (admin only)
// **Validates: Requirements 9.1**
if ($method === 'GET' && preg_match('#^/api/admin/bans$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem danh sách ban']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem danh sách ban']]);
		exit;
	}
	
	$controller = createBanController();
	$response = $controller->index($_GET);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/admin/bans/{id} - Get ban detail (admin only)
// **Validates: Requirements 9.1**
if ($method === 'GET' && preg_match('#^/api/admin/bans/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem chi tiết ban']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem chi tiết ban']]);
		exit;
	}
	
	$banId = $matches[1];
	$controller = createBanController();
	$response = $controller->show($banId);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/admin/bans/{id}/lift - Lift a ban (admin only)
// **Validates: Requirements 7.5**
if ($method === 'POST' && preg_match('#^/api/admin/bans/([0-9a-fA-F\-]+)/lift$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để gỡ ban']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền gỡ ban']]);
		exit;
	}
	
	$banId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createBanController();
	$response = $controller->lift($banId, $body, $authUser['id']);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/admin/bans/user/{userId} - Get ban history for a user (admin only)
// **Validates: Requirements 9.1**
if ($method === 'GET' && preg_match('#^/api/admin/bans/user/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem lịch sử ban']]);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => ['code' => 'FORBIDDEN', 'message' => 'Chỉ admin mới có quyền xem lịch sử ban']]);
		exit;
	}
	
	$userId = $matches[1];
	$controller = createBanController();
	$response = $controller->userHistory($userId);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// ============================================================================
// END BAN SYSTEM API ENDPOINTS
// ============================================================================

// ============================================================================
// RANKED BO3 SERIES API ENDPOINTS
// ============================================================================

use App\Controllers\SeriesController;
use App\Services\SeriesManagerService;
use App\Services\ScoringEngineService;
use App\Controllers\PaymentController;
use App\Controllers\CurrencyController;
use App\Services\PaymentService;
use App\Services\SubscriptionService;
use App\Services\CurrencyService;

/**
 * Helper function to create SeriesController with dependencies
 */
function createSeriesController(): SeriesController {
	$scoringEngine = new ScoringEngineService();
	
	// Set profile updater using Supabase REST API
	$scoringEngine->setProfileUpdater(function($playerId, $mpChange, $coins, $exp) {
		// Get current profile
		$result = supabaseRequest('GET', "profiles?user_id=eq.{$playerId}&select=mindpoint,current_rank,coins,exp");
		if (!$result || $result['status'] !== 200 || empty($result['body'])) {
			error_log("[ScoringEngine] Failed to get profile for {$playerId}");
			return null;
		}
		
		$profile = $result['body'][0];
		$oldMP = (int)($profile['mindpoint'] ?? 0);
		$oldRank = $profile['current_rank'] ?? 'vo_danh';
		$oldCoins = (int)($profile['coins'] ?? 0);
		$oldExp = (int)($profile['exp'] ?? 0);
		
		// Calculate new values
		$newMP = max(0, $oldMP + $mpChange);
		$newRank = getRankFromMP($newMP);
		$newCoins = $oldCoins + $coins;
		$newExp = $oldExp + $exp;
		
		// Update profile via Supabase
		$updateResult = supabaseRequest('PATCH', "profiles?user_id=eq.{$playerId}", [
			'mindpoint' => $newMP,
			'current_rank' => $newRank,
			'coins' => $newCoins,
			'exp' => $newExp,
			'updated_at' => date('c')
		]);
		
		if (!$updateResult || $updateResult['status'] >= 300) {
			error_log("[ScoringEngine] Failed to update profile for {$playerId}: " . json_encode($updateResult));
			return null;
		}
		
		error_log("[ScoringEngine] Updated profile {$playerId}: MP {$oldMP} -> {$newMP}, Rank {$oldRank} -> {$newRank}");
		
		// Return rank change if changed
		if ($oldRank !== $newRank) {
			return [
				'playerId' => $playerId,
				'oldRank' => $oldRank,
				'newRank' => $newRank,
				'newMP' => $newMP,
			];
		}
		return null;
	});
	
	$seriesManager = new SeriesManagerService();
	$seriesManager->setScoringEngine($scoringEngine);
	return new SeriesController($seriesManager);
}

/**
 * Get rank from MP value (helper for profile updater)
 */
function getRankFromMP(int $mp): string {
	$thresholds = [
		'truyen_thuyet' => 5500,
		'ky_thanh' => 3000,
		'cao_ky' => 1500,
		'ky_lao' => 600,
		'hoc_ky' => 200,
		'tan_ky' => 50,
		'vo_danh' => 0,
	];
	foreach ($thresholds as $rank => $threshold) {
		if ($mp >= $threshold) {
			return $rank;
		}
	}
	return 'vo_danh';
}

/**
 * Helper function to create PaymentController with dependencies
 */
function createPaymentController(): PaymentController {
	$subscriptionService = new SubscriptionService();
	
	// Get database connection
	$db = null;
	try {
		$host = getenv('DB_HOST') ?: '127.0.0.1';
		$port = getenv('DB_PORT') ?: 3306;
		$database = getenv('DB_DATABASE') ?: 'mindpoint';
		$username = getenv('DB_USERNAME') ?: 'root';
		$password = getenv('DB_PASSWORD') ?: '';
		
		$dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
		$db = new PDO($dsn, $username, $password, [
			PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
			PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
		]);
	} catch (Exception $e) {
		error_log("Database connection failed: " . $e->getMessage());
	}
	
	$paymentService = new PaymentService(
		getenv('VNPAY_TMN_CODE') ?: null,
		getenv('VNPAY_HASH_SECRET') ?: null,
		getenv('VNPAY_RETURN_URL') ?: null,
		getenv('VNPAY_IPN_URL') ?: null,
		getenv('VNPAY_GATEWAY_URL') ?: null,
		$db
	);
	return new PaymentController($paymentService, $subscriptionService);
}

/**
 * Helper function to create CurrencyController with dependencies
 */
function createCurrencyController(): CurrencyController {
	$currencyService = new CurrencyService();
	return new CurrencyController($currencyService);
}

// POST /api/series/create -> Create a new ranked BO3 series
// **Validates: Requirements 1.1**
if ($method === 'POST' && preg_match('#^/api/series/create$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để tạo series']]);
		exit;
	}
	
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createSeriesController();
	$response = $controller->create($body);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/series/{id} -> Get series state
// **Validates: Requirements 9.3**
if ($method === 'GET' && preg_match('#^/api/series/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để xem series']]);
		exit;
	}
	
	$seriesId = $matches[1];
	$controller = createSeriesController();
	$response = $controller->show($seriesId);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/series/{id}/end-game -> End a game within the series
// **Validates: Requirements 2.1**
if ($method === 'POST' && preg_match('#^/api/series/([0-9a-fA-F\-]+)/end-game$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để cập nhật series']]);
		exit;
	}
	
	$seriesId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createSeriesController();
	$response = $controller->endGame($seriesId, $body);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/series/{id}/forfeit -> Forfeit current game
// **Validates: Requirements 7.3**
if ($method === 'POST' && preg_match('#^/api/series/([0-9a-fA-F\-]+)/forfeit$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để forfeit game']]);
		exit;
	}
	
	$seriesId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createSeriesController();
	$response = $controller->forfeit($seriesId, $body);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/series/{id}/abandon -> Abandon entire series
// **Validates: Requirements 7.4**
if ($method === 'POST' && preg_match('#^/api/series/([0-9a-fA-F\-]+)/abandon$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để abandon series']]);
		exit;
	}
	
	$seriesId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createSeriesController();
	$response = $controller->abandon($seriesId, $body);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/series/{id}/rematch -> Request rematch after series ends
// **Validates: Requirements 10.1, 10.2**
if ($method === 'POST' && preg_match('#^/api/series/([0-9a-fA-F\-]+)/rematch$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => ['code' => 'SERVER_ERROR', 'message' => 'Supabase service key not configured']]);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Đăng nhập để yêu cầu rematch']]);
		exit;
	}
	
	$seriesId = $matches[1];
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createSeriesController();
	$response = $controller->rematch($seriesId, $body);
	
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// ============================================================================
// END RANKED BO3 SERIES API ENDPOINTS
// ============================================================================

// ============================================================================
// PAYMENT API ENDPOINTS (VNPay-style demo)
// ============================================================================

// POST /api/payment/create -> tao lien ket thanh toan
if ($method === 'POST' && preg_match('#^/api/payment/create$#', $uri)) {
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Vui long dang nhap']]);
		exit;
	}
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createPaymentController();
	$response = $controller->create($body, $authUser['id']);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST/GET /api/payment/webhook -> nhan IPN/return
if (($method === 'POST' || $method === 'GET') && preg_match('#^/api/payment/webhook$#', $uri)) {
	$params = $method === 'POST'
		? (json_decode(file_get_contents('php://input'), true) ?? $_POST)
		: $_GET;
	$controller = createPaymentController();
	$response = $controller->webhook($params);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/payment/status/{txnRef}
if ($method === 'GET' && preg_match('#^/api/payment/status/([A-Za-z0-9]+)$#', $uri, $matches)) {
	$txnRef = $matches[1];
	$controller = createPaymentController();
	$response = $controller->status($txnRef);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /payment/return -> trang thong bao ket qua VNPay
if ($method === 'GET' && preg_match('#^/payment/return$#', $uri)) {
	$params = $_GET;
	$controller = createPaymentController();
	// Controller se verify + update sub va redirect ve frontend #payment-result
	$controller->returnPage($params);
	exit;
}

// ============================================================================
// END PAYMENT API ENDPOINTS
// ============================================================================

// ============================================================================
// CURRENCY API ENDPOINTS (Coin/Gem Purchase)
// ============================================================================

// GET /api/currency/packages -> get available packages
if ($method === 'GET' && preg_match('#^/api/currency/packages$#', $uri)) {
	$controller = createCurrencyController();
	$response = $controller->getPackages($_GET);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/currency/purchase -> create purchase (VNPay)
if ($method === 'POST' && preg_match('#^/api/currency/purchase$#', $uri)) {
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Vui long dang nhap']]);
		exit;
	}
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createCurrencyController();
	$response = $controller->createPurchase($body, $authUser['id']);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST/GET /api/currency/webhook -> payment callback
if (($method === 'POST' || $method === 'GET') && preg_match('#^/api/currency/webhook$#', $uri)) {
	$params = $method === 'POST'
		? (json_decode(file_get_contents('php://input'), true) ?? $_POST)
		: $_GET;
	$controller = createCurrencyController();
	$response = $controller->webhook($params);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/currency/status/{txnRef}
if ($method === 'GET' && preg_match('#^/api/currency/status/([A-Za-z0-9]+)$#', $uri, $matches)) {
	$txnRef = $matches[1];
	$controller = createCurrencyController();
	$response = $controller->getStatus($txnRef);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/currency/history -> user purchase history
if ($method === 'GET' && preg_match('#^/api/currency/history$#', $uri)) {
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Vui long dang nhap']]);
		exit;
	}
	$controller = createCurrencyController();
	$response = $controller->getHistory($authUser['id'], $_GET);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /api/currency/balance -> user balance
if ($method === 'GET' && preg_match('#^/api/currency/balance$#', $uri)) {
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Vui long dang nhap']]);
		exit;
	}
	$controller = createCurrencyController();
	$response = $controller->getBalance($authUser['id']);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// POST /api/currency/test -> test purchase (dev only)
if ($method === 'POST' && preg_match('#^/api/currency/test$#', $uri)) {
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => ['code' => 'UNAUTHORIZED', 'message' => 'Vui long dang nhap']]);
		exit;
	}
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$controller = createCurrencyController();
	$response = $controller->testPurchase($body, $authUser['id']);
	http_response_code($response['status']);
	unset($response['status']);
	echo json_encode($response);
	exit;
}

// GET /currency-return -> VNPay return redirect
if ($method === 'GET' && preg_match('#^/currency-return$#', $uri)) {
	$params = $_GET;
	$controller = createCurrencyController();
	$controller->returnPage($params);
	exit;
}

// ============================================================================
// END CURRENCY API ENDPOINTS
// ============================================================================

// ============================================================================
// NOTIFICATION INBOX API ENDPOINTS
// ============================================================================

// Notification helper functions defined below

/**
 * Notification helper functions using supabaseRequest directly
 */

function notificationGetInbox(string $userId, int $page = 1, int $limit = 20): array {
	$offset = ($page - 1) * $limit;
	
	// Get user notifications with notification details using join
	$select = 'id,notification_id,user_id,is_read,read_at,created_at,admin_notifications!inner(id,admin_id,title,content,is_broadcast,created_at)';
	$params = http_build_query([
		'select' => $select,
		'user_id' => 'eq.' . $userId,
		'deleted_at' => 'is.null',
		'order' => 'created_at.desc',
		'offset' => $offset,
		'limit' => $limit
	]);
	
	$result = supabaseRequest('GET', "user_admin_notifications?$params", null, true);
	$items = ($result && $result['status'] === 200) ? ($result['body'] ?? []) : [];
	
	// Get total count
	$countParams = http_build_query([
		'select' => 'id',
		'user_id' => 'eq.' . $userId,
		'deleted_at' => 'is.null'
	]);
	$countResult = supabaseRequest('GET', "user_admin_notifications?$countParams", null, true);
	$total = ($countResult && is_array($countResult['body'])) ? count($countResult['body']) : count($items);
	
	// Format response
	$notifications = array_map(function ($item) {
		$notification = $item['admin_notifications'] ?? [];
		$adminId = $notification['admin_id'] ?? '';
		$senderName = notificationGetAdminEmail($adminId);
		$content = $notification['content'] ?? '';
		return [
			'id' => $item['notification_id'],
			'user_notification_id' => $item['id'],
			'title' => $notification['title'] ?? '',
			'content_preview' => strlen($content) > 100 ? substr(strip_tags($content), 0, 100) . '...' : strip_tags($content),
			'sender_name' => $senderName,
			'is_read' => $item['is_read'] ?? false,
			'read_at' => $item['read_at'],
			'created_at' => $notification['created_at'] ?? $item['created_at'],
			'is_broadcast' => $notification['is_broadcast'] ?? false
		];
	}, $items);
	
	return [
		'success' => true,
		'notifications' => $notifications,
		'pagination' => [
			'page' => $page,
			'limit' => $limit,
			'total' => $total,
			'total_pages' => (int)ceil($total / $limit)
		]
	];
}

function notificationGetDetail(string $userId, string $notificationId): ?array {
	// Include gift_data and gift_claimed columns
	$select = 'id,notification_id,user_id,is_read,read_at,created_at,gift_claimed,gift_claimed_at,admin_notifications!inner(id,admin_id,title,content,is_broadcast,created_at,gift_data)';
	$params = http_build_query([
		'select' => $select,
		'user_id' => 'eq.' . $userId,
		'notification_id' => 'eq.' . $notificationId,
		'deleted_at' => 'is.null',
		'limit' => 1
	]);
	
	$result = supabaseRequest('GET', "user_admin_notifications?$params", null, true);
	if (!$result || $result['status'] !== 200 || !is_array($result['body']) || count($result['body']) === 0) {
		return null;
	}
	
	$item = $result['body'][0];
	$notification = $item['admin_notifications'] ?? [];
	
	// Auto mark as read
	if (!($item['is_read'] ?? false)) {
		notificationMarkAsRead($userId, $notificationId);
	}
	
	$senderName = notificationGetAdminEmail($notification['admin_id'] ?? '');
	
	// Parse gift_data - handle both string (JSON) and array from Supabase JSONB
	$giftData = null;
	$rawGiftData = $notification['gift_data'] ?? null;
	if ($rawGiftData !== null) {
		if (is_string($rawGiftData)) {
			$giftData = json_decode($rawGiftData, true);
		} elseif (is_array($rawGiftData)) {
			$giftData = $rawGiftData;
		}
	}
	
	return [
		'id' => $item['notification_id'],
		'user_notification_id' => $item['id'],
		'title' => $notification['title'] ?? '',
		'content' => $notification['content'] ?? '',
		'sender_name' => $senderName,
		'is_read' => true,
		'read_at' => $item['read_at'] ?? date('c'),
		'created_at' => $notification['created_at'] ?? $item['created_at'],
		'is_broadcast' => $notification['is_broadcast'] ?? false,
		'gift_data' => $giftData,
		'gift_claimed' => $item['gift_claimed'] ?? false,
		'gift_claimed_at' => $item['gift_claimed_at'] ?? null
	];
}

function notificationMarkAsRead(string $userId, string $notificationId): bool {
	$params = http_build_query([
		'user_id' => 'eq.' . $userId,
		'notification_id' => 'eq.' . $notificationId
	]);
	$result = supabaseRequest('PATCH', "user_admin_notifications?$params", [
		'is_read' => true,
		'read_at' => date('c')
	], true);
	return $result && in_array($result['status'], [200, 204]);
}

function notificationMarkAllAsRead(string $userId): int {
	$params = http_build_query([
		'user_id' => 'eq.' . $userId,
		'is_read' => 'eq.false',
		'deleted_at' => 'is.null'
	]);
	$result = supabaseRequest('PATCH', "user_admin_notifications?$params", [
		'is_read' => true,
		'read_at' => date('c')
	], true);
	return ($result && is_array($result['body'])) ? count($result['body']) : 0;
}

function notificationDelete(string $userId, string $notificationId): bool {
	$params = http_build_query([
		'user_id' => 'eq.' . $userId,
		'notification_id' => 'eq.' . $notificationId
	]);
	$result = supabaseRequest('PATCH', "user_admin_notifications?$params", [
		'deleted_at' => date('c')
	], true);
	return $result && in_array($result['status'], [200, 204]);
}

function notificationClaimGift(string $userId, string $notificationId): array {
	// Get notification with gift data
	$select = 'id,notification_id,gift_claimed,admin_notifications!inner(gift_data)';
	$params = http_build_query([
		'select' => $select,
		'user_id' => 'eq.' . $userId,
		'notification_id' => 'eq.' . $notificationId,
		'deleted_at' => 'is.null',
		'limit' => 1
	]);
	
	$result = supabaseRequest('GET', "user_admin_notifications?$params", null, true);
	if (!$result || $result['status'] !== 200 || !is_array($result['body']) || count($result['body']) === 0) {
		return ['success' => false, 'error' => 'notification_not_found'];
	}
	
	$item = $result['body'][0];
	
	// Check if already claimed
	if ($item['gift_claimed'] ?? false) {
		return ['success' => false, 'error' => 'already_claimed'];
	}
	
	// Get gift data
	$notification = $item['admin_notifications'] ?? [];
	$rawGiftData = $notification['gift_data'] ?? null;
	
	if (!$rawGiftData) {
		return ['success' => false, 'error' => 'no_gift'];
	}
	
	$giftData = is_string($rawGiftData) ? json_decode($rawGiftData, true) : $rawGiftData;
	if (!$giftData) {
		return ['success' => false, 'error' => 'invalid_gift_data'];
	}
	
	$coinsAdded = 0;
	$gemsAdded = 0;
	
	// Credit coins
	if (($giftData['coins'] ?? 0) > 0) {
		$coinsAdded = (int)$giftData['coins'];
		notificationCreditCurrency($userId, 'coins', $coinsAdded);
	}
	
	// Credit gems
	if (($giftData['gems'] ?? 0) > 0) {
		$gemsAdded = (int)$giftData['gems'];
		notificationCreditCurrency($userId, 'gems', $gemsAdded);
	}
	
	// Add items to user_items
	$itemsAdded = [];
	$itemIds = $giftData['item_ids'] ?? [];
	if (is_array($itemIds) && count($itemIds) > 0) {
		foreach ($itemIds as $itemId) {
			if (!isValidUuid($itemId)) continue;
			
			// Check if user already has this item
			$checkParams = http_build_query([
				'select' => 'id',
				'user_id' => 'eq.' . $userId,
				'item_id' => 'eq.' . $itemId,
				'limit' => 1
			]);
			$existing = supabaseRequest('GET', "user_items?$checkParams", null, true);
			
			if (!$existing || !is_array($existing['body']) || count($existing['body']) === 0) {
				// Insert new user_item
				$insertResult = supabaseRequest('POST', 'user_items', [
					'user_id' => $userId,
					'item_id' => $itemId,
					'is_equipped' => false,
					'acquired_at' => date('c')
				], true);
				
				if ($insertResult && in_array($insertResult['status'], [200, 201])) {
					$itemsAdded[] = $itemId;
				}
			} else {
				// User already has item, still count as added
				$itemsAdded[] = $itemId;
			}
		}
	}
	
	// Mark gift as claimed
	$updateParams = http_build_query([
		'user_id' => 'eq.' . $userId,
		'notification_id' => 'eq.' . $notificationId
	]);
	supabaseRequest('PATCH', "user_admin_notifications?$updateParams", [
		'gift_claimed' => true,
		'gift_claimed_at' => date('c')
	], true);
	
	return [
		'success' => true,
		'claimed' => [
			'coins' => $coinsAdded,
			'gems' => $gemsAdded,
			'items' => $itemsAdded
		]
	];
}

function notificationCreditCurrency(string $userId, string $type, int $amount): void {
	// Get current balance
	$params = http_build_query([
		'select' => 'coins,gems',
		'user_id' => 'eq.' . $userId,
		'limit' => 1
	]);
	$result = supabaseRequest('GET', "profiles?$params", null, true);
	
	if (!$result || !is_array($result['body']) || count($result['body']) === 0) {
		return;
	}
	
	$profile = $result['body'][0];
	$currentCoins = (int)($profile['coins'] ?? 0);
	$currentGems = (int)($profile['gems'] ?? 0);
	
	// Update balance
	$newCoins = $type === 'coins' ? $currentCoins + $amount : $currentCoins;
	$newGems = $type === 'gems' ? $currentGems + $amount : $currentGems;
	
	$updateParams = http_build_query(['user_id' => 'eq.' . $userId]);
	supabaseRequest('PATCH', "profiles?$updateParams", [
		'coins' => $newCoins,
		'gems' => $newGems
	], true);
}

function notificationGetUnreadCount(string $userId): int {
	$params = http_build_query([
		'select' => 'id',
		'user_id' => 'eq.' . $userId,
		'is_read' => 'eq.false',
		'deleted_at' => 'is.null'
	]);
	$result = supabaseRequest('GET', "user_admin_notifications?$params", null, true);
	return ($result && is_array($result['body'])) ? count($result['body']) : 0;
}

function notificationGetAdminEmail(string $adminId): string {
	if (!$adminId) return 'Admin';
	$params = http_build_query([
		'select' => 'email',
		'user_id' => 'eq.' . $adminId,
		'limit' => 1
	]);
	$result = supabaseRequest('GET', "admin?$params", null, true);
	if ($result && is_array($result['body']) && count($result['body']) > 0) {
		return $result['body'][0]['email'] ?? 'Admin';
	}
	return 'Admin';
}

function notificationCreate(string $adminId, string $title, string $content, array $recipientIds, bool $isBroadcast, ?array $giftData = null): array {
	// Validate
	if (empty(trim($title)) || empty(trim($content))) {
		return ['success' => false, 'error' => 'Title and content are required'];
	}
	
	// For broadcast, get all user IDs
	if ($isBroadcast) {
		$usersResult = supabaseRequest('GET', 'profiles?select=user_id', null, true);
		$recipientIds = [];
		if ($usersResult && is_array($usersResult['body'])) {
			foreach ($usersResult['body'] as $row) {
				if (!empty($row['user_id'])) $recipientIds[] = $row['user_id'];
			}
		}
	}
	
	if (empty($recipientIds)) {
		return ['success' => false, 'error' => 'No recipients'];
	}
	
	// Create notification with gift_data
	$notificationPayload = [
		'admin_id' => $adminId,
		'title' => trim($title),
		'content' => trim($content),
		'is_broadcast' => $isBroadcast,
		'created_at' => date('c')
	];
	
	// Add gift_data if provided (coins, gems, item_ids)
	if ($giftData !== null && is_array($giftData)) {
		$hasGift = (isset($giftData['coins']) && $giftData['coins'] > 0) ||
		           (isset($giftData['gems']) && $giftData['gems'] > 0) ||
		           (isset($giftData['item_ids']) && is_array($giftData['item_ids']) && count($giftData['item_ids']) > 0);
		if ($hasGift) {
			$notificationPayload['gift_data'] = $giftData;
		}
	}
	
	$result = supabaseRequest('POST', 'admin_notifications', $notificationPayload, true);
	if (!$result || !in_array($result['status'], [200, 201]) || !is_array($result['body']) || count($result['body']) === 0) {
		return ['success' => false, 'error' => 'Failed to create notification'];
	}
	
	$notificationId = $result['body'][0]['id'] ?? null;
	if (!$notificationId) {
		return ['success' => false, 'error' => 'Failed to get notification ID'];
	}
	
	// Create user_admin_notification records
	$records = [];
	foreach ($recipientIds as $userId) {
		$records[] = [
			'notification_id' => $notificationId,
			'user_id' => $userId,
			'is_read' => false,
			'created_at' => date('c')
		];
	}
	
	$insertResult = supabaseRequest('POST', 'user_admin_notifications', $records, true);
	$created = ($insertResult && is_array($insertResult['body'])) ? count($insertResult['body']) : 0;
	
	return [
		'success' => true,
		'notification_id' => $notificationId,
		'recipients_count' => $created
	];
}

function notificationGetSent(string $adminId, int $page = 1, int $limit = 20): array {
	$offset = ($page - 1) * $limit;
	$params = http_build_query([
		'select' => '*',
		'admin_id' => 'eq.' . $adminId,
		'deleted_at' => 'is.null',
		'order' => 'created_at.desc',
		'offset' => $offset,
		'limit' => $limit
	]);
	
	$result = supabaseRequest('GET', "admin_notifications?$params", null, true);
	$items = ($result && $result['status'] === 200) ? ($result['body'] ?? []) : [];
	
	// Get stats for each
	$notifications = [];
	foreach ($items as $item) {
		$stats = notificationGetStats($item['id']);
		$content = $item['content'] ?? '';
		$notifications[] = [
			'id' => $item['id'],
			'title' => $item['title'],
			'content_preview' => strlen($content) > 100 ? substr(strip_tags($content), 0, 100) . '...' : strip_tags($content),
			'is_broadcast' => $item['is_broadcast'] ?? false,
			'created_at' => $item['created_at'],
			'stats' => $stats
		];
	}
	
	// Get total
	$countParams = http_build_query([
		'select' => 'id',
		'admin_id' => 'eq.' . $adminId,
		'deleted_at' => 'is.null'
	]);
	$countResult = supabaseRequest('GET', "admin_notifications?$countParams", null, true);
	$total = ($countResult && is_array($countResult['body'])) ? count($countResult['body']) : count($items);
	
	return [
		'success' => true,
		'notifications' => $notifications,
		'pagination' => [
			'page' => $page,
			'limit' => $limit,
			'total' => $total,
			'total_pages' => (int)ceil($total / $limit)
		]
	];
}

function notificationGetStats(string $notificationId): array {
	// Total
	$totalParams = http_build_query([
		'select' => 'id',
		'notification_id' => 'eq.' . $notificationId,
		'deleted_at' => 'is.null'
	]);
	$totalResult = supabaseRequest('GET', "user_admin_notifications?$totalParams", null, true);
	$total = ($totalResult && is_array($totalResult['body'])) ? count($totalResult['body']) : 0;
	
	// Read
	$readParams = http_build_query([
		'select' => 'id',
		'notification_id' => 'eq.' . $notificationId,
		'is_read' => 'eq.true',
		'deleted_at' => 'is.null'
	]);
	$readResult = supabaseRequest('GET', "user_admin_notifications?$readParams", null, true);
	$readCount = ($readResult && is_array($readResult['body'])) ? count($readResult['body']) : 0;
	
	return [
		'total_recipients' => $total,
		'read_count' => $readCount,
		'unread_count' => $total - $readCount
	];
}

function notificationAdminDelete(string $adminId, string $notificationId): bool {
	// Verify ownership
	$params = http_build_query([
		'select' => 'id',
		'id' => 'eq.' . $notificationId,
		'admin_id' => 'eq.' . $adminId,
		'limit' => 1
	]);
	$check = supabaseRequest('GET', "admin_notifications?$params", null, true);
	if (!$check || !is_array($check['body']) || count($check['body']) === 0) {
		return false;
	}
	
	// Soft delete notification
	$deleteParams = http_build_query(['id' => 'eq.' . $notificationId]);
	supabaseRequest('PATCH', "admin_notifications?$deleteParams", ['deleted_at' => date('c')], true);
	
	// Soft delete user notifications
	$userDeleteParams = http_build_query(['notification_id' => 'eq.' . $notificationId]);
	supabaseRequest('PATCH', "user_admin_notifications?$userDeleteParams", ['deleted_at' => date('c')], true);
	
	return true;
}

// GET /api/notifications/inbox -> Get user's inbox
if ($method === 'GET' && preg_match('#^/api/notifications/inbox$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
	$limit = isset($_GET['limit']) ? min(50, max(1, (int)$_GET['limit'])) : 20;
	
	$result = notificationGetInbox($authUser['id'], $page, $limit);
	echo json_encode($result);
	exit;
}

// GET /api/notifications/unread-count -> Get unread count
if ($method === 'GET' && preg_match('#^/api/notifications/unread-count$#', $uri)) {
	try {
		if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
			http_response_code(500);
			echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
			exit;
		}
		
		[$authUser, $token] = getSupabaseAuthContext();
		if (!$authUser) {
			http_response_code(401);
			echo json_encode(['success' => false, 'error' => 'Unauthorized']);
			exit;
		}
		
		$count = notificationGetUnreadCount($authUser['id']);
		echo json_encode(['success' => true, 'unread_count' => $count]);
		exit;
	} catch (Exception $e) {
		error_log("[unread-count] Exception: " . $e->getMessage());
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Internal server error', 'message' => $e->getMessage()]);
		exit;
	}
}

// GET /api/notifications/{id} -> Get notification detail
if ($method === 'GET' && preg_match('#^/api/notifications/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	$notification = notificationGetDetail($authUser['id'], $matches[1]);
	if (!$notification) {
		http_response_code(404);
		echo json_encode(['success' => false, 'error' => 'Notification not found']);
		exit;
	}
	
	echo json_encode(['success' => true, 'notification' => $notification]);
	exit;
}

// POST /api/notifications/{id}/read -> Mark as read
if ($method === 'POST' && preg_match('#^/api/notifications/([0-9a-fA-F\-]+)/read$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	$success = notificationMarkAsRead($authUser['id'], $matches[1]);
	echo json_encode(['success' => true, 'marked' => $success]);
	exit;
}

// POST /api/notifications/read-all -> Mark all as read
if ($method === 'POST' && preg_match('#^/api/notifications/read-all$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	$count = notificationMarkAllAsRead($authUser['id']);
	echo json_encode(['success' => true, 'marked_count' => $count]);
	exit;
}

// DELETE /api/notifications/{id} -> Delete notification
if ($method === 'DELETE' && preg_match('#^/api/notifications/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	$success = notificationDelete($authUser['id'], $matches[1]);
	echo json_encode(['success' => true, 'deleted' => $success]);
	exit;
}

// POST /api/notifications/{id}/claim-gift -> Claim gift from notification
if ($method === 'POST' && preg_match('#^/api/notifications/([0-9a-fA-F\-]+)/claim-gift$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	$result = notificationClaimGift($authUser['id'], $matches[1]);
	if (!$result['success']) {
		http_response_code(400);
	}
	echo json_encode($result);
	exit;
}

// POST /api/admin/notifications -> Admin send notification
if ($method === 'POST' && preg_match('#^/api/admin/notifications$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => 'Admin access required']);
		exit;
	}
	
	$body = json_decode(file_get_contents('php://input'), true) ?? [];
	$title = $body['title'] ?? '';
	$content = $body['content'] ?? '';
	$recipientIds = $body['recipient_ids'] ?? [];
	$isBroadcast = $body['is_broadcast'] ?? false;
	
	// Extract gift_data from request body
	$giftData = null;
	if (isset($body['gift_data']) && is_array($body['gift_data'])) {
		$giftData = [
			'coins' => isset($body['gift_data']['coins']) ? (int)$body['gift_data']['coins'] : 0,
			'gems' => isset($body['gift_data']['gems']) ? (int)$body['gift_data']['gems'] : 0,
			'item_ids' => isset($body['gift_data']['item_ids']) && is_array($body['gift_data']['item_ids']) 
				? $body['gift_data']['item_ids'] 
				: []
		];
	}
	
	$result = notificationCreate($authUser['id'], $title, $content, $recipientIds, $isBroadcast, $giftData);
	
	if (!$result['success']) {
		http_response_code(400);
	} else {
		http_response_code(201);
	}
	echo json_encode($result);
	exit;
}

// GET /api/admin/notifications/sent -> Admin view sent notifications
if ($method === 'GET' && preg_match('#^/api/admin/notifications/sent$#', $uri)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => 'Admin access required']);
		exit;
	}
	
	$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
	$limit = isset($_GET['limit']) ? min(50, max(1, (int)$_GET['limit'])) : 20;
	
	$result = notificationGetSent($authUser['id'], $page, $limit);
	echo json_encode($result);
	exit;
}

// GET /api/admin/notifications/{id}/stats -> Get notification stats
if ($method === 'GET' && preg_match('#^/api/admin/notifications/([0-9a-fA-F\-]+)/stats$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => 'Admin access required']);
		exit;
	}
	
	$stats = notificationGetStats($matches[1]);
	echo json_encode(['success' => true, 'stats' => $stats]);
	exit;
}

// DELETE /api/admin/notifications/{id} -> Admin delete notification
if ($method === 'DELETE' && preg_match('#^/api/admin/notifications/([0-9a-fA-F\-]+)$#', $uri, $matches)) {
	if (!$SUPABASE_SERVICE_KEY || !$SUPABASE_URL) {
		http_response_code(500);
		echo json_encode(['success' => false, 'error' => 'Supabase service key not configured']);
		exit;
	}
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['success' => false, 'error' => 'Unauthorized']);
		exit;
	}
	
	// Check admin permission
	if (!isUserAdmin($authUser['id'])) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => 'Admin access required']);
		exit;
	}
	
	$success = notificationAdminDelete($authUser['id'], $matches[1]);
	if (!$success) {
		http_response_code(403);
		echo json_encode(['success' => false, 'error' => 'Not authorized or notification not found']);
		exit;
	}
	
	echo json_encode(['success' => true, 'deleted' => true]);
	exit;
}

// ============================================================================
// END NOTIFICATION INBOX API ENDPOINTS
// ============================================================================

// POST /api/dataset/add -> add new Q&A entry to caro_dataset.jsonl
// Debug: check if URI matches
if ($method === 'POST' && preg_match('#^/api/dataset/add$#', $uri)) {
	// Debug: log để kiểm tra
	error_log("=== DATASET ADD DEBUG ===");
	error_log("HTTP_AUTHORIZATION: " . ($_SERVER['HTTP_AUTHORIZATION'] ?? 'NOT SET'));
	error_log("REDIRECT_HTTP_AUTHORIZATION: " . ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? 'NOT SET'));
	if (function_exists('getallheaders')) {
		$allHeaders = getallheaders();
		error_log("Authorization from getallheaders: " . ($allHeaders['Authorization'] ?? ($allHeaders['authorization'] ?? 'NOT FOUND')));
	}
	error_log("SUPABASE_URL: " . ($SUPABASE_URL ?? 'NOT SET'));
	error_log("SUPABASE_ANON_KEY: " . ($SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'));
	$header = getAuthorizationHeaderValue();
	error_log("getAuthorizationHeaderValue() returned: " . ($header ? substr($header, 0, 50) . '...' : 'NULL'));
	if ($header) {
		if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
			$token = $matches[1];
			error_log("Extracted token: " . substr($token, 0, 20) . '...');
			$user = verifySupabaseToken($token);
			error_log("verifySupabaseToken() returned: " . ($user ? 'SUCCESS - user ID: ' . ($user['id'] ?? 'NO ID') : 'FAILED'));
		} else {
			error_log("Failed to extract token from header");
		}
	}
	error_log("=== END DEBUG ===");
	
	[$authUser, $token] = getSupabaseAuthContext();
	if (!$authUser) {
		http_response_code(401);
		echo json_encode(['error' => 'Login required']);
		exit;
	}

	$body = json_decode(file_get_contents('php://input'), true);
	if (!isset($body['question']) || !isset($body['answer'])) {
		http_response_code(422);
		echo json_encode(['error' => 'question and answer are required']);
		exit;
	}
	
	// Language is required to separate datasets by language
	$language = isset($body['language']) && in_array($body['language'], ['vi', 'en', 'zh', 'ja']) 
		? $body['language'] 
		: 'vi'; // Default to Vietnamese if not specified

	$datasetFile = __DIR__ . '/../data/caro_dataset.jsonl';
	if (!file_exists($datasetFile)) {
		// Create empty file if doesn't exist
		file_put_contents($datasetFile, '');
	}

	// Normalize question for duplicate check
	$normalized = strtolower(trim($body['question']));
	$normalized = preg_replace('/[^a-z0-9\s]/', ' ', $normalized);
	$normalized = preg_replace('/\s+/', ' ', $normalized);
	$normalized = trim($normalized);

	// Read existing entries to check for duplicates (only check same language)
	$existing = [];
	if (filesize($datasetFile) > 0) {
		$lines = file($datasetFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
		foreach ($lines as $line) {
			$entry = json_decode($line, true);
			if ($entry && isset($entry['question'])) {
				// Only check duplicates within same language
				$entryLanguage = isset($entry['language']) ? $entry['language'] : 'vi';
				if ($entryLanguage !== $language) {
					continue; // Skip entries with different language
				}
				$existing[] = $entry;
				// Check if duplicate
				$existingNormalized = strtolower(trim($entry['question']));
				$existingNormalized = preg_replace('/[^a-z0-9\s]/', ' ', $existingNormalized);
				$existingNormalized = preg_replace('/\s+/', ' ', $existingNormalized);
				$existingNormalized = trim($existingNormalized);
				if ($existingNormalized === $normalized) {
					http_response_code(409);
					echo json_encode(['error' => 'Question already exists in dataset for this language']);
					exit;
				}
			}
		}
	}

	// Create new entry
	$newEntry = [
		'id' => 'c-auto-' . time() . '-' . uniqid(),
		'question' => trim($body['question']),
		'paraphrases' => isset($body['paraphrases']) && is_array($body['paraphrases']) ? $body['paraphrases'] : [],
		'answer' => trim($body['answer']),
		'topic' => isset($body['topic']) ? $body['topic'] : 'auto',
		'difficulty' => isset($body['difficulty']) ? $body['difficulty'] : 'beginner',
		'language' => $language // Lưu language vào entry
	];

	// Append to file
	$line = json_encode($newEntry) . "\n";
	if (file_put_contents($datasetFile, $line, FILE_APPEND | LOCK_EX) === false) {
		http_response_code(500);
		echo json_encode(['error' => 'Failed to write to dataset file']);
		exit;
	}

	echo json_encode(['success' => true, 'entry' => $newEntry]);
	exit;
}

// GET /api/dataset/learned -> get entries learned from Trial mode
if ($method === 'GET' && preg_match('#^/api/dataset/learned$#', $uri)) {
	$language = $_GET['language'] ?? null;
	
	$datasetFile = __DIR__ . '/../data/caro_dataset.jsonl';
	if (!file_exists($datasetFile) || filesize($datasetFile) === 0) {
		echo json_encode([
			'entries' => [],
			'count' => 0
		]);
		exit;
	}
	
	$entries = [];
	$lines = file($datasetFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
	foreach ($lines as $line) {
		$entry = json_decode($line, true);
		if (!$entry || !isset($entry['question']) || !isset($entry['answer'])) {
			continue;
		}
		
		// Filter by language if specified
		$entryLang = $entry['language'] ?? 'vi';
		if ($language && $entryLang !== $language) {
			continue;
		}
		
		$entries[] = $entry;
	}
	
	echo json_encode([
		'entries' => $entries,
		'count' => count($entries)
	]);
	exit;
}

// ============================================================================
// AI PROXY ROUTES (bypass browser extension interference)
// ============================================================================

$AI_SERVICE_URL = getenv('AI_SERVICE_URL') ?: 'http://localhost:8004';

// POST /api/ai/analyze -> Proxy to AI service
if ($method === 'POST' && preg_match('#^/api/ai/analyze$#', $uri)) {
	$body = file_get_contents('php://input');
	$ch = curl_init($AI_SERVICE_URL . '/analyze');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 60);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// GET /api/ai/usage -> Proxy to AI service
if ($method === 'GET' && preg_match('#^/api/ai/usage$#', $uri)) {
	$queryString = $_SERVER['QUERY_STRING'] ?? '';
	$ch = curl_init($AI_SERVICE_URL . '/usage?' . $queryString);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 10);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// POST /api/ai/ask -> Proxy to AI service
if ($method === 'POST' && preg_match('#^/api/ai/ask$#', $uri)) {
	$body = file_get_contents('php://input');
	$ch = curl_init($AI_SERVICE_URL . '/ask');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 30);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// POST /api/ai/replay/create -> Proxy to AI service
if ($method === 'POST' && preg_match('#^/api/ai/replay/create$#', $uri)) {
	$body = file_get_contents('php://input');
	$ch = curl_init($AI_SERVICE_URL . '/replay/create');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 30);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// POST /api/ai/replay/navigate -> Proxy to AI service
if ($method === 'POST' && preg_match('#^/api/ai/replay/navigate$#', $uri)) {
	$body = file_get_contents('php://input');
	$ch = curl_init($AI_SERVICE_URL . '/replay/navigate');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 10);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// POST /api/ai/replay/play -> Proxy to AI service
if ($method === 'POST' && preg_match('#^/api/ai/replay/play$#', $uri)) {
	$body = file_get_contents('php://input');
	$ch = curl_init($AI_SERVICE_URL . '/replay/play');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 30);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// GET /api/ai/health -> Proxy to AI service
if ($method === 'GET' && preg_match('#^/api/ai/health$#', $uri)) {
	$ch = curl_init($AI_SERVICE_URL . '/health');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	$response = curl_exec($ch);
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);
	if ($error) {
		http_response_code(502);
		echo json_encode(['error' => 'AI service unavailable', 'details' => $error]);
		exit;
	}
	http_response_code($httpCode);
	echo $response;
	exit;
}

// ============================================================================
// SKILL SYSTEM API ENDPOINTS
// ============================================================================

use Bootstrap\ServiceProvider;

// GET /api/seasons/current -> Get current active season
if ($method === 'GET' && preg_match('#^/api/seasons/current$#', $uri)) {
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getCurrentSeason();
        
        if (isset($result['status']) && $result['status'] >= 400) {
            http_response_code($result['status']);
            unset($result['status']);
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/skills -> Get skills for a season
if ($method === 'GET' && preg_match('#^/api/skills$#', $uri)) {
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getSkills($_GET);
        
        if (isset($result['status']) && $result['status'] >= 400) {
            http_response_code($result['status']);
            unset($result['status']);
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/skills/recommended -> Get recommended combo
if ($method === 'GET' && preg_match('#^/api/skills/recommended$#', $uri)) {
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getRecommendedCombo($_GET);
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/skills/{id} -> Get skill by ID
if ($method === 'GET' && preg_match('#^/api/skills/([0-9a-fA-F\-]+)$#', $uri, $m)) {
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getSkillById($m[1]);
        
        if (isset($result['status']) && $result['status'] >= 400) {
            http_response_code($result['status']);
            unset($result['status']);
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/user/skills -> Get user's unlocked skills (requires auth)
if ($method === 'GET' && preg_match('#^/api/user/skills$#', $uri)) {
    [$authUser, $token] = getSupabaseAuthContext();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getUserSkills($authUser['id']);
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// GET /api/user/combos -> Get user's combos (requires auth)
if ($method === 'GET' && preg_match('#^/api/user/combos$#', $uri)) {
    [$authUser, $token] = getSupabaseAuthContext();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getUserCombos($authUser['id'], $_GET['season_id'] ?? null);
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/user/combos -> Save combo (requires auth)
if ($method === 'POST' && preg_match('#^/api/user/combos$#', $uri)) {
    [$authUser, $token] = getSupabaseAuthContext();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->saveCombo($body, $authUser['id']);
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/user/combos/active -> Set active combo (requires auth)
if ($method === 'POST' && preg_match('#^/api/user/combos/active$#', $uri)) {
    [$authUser, $token] = getSupabaseAuthContext();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->setActiveCombo($body, $authUser['id']);
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/match/{id}/skill/random -> Get random skills for turn (requires auth)
if ($method === 'POST' && preg_match('#^/api/match/([^/]+)/skill/random$#', $uri, $m)) {
    [$authUser, $token] = getSupabaseAuthContext();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $body['match_id'] = $m[1];
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->getRandomSkillsForTurn($body, $authUser['id']);
        
        if (isset($result['status']) && $result['status'] >= 400) {
            http_response_code($result['status']);
            unset($result['status']);
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// POST /api/match/{id}/skill/use -> Use a skill (requires auth)
if ($method === 'POST' && preg_match('#^/api/match/([^/]+)/skill/use$#', $uri, $m)) {
    [$authUser, $token] = getSupabaseAuthContext();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $body['match_id'] = $m[1];
    try {
        ServiceProvider::boot();
        $controller = ServiceProvider::createSkillController();
        $result = $controller->useSkill($body, $authUser['id']);
        
        if (isset($result['status']) && $result['status'] >= 400) {
            http_response_code($result['status']);
            unset($result['status']);
        }
        echo json_encode($result);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Fallback: show simple info (also useful for debugging)
http_response_code(200);
echo json_encode([
	'message' => 'MindPoint Arena backend — lightweight API available at /api/rooms',
	'requested_uri' => $uri,
	'method' => $method,
	'available_endpoints' => [
		'POST /api/rooms',
		'POST /api/rooms/{id}/join',
		'GET /api/rooms/{id}',
		'POST /api/matches',
		'POST /api/chat/send',
		'GET /api/chat/history',
		'POST /api/dataset/add',
		// Report Violation System
		'POST /api/reports',
		'GET /api/reports',
		'GET /api/reports/{id}',
		'PUT /api/reports/{id}',
		// Appeal System
		'POST /api/appeals',
		'GET /api/appeals',
		'GET /api/appeals/{id}',
		'PUT /api/appeals/{id}',
		// Ban System
		'GET /api/bans/status',
		'POST /api/admin/bans',
		'GET /api/admin/bans',
		'GET /api/admin/bans/{id}',
		'POST /api/admin/bans/{id}/lift',
		'GET /api/admin/bans/user/{userId}',
		// Ranked BO3 Series System
		'POST /api/series/create',
		'GET /api/series/{id}',
		'POST /api/series/{id}/end-game',
		'POST /api/series/{id}/forfeit',
		'POST /api/series/{id}/abandon',
		'POST /api/series/{id}/rematch',
		// Payment demo
		'POST /api/payment/create',
		'POST /api/payment/webhook',
		'GET /api/payment/status/{txnRef}',
		// Currency (Coin/Gem)
		'GET /api/currency/packages',
		'POST /api/currency/purchase',
		'POST /api/currency/webhook',
		'GET /api/currency/status/{txnRef}',
		'GET /api/currency/history',
		'GET /api/currency/balance',
		'POST /api/currency/test',
		// Notification Inbox
		'GET /api/notifications/inbox',
		'GET /api/notifications/unread-count',
		'GET /api/notifications/{id}',
		'POST /api/notifications/{id}/read',
		'POST /api/notifications/read-all',
		'DELETE /api/notifications/{id}',
		'POST /api/admin/notifications',
		'GET /api/admin/notifications/sent',
		'GET /api/admin/notifications/{id}/stats',
		'DELETE /api/admin/notifications/{id}',
		// AI Proxy (bypass browser extension)
		'POST /api/ai/analyze',
		'GET /api/ai/usage',
		'POST /api/ai/ask',
		'POST /api/ai/replay/create',
		'POST /api/ai/replay/navigate',
		'POST /api/ai/replay/play',
		'GET /api/ai/health',
		// Skill System
		'GET /api/seasons/current',
		'GET /api/skills',
		'GET /api/skills/recommended',
		'GET /api/skills/{id}',
		'GET /api/user/skills',
		'GET /api/user/combos',
		'POST /api/user/combos',
		'POST /api/user/combos/active',
		'POST /api/match/{id}/skill/random',
		'POST /api/match/{id}/skill/use'
	]
]);
