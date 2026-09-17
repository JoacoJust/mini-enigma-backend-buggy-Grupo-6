const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

async function register(req, res) {
  const { nombre, email, password, rol } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'El email ya esta registrado' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    nombre,
    email,
    password: hashed,
    rol,
  });

  const token = generateToken(user);

  res.status(201).json({
    id: user._id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    token,
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(401).json({ error: 'Credenciales invalidas' });
  }

  const token = generateToken(user);

  res.json({
    id: user._id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    token,
  });
}

async function me(req, res) {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
}

module.exports = { register, login, me };
