const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/assetController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
