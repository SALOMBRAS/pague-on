const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const HttpError = require('../utils/httpError');

const uploadRoot = path.resolve(process.env.UPLOAD_PATH || './uploads');
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Em produção (Vercel) o filesystem é efêmero: uploads gravados em disco se perdem
// entre deploys/invocações. Quando o Supabase Storage está configurado, o arquivo
// vai para o bucket e o front recebe a URL pública. Sem Storage (dev local), o
// comportamento antigo de disco é preservado.
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const storageConfigured = Boolean(supabaseUrl && supabaseServiceRole);

function ensureDirectory(folder) {
  if (storageConfigured) return;
  try {
    fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
  } catch (_error) {
    // Em serverless o filesystem é read-only (exceto /tmp); uploads não críticos
    // devem ser tolerantes — o multer usará o disco se não der, e a falha NÃO
    // pode derrubar o boot do app.
  }
}

function randomFilename(file) {
  return `${crypto.randomUUID()}${extensions[file.mimetype]}`;
}

async function uploadToStorage(folder, filename, buffer, mimetype) {
  const objectPath = `${folder}/${filename}`;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceRole}`,
      'Content-Type': mimetype,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!response.ok) throw new HttpError(502, 'STORAGE_UPLOAD_FAILED', 'Falha ao armazenar o arquivo no storage.');
  return `${supabaseUrl}/storage/v1/object/public/${objectPath}`;
}

function createUploader(folder) {
  ensureDirectory(folder);
  const storage = storageConfigured
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, path.join(uploadRoot, folder)),
        filename: (_req, file, callback) => callback(null, randomFilename(file)),
      });
  const upload = multer({
    storage,
    limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 5242880) },
    fileFilter: (_req, file, callback) => {
      if (!extensions[file.mimetype]) return callback(new HttpError(400, 'INVALID_FILE_TYPE', 'Envie uma imagem JPEG, PNG ou WEBP.'));
      callback(null, true);
    },
  }).single('image');

  return function uploadWithStorage(req, res, next) {
    upload(req, res, async (error) => {
      if (error) return next(error);
      if (storageConfigured && req.file) {
        // memoryStorage não grava em disco nem gera filename; o nome é derivado aqui.
        req.file.filename = randomFilename(req.file);
        try {
          req.file.storageUrl = await uploadToStorage(folder, req.file.filename, req.file.buffer, req.file.mimetype);
        } catch (uploadError) {
          return next(uploadError);
        }
      }
      next();
    });
  };
}

function fileUrl(file) {
  if (file.storageUrl) return file.storageUrl;
  return `/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`;
}

module.exports = {
  avatarUpload: createUploader('avatars'),
  productUpload: createUploader('products'),
  paymentProofUpload: createUploader('payment-proofs'),
  fileUrl,
  ensureDirectory,
};
