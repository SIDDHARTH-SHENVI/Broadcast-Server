const WebSocket = require('ws');
const password = require('../auth/password');
const { issueTokens, verifyAccessToken, verifyRefreshToken } = require('../auth/jwt');
const { formatMessage } = require('../utils/formatter');
const logger = require('../utils/logger');

// In-memory store (Phase 5 → DB)
// username -> { passwordHash, role, createdAt }
const users = new Map();
// username -> Set<WebSocket> (multi-device support)
const sessions = new Map();
// refreshToken -> username (Phase 5 → Redis)
const refreshStore = new Map();

const attachSession = (username, ws) => {
  if (!sessions.has(username)) sessions.set(username, new Set());
  sessions.get(username).add(ws);
  ws.username = username;
};

const detachSession = (ws) => {
  if (!ws.username) return;
  const set = sessions.get(ws.username);
  if (set) {
    set.delete(ws);
    if (set.size === 0) sessions.delete(ws.username);
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
  if (!user || !(await password.verify(pw, user.passwordHash))) {
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

  // 🔧 Auto-recreate user shell if server restarted (Phase 5 fixes this with DB)
  if (!user) {
    logger.warn(`Refresh for unknown user "${username}" — recreating session shell (no DB yet)`);
    user = { username, passwordHash: null, role: result.payload.role || 'user', createdAt: Date.now() };
    users.set(username, user);
  }

  // Rotate refresh token
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
  if (!authFromToken(data.token)) return ws.send(formatMessage('error', { message: 'Unauthorized' }));
  ws.send(formatMessage('users_list', { users: Array.from(sessions.keys()) }));
};

const disconnect = (ws) => {
  if (ws.username) logger.info(`Disconnected: ${ws.username}`);
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
  authFromToken,
  disconnect,
};
