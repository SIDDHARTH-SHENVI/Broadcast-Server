const WebSocket = require('ws');
const userManager = require('./userManager');
const roomManager = require('./roomManager');

const PORT = 3000;

const wss = new WebSocket.Server({ port: PORT });

console.log(`Server started on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'register':
        userManager.register(ws, data);
        break;
      case 'login':
        userManager.login(ws, data);
        break;
      case 'private_message':
        userManager.privateMessage(ws, data);
        break;
      case 'join_room':
        roomManager.joinRoom(ws, data);
        break;
      case 'room_message':
        roomManager.broadcastToRoom(ws, data);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid command' }));
    }
  });
  

  ws.on('close', () => {
    userManager.disconnect(ws);
  });
});
