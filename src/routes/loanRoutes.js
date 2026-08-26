const express = require('express');
const controller = require('../controllers/loanController');
const router = express.Router();
router.get('/configurations', controller.configurations);
router.put('/configurations', controller.saveConfiguration);
router.get('/customers', controller.customers);
router.post('/simulate', controller.simulate);
router.post('/', controller.create);
module.exports = router;
