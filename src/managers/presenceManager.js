const WebSocket = require('ws');
const logger = require('../utils/logger');
const { formatMessage } = require('../utils/formatter');

const AWAY_AFTER_MS = parseInt(process.env.AWAY_AFTER_MS, 10) || 2 * 60 * 1000; // 2 min
const SWEEP_INTERVAL_MS = 15 * 1000; // check every 15s

// username -> { status: 'online'|'away'|'offline', lastActive: ts, manual: bool }
const presence = new Map();

let userManager = null;
let roomManager = null;
let sweepTimer = null;

/** Late-bind to avoid circular imports */
const init = (deps) => {
  userManager = deps.userManager;
  roomManager = deps.roomManager;
  start();
};

const get = (username) => presence.get(username) || { status: 'offline', lastActive: 0, manual: false };

/** Find all users who share at least one room with `username` */
const interestedUsers = (username) => {
  const interested = new Set();
  if (!roomManager) return interested;
  const userRooms = roomManager.getUserRooms ? roomManager.getUserRooms(username) : [];
  for (const room of userRooms) {
    const members = roomManager.getRoomMembers ? roomManager.getRoomMembers(room) : [];
    members.forEach((m) => {
      if (m !== username) interested.add(m);
    });
  }
  return interested;
};

/** Broadcast a presence change to everyone who shares a room */
const broadcast = (username, status) => {
  if (!userManager) return;
  const payload = formatMessage('presence', {
    username,
    status,
    timestamp: Date.now(),
  });
  const audience = interestedUsers(username);
  audience.forEach((peer) => {
    const sessions = userManager.sessions.get(peer);
    if (!sessions) return;
    sessions.forEach((sock) => {
      if (sock.readyState === WebSocket.OPEN) sock.send(payload);
    });
  });
};

/** Internal state setter that broadcasts only if status actually changed */
const setStatus = (username, status, { manual = false, silent = false } = {}) => {
  const prev = presence.get(username);
  const next = {
    status,
    lastActive: status === 'online' ? Date.now() : (prev?.lastActive || Date.now()),
    manual,
  };
  presence.set(username, next);
  if (!silent && (!prev || prev.status !== status)) {
    logger.debug(`Presence: ${username} → ${status}${manual ? ' (manual)' : ''}`);
    broadcast(username, status);
  }
};

/** Called from any message handler that represents real user activity */
const touch = (username) => {
  if (!username) return;
  const cur = presence.get(username);
  // If user manually set away, don't auto-flip back to online on activity
  if (cur?.manual && cur.status === 'away') {
    cur.lastActive = Date.now();
    return;
  }
  if (!cur || cur.status !== 'online') {
    setStatus(username, 'online', { manual: false });
  } else {
    cur.lastActive = Date.now();
  }
};

/** Called on first session attach */
const handleConnect = (username) => {
  setStatus(username, 'online', { manual: false });
};

/** Called when last session closes */
const handleDisconnect = (username, stillHasSessions) => {
  if (stillHasSessions) return; // multi-device — still online
  setStatus(username, 'offline', { manual: false });
};

/** Manual /away */
const setAway = (username) => {
  setStatus(username, 'away', { manual: true });
};

/** Manual /back */
const setBack = (username) => {
  setStatus(username, 'online', { manual: false });
};

/** Get snapshot of presence for a list of usernames (used by /users) */
const snapshot = (usernames) => {
  return usernames.map((u) => {
    const p = get(u);
    return { username: u, status: p.status, lastActive: p.lastActive };
  });
};

/** Background sweep: flip idle online users to away */
const sweep = () => {
  const now = Date.now();
  for (const [username, p] of presence.entries()) {
    if (p.status === 'online' && !p.manual && now - p.lastActive > AWAY_AFTER_MS) {
      setStatus(username, 'away', { manual: false });
    }
  }
};

const start = () => {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  logger.info(`👤 Presence enabled (auto-away after ${AWAY_AFTER_MS / 1000}s)`);
};

const stop = () => {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};

module.exports = {
  init,
  touch,
  get,
  snapshot,
  handleConnect,
  handleDisconnect,
  setAway,
  setBack,
  stop,
};
