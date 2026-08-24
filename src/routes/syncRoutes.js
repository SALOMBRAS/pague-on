const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/syncController');
const router = express.Router();
router.use(auth);
router.post('/push', controller.push);
router.get('/pull', controller.pull);
module.exports = router;
