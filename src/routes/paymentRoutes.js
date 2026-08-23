const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/paymentController');

const router = express.Router();
router.use(auth);
router.post('/', controller.create);

module.exports = router;
