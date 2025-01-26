const utils = require('./utils');
const WebSocket = require('ws');
const { users } = require('./userManager'); // Import the users map directly

const rooms = new Map(); // roomName -> Set of usernames

// Join a room
const joinRoom = (ws, data) => {
  const { token, room } = data;

  const user = Array.from(users.entries()).find(([_, u]) => u.token === token);

  if (user) {
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }

    rooms.get(room).add(user[0]);

    ws.send(utils.formatMessage('success', { message: `Joined room: ${room}` }));
  } else {
    ws.send(utils.formatMessage('error', { message: 'Unauthorized' }));
  }
};

// Broadcast message to a room
const broadcastToRoom = (ws, data) => {
  const { token, room, text } = data;

  const user = Array.from(users.entries()).find(([_, u]) => u.token === token);

  if (user && rooms.has(room) && rooms.get(room).has(user[0])) {
    const message = utils.formatMessage('room', {
      room,
      from: user[0],
      text,
    });

    rooms.get(room).forEach((username) => {
      const member = users.get(username);
      if (member && member.ws.readyState === WebSocket.OPEN) {
        member.ws.send(message);
      }
    });
  } else {
    ws.send(utils.formatMessage('error', { message: 'Unauthorized or not in room' }));
  }
};

module.exports = { joinRoom, broadcastToRoom };
