const express = require('express');
const {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  listOverdue,
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.post('/', createTask);
router.get('/', listTasks);
router.get('/overdue', listOverdue);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;
