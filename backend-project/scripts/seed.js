require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Task = require('../src/models/Task');

const usersData = [
  { nombre: 'Ana Admin', email: 'ana.admin@taskflow.test', password: '123456', rol: 'admin' },
  { nombre: 'Bruno Perez', email: 'bruno@taskflow.test', password: '123456', rol: 'user' },
  { nombre: 'Carla Gomez', email: 'carla@taskflow.test', password: '123456', rol: 'user' },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[seed] Conectado a MongoDB');

  const createdUsers = [];

  for (const u of usersData) {
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await User.create({ ...u, password: hashed });
    createdUsers.push(user);
  }

  const [ana, bruno, carla] = createdUsers;

  const tasksData = [
    { titulo: 'Preparar informe mensual', estado: 'pendiente', prioridad: 'alta', owner: bruno._id, fechaVencimiento: new Date(Date.now() - 86400000) },
    { titulo: 'Revisar PRs pendientes', estado: 'en_progreso', prioridad: 'media', owner: bruno._id, fechaVencimiento: new Date(Date.now() + 86400000 * 3) },
    { titulo: 'Actualizar dependencias', estado: 'completada', prioridad: 'baja', owner: carla._id },
    { titulo: 'Configurar backups', estado: 'pendiente', prioridad: 'alta', owner: ana._id, fechaVencimiento: new Date(Date.now() + 86400000) },
    { titulo: 'Documentar API', estado: 'pendiente', prioridad: 'media', owner: carla._id, fechaVencimiento: new Date(Date.now() - 86400000 * 2) },
  ];

  await Task.insertMany(tasksData);

  console.log(`[seed] Insertados ${createdUsers.length} usuarios y ${tasksData.length} tareas`);
  console.log('[seed] Usuarios de prueba (password para todos: 123456):');
  createdUsers.forEach((u) => console.log(`  - ${u.email} (${u.rol})`));

  await mongoose.disconnect();
}

run();
