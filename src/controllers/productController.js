const prisma = require('../config/database');
const productService = require('../services/productService');
const { productCreateSchema, productUpdateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const { fileUrl } = require('../middlewares/uploadMiddleware');
const HttpError = require('../utils/httpError');

function parseId(req) { return idSchema.parse(req.params).id; }

async function list(req, res) {
  const products = await productService.listProducts(req.user.id, req.query);
  return sendSuccess(res, serialize(products));
}

async function getById(req, res) {
  const product = await productService.productDetail(req.user.id, parseId(req));
  return sendSuccess(res, serialize(product));
}

async function create(req, res) {
  const product = await productService.createProduct(req.user.id, productCreateSchema.parse(req.body));
  return sendSuccess(res, serialize(product), 'Produto criado com sucesso.', 201);
}

async function update(req, res) {
  const product = await productService.updateProduct(req.user.id, parseId(req), productUpdateSchema.parse(req.body));
  return sendSuccess(res, serialize(product), 'Produto atualizado com sucesso.');
}

async function remove(req, res) {
  const product = await productService.updateProduct(req.user.id, parseId(req), { isActive: false });
  return sendSuccess(res, serialize(product), 'Produto arquivado com sucesso.');
}

async function uploadImage(req, res) {
  if (!req.file) throw new HttpError(400, 'IMAGE_REQUIRED', 'Envie uma imagem no campo image.');
  await productService.findOwnedProduct(req.user.id, parseId(req));
  const product = await prisma.product.update({ where: { id: req.params.id }, data: { image: fileUrl(req.file) } });
  return sendSuccess(res, serialize(product), 'Imagem do produto atualizada com sucesso.');
}

module.exports = { list, getById, create, update, remove, uploadImage };
