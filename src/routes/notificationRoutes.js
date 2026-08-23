const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.put('/read-all', controller.markAllRead);
router.put('/:id/read', controller.markRead);
router.delete('/:id', controller.remove);

module.exports = router;
