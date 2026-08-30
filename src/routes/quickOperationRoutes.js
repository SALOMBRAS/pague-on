const express = require('express');
const controller = require('../controllers/quickOperationController');

const router = express.Router();

router.post('/product-preview', controller.previewProduct);

module.exports = router;
