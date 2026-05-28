const formatMessage = (type, payload = {}) =>
  JSON.stringify({ type, ...payload, timestamp: Date.now() });

const safeParse = (raw) => {
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: 'Invalid JSON' };
  }
};

module.exports = { formatMessage, safeParse };
