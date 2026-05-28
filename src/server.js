const WebSocket = require('ws');
const config = require('../config/config');
const logger = require('./utils/logger');
const { safeParse, formatMessage } = require('./utils/formatter');
const { validate } = require('./validation/schemas');
const userManager = require('./managers/userManager');
const roomManager = require('./managers/roomManager');
const heartbeat = require('./heartbeat');
const presenceManager = require('./managers/presenceManager');


const SHUTDOWN_GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS, 10) || 5000;

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
  set_status: userManager.setStatus,
};

const start = () => {
  const wss = new WebSocket.Server({ port: config.port, host: config.host });
  logger.info(`🚀 Broadcast server running on ws://${config.host}:${config.port}`);

  heartbeat.start(wss);
  presenceManager.init({ userManager, roomManager });

  wss.on('connection', (ws, req) => {
    logger.debug(`New connection from ${req.socket.remoteAddress}`);
    heartbeat.attach(ws);

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

    ws.on('close', (code, reason) => {
      logger.debug(`Connection closed: ${ws.username || 'anonymous'} (code=${code}, reason=${reason || 'none'})`);
      userManager.disconnect(ws);
    });

    ws.on('error', (err) => logger.error(`WS error: ${err.message}`));
  });

  // 🛑 Graceful shutdown
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.warn(`Received ${signal} — starting graceful shutdown...`);

    // 1. Stop accepting new connections
    wss.close(() => {
      logger.info('✓ Server closed to new connections');
    });

    // 2. Notify all existing clients & close politely
    const clientCount = wss.clients.size;
    logger.info(`Notifying ${clientCount} client(s) of shutdown...`);
    wss.clients.forEach((ws) => {
      try {
        ws.send(formatMessage('server_shutdown', {
          message: 'Server is restarting. Please reconnect in a moment.',
          reconnectIn: 2000,
        }));
        ws.close(1001, 'Server shutting down');
      } catch (err) {
        logger.debug(`Failed to notify client: ${err.message}`);
      }
    });

    // 3. Force-exit after grace period (don't hang forever)
    setTimeout(() => {
      logger.warn(`Grace period (${SHUTDOWN_GRACE_MS}ms) elapsed — forcing exit`);
      wss.clients.forEach((ws) => ws.terminate());
      process.exit(0);
    }, SHUTDOWN_GRACE_MS);

    // 4. Clean exit when all clients have disconnected
    const checkDone = setInterval(() => {
      if (wss.clients.size === 0) {
        clearInterval(checkDone);
        logger.info('✓ All clients disconnected — exiting cleanly');
        process.exit(0);
      }
    }, 200);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

if (require.main === module) start();
module.exports = { start };
