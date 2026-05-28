const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * A WebSocket wrapper that auto-reconnects with exponential backoff + jitter.
 *
 * Events:
 *   'open'         → fired on every successful connection (initial + reconnects)
 *   'message'      → forwarded from underlying ws
 *   'reconnecting' → { attempt, delayMs } before each retry
 *   'giveup'       → after max attempts exhausted
 *   'close'        → user-initiated permanent close
 */
class ReconnectingWebSocket extends EventEmitter {
  constructor(url, opts = {}) {
    super();
    this.url = url;
    this.maxAttempts = opts.maxAttempts ?? Infinity;
    this.baseDelay = opts.baseDelay ?? 1000;   // 1s
    this.maxDelay = opts.maxDelay ?? 30000;    // cap at 30s
    this.jitterRatio = opts.jitterRatio ?? 0.2; // ±20%

    this.attempt = 0;
    this.manuallyClosed = false;
    this.ws = null;
    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.attempt = 0; // reset backoff on success
      this.emit('open');
    });

    this.ws.on('message', (data) => this.emit('message', data));

    this.ws.on('close', (code, reason) => {
      if (this.manuallyClosed) {
        this.emit('close', code, reason);
        return;
      }
      this._scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      // Don't emit — 'close' will follow and trigger reconnect.
      // Suppress to avoid uncaught error crashes.
      this.emit('connectError', err);
    });
  }

  _scheduleReconnect() {
    this.attempt++;
    if (this.attempt > this.maxAttempts) {
      this.emit('giveup');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at maxDelay
    const exp = Math.min(this.baseDelay * 2 ** (this.attempt - 1), this.maxDelay);
    // Jitter: ±jitterRatio (e.g., ±20%)
    const jitter = exp * this.jitterRatio * (Math.random() * 2 - 1);
    const delay = Math.max(0, Math.round(exp + jitter));

    this.emit('reconnecting', { attempt: this.attempt, delayMs: delay });
    setTimeout(() => this._connect(), delay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false; // dropped — caller may want to queue
  }

  close() {
    this.manuallyClosed = true;
    if (this.ws) this.ws.close();
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}

module.exports = ReconnectingWebSocket;
