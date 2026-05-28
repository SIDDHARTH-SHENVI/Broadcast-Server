const WebSocket = require('ws');
const { formatMessage } = require('../utils/formatter');
const { authFromToken, sessions } = require('./userManager');
const logger = require('../utils/logger');

// roomName -> Set<username>
const rooms = new Map();

const ensureRoom = (name) => {
  if (!rooms.has(name)) rooms.set(name, new Set());
  return rooms.get(name);
};

const broadcastSystem = (roomName, payload) => {
  const members = rooms.get(roomName);
  if (!members) return;
  members.forEach((username) => {
    const socks = sessions.get(username);
    if (!socks) return;
    socks.forEach((s) => s.readyState === WebSocket.OPEN && s.send(payload));
  });
};

const joinRoom = (ws, data) => {
  const user = authFromToken(data.token);
  if (!user) return ws.send(formatMessage('error', { message: 'Unauthorized' }));

  const members = ensureRoom(data.room);
  const isNew = !members.has(user.username);
  members.add(user.username);

  ws.send(formatMessage('joined_room', {
    room: data.room,
    members: Array.from(members),
  }));

  if (isNew) {
    broadcastSystem(data.room, formatMessage('user_joined', {
      room: data.room,
      username: user.username,
    }));
    logger.info(`${user.username} joined ${data.room}`);
  }
};

const leaveRoom = (ws, data) => {
  const user = authFromToken(data.token);
  if (!user) return ws.send(formatMessage('error', { message: 'Unauthorized' }));

  const members = rooms.get(data.room);
  if (!members || !members.has(user.username)) {
    return ws.send(formatMessage('error', { message: 'Not in that room' }));
  }
  members.delete(user.username);
  if (members.size === 0) rooms.delete(data.room);

  ws.send(formatMessage('left_room', { room: data.room }));
  broadcastSystem(data.room, formatMessage('user_left', {
    room: data.room,
    username: user.username,
  }));
};

const broadcastToRoom = (ws, data) => {
  const user = authFromToken(data.token);
  if (!user) return ws.send(formatMessage('error', { message: 'Unauthorized' }));

  const members = rooms.get(data.room);
  if (!members || !members.has(user.username)) {
    return ws.send(formatMessage('error', { message: 'Join the room first' }));
  }

  const payload = formatMessage('room', {
    room: data.room,
    from: user.username,
    text: data.text,
  });
  broadcastSystem(data.room, payload);
};

const listRooms = (ws, data) => {
  if (!authFromToken(data.token)) return ws.send(formatMessage('error', { message: 'Unauthorized' }));
  const list = Array.from(rooms.entries()).map(([name, members]) => ({
    name,
    memberCount: members.size,
  }));
  ws.send(formatMessage('rooms_list', { rooms: list }));
};

module.exports = { rooms, joinRoom, leaveRoom, broadcastToRoom, listRooms };
