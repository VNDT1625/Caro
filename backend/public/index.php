<?php
// Simple front controller (placeholder). Replace with framework entry (Laravel/ Symfony) when ready.

require __DIR__ . '/../vendor/autoload.php';

// Minimal lightweight API for rooms (create / join) using JSON file storage.
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$storageDir = __DIR__ . '/../storage';
if (!is_dir($storageDir)) mkdir($storageDir, 0755, true);
$roomsFile = $storageDir . '/rooms.json';
if (!file_exists($roomsFile)) file_put_contents($roomsFile, json_encode(new stdClass()));

// Supabase config (optional)
$SUPABASE_URL = getenv('SUPABASE_URL') ?: getenv('VITE_SUPABASE_URL') ?: null;
$SUPABASE_ANON_KEY = getenv('SUPABASE_ANON_KEY') ?: getenv('VITE_SUPABASE_ANON_KEY') ?: null;
// Service role key for server-side writes to Supabase REST (keep secret)
$SUPABASE_SERVICE_KEY = getenv('SUPABASE_SERVICE_KEY') ?: null;

function verifySupabaseToken(?string $token) {
	global $SUPABASE_URL, $SUPABASE_ANON_KEY;
	if (!$token || !$SUPABASE_URL) return null;
	$url = rtrim($SUPABASE_URL, '/') . '/auth/v1/user';
	$ch = curl_init($url);
	$headers = ["Authorization: Bearer {$token}"];
	if ($SUPABASE_ANON_KEY) $headers[] = "apikey: {$SUPABASE_ANON_KEY}";
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
	curl_setopt($ch, CURLOPT_TIMEOUT, 5);
	$resp = curl_exec($ch);
	$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	curl_close($ch);
	if ($code === 200 && $resp) {
		$data = json_decode($resp, true);
		return is_array($data) ? $data : null;
	}
	return null;
}

function supabaseRequest(string $method, string $path, $body = null, bool $useService = true) {
	global $SUPABASE_URL, $SUPABASE_ANON_KEY, $SUPABASE_SERVICE_KEY;
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
	if (isset($_SERVER['HTTP_AUTHORIZATION'])) return $_SERVER['HTTP_AUTHORIZATION'];
	if (function_exists('getallheaders')) {
		$headers = getallheaders();
		if (!empty($headers['Authorization'])) return $headers['Authorization'];
	}
	return null;
}

function getSupabaseAuthContext(): array {
	$header = getAuthorizationHeaderValue();
	if (!$header) return [null, null];
	if (!preg_match('/Bearer\s+(.*)$/i', $header, $matches)) return [null, null];
	$token = $matches[1];
	$user = verifySupabaseToken($token);
	if (!$user || empty($user['id'])) return [null, null];
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
			// Normalize players array to extract user ids in expected order
			function extractPlayerIds(array $players) {
				$uids = [];
				foreach ($players as $p) {
					if (!is_array($p)) continue;
					if (!empty($p['userId'])) $uids[] = $p['userId'];
					elseif (!empty($p['user_id'])) $uids[] = $p['user_id'];
					elseif (!empty($p['id'])) $uids[] = $p['id'];
				}
				return $uids;
			}
			// Insert into matches table (attempt). The schema may require UUID player ids; only send UUIDs.
			$player_x = null; $player_o = null;
			if (!empty($body['players']) && is_array($body['players'])) {
				$uids = extractPlayerIds($body['players']);
				if (count($uids) > 0 && isValidUuid($uids[0])) $player_x = $uids[0];
				if (count($uids) > 1 && isValidUuid($uids[1])) $player_o = $uids[1];
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

// Fallback: show simple info
http_response_code(200);
echo json_encode(['message' => 'MindPoint Arena backend — lightweight API available at /api/rooms']);
