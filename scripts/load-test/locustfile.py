"""
MindPoint Arena Load Testing Tool
Test concurrent users on Frontend, Backend API, and Socket Server

Usage:
  pip install -r requirements.txt
  locust -f locustfile.py --host=http://localhost:8001

Web UI: http://localhost:8089

Test Classes:
  - APIUser: Test PHP Backend API (default)
  - CombinedUser: Full user flow simulation
  - SocketLoadUser: Test Socket.IO (requires socket server at :8000)
  - AIServiceUser: Test AI Service (requires AI at :8004)
"""

import random
import string
import time
import os
from locust import HttpUser, task, between, events

# Socket.IO is optional
try:
    import socketio
    SOCKETIO_AVAILABLE = True
except ImportError:
    SOCKETIO_AVAILABLE = False
    print("Warning: python-socketio not installed, socket tests disabled")


# Configuration
SOCKET_SERVER_URL = os.getenv("SOCKET_URL", "http://localhost:8000")
AI_SERVICE_URL = os.getenv("AI_URL", "http://localhost:8004")


class APIUser(HttpUser):
    """Test PHP Backend API endpoints"""
    
    wait_time = between(1, 3)
    weight = 3  # Higher weight = more instances
    
    def on_start(self):
        """Setup - create fake user session"""
        self.user_id = ''.join(random.choices(string.ascii_lowercase, k=8))
    
    @task(3)
    def health_check(self):
        """Test basic API health"""
        self.client.get("/api/health", name="API Health")
    
    @task(2)
    def get_rooms(self):
        """Test room listing"""
        self.client.get("/api/rooms", name="List Rooms")
    
    @task(2)
    def get_leaderboard(self):
        """Test leaderboard"""
        self.client.get("/api/leaderboard", name="Leaderboard")
    
    @task(1)
    def get_skills(self):
        """Test skills endpoint"""
        self.client.get("/api/skills", name="List Skills")
    
    @task(1)
    def get_shop_items(self):
        """Test shop items"""
        self.client.get("/api/items", name="Shop Items")


class SocketLoadUser(HttpUser):
    """Test Socket.IO Server concurrent connections
    
    Requires: Socket server running at localhost:8000
    Enable: Set ENABLE_SOCKET_TEST=1 environment variable
    """
    
    wait_time = between(2, 5)
    weight = 1
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sio = None
        self.connected = False
        self.room_id = None
        self.enabled = SOCKETIO_AVAILABLE and os.getenv("ENABLE_SOCKET_TEST", "0") == "1"
    
    def on_start(self):
        """Connect to Socket.IO server"""
        if not self.enabled:
            return
            
        self.sio = socketio.Client()
        self.user_id = ''.join(random.choices(string.ascii_lowercase, k=8))
        
        @self.sio.event
        def connect():
            self.connected = True
        
        @self.sio.event
        def disconnect():
            self.connected = False
        
        try:
            self.sio.connect(SOCKET_SERVER_URL, wait_timeout=10)
        except Exception as e:
            print(f"Socket connection failed: {e}")
    
    def on_stop(self):
        """Disconnect from Socket.IO"""
        if self.sio and self.connected:
            try:
                self.sio.disconnect()
            except:
                pass
    
    @task(3)
    def join_room(self):
        """Test joining a room"""
        if not self.enabled or not self.connected:
            return
            
        room_id = f"test-room-{random.randint(1, 10)}"
        start = time.time()
        try:
            self.sio.emit('join_room', {
                'roomId': room_id,
                'userId': self.user_id
            })
            self.room_id = room_id
            events.request.fire(
                request_type="SOCKET",
                name="join_room",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                exception=None
            )
        except Exception as e:
            events.request.fire(
                request_type="SOCKET",
                name="join_room",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                exception=e
            )
    
    @task(2)
    def send_chat(self):
        """Test sending chat message"""
        if not self.enabled or not self.connected or not self.room_id:
            return
            
        start = time.time()
        try:
            self.sio.emit('chat_message', {
                'roomId': self.room_id,
                'userId': self.user_id,
                'message': f"Test message {random.randint(1, 1000)}"
            })
            events.request.fire(
                request_type="SOCKET",
                name="chat_message",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                exception=None
            )
        except Exception as e:
            events.request.fire(
                request_type="SOCKET",
                name="chat_message",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                exception=e
            )
    
    @task(1)
    def make_move(self):
        """Test making a game move"""
        if not self.enabled or not self.connected or not self.room_id:
            return
            
        start = time.time()
        try:
            self.sio.emit('make_move', {
                'roomId': self.room_id,
                'userId': self.user_id,
                'x': random.randint(0, 14),
                'y': random.randint(0, 14)
            })
            events.request.fire(
                request_type="SOCKET",
                name="make_move",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                exception=None
            )
        except Exception as e:
            events.request.fire(
                request_type="SOCKET",
                name="make_move",
                response_time=(time.time() - start) * 1000,
                response_length=0,
                exception=e
            )


class CombinedUser(HttpUser):
    """Combined test: API + simulated game flow"""
    
    wait_time = between(1, 3)
    weight = 2
    
    def on_start(self):
        self.user_id = ''.join(random.choices(string.ascii_lowercase, k=8))
    
    @task(5)
    def browse_home(self):
        """Simulate user browsing home page"""
        self.client.get("/api/health", name="Home - Health")
        self.client.get("/api/rooms", name="Home - Rooms")
    
    @task(3)
    def view_profile(self):
        """Simulate viewing profile"""
        self.client.get(f"/api/profiles/{self.user_id}", name="View Profile")
    
    @task(2)
    def view_shop(self):
        """Simulate browsing shop"""
        self.client.get("/api/items", name="Shop - Items")
        self.client.get("/api/skills", name="Shop - Skills")
    
    @task(1)
    def view_leaderboard(self):
        """Simulate viewing leaderboard"""
        self.client.get("/api/leaderboard", name="Leaderboard")
    
    @task(1)
    def analysis_request(self):
        """Simulate AI analysis request"""
        self.client.post("/api/analysis/analyze", json={
            "match_id": f"test-{random.randint(1, 1000)}",
            "moves": [[7, 7], [7, 8], [8, 7]],
            "tier": "basic"
        }, name="AI Analysis")


class AIServiceUser(HttpUser):
    """Test AI Service directly (port 8004)
    
    Enable: Set ENABLE_AI_TEST=1 and AI_URL=http://localhost:8004
    """
    
    wait_time = between(2, 5)
    weight = 1
    host = AI_SERVICE_URL
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.enabled = os.getenv("ENABLE_AI_TEST", "0") == "1"
        self.session_id = None
    
    @task(3)
    def health_check(self):
        """Test AI service health"""
        if not self.enabled:
            return
        self.client.get("/health", name="AI Health")
    
    @task(2)
    def analyze_match(self):
        """Test match analysis"""
        if not self.enabled:
            return
        
        # Generate random game moves
        moves = [[7, 7]]
        for i in range(random.randint(5, 20)):
            moves.append([random.randint(0, 14), random.randint(0, 14)])
        
        self.client.post("/analyze", json={
            "match_id": f"load-test-{random.randint(1, 10000)}",
            "moves": moves,
            "tier": random.choice(["basic", "standard", "pro"])
        }, name="AI Analyze")
    
    @task(1)
    def create_replay(self):
        """Test replay creation"""
        if not self.enabled:
            return
        
        moves = [[7, 7], [7, 8], [8, 7], [6, 8], [9, 7]]
        response = self.client.post("/replay/create", json={
            "match_id": f"replay-test-{random.randint(1, 1000)}",
            "moves": moves
        }, name="AI Replay Create")
        
        if response.status_code == 200:
            data = response.json()
            self.session_id = data.get("session_id")
    
    @task(1)
    def navigate_replay(self):
        """Test replay navigation"""
        if not self.enabled or not self.session_id:
            return
        
        self.client.post("/replay/navigate", json={
            "session_id": self.session_id,
            "move_number": random.randint(0, 5)
        }, name="AI Replay Navigate")
