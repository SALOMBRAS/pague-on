const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/financialAccountController');
const router = express.Router();
router.use(auth);
router.get('/', controller.list);
module.exports = router;
