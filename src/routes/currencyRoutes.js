const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/currencyController');
const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.get('/convert', controller.convert);
router.post('/refresh', controller.refresh);
module.exports = router;
