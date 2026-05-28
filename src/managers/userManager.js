const WebSocket = require('ws');
const password = require('../auth/password');
const { issueTokens, verifyAccessToken, verifyRefreshToken } = require('../auth/jwt');
const { formatMessage } = require('../utils/formatter');
const logger = require('../utils/logger');
const presence = require('./presenceManager');
const typingManager = require('./typingManager');

const users = new Map();
const sessions = new Map();
const refreshStore = new Map();

const attachSession = (username, ws) => {
  const isFirst = !sessions.has(username);
  if (isFirst) sessions.set(username, new Set());
  sessions.get(username).add(ws);
  ws.username = username;
  if (isFirst) presence.handleConnect(username);
};

const detachSession = (ws) => {
  if (!ws.username) return;
  const set = sessions.get(ws.username);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    sessions.delete(ws.username);
    presence.handleDisconnect(ws.username, false);
  } else {
    presence.handleDisconnect(ws.username, true);
  }
};

const register = async (ws, data) => {
  const { username, password: pw } = data;
  if (users.has(username)) {
    return ws.send(formatMessage('error', { message: 'Username already exists' }));
  }
  const passwordHash = await password.hash(pw);
  const user = { username, passwordHash, role: 'user', createdAt: Date.now() };
  users.set(username, user);

  const tokens = issueTokens(user);
  refreshStore.set(tokens.refreshToken, username);
  attachSession(username, ws);

  logger.info(`User registered: ${username}`);
  ws.send(formatMessage('auth_success', { username, ...tokens, message: 'Registered & logged in' }));
};

const login = async (ws, data) => {
  const { username, password: pw } = data;
  const user = users.get(username);
  if (!user || !user.passwordHash || !(await password.verify(pw, user.passwordHash))) {
    return ws.send(formatMessage('error', { message: 'Invalid credentials' }));
  }
  const tokens = issueTokens(user);
  refreshStore.set(tokens.refreshToken, username);
  attachSession(username, ws);

  logger.info(`User logged in: ${username}`);
  ws.send(formatMessage('auth_success', { username, ...tokens, message: 'Login successful' }));
};

const refresh = (ws, data) => {
  const { refreshToken } = data;
  const result = verifyRefreshToken(refreshToken);
  if (!result.ok) {
    return ws.send(formatMessage('error', { message: 'Invalid refresh token' }));
  }

  const username = result.payload.username;
  let user = users.get(username);

  if (!user) {
    logger.warn(`Refresh for unknown user "${username}" — recreating session shell (no DB yet)`);
    user = { username, passwordHash: null, role: result.payload.role || 'user', createdAt: Date.now() };
    users.set(username, user);
  }

  refreshStore.delete(refreshToken);
  const tokens = issueTokens(user);
  refreshStore.set(tokens.refreshToken, username);
  attachSession(username, ws);

  ws.send(formatMessage('auth_success', { username, ...tokens, message: 'Token refreshed' }));
};

const authFromToken = (token) => {
  const result = verifyAccessToken(token);
  if (!result.ok) return null;
  const user = users.get(result.payload.username);
  return user || null;
};

const privateMessage = (ws, data) => {
  const sender = authFromToken(data.token);
  if (!sender) return ws.send(formatMessage('error', { message: 'Unauthorized' }));

  presence.touch(sender.username);

  const recipientSessions = sessions.get(data.to);
  if (!recipientSessions || recipientSessions.size === 0) {
    return ws.send(formatMessage('error', { message: 'Recipient offline' }));
  }

  const payload = formatMessage('private', { from: sender.username, text: data.text });
  recipientSessions.forEach((sock) => {
    if (sock.readyState === WebSocket.OPEN) sock.send(payload);
  });
  ws.send(formatMessage('private_sent', { to: data.to, text: data.text }));
};

const listUsers = (ws, data) => {
  const me = authFromToken(data.token);
  if (!me) return ws.send(formatMessage('error', { message: 'Unauthorized' }));
  presence.touch(me.username);
  const list = presence.snapshot(Array.from(sessions.keys()));
  ws.send(formatMessage('users_list', { users: list }));
};

const setStatus = (ws, data) => {
  const me = authFromToken(data.token);
  if (!me) return ws.send(formatMessage('error', { message: 'Unauthorized' }));
  if (data.status === 'away') presence.setAway(me.username);
  else if (data.status === 'online') presence.setBack(me.username);
  else return ws.send(formatMessage('error', { message: 'Invalid status' }));
  ws.send(formatMessage('status_set', { status: data.status }));
};

const disconnect = (ws) => {
  if (ws.username) {
    logger.info(`Disconnected: ${ws.username}`);
    typingManager.clearUser(ws.username);
  }
  detachSession(ws);
};


module.exports = {
  users,
  sessions,
  register,
  login,
  refresh,
  privateMessage,
  listUsers,
  setStatus,
  authFromToken,
  disconnect,
};
