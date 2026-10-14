const express = require('express');
const controller = require('../controllers/cronController');

const router = express.Router();
router.get('/daily', controller.daily);
router.post('/check-reminders', controller.checkReminders);
router.post('/update-exchange-rates', controller.updateExchangeRates);
router.post('/run-notifications', controller.runNotifications);
router.post('/weekly-digest', controller.weeklyDigest);
router.post('/monthly-digest', controller.monthlyDigest);
router.post('/recalculate-interest', controller.recalculateInterest);

module.exports = router;
