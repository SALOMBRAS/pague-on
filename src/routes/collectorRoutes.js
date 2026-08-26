const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/collectorController');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/me/customers', controller.myCustomers);
router.get('/me/debts', controller.myDebts);
router.get('/me/agenda', controller.myAgenda);
router.get('/me/contacts', controller.myContacts);
router.post('/me/contacts', controller.addMyContact);
router.get('/me/commissions', controller.myCommissions);
router.post('/me/installments/:id/pay', controller.recordMyPayment);
router.get('/:id/commissions', controller.report);
router.put('/:id', controller.update);
router.put('/:id/customers', controller.assign);
module.exports = router;
