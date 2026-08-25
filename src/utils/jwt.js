const jwt = require('jsonwebtoken');

function signToken(userId, sessionVersion) {
  return jwt.sign({ sub: userId, sv: sessionVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}

module.exports = { signToken, verifyToken };
