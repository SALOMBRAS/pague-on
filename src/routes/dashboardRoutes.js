const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/dashboardController');

const router = express.Router();
router.get('/', auth, controller.getDashboard);

module.exports = router;
