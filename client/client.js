const WebSocket = require('ws');
const readline = require('readline');
const config = require('../config/config');
const commands = require('./commands');
const storage = require('./storage');
const { print } = require('./ui');

const state = {
  username: null,
  accessToken: null,
  refreshToken: null,
  activeRoom: null,
  joinedRooms: new Set(),
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const setPrompt = () => {
  rl.setPrompt(print.prompt(state.activeRoom, state.username));
  rl.prompt();
};

const ws = new WebSocket(`ws://${config.host}:${config.port}`);

const sendRaw = (obj) => ws.send(JSON.stringify(obj));

const sendWithAuth = (payload) => {
  if (state.accessToken && payload.type !== 'register' && payload.type !== 'login' && payload.type !== 'refresh') {
    payload.token = state.accessToken;
  }
  sendRaw(payload);
};

// --- Connection lifecycle ---
ws.on('open', () => {
  print.banner();
  print.system(`Profile: ${storage.profile}`);
  print.system(`Connected to ws://${config.host}:${config.port}`);

  const saved = storage.load();
  if (saved.refreshToken) {
    print.system(`Restoring session for ${saved.username}...`);
    state.username = saved.username;
    sendRaw({ type: 'refresh', refreshToken: saved.refreshToken });
  } else {
    print.info('Type /register <user> <pass> or /login <user> <pass> to start. /help for commands.');
  }
  setPrompt();
});


ws.on('close', () => {
  print.error('Disconnected from server.');
  process.exit(0);
});

ws.on('error', (err) => {
  print.error(`Connection error: ${err.message}`);
});

// --- Server message handler ---
ws.on('message', (raw) => {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  switch (msg.type) {
    case 'welcome':
      break; // banner already shown

    case 'auth_success':
      state.username = msg.username;
      state.accessToken = msg.accessToken;
      state.refreshToken = msg.refreshToken;
      storage.save({
        username: msg.username,
        refreshToken: msg.refreshToken,
      });
      print.success(`${msg.message} — Welcome, ${msg.username}!`);
      break;

    case 'joined_room':
      state.joinedRooms.add(msg.room);
      state.activeRoom = msg.room;
      print.success(`Joined #${msg.room} (${msg.members.length} member${msg.members.length === 1 ? '' : 's'})`);
      break;

    case 'left_room':
      state.joinedRooms.delete(msg.room);
      if (state.activeRoom === msg.room) state.activeRoom = null;
      print.system(`Left #${msg.room}`);
      break;

    case 'user_joined':
      print.userJoined(msg);
      break;

    case 'user_left':
      print.userLeft(msg);
      break;

    case 'room':
      print.roomMsg({ ...msg, isSelf: msg.from === state.username });
      break;

    case 'private':
      print.privateMsg(msg);
      break;

    case 'private_sent':
      print.privateSent(msg);
      break;

    case 'rooms_list':
      print.roomsList(msg.rooms);
      break;

    case 'users_list':
      print.usersList(msg.users);
      break;

    case 'error':
      print.error(msg.message);
      break;

    default:
      print.system(`[${msg.type}] ${JSON.stringify(msg)}`);
  }
  setPrompt();
});

// --- Input handler ---
rl.on('line', (input) => {
  const result = commands.parse(input, state);

  switch (result.kind) {
    case 'noop':
      break;

    case 'error':
      print.error(result.message);
      break;

    case 'local':
      handleLocal(result);
      break;

    case 'server':
      sendWithAuth(result.payload);
      break;
  }
  setPrompt();
});

const handleLocal = (result) => {
  switch (result.action) {
    case 'help':
      print.help();
      break;
    case 'clear':
      console.clear();
      print.banner();
      break;
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
