const utils = require('./utils');
const WebSocket = require('ws');


const users = new Map(); // username -> { password, token, ws }

const register = (ws, data) => {
  const { username, password } = data;

  if (users.has(username)) {
    ws.send(utils.formatMessage('error', { message: 'Username already exists' }));
    return;
  }

  const token = utils.generateToken();
  users.set(username, { password, token, ws });
  ws.send(utils.formatMessage('success', { token, message: 'Registration successful' }));
};

const login = (ws, data) => {
  const { username, password } = data;
  const user = users.get(username);

  if (user && user.password === password) {
    const token = utils.generateToken();
    user.token = token;
    user.ws = ws;
    ws.send(utils.formatMessage('success', { token, message: 'Login successful' }));
  } else {
    ws.send(utils.formatMessage('error', { message: 'Invalid credentials' }));
  }
};

const privateMessage = (ws, data) => {
  const { token, to, text } = data;
  const sender = Array.from(users.entries()).find(([_, u]) => u.token === token);

  if (sender) {
    const recipient = users.get(to);
    if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
      recipient.ws.send(utils.formatMessage('private', { from: sender[0], text }));
    } else {
      ws.send(utils.formatMessage('error', { message: 'Recipient not available' }));
    }
  } else {
    ws.send(utils.formatMessage('error', { message: 'Unauthorized' }));
  }
};

const disconnect = (ws) => {
  const user = Array.from(users.entries()).find(([_, u]) => u.ws === ws);
  if (user) {
    users.delete(user[0]);
  }
};

module.exports = { users,register, login, privateMessage, disconnect };
