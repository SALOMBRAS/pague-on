const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/reportController');

const router = express.Router();
router.use(auth);
router.get('/cashflow', controller.cashflow);
router.get('/profit', controller.profit);
router.get('/debts', controller.debts);
router.get('/export', controller.exportData);

module.exports = router;
