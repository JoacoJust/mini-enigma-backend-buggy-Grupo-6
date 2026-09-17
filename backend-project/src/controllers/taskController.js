const Task = require('../models/Task');

async function createTask(req, res) {
  const { titulo, descripcion, estado, prioridad, fechaVencimiento } = req.body;

  const task = await Task.create({
    titulo,
    descripcion,
    estado,
    prioridad,
    fechaVencimiento,
    owner: req.user.id,
  });

  res.status(201).json(task);
}

async function listTasks(req, res) {
  const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;

  const skip = page * limit;

  const tasks = await Task.find({ owner: req.user.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Task.countDocuments({ owner: req.user.id });

  res.json({
    data: tasks,
    page: Number(page),
    limit: Number(limit),
    total,
  });
}

async function getTask(req, res) {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  res.json(task);
}

async function updateTask(req, res) {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  res.json(task);
}

async function deleteTask(req, res) {
  await Task.findByIdAndDelete(req.params.id);
  res.status(204).send();
}

async function listOverdue(req, res) {
  const now = new Date();

  const tasks = await Task.find({
    owner: req.user.id,
    estado: { $ne: 'completada' },
    fechaVencimiento: { $lt: now },
  });

  res.json(tasks);
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  listOverdue,
};
