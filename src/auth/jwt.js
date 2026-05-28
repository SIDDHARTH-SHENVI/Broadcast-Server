const jwt = require('jsonwebtoken');
const config = require('../../config/config');

const signAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpiry });

const signRefreshToken = (payload) =>
  jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiry });

const verifyAccessToken = (token) => {
  try {
    return { ok: true, payload: jwt.verify(token, config.jwt.accessSecret) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

const verifyRefreshToken = (token) => {
  try {
    return { ok: true, payload: jwt.verify(token, config.jwt.refreshSecret) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

const issueTokens = (user) => {
  const payload = { username: user.username, role: user.role || 'user' };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
};
