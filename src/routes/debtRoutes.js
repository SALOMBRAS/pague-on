const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/debtController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/check-duplicate', controller.checkDuplicate);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/pay', controller.pay);
router.post('/:id/cancel', controller.cancel);
router.get('/:id/installments', controller.installments);
router.post('/:id/installments/:installmentId/pay', controller.payInstallment);
router.get('/:id/recurring-history', controller.recurringHistory);
router.post('/:id/collect', controller.collect);

module.exports = router;
