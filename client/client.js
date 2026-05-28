const readline = require('readline');
const config = require('../config/config');
const commands = require('./commands');
const storage = require('./storage');
const { print } = require('./ui');
const ReconnectingWebSocket = require('./reconnect');

const state = {
  username: null,
  accessToken: null,
  refreshToken: null,
  activeRoom: null,
  joinedRooms: new Set(),
  // Track rooms we want to rejoin after reconnect
  desiredRooms: new Set(),
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const setPrompt = () => {
  rl.setPrompt(print.prompt(state.activeRoom, state.username));
  rl.prompt();
};

const ws = new ReconnectingWebSocket(`ws://${config.host}:${config.port}`);

const sendRaw = (obj) => ws.send(JSON.stringify(obj));

const sendWithAuth = (payload) => {
  if (
    state.accessToken &&
    payload.type !== 'register' &&
    payload.type !== 'login' &&
    payload.type !== 'refresh'
  ) {
    payload.token = state.accessToken;
  }
  const ok = sendRaw(payload);
  if (!ok) print.error('Not connected — message dropped. Will retry once reconnected.');
};

// --- Connection lifecycle ---
ws.on('open', () => {
  const isReconnect = state.username !== null;

  if (isReconnect) {
    print.success('Reconnected to server!');
    // Restore session via refresh token
    if (state.refreshToken) {
      sendRaw({ type: 'refresh', refreshToken: state.refreshToken });
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
      sendRaw({ type: 'refresh', refreshToken: saved.refreshToken });
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
  // Quiet by default — reconnect handler will retry
  if (process.env.LOG_LEVEL === 'debug') print.system(`(connect error: ${err.message})`);
});

// --- Server message handler ---
ws.on('message', (raw) => {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  switch (msg.type) {
    case 'welcome':
      break;

    case 'auth_success': {
      const wasReconnect = state.accessToken !== null || state.refreshToken !== null;
      state.username = msg.username;
      state.accessToken = msg.accessToken;
      state.refreshToken = msg.refreshToken;
      storage.save({ username: msg.username, refreshToken: msg.refreshToken });

      if (wasReconnect && state.desiredRooms.size > 0) {
        print.system(`Restoring ${state.desiredRooms.size} room(s)...`);
        state.joinedRooms.clear();
        state.desiredRooms.forEach((room) => {
          sendWithAuth({ type: 'join_room', room });
        });
      } else {
        print.success(`${msg.message} — Welcome, ${msg.username}!`);
      }
      break;
    }

    case 'server_shutdown':
      print.warn(`⚠ ${msg.message}`);
      // ReconnectingWebSocket will auto-retry after the underlying ws closes
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
    case 'room':        print.roomMsg({ ...msg, isSelf: msg.from === state.username }); break;
    case 'private':     print.privateMsg(msg); break;
    case 'private_sent':print.privateSent(msg); break;
    case 'rooms_list':  print.roomsList(msg.rooms); break;
    case 'users_list':  print.usersList(msg.users); break;
    case 'error':       print.error(msg.message); break;
    case 'presence':
      print.presenceChange(msg);
      break;

    case 'status_set':
      print.success(`Status: ${msg.status}`);
      break;
    default:            print.system(`[${msg.type}] ${JSON.stringify(msg)}`);
  }
  setPrompt();
});

// --- Input handler ---
rl.on('line', (input) => {
  const result = commands.parse(input, state);

  switch (result.kind) {
    case 'noop':                                break;
    case 'error':  print.error(result.message); break;
    case 'local':  handleLocal(result);         break;
    case 'server': sendWithAuth(result.payload);break;
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
        state.activeRoom = result.room;
        print.success(`Switched to #${result.room}`);
      }
      break;
    case 'logout':
      storage.clear();
      state.username = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.activeRoom = null;
      state.joinedRooms.clear();
      state.desiredRooms.clear();
      print.success('Logged out.');
      break;
    case 'quit':
      print.system('Bye!');
      ws.close();
      process.exit(0);
  }
};

rl.on('close', () => {
  ws.close();
  process.exit(0);
});
