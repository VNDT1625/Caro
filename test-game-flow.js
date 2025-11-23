// Automated test for game flow
// Run: node test-game-flow.js

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8000';
const SUPABASE_URL = 'https://odkemyagrewvphbcikdy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ka2VteWFncmV3dnBoYmNpa2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxOTIxNjYsImV4cCI6MjA3ODc2ODE2Nn0.bm6z8CHi7CMoOTINQEvCBcwNMwBhdEdVSCuUtuy1oBo';

// Mock users
const USER_X = {
  email: 'testx@test.com',
  password: 'test123456',
  token: null,
  id: null
};

const USER_O = {
  email: 'testo@test.com', 
  password: 'test123456',
  token: null,
  id: null
};

let TEST_ROOM_ID = null;

async function supabaseRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${SUPABASE_URL}${endpoint}`, options);
  return res.json();
}

async function apiRequest(endpoint, method = 'POST', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function signUp(user) {
  console.log(`\n📝 Signing up ${user.email}...`);
  const data = await supabaseRequest('/auth/v1/signup', 'POST', {
    email: user.email,
    password: user.password
  });
  
  if (data.access_token) {
    user.token = data.access_token;
    user.id = data.user.id;
    console.log(`✅ Signed up: ${user.id}`);
    return true;
  } else {
    console.log(`⚠️ User might exist, trying sign in...`);
    return signIn(user);
  }
}

async function signIn(user) {
  const data = await supabaseRequest('/auth/v1/token?grant_type=password', 'POST', {
    email: user.email,
    password: user.password
  });
  
  if (data.access_token) {
    user.token = data.access_token;
    user.id = data.user.id;
    console.log(`✅ Signed in: ${user.id}`);
    return true;
  }
  
  console.error('❌ Failed to authenticate:', data);
  return false;
}

async function createRoom() {
  console.log('\n🏠 Creating room...');
  
  const roomId = `test-room-${Date.now()}`;
  TEST_ROOM_ID = roomId;
  
  const data = await supabaseRequest('/rest/v1/rooms', 'POST', {
    id: roomId,
    name: 'Test Room',
    status: 'playing',
    game_state: {
      board: Array(15).fill(null).map(() => Array(15).fill(null)),
      moves: [],
      currentTurn: 'X',
      currentGame: 1,
      scores: { X: 0, O: 0 },
      totalTimeX: 300,
      totalTimeO: 300,
      gameStartedAt: new Date().toISOString(),
      lastMoveAt: null
    }
  }, USER_X.token);
  
  console.log(`✅ Room created: ${roomId}`);
  return roomId;
}

async function addPlayerToRoom(user, side) {
  console.log(`\n👤 Adding ${user.email} as player ${side}...`);
  
  await supabaseRequest('/rest/v1/room_players', 'POST', {
    room_id: TEST_ROOM_ID,
    user_id: user.id,
    player_side: side
  }, user.token);
  
  console.log(`✅ Player ${side} added`);
}

async function createMatch() {
  console.log('\n🎮 Creating match...');
  
  const data = await supabaseRequest('/rest/v1/matches', 'POST', {
    room_id: TEST_ROOM_ID,
    match_type: 'ranked',
    player_x_user_id: USER_X.id,
    player_o_user_id: USER_O.id,
    started_at: new Date().toISOString()
  }, USER_X.token);
  
  console.log('✅ Match created:', data[0]?.id);
  return data[0]?.id;
}

async function getGameState() {
  const res = await apiRequest(`/api/game/state/${TEST_ROOM_ID}`, 'GET', null, USER_X.token);
  return res.data.gameState;
}

async function makeMove(user, x, y, expectedResult) {
  console.log(`\n🎯 ${user.email} making move at (${x}, ${y})...`);
  
  const res = await apiRequest('/api/game/move', 'POST', {
    roomId: TEST_ROOM_ID,
    x,
    y
  }, user.token);
  
  console.log(`Response status: ${res.status}`);
  console.log(`Response:`, JSON.stringify(res.data, null, 2));
  
  if (expectedResult === 'success' && res.status === 200) {
    console.log(`✅ Move accepted by server`);
    console.log(`   Next turn: ${res.data.nextTurn}`);
    return res.data;
  } else if (expectedResult === 'reject' && res.status !== 200) {
    console.log(`✅ Move correctly rejected: ${res.data.error}`);
    return res.data;
  } else {
    console.log(`❌ UNEXPECTED: Expected ${expectedResult}, got status ${res.status}`);
    return null;
  }
}

async function verifyState(expectedTurn, description) {
  console.log(`\n🔍 Verifying state: ${description}`);
  const state = await getGameState();
  
  console.log(`Current turn in DB: ${state.currentTurn}`);
  
  if (state.currentTurn === expectedTurn) {
    console.log(`✅ PASS: Turn is ${expectedTurn} as expected`);
    return true;
  } else {
    console.log(`❌ FAIL: Expected turn ${expectedTurn}, got ${state.currentTurn}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting automated game flow tests...\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Setup
    console.log('\n📦 SETUP PHASE');
    console.log('=' .repeat(60));
    
    await signUp(USER_X) || await signIn(USER_X);
    await signUp(USER_O) || await signIn(USER_O);
    await createRoom();
    await addPlayerToRoom(USER_X, 'X');
    await addPlayerToRoom(USER_O, 'O');
    await createMatch();
    
    // Test 1: Initial state
    console.log('\n\n🧪 TEST 1: Initial state should be turn X');
    console.log('=' .repeat(60));
    if (await verifyState('X', 'Initial state')) {
      passed++;
    } else {
      failed++;
    }
    
    // Test 2: X makes first move
    console.log('\n\n🧪 TEST 2: X makes first move at (7,7)');
    console.log('=' .repeat(60));
    const move1 = await makeMove(USER_X, 7, 7, 'success');
    if (move1 && move1.nextTurn === 'O') {
      console.log('✅ PASS: Move accepted and turn switched to O');
      passed++;
    } else {
      console.log('❌ FAIL: Move rejected or turn not switched');
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 500)); // Wait for DB sync
    
    // Test 3: Verify turn changed to O
    console.log('\n\n🧪 TEST 3: Verify turn is now O');
    console.log('=' .repeat(60));
    if (await verifyState('O', 'After X move')) {
      passed++;
    } else {
      failed++;
    }
    
    // Test 4: X tries to move again (should fail)
    console.log('\n\n🧪 TEST 4: X tries to move again (should be rejected)');
    console.log('=' .repeat(60));
    const move2 = await makeMove(USER_X, 8, 8, 'reject');
    if (move2 && move2.error) {
      console.log('✅ PASS: Move correctly rejected');
      passed++;
    } else {
      console.log('❌ FAIL: Move should have been rejected');
      failed++;
    }
    
    // Test 5: O makes move
    console.log('\n\n🧪 TEST 5: O makes move at (8,7)');
    console.log('=' .repeat(60));
    const move3 = await makeMove(USER_O, 8, 7, 'success');
    if (move3 && move3.nextTurn === 'X') {
      console.log('✅ PASS: Move accepted and turn switched to X');
      passed++;
    } else {
      console.log('❌ FAIL: Move rejected or turn not switched');
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 500));
    
    // Test 6: Verify turn changed back to X
    console.log('\n\n🧪 TEST 6: Verify turn is back to X');
    console.log('=' .repeat(60));
    if (await verifyState('X', 'After O move')) {
      passed++;
    } else {
      failed++;
    }
    
    // Test 7: X makes second move
    console.log('\n\n🧪 TEST 7: X makes second move at (7,8)');
    console.log('=' .repeat(60));
    const move4 = await makeMove(USER_X, 7, 8, 'success');
    if (move4 && move4.nextTurn === 'O') {
      console.log('✅ PASS: Turn alternation working correctly');
      passed++;
    } else {
      console.log('❌ FAIL: Turn alternation broken');
      failed++;
    }
    
  } catch (error) {
    console.error('\n💥 TEST ERROR:', error);
    failed++;
  }
  
  // Summary
  console.log('\n\n📊 TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Game logic is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Check the logs above for details.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
