const logger = require('./utils/logger');
const userManager = require('./managers/userManager');

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 30000;

/**
 * Attach heartbeat tracking to a single WebSocket connection.
 * Called on every new connection from server.js.
 */
const attach = (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
    logger.debug(`Pong received from ${ws.username || 'anonymous'}`);
  });
};

/**
 * Start the server-wide heartbeat interval.
 * Pings all clients every HEARTBEAT_INTERVAL_MS.
 * Terminates clients that didn't pong since the last tick.
 */
const start = (wss) => {
  logger.info(`💓 Heartbeat enabled (interval: ${HEARTBEAT_INTERVAL_MS}ms)`);

  const interval = setInterval(() => {
    let alive = 0;
    let killed = 0;

    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        // Did not respond to the previous ping → assume dead
        logger.warn(`💀 Terminating dead connection: ${ws.username || 'anonymous'}`);
        userManager.disconnect(ws); // clean up sessions
        ws.terminate();              // force-close the socket (no close handshake)
        killed++;
        return;
      }

      ws.isAlive = false; // will be set true again when pong arrives
      ws.ping();          // send a WS ping frame
      alive++;
    });

    if (killed > 0 || alive > 0) {
      logger.debug(`Heartbeat tick → alive: ${alive}, killed: ${killed}`);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Stop pinging when the server closes
  wss.on('close', () => {
    clearInterval(interval);
    logger.info('Heartbeat stopped');
  });

  return interval;
};

module.exports = { attach, start, HEARTBEAT_INTERVAL_MS };
