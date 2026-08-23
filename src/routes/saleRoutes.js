const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/saleController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.post('/:id/pay', controller.pay);
router.post('/:id/cancel', controller.cancel);
router.delete('/:id', controller.cancel);
router.post('/:id/recalculate', controller.recalculate);

module.exports = router;
