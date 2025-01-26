const WebSocket = require('ws');
const readline = require('readline');
const commands = require('./commands');
const { host, port } = require('../config/config');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ws = new WebSocket(`ws://${host}:${port}`);

ws.on('open', () => {
  console.log('Connected to the server');
  rl.prompt();
});

rl.on('line', (input) => {
  const command = commands.parse(input);
  ws.send(JSON.stringify(command));
  rl.prompt();
});

let token = null;

ws.on('message', (data) => {
  const message = JSON.parse(data);

  if (message.type === 'success' && message.token) {
    token = message.token; // Store the token after login
  }

  console.log(`[${message.type}]: ${message.message || message.text || ''}`);
});

rl.on('line', (input) => {
  const command = commands.parse(input);
  if (token) {
    command.token = token; // Add the token to all commands
  }
  ws.send(JSON.stringify(command));
  rl.prompt();
});

