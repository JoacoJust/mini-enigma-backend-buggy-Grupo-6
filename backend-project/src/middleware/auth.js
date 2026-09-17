const jwt = require('jsonwebtoken');

const FALLBACK_SECRET = 'taskflow-dev-secret';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token no provisto' });
  }

  const token = header.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || FALLBACK_SECRET;
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (err) {
    console.error('[auth] token invalido:', err.message);
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.rol === 'admin') {
    next();
  }
}

module.exports = { requireAuth, requireAdmin };
