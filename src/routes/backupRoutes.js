const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/backupController');

const router = express.Router();
router.use(auth);
router.get('/export', controller.exportBackup);
router.post('/restore', controller.restoreBackup);
router.get('/cloud/status', controller.cloudStatus);
router.post('/cloud', controller.saveCloudBackup);
router.post('/cloud/:id/restore', controller.restoreCloudBackup);

module.exports = router;
