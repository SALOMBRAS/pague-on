const prisma = require('../config/database');
const authService = require('../services/authService');
const { registerSchema, loginSchema, refreshTokenSchema, passwordResetRequestSchema, passwordResetConfirmSchema, profileSchema, passwordSchema, pinSchema, securitySettingsSchema, webauthnCredentialSchema } = require('../utils/validators');
const securityService = require('../services/securityService');
const { sendSuccess } = require('../utils/responseHelper');
const { publicUser } = require('../utils/serializers');
const HttpError = require('../utils/httpError');
const { fileUrl } = require('../middlewares/uploadMiddleware');
const audit = require('../services/auditService');

const refreshCookie = 'pagueon_refresh';
const refreshTtlMs = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
const cookieOptions = (remember = true) => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/auth', ...(remember ? { maxAge: refreshTtlMs } : {}) });
const cookieValue = (req, name) => {
  const value = (req.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
};
function sendSession(res, result, message, status = 200, remember = true) { res.cookie(refreshCookie, result.refreshToken, cookieOptions(remember)); return sendSuccess(res, { token: result.token, user: result.user }, message, status); }

async function register(req, res) { const { remember: _remember, ...payload } = req.body || {}; const user = await authService.register(registerSchema.parse(payload)); await audit.record({ eventType: 'account_registered', req, actor: user }); return sendSuccess(res, { user }, 'Conta criada com sucesso. Entre com seu e-mail e senha para continuar.', 201); }
async function login(req, res) { const { remember, email, ...payload } = req.body || {}; const input = loginSchema.parse({ ...payload, identity: payload.identity || email }); try { const result = await authService.login(input); await audit.record({ eventType: 'login', req, actor: result.user, payload: { persistentSession: remember !== false } }); return sendSession(res, result, 'Login realizado com sucesso.', 200, remember !== false); } catch (error) { await audit.record({ eventType: 'login_failed', req, payload: { identityHash: audit.hash(input.identity) } }); throw error; } }
async function refresh(req, res) { const token = cookieValue(req, refreshCookie) || req.body?.refreshToken; if (!token) return sendSuccess(res, null, 'Nenhuma sessão ativa para renovar.'); const result = await authService.refresh(refreshTokenSchema.parse({ refreshToken: token }).refreshToken); return sendSession(res, result, 'Sessão renovada com sucesso.'); }
async function logout(req, res) { const actor = req.actor || req.user; await authService.logout(actor.id); await audit.record({ eventType: 'logout', req, actor }); res.clearCookie(refreshCookie, cookieOptions(false)); return sendSuccess(res, null, 'Sessão encerrada com sucesso.'); }
async function requestPasswordReset(req, res) { const input = passwordResetRequestSchema.parse(req.body); await authService.requestPasswordReset(input.identity); await audit.record({ eventType: 'password_reset_requested', req, payload: { identityHash: audit.hash(input.identity) } }); return sendSuccess(res, null, 'Se houver uma conta compatível, você receberá as instruções de recuperação.'); }
async function resetPassword(req, res) { const input = passwordResetConfirmSchema.parse(req.body); await authService.resetPassword(input.token, input.newPassword); await audit.record({ eventType: 'password_reset_completed', req }); return sendSuccess(res, null, 'Senha atualizada. Entre novamente para continuar.'); }
async function me(req, res) { return sendSuccess(res, publicUser(req.actor || req.user)); }
async function updateMe(req, res) { const actor = req.actor || req.user; const input = profileSchema.parse(req.body); const user = await prisma.user.update({ where: { id: actor.id }, data: { ...input, ...(Object.prototype.hasOwnProperty.call(input, 'phone') ? { phoneNormalized: authService.normalizePhone(input.phone) } : {}) } }); return sendSuccess(res, publicUser(user), 'Perfil atualizado com sucesso.'); }
async function changePassword(req, res) { const actor = req.actor || req.user; const input = passwordSchema.parse(req.body); await authService.changePassword(actor, input.oldPassword, input.newPassword); await audit.record({ eventType: 'password_changed', req, actor }); return sendSuccess(res, null, 'Senha atualizada com sucesso.'); }
async function uploadAvatar(req, res) { const actor = req.actor || req.user; if (!req.file) throw new HttpError(400, 'IMAGE_REQUIRED', 'Envie uma imagem no campo image.'); const user = await prisma.user.update({ where: { id: actor.id }, data: { avatar: fileUrl(req.file) } }); return sendSuccess(res, publicUser(user), 'Foto de perfil atualizada com sucesso.'); }
async function security(req, res) { return sendSuccess(res, await securityService.getSecurity((req.actor || req.user).id)); }
async function updateSecurity(req, res) { return sendSuccess(res, await securityService.updateSettings((req.actor || req.user).id, securitySettingsSchema.parse(req.body)), 'Preferências de segurança atualizadas.'); }
async function setPin(req, res) { return sendSuccess(res, await securityService.setPin((req.actor || req.user).id, pinSchema.parse(req.body).pin), 'PIN definido com sucesso.'); }
async function verifyPin(req, res) { return sendSuccess(res, await securityService.verifyPin((req.actor || req.user).id, pinSchema.parse(req.body).pin)); }
async function biometricRegistrationOptions(req, res) { return sendSuccess(res, await securityService.registrationOptions(req.actor || req.user)); }
async function biometricRegister(req, res) { return sendSuccess(res, await securityService.registerBiometric(req.actor || req.user, webauthnCredentialSchema.parse(req.body.credential)), 'Biometria ativada com sucesso.'); }
async function biometricAuthenticationOptions(req, res) { return sendSuccess(res, await securityService.authenticationOptions((req.actor || req.user).id)); }
async function biometricVerify(req, res) { return sendSuccess(res, await securityService.verifyBiometric((req.actor || req.user).id, webauthnCredentialSchema.parse(req.body.credential))); }

module.exports = { register, login, refresh, logout, requestPasswordReset, resetPassword, me, updateMe, changePassword, uploadAvatar, security, updateSecurity, setPin, verifyPin, biometricRegistrationOptions, biometricRegister, biometricAuthenticationOptions, biometricVerify };
