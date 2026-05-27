const WebSocket = require('ws');
const config = require('../config/config');
const logger = require('./utils/logger');
const { safeParse, formatMessage } = require('./utils/formatter');
const { validate } = require('./validation/schemas');
const userManager = require('./managers/userManager');
const roomManager = require('./managers/roomManager');

const handlers = {
  register: userManager.register,
  login: userManager.login,
  refresh: userManager.refresh,
  private_message: userManager.privateMessage,
  list_users: userManager.listUsers,
  join_room: roomManager.joinRoom,
  leave_room: roomManager.leaveRoom,
  room_message: roomManager.broadcastToRoom,
  list_rooms: roomManager.listRooms,
};

const start = () => {
  const wss = new WebSocket.Server({ port: config.port, host: config.host });
  logger.info(`🚀 Broadcast server running on ws://${config.host}:${config.port}`);

  wss.on('connection', (ws, req) => {
    logger.debug(`New connection from ${req.socket.remoteAddress}`);
    ws.send(formatMessage('welcome', { message: 'Connected to Broadcast Server' }));

    ws.on('message', async (raw) => {
      const parsed = safeParse(raw.toString());
      if (!parsed.ok) {
        return ws.send(formatMessage('error', { message: parsed.error }));
      }
      const { type, ...rest } = parsed.data;
      const handler = handlers[type];
      if (!handler) {
        return ws.send(formatMessage('error', { message: `Unknown type: ${type}` }));
      }
      const v = validate(type, rest);
      if (!v.ok) {
        return ws.send(formatMessage('error', { message: v.error }));
      }
      try {
        await handler(ws, v.data);
      } catch (err) {
        logger.error(`Handler error: ${err.message}`);
        ws.send(formatMessage('error', { message: 'Internal server error' }));
      }
    });

    ws.on('close', () => userManager.disconnect(ws));
    ws.on('error', (err) => logger.error(`WS error: ${err.message}`));
  });

  // Graceful shutdown (Phase 2 will expand)
  const shutdown = () => {
    logger.warn('Shutting down...');
    wss.clients.forEach((c) => c.close(1001, 'Server shutting down'));
    wss.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

if (require.main === module) start();
module.exports = { start };
