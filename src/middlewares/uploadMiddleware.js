const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const HttpError = require('../utils/httpError');

const uploadRoot = path.resolve(process.env.UPLOAD_PATH || './uploads');
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function ensureDirectory(folder) {
  fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
}

function createUploader(folder) {
  ensureDirectory(folder);
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, path.join(uploadRoot, folder)),
      filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${extensions[file.mimetype]}`),
    }),
    limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 5242880) },
    fileFilter: (_req, file, callback) => {
      if (!extensions[file.mimetype]) return callback(new HttpError(400, 'INVALID_FILE_TYPE', 'Envie uma imagem JPEG, PNG ou WEBP.'));
      callback(null, true);
    },
  }).single('image');
}

function fileUrl(file) {
  return `/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`;
}

module.exports = {
  avatarUpload: createUploader('avatars'),
  productUpload: createUploader('products'),
  paymentProofUpload: createUploader('payment-proofs'),
  fileUrl,
  ensureDirectory,
};
