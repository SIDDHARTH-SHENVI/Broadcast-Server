const readline = require('readline');
const crypto = require('crypto');
const config = require('../config/config');
const commands = require('./commands');
const storage = require('./storage');
const { print } = require('./ui');
const ReconnectingWebSocket = require('./reconnect');
const MessageQueue = require('./messageQueue');

const state = {
  username: null,
  accessToken: null,
  refreshToken: null,
  activeRoom: null,
  joinedRooms: new Set(),
  desiredRooms: new Set(),
};

const queue = new MessageQueue({ max: 100 });
const pendingAcks = new Map();

// --- Typing state ---
const TYPING_THROTTLE_MS = 3000;
const typingState = {
  lastSentAt: 0,
  lastRoom: null,
  others: new Map(), // username -> expiresAt
  renderTimer: null,
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const setPrompt = () => {
  rl.setPrompt(print.prompt(state.activeRoom, state.username));
  rl.prompt(true);
};

const ws = new ReconnectingWebSocket(`ws://${config.host}:${config.port}`);

const newMsgId = () => crypto.randomBytes(8).toString('hex');
const rawSend = (obj) => ws.send(JSON.stringify(obj));

const sendWithAuth = (payload) => {
  if (
    state.accessToken &&
    payload.type !== 'register' &&
    payload.type !== 'login' &&
    payload.type !== 'refresh'
  ) {
    payload.token = state.accessToken;
  }
  if (payload.type === 'room_message' || payload.type === 'private_message') {
    if (!payload.msgId) payload.msgId = newMsgId();
    pendingAcks.set(payload.msgId, { type: payload.type, text: payload.text });
  }
  const ok = rawSend(payload);
  if (!ok) {
    queue.enqueue(payload);
    print.system(`(queued — ${queue.size} message${queue.size === 1 ? '' : 's'} pending)`);
  }
};

const flushQueue = () => {
  if (queue.size === 0) return;
  const before = queue.size;
  const sent = queue.flush((item) => rawSend(item));
  if (sent > 0) print.system(`Flushed ${sent}/${before} queued message(s)`);
};

// --- Typing emission ---
const emitTypingStart = () => {
  if (!state.activeRoom || !state.accessToken) return;
  const now = Date.now();
  if (now - typingState.lastSentAt < TYPING_THROTTLE_MS && typingState.lastRoom === state.activeRoom) return;
  typingState.lastSentAt = now;
  typingState.lastRoom = state.activeRoom;
  rawSend({
    type: 'typing_start',
    token: state.accessToken,
    room: state.activeRoom,
  });
};

const emitTypingStop = () => {
  if (!typingState.lastRoom || !state.accessToken) return;
  rawSend({
    type: 'typing_stop',
    token: state.accessToken,
    room: typingState.lastRoom,
  });
  typingState.lastSentAt = 0;
  typingState.lastRoom = null;
};

// Poll rl.line to detect typing (cross-platform, no raw mode needed)
let lastLineSnapshot = '';
setInterval(() => {
  const cur = rl.line || '';
  if (cur === lastLineSnapshot) return;
  lastLineSnapshot = cur;
  if (!state.activeRoom) return;
  if (cur.length === 0) return;
  if (cur.startsWith('/')) return;
  emitTypingStart();
}, 150).unref();

// --- Render "X is typing..." status line ---
const renderTypingLine = () => {
  const now = Date.now();
  for (const [user, exp] of typingState.others.entries()) {
    if (exp < now) typingState.others.delete(user);
  }
  const active = Array.from(typingState.others.keys());
  if (active.length === 0) {
    print.clearTypingLine();
  } else {
    print.typingStatus(active);
  }
  setPrompt();
};

const scheduleRender = () => {
  if (typingState.renderTimer) return;
  typingState.renderTimer = setTimeout(() => {
    typingState.renderTimer = null;
    renderTypingLine();
  }, 100);
};

// --- Connection lifecycle ---
ws.on('open', () => {
  const isReconnect = state.username !== null;
  if (isReconnect) {
    print.success('Reconnected to server!');
    if (state.refreshToken) {
      rawSend({ type: 'refresh', refreshToken: state.refreshToken });
    }
  } else {
    print.banner();
    print.system(`Profile: ${storage.profile}`);
    print.system(`Connected to ws://${config.host}:${config.port}`);
    const saved = storage.load();
    if (saved.refreshToken) {
      print.system(`Restoring session for ${saved.username}...`);
      state.username = saved.username;
      state.refreshToken = saved.refreshToken;
      rawSend({ type: 'refresh', refreshToken: saved.refreshToken });
    } else {
      print.info('Type /register <user> <pass> or /login <user> <pass> to start. /help for commands.');
    }
  }
  setPrompt();
});

ws.on('reconnecting', ({ attempt, delayMs }) => {
  print.warn(`🔌 Connection lost. Reconnecting in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt})...`);
});

ws.on('giveup', () => {
  print.error('Could not reconnect after max attempts. Exiting.');
  process.exit(1);
});

ws.on('close', () => {
  print.error('Disconnected from server.');
  process.exit(0);
});

ws.on('connectError', (err) => {
  if (process.env.LOG_LEVEL === 'debug') print.system(`(connect error: ${err.message})`);
});

ws.on('message', (raw) => {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  switch (msg.type) {
    case 'welcome': break;

    case 'auth_success': {
      const wasReconnect = state.accessToken !== null || state.refreshToken !== null;
      state.username = msg.username;
      state.accessToken = msg.accessToken;
      state.refreshToken = msg.refreshToken;
      storage.save({ username: msg.username, refreshToken: msg.refreshToken });

      if (wasReconnect && state.desiredRooms.size > 0) {
        print.system(`Restoring ${state.desiredRooms.size} room(s)...`);
        state.joinedRooms.clear();
        state.desiredRooms.forEach((room) => sendWithAuth({ type: 'join_room', room }));
        setTimeout(flushQueue, 200);
      } else {
        print.success(`${msg.message} — Welcome, ${msg.username}!`);
        flushQueue();
      }
      break;
    }

    case 'ack': {
      const pending = pendingAcks.get(msg.msgId);
      if (pending) pendingAcks.delete(msg.msgId);
      break;
    }

    case 'server_shutdown':
      print.warn(`⚠ ${msg.message}`);
      break;

    case 'joined_room':
      state.joinedRooms.add(msg.room);
      state.desiredRooms.add(msg.room);
      state.activeRoom = msg.room;
      print.success(`Joined #${msg.room} (${msg.members.length} member${msg.members.length === 1 ? '' : 's'})`);
      break;

    case 'left_room':
      state.joinedRooms.delete(msg.room);
      state.desiredRooms.delete(msg.room);
      if (state.activeRoom === msg.room) state.activeRoom = null;
      print.system(`Left #${msg.room}`);
      break;

    case 'user_joined': print.userJoined(msg); break;
    case 'user_left':   print.userLeft(msg); break;

    case 'room':
      print.roomMsg({ ...msg, isSelf: msg.from === state.username });
      typingState.others.delete(msg.from);
      scheduleRender();
      break;

    case 'private':      print.privateMsg(msg); break;
    case 'private_sent': print.privateSent(msg); break;
    case 'rooms_list':   print.roomsList(msg.rooms); break;
    case 'users_list':   print.usersList(msg.users); break;

    case 'presence':     print.presenceChange(msg); break;
    case 'status_set':   print.success(`Status: ${msg.status}`); break;

    case 'typing_start':
      if (msg.room === state.activeRoom && msg.username !== state.username) {
        typingState.others.set(msg.username, Date.now() + 6000);
        scheduleRender();
      }
      break;

    case 'typing_stop':
      if (msg.room === state.activeRoom) {
        typingState.others.delete(msg.username);
        scheduleRender();
      }
      break;

    case 'error':   print.error(msg.message); break;
    default:        print.system(`[${msg.type}] ${JSON.stringify(msg)}`);
  }
  setPrompt();
});

rl.on('line', (input) => {
  const result = commands.parse(input, state);
  emitTypingStop();
  lastLineSnapshot = '';

  switch (result.kind) {
    case 'noop': break;
    case 'error':  print.error(result.message); break;
    case 'local':  handleLocal(result); break;
    case 'server': sendWithAuth(result.payload); break;
  }
  setPrompt();
});

const handleLocal = (result) => {
  switch (result.action) {
    case 'help':  print.help(); break;
    case 'clear': console.clear(); print.banner(); break;
    case 'switch':
      if (!state.joinedRooms.has(result.room)) {
        print.error(`You haven't joined #${result.room}. Use /join ${result.room}`);
      } else {
        emitTypingStop();
        state.activeRoom = result.room;
        typingState.others.clear();
        print.success(`Switched to #${result.room}`);
      }
      break;
    case 'logout':
      emitTypingStop();
      storage.clear();
      state.username = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.activeRoom = null;
      state.joinedRooms.clear();
      state.desiredRooms.clear();
      typingState.others.clear();
      queue.items.length = 0;
      pendingAcks.clear();
      print.success('Logged out.');
      break;
    case 'quit':
      emitTypingStop();
      print.system('Bye!');
      ws.close();
      process.exit(0);
  }
};

rl.on('close', () => {
  emitTypingStop();
  ws.close();
  process.exit(0);
});
