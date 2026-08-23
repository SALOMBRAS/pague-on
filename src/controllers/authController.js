const prisma = require('../config/database');
const authService = require('../services/authService');
const { registerSchema, loginSchema, refreshTokenSchema, profileSchema, passwordSchema, pinSchema, securitySettingsSchema, webauthnCredentialSchema } = require('../utils/validators');
const securityService = require('../services/securityService');
const { sendSuccess } = require('../utils/responseHelper');
const { publicUser } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const { fileUrl } = require('../middlewares/uploadMiddleware');

async function register(req, res) {
  const result = await authService.register(registerSchema.parse(req.body));
  return sendSuccess(res, result, 'Cadastro realizado com sucesso.', 201);
}

async function login(req, res) {
  const result = await authService.login(loginSchema.parse(req.body));
  return sendSuccess(res, result, 'Login realizado com sucesso.');
}

async function refresh(req, res) {
  const result = await authService.refresh(refreshTokenSchema.parse(req.body).refreshToken);
  return sendSuccess(res, result, 'Sessão renovada com sucesso.');
}

async function logout(req, res) {
  const refreshToken = req.body && typeof req.body.refreshToken === 'string' ? req.body.refreshToken : null;
  await authService.logout(refreshToken);
  return sendSuccess(res, null, 'Sessão encerrada com sucesso.');
}

async function me(req, res) {
  return sendSuccess(res, publicUser(req.user));
}

async function updateMe(req, res) {
  const input = profileSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: input });
  return sendSuccess(res, publicUser(user), 'Perfil atualizado com sucesso.');
}

async function changePassword(req, res) {
  const input = passwordSchema.parse(req.body);
  await authService.changePassword(req.user, input.oldPassword, input.newPassword);
  return sendSuccess(res, null, 'Senha atualizada com sucesso.');
}

async function uploadAvatar(req, res) {
  if (!req.file) throw new HttpError(400, 'IMAGE_REQUIRED', 'Envie uma imagem no campo image.');
  const avatar = fileUrl(req.file);
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatar } });
  return sendSuccess(res, publicUser(user), 'Foto de perfil atualizada com sucesso.');
}

async function security(req, res) { return sendSuccess(res, await securityService.getSecurity(req.user.id)); }
async function updateSecurity(req, res) { return sendSuccess(res, await securityService.updateSettings(req.user.id, securitySettingsSchema.parse(req.body)), 'Preferências de segurança atualizadas.'); }
async function setPin(req, res) { return sendSuccess(res, await securityService.setPin(req.user.id, pinSchema.parse(req.body).pin), 'PIN definido com sucesso.'); }
async function verifyPin(req, res) { return sendSuccess(res, await securityService.verifyPin(req.user.id, pinSchema.parse(req.body).pin)); }
async function biometricRegistrationOptions(req, res) { return sendSuccess(res, await securityService.registrationOptions(req.user)); }
async function biometricRegister(req, res) { return sendSuccess(res, await securityService.registerBiometric(req.user, webauthnCredentialSchema.parse(req.body.credential)), 'Biometria ativada com sucesso.'); }
async function biometricAuthenticationOptions(req, res) { return sendSuccess(res, await securityService.authenticationOptions(req.user.id)); }
async function biometricVerify(req, res) { return sendSuccess(res, await securityService.verifyBiometric(req.user.id, webauthnCredentialSchema.parse(req.body.credential))); }

module.exports = { register, login, refresh, logout, me, updateMe, changePassword, uploadAvatar, security, updateSecurity, setPin, verifyPin, biometricRegistrationOptions, biometricRegister, biometricAuthenticationOptions, biometricVerify };
