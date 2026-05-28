# 📡 Broadcast Server

A **real-time, multi-user chat platform** built on WebSockets with JWT authentication, room-based messaging, private DMs, presence, typing indicators, and a rich CLI client. Designed as a learning project covering networking, authentication, real-time systems, and production-grade reliability patterns.

---

## ✨ Features

### 🔐 Security & Auth
- **bcrypt** password hashing (no plaintext storage)
- **JWT access tokens** (15-min expiry) + **refresh tokens** with rotation
- **Zod** schema validation on every message
- Safe JSON parsing — server never crashes on malformed input

### 💬 Real-Time Messaging
- **Room-based chat** — join, leave, broadcast
- **Private messages (DMs)** between users
- **Multi-device support** — same user logged in from multiple terminals
- **Live join/leave notifications**
- **Server-assigned timestamps** on every message

### 👤 Presence & Typing
- **Online / away / offline** states with colored status dots
- **Auto-away** after 2 min of inactivity (configurable)
- **Manual** `/away` and `/back` commands
- **Room-scoped presence broadcasts** — only notify users who share a room
- **Typing indicators** — `✏ alice is typing...` with throttling + server-side auto-expire

### 🔁 Reliability
- **Heartbeat (ping/pong)** — detect and prune dead connections
- **Graceful shutdown** — notify clients, drain, force-exit on grace timeout
- **Auto-reconnect** on the client with exponential backoff + jitter
- **Offline message queue** — messages typed while disconnected are sent on reconnect
- **Client-generated message IDs** + server acks (delivery confirmation)
- **Room restoration** after reconnect

### 🎨 Rich CLI Experience
- Colored output with per-user color hashing
- **Active room context** — type freely without `/room` prefix
- **Smart prompt** showing current room + username (`#general alice ›`)
- **Auto-login** via saved refresh token
- **Multi-profile** support (`BROADCAST_PROFILE=alice`) for testing many users
- Beautiful `/help`, banner, and system messages

### 🏗️ Clean Architecture
- Modular folder structure (auth, managers, validation, utils)
- Centralized logger with levels
- Environment-based configuration
- CLI wrapper with `start` / `connect` commands

---

## 📦 Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js |
| Transport | `ws` (WebSocket) |
| Auth | `jsonwebtoken`, `bcrypt` |
| Validation | `zod` |
| CLI | `commander`, `readline` |
| UX | `chalk` |
| Config | `dotenv` |

---

## 📁 Project Structure

```
Broadcast-Server/
├── cli.js                          # CLI entry (start / connect)
├── config/
│   └── config.js                   # Env-driven config
├── src/
│   ├── server.js                   # WebSocket server + router + graceful shutdown
│   ├── heartbeat.js                # Ping/pong dead-connection detection
│   ├── auth/
│   │   ├── jwt.js                  # Access + refresh token logic
│   │   └── password.js             # bcrypt hashing
│   ├── managers/
│   │   ├── userManager.js          # Register, login, refresh, DMs, sessions
│   │   ├── roomManager.js          # Join, leave, broadcast, list
│   │   ├── presenceManager.js      # Online/away/offline + idle sweep
│   │   └── typingManager.js        # Typing start/stop + auto-expire
│   ├── validation/
│   │   └── schemas.js              # Zod schemas per message type
│   └── utils/
│       ├── logger.js               # Leveled logger with colors
│       └── formatter.js            # JSON formatter + safe parser
└── client/
    ├── client.js                   # Interactive client loop
    ├── commands.js                 # Command parser (/join, /dm, /away, etc.)
    ├── ui.js                       # Print helpers, colors, prompts, typing line
    ├── storage.js                  # Per-profile session persistence
    ├── reconnect.js                # Reconnecting WebSocket wrapper
    └── messageQueue.js             # Offline send queue
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/SIDDHARTH-SHENVI/Broadcast-Server.git
cd Broadcast-Server
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and set strong secrets:
```env
PORT=3000
HOST=localhost
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=10
LOG_LEVEL=info
AWAY_AFTER_MS=120000
TYPING_TIMEOUT_MS=5000
SHUTDOWN_GRACE_MS=5000
```

### 3. Start the Server
```bash
npm start
```

You should see:
```
🚀 Broadcast server running on ws://localhost:3000
💓 Heartbeat enabled (interval: 30000ms)
👤 Presence enabled (auto-away after 120s)
⌨️  Typing indicators enabled (timeout: 5000ms)
```

### 4. Connect Clients (in new terminals)

**Linux / macOS:**
```bash
BROADCAST_PROFILE=alice npm run client
BROADCAST_PROFILE=bob npm run client
```

**Windows:**
```bash
set BROADCAST_PROFILE=alice && npm run client
set BROADCAST_PROFILE=bob && npm run client
```

Each profile stores its session separately at `~/.broadcast/<profile>.json`, so multiple users can coexist on one machine.

---

## 💻 CLI Commands

| Command | Description |
|---|---|
| `/register <user> <pass>` | Create an account and auto-login |
| `/login <user> <pass>` | Login to an existing account |
| `/logout` | Logout and clear saved session |
| `/join <room>` | Join a room (becomes the active room) |
| `/leave <room>` | Leave a room |
| `/switch <room>` | Switch the active room |
| `/rooms` | List all rooms with member counts |
| `/users` | List users with presence (●online ●away ○offline) |
| `/dm <user> <message>` | Send a private message |
| `/away` | Mark yourself as away |
| `/back` | Mark yourself as online |
| `/clear` | Clear the screen |
| `/help` | Show all commands |
| `/quit` | Exit the client |
| `<message>` | Send message to the active room (no prefix needed) |

---

## 📜 Example Session

```text
$ npm run client

  ╔══════════════════════════════╗
  ║   📡  BROADCAST CHAT  📡    ║
  ╚══════════════════════════════╝

  · Profile: alice
  · Connected to ws://localhost:3000
  ℹ Type /register <user> <pass> or /login <user> <pass> to start.

› /register alice secret123
  ✓ Registered & logged in — Welcome, alice!

alice › /join general
  ✓ Joined #general (1 member)

#general alice › hello everyone!
[10:23] #general alice (you): hello everyone!
  · ● bob is now online
[10:24] #general bob: hey alice 👋
  ✏  bob is typing...
[10:24] #general bob: how's it going?

#general alice › /dm bob psst, secret meeting at 5
[10:25] → bob: psst, secret meeting at 5

#general alice › /away
  ✓ Status: away
```

---

## 🔌 WebSocket Message Protocol

All messages are JSON with a `type` field.

### Client → Server
```json
{ "type": "register", "username": "alice", "password": "secret123" }
{ "type": "login", "username": "alice", "password": "secret123" }
{ "type": "refresh", "refreshToken": "<jwt>" }
{ "type": "join_room", "token": "<jwt>", "room": "general" }
{ "type": "leave_room", "token": "<jwt>", "room": "general" }
{ "type": "room_message", "token": "<jwt>", "room": "general", "text": "hi", "msgId": "abc" }
{ "type": "private_message", "token": "<jwt>", "to": "bob", "text": "yo", "msgId": "abc" }
{ "type": "list_rooms", "token": "<jwt>" }
{ "type": "list_users", "token": "<jwt>" }
{ "type": "set_status", "token": "<jwt>", "status": "away" }
{ "type": "typing_start", "token": "<jwt>", "room": "general" }
{ "type": "typing_stop",  "token": "<jwt>", "room": "general" }
```

### Server → Client
```json
{ "type": "auth_success", "username": "alice", "accessToken": "...", "refreshToken": "..." }
{ "type": "joined_room", "room": "general", "members": ["alice","bob"] }
{ "type": "left_room", "room": "general" }
{ "type": "room", "room": "general", "from": "bob", "text": "hi", "timestamp": 1716800000000 }
{ "type": "private", "from": "bob", "text": "secret", "timestamp": 1716800000000 }
{ "type": "private_sent", "to": "bob", "text": "secret" }
{ "type": "user_joined", "room": "general", "username": "bob" }
{ "type": "user_left", "room": "general", "username": "bob" }
{ "type": "presence", "username": "bob", "status": "away", "timestamp": 1716800000000 }
{ "type": "status_set", "status": "away" }
{ "type": "typing_start", "room": "general", "username": "bob" }
{ "type": "typing_stop",  "room": "general", "username": "bob" }
{ "type": "ack", "msgId": "abc" }
{ "type": "rooms_list", "rooms": [{ "name": "general", "memberCount": 2 }] }
{ "type": "users_list", "users": [{ "username": "alice", "status": "online", "lastActive": 1716800000000 }] }
{ "type": "server_shutdown", "message": "Server is restarting...", "reconnectIn": 2000 }
{ "type": "error", "message": "Unauthorized" }
```

---

## 🎓 Concepts Demonstrated

- HTTP Upgrade & WebSocket protocol
- Persistent connections & connection lifecycle
- JWT authentication & refresh-token rotation
- Stateful authorization on WebSocket messages
- Input validation & safe deserialization
- Multi-session / multi-device handling
- Pub/sub-style room broadcasting
- Heartbeat & dead-connection pruning
- Graceful shutdown patterns
- Exponential backoff with jitter for reconnects
- Offline message queueing
- Idempotency via client-generated message IDs
- Presence systems with idle detection
- Throttled event emission (typing indicators)
- Server-side auto-expire safety nets
- CLI/UX design for terminal applications

---

## 🤝 Contributing

This is a personal learning project, but suggestions and PRs are welcome! Feel free to open an issue.

---

## 📄 License

ISC

---

## 👤 Author

**Siddharth Shenvi**
GitHub: [@SIDDHARTH-SHENVI](https://github.com/SIDDHARTH-SHENVI)


