const WebSocket = require('ws');
const { formatMessage } = require('../utils/formatter');
const logger = require('../utils/logger');
const presence = require('./presenceManager');

const TYPING_TIMEOUT_MS = parseInt(process.env.TYPING_TIMEOUT_MS, 10) || 5000;

// key = `${room}::${username}` -> timeoutId
const activeTimers = new Map();

let userManager = null;
let roomManager = null;

const init = (deps) => {
  userManager = deps.userManager;
  roomManager = deps.roomManager;
  logger.info(`⌨️  Typing indicators enabled (timeout: ${TYPING_TIMEOUT_MS}ms)`);
};

const keyOf = (room, username) => `${room}::${username}`;

const broadcastToRoomExcept = (room, excludeUsername, payload) => {
  if (!roomManager || !userManager) return;
  const members = roomManager.getRoomMembers(room);
  members.forEach((m) => {
    if (m === excludeUsername) return;
    const socks = userManager.sessions.get(m);
    if (!socks) return;
    socks.forEach((s) => s.readyState === WebSocket.OPEN && s.send(payload));
  });
};

const clearTimer = (room, username) => {
  const key = keyOf(room, username);
  const t = activeTimers.get(key);
  if (t) {
    clearTimeout(t);
    activeTimers.delete(key);
  }
};

const emitStop = (room, username) => {
  clearTimer(room, username);
  broadcastToRoomExcept(room, username, formatMessage('typing_stop', { room, username }));
};

const handleStart = (ws, data) => {
  const username = ws.username;
  if (!username) return; // unauthenticated socket
  presence.touch(username);
  const { room } = data;

  // Verify user is in the room
  const members = roomManager.getRoomMembers(room);
  if (!members.includes(username)) return;

  const key = keyOf(room, username);
  const existing = activeTimers.get(key);

  // Refresh / reset timeout
  if (existing) clearTimeout(existing);
  const timeoutId = setTimeout(() => emitStop(room, username), TYPING_TIMEOUT_MS);
  activeTimers.set(key, timeoutId);

  // Only broadcast on transition from not-typing → typing
  if (!existing) {
    broadcastToRoomExcept(room, username, formatMessage('typing_start', { room, username }));
  }
};

const handleStop = (ws, data) => {
  const username = ws.username;
  if (!username) return;
  const { room } = data;
  if (!activeTimers.has(keyOf(room, username))) return; // wasn't typing
  emitStop(room, username);
};

/** Called when a user disconnects — clear all their typing states */
const clearUser = (username) => {
  for (const key of activeTimers.keys()) {
    const [room, user] = key.split('::');
    if (user === username) emitStop(room, username);
  }
};

module.exports = { init, handleStart, handleStop, clearUser };
