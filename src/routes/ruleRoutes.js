const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/ruleController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/run-all', controller.runAll);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/test', controller.test);

module.exports = router;
