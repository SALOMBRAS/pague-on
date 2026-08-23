const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/pushController');

const router = express.Router();
router.use(auth);
router.get('/config', controller.config);
router.post('/subscribe', controller.subscribe);
router.delete('/subscribe', controller.unsubscribe);
router.post('/test', controller.test);

module.exports = router;
