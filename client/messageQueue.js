class MessageQueue {
  constructor({ max = 100 } = {}) {
    this.max = max;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  enqueue(item) {
    if (this.items.length >= this.max) this.items.shift(); // drop oldest
    this.items.push(item);
  }

  flush(sendFn) {
    let sent = 0;
    while (this.items.length > 0) {
      const item = this.items[0];
      const ok = sendFn(item);
      if (!ok) break;
      this.items.shift();
      sent++;
    }
    return sent;
  }
}

module.exports = MessageQueue;
