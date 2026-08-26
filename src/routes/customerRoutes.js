const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/customerController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/approve', controller.approve);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
