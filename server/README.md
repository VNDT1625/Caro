MindPoint Arena — Socket server skeleton

Run locally (install dependencies first):

Windows cmd:

    cd server
    npm install
    npm start

Server exposes Socket.IO events:
- `create_room(roomId)`
- `join_room(roomId)`
- `move({ roomId, x, y, mark })` -> broadcasts `move_made` and `match_end` on winner

This is a minimal in-memory server for demo and testing. For production, persist rooms/matches and secure events.
