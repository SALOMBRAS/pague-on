const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/customerRegistrationController');
const router = express.Router();
router.get('/:token', controller.details);
router.post('/:token', controller.submit);
router.post('/customers/:id/invite', auth, controller.create);
router.post('/invites/:id/revoke', auth, controller.revoke);
module.exports = router;
