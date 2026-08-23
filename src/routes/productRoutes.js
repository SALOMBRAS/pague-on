const express = require('express');
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/productController');
const { productUpload } = require('../middlewares/uploadMiddleware');

const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/image', productUpload, controller.uploadImage);

module.exports = router;
