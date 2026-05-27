# 📡 Broadcast Server

A **real-time, multi-user chat platform** built on WebSockets with JWT authentication, room-based messaging, private DMs, and a rich CLI client. Designed as a learning project covering networking, authentication, real-time systems, and production-grade reliability patterns.

> ⚠️ **Status:** Phase 1 complete (Auth + Security + UX). Phases 2–8 in progress.

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

### 🎨 Rich CLI Experience
- Colored output with per-user color hashing
- **Active room context** — type freely without `/room` prefix
- **Smart prompt** showing current room + username (`#general alice ›`)
- **Auto-login** via saved refresh token
- **Multi-profile** support (`--profile=alice`) for testing many users
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
├── cli.js                      # CLI entry (start / connect)
├── config/
│   └── config.js               # Env-driven config
├── src/
│   ├── server.js               # WebSocket server + router
│   ├── auth/
│   │   ├── jwt.js              # Access + refresh token logic
│   │   └── password.js         # bcrypt hashing
│   ├── managers/
│   │   ├── userManager.js      # Register, login, refresh, DMs, sessions
│   │   └── roomManager.js      # Join, leave, broadcast, list
│   ├── validation/
│   │   └── schemas.js          # Zod schemas per message type
│   └── utils/
│       ├── logger.js           # Leveled logger with colors
│       └── formatter.js        # JSON formatter + safe parser
└── client/
    ├── client.js               # Interactive client loop
    ├── commands.js             # Command parser (/join, /dm, etc.)
    ├── ui.js                   # Print helpers, colors, prompts
    └── storage.js              # Per-profile session persistence
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
```

### 3. Start the Server
```bash
npm start
```

You should see:
```
🚀 Broadcast server running on ws://localhost:3000
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
| `/users` | List online users |
| `/dm <user> <message>` | Send a private message |
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
[10:24] #general bob: hey alice 👋

#general alice › /dm bob psst, secret meeting at 5
[10:25] → bob: psst, secret meeting at 5
```

---

## 🔌 WebSocket Message Protocol

All messages are JSON with a `type` field. Server responds with typed messages too.

### Client → Server
```json
{ "type": "register", "username": "alice", "password": "secret123" }
{ "type": "login", "username": "alice", "password": "secret123" }
{ "type": "refresh", "refreshToken": "<jwt>" }
{ "type": "join_room", "token": "<jwt>", "room": "general" }
{ "type": "room_message", "token": "<jwt>", "room": "general", "text": "hi" }
{ "type": "private_message", "token": "<jwt>", "to": "bob", "text": "yo" }
{ "type": "list_rooms", "token": "<jwt>" }
{ "type": "list_users", "token": "<jwt>" }
```

### Server → Client
```json
{ "type": "auth_success", "username": "alice", "accessToken": "...", "refreshToken": "..." }
{ "type": "joined_room", "room": "general", "members": ["alice","bob"] }
{ "type": "room", "room": "general", "from": "bob", "text": "hi", "timestamp": 1716800000000 }
{ "type": "private", "from": "bob", "text": "secret", "timestamp": 1716800000000 }
{ "type": "user_joined", "room": "general", "username": "bob" }
{ "type": "user_left", "room": "general", "username": "bob" }
{ "type": "error", "message": "Unauthorized" }
```

---

## 🗺️ Roadmap

This project is being built in **8 phases**, each teaching specific backend & system-design concepts.

- [x] **Phase 1 — Security & UX Foundation**
  JWT, bcrypt, refresh tokens, validation, rich CLI, profiles
- [ ] **Phase 2 — Reliability**
  Heartbeat (ping/pong), auto-reconnect, graceful shutdown, idempotency, custom HTTP upgrade handler
- [ ] **Phase 3 — Real-Time Features**
  Presence, typing indicators, message history, subscriptions, desktop notifications
- [ ] **Phase 4 — Concurrency & Rate Limiting**
  Mutex locks, token-bucket rate limiter, abuse prevention
- [ ] **Phase 5 — Persistence & Caching**
  PostgreSQL/SQLite for users & messages, Redis for cache & sessions
- [ ] **Phase 6 — Distributed Systems**
  Redis pub/sub across nodes, Nginx load balancer, Docker Compose
- [ ] **Phase 7 — Web UI**
  Next.js + Tailwind frontend (Slack/Discord-style)
- [ ] **Phase 8 — Production Polish**
  Jest tests, GitHub Actions CI/CD, Prometheus metrics, deployment

---

## 🎓 Concepts Demonstrated (so far)

- HTTP Upgrade & WebSocket protocol
- Persistent connections & connection lifecycle
- JWT authentication & refresh-token rotation
- Stateful authorization on WebSocket messages
- Input validation & safe deserialization
- Multi-session / multi-device handling
- Pub/sub-style room broadcasting
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
```

Commit it:

```bash
git add README.md
```

```bash
git commit -m "docs: comprehensive README with architecture, protocol, and roadmap"
