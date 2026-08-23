const crypto = require('crypto');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const scrypt = (pin, salt) => new Promise((resolve, reject) => crypto.scrypt(pin, salt, 32, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
const settings = () => ({ rpID: process.env.WEBAUTHN_RP_ID || 'localhost', rpName: process.env.WEBAUTHN_RP_NAME || 'Pague-On', origins: (process.env.WEBAUTHN_ORIGINS || 'http://localhost:5500,http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean) });

function publicSecurity(security, credentialCount = 0) {
  return { biometricEnabled: Boolean(security?.biometricEnabled && credentialCount), pinEnabled: Boolean(security?.pinHash), lockTimeout: security?.lockTimeout ?? 5, hideValues: security?.hideValues ?? false, pinLockedUntil: security?.pinLockedUntil || null, credentialCount };
}
async function ensureSecurity(userId) { return prisma.userSecurity.upsert({ where: { userId }, update: {}, create: { userId } }); }
async function getSecurity(userId) { const [security, count] = await Promise.all([ensureSecurity(userId), prisma.webAuthnCredential.count({ where: { userId } })]); return publicSecurity(security, count); }
async function updateSettings(userId, input) { const security = await prisma.userSecurity.upsert({ where: { userId }, create: { userId, ...input }, update: input }); const count = await prisma.webAuthnCredential.count({ where: { userId } }); return publicSecurity(security, count); }
async function setPin(userId, pin) { const salt = crypto.randomBytes(16).toString('hex'); const hash = (await scrypt(pin, salt)).toString('hex'); const security = await prisma.userSecurity.upsert({ where: { userId }, create: { userId, pinSalt: salt, pinHash: hash }, update: { pinSalt: salt, pinHash: hash, pinAttempts: 0, pinLockedUntil: null } }); const count = await prisma.webAuthnCredential.count({ where: { userId } }); return publicSecurity(security, count); }
async function verifyPin(userId, pin) {
  const security = await ensureSecurity(userId);
  if (!security.pinHash || !security.pinSalt) throw new HttpError(400, 'PIN_NOT_CONFIGURED', 'Defina um PIN antes de usá-lo.');
  if (security.pinLockedUntil && security.pinLockedUntil > new Date()) throw new HttpError(423, 'PIN_LOCKED', 'PIN bloqueado temporariamente. Tente novamente mais tarde.');
  const attempt = (await scrypt(pin, security.pinSalt)).toString('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(security.pinHash, 'hex'));
  if (!valid) {
    const attempts = security.pinAttempts + 1; const locked = attempts >= 3 ? new Date(Date.now() + 5 * 60 * 1000) : null;
    await prisma.userSecurity.update({ where: { userId }, data: { pinAttempts: attempts, pinLockedUntil: locked } });
    throw new HttpError(401, 'INVALID_PIN', `PIN incorreto. ${Math.max(0, 3 - attempts)} tentativa(s) restante(s).`);
  }
  await prisma.userSecurity.update({ where: { userId }, data: { pinAttempts: 0, pinLockedUntil: null } });
  return { verified: true };
}
async function storeChallenge(userId, challenge, type) { await prisma.userSecurity.upsert({ where: { userId }, create: { userId, webauthnChallenge: challenge, challengeType: type, challengeExpiresAt: new Date(Date.now() + 5 * 60 * 1000) }, update: { webauthnChallenge: challenge, challengeType: type, challengeExpiresAt: new Date(Date.now() + 5 * 60 * 1000) } }); }
async function consumeChallenge(userId, type) { const security = await ensureSecurity(userId); if (!security.webauthnChallenge || security.challengeType !== type || !security.challengeExpiresAt || security.challengeExpiresAt < new Date()) throw new HttpError(400, 'WEBAUTHN_CHALLENGE_EXPIRED', 'A solicitação biométrica expirou. Tente novamente.'); await prisma.userSecurity.update({ where: { userId }, data: { webauthnChallenge: null, challengeType: null, challengeExpiresAt: null } }); return security.webauthnChallenge; }
async function registrationOptions(user) { const config = settings(); const credentials = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } }); const options = await generateRegistrationOptions({ rpName: config.rpName, rpID: config.rpID, userID: new TextEncoder().encode(user.id), userName: user.email, userDisplayName: user.name, attestationType: 'none', excludeCredentials: credentials.map((credential) => ({ id: credential.credentialId, transports: credential.transports })), authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' } }); await storeChallenge(user.id, options.challenge, 'REGISTRATION'); return options; }
async function registerBiometric(user, credentialResponse) { const challenge = await consumeChallenge(user.id, 'REGISTRATION'); const config = settings(); const verification = await verifyRegistrationResponse({ response: credentialResponse, expectedChallenge: challenge, expectedOrigin: config.origins, expectedRPID: config.rpID, requireUserVerification: true }); if (!verification.verified || !verification.registrationInfo) throw new HttpError(400, 'WEBAUTHN_REGISTRATION_FAILED', 'Não foi possível validar a biometria.'); const info = verification.registrationInfo; const credential = info.credential; const existing = await prisma.webAuthnCredential.findUnique({ where: { credentialId: credential.id } }); if (existing && existing.userId !== user.id) throw new HttpError(409, 'CREDENTIAL_IN_USE', 'Esta biometria já está vinculada a outra conta.'); await prisma.$transaction([prisma.webAuthnCredential.upsert({ where: { credentialId: credential.id }, create: { userId: user.id, credentialId: credential.id, publicKey: Buffer.from(credential.publicKey), counter: BigInt(credential.counter), transports: credentialResponse.response.transports || [], deviceType: info.credentialDeviceType, backedUp: info.credentialBackedUp }, update: { publicKey: Buffer.from(credential.publicKey), counter: BigInt(credential.counter), transports: credentialResponse.response.transports || [] } }), prisma.userSecurity.update({ where: { userId: user.id }, data: { biometricEnabled: true } })]); return getSecurity(user.id); }
async function authenticationOptions(userId) { const config = settings(); const credentials = await prisma.webAuthnCredential.findMany({ where: { userId } }); if (!credentials.length) throw new HttpError(400, 'BIOMETRIC_NOT_CONFIGURED', 'Nenhuma biometria foi configurada.'); const options = await generateAuthenticationOptions({ rpID: config.rpID, allowCredentials: credentials.map((credential) => ({ id: credential.credentialId, transports: credential.transports })), userVerification: 'required' }); await storeChallenge(userId, options.challenge, 'AUTHENTICATION'); return options; }
async function verifyBiometric(userId, credentialResponse) { const challenge = await consumeChallenge(userId, 'AUTHENTICATION'); const credential = await prisma.webAuthnCredential.findFirst({ where: { userId, credentialId: credentialResponse.id } }); if (!credential) throw new HttpError(401, 'UNKNOWN_CREDENTIAL', 'Credencial biométrica não reconhecida.'); const config = settings(); const verification = await verifyAuthenticationResponse({ response: credentialResponse, expectedChallenge: challenge, expectedOrigin: config.origins, expectedRPID: config.rpID, credential: { id: credential.credentialId, publicKey: new Uint8Array(credential.publicKey), counter: Number(credential.counter), transports: credential.transports }, requireUserVerification: true }); if (!verification.verified) throw new HttpError(401, 'WEBAUTHN_VERIFICATION_FAILED', 'A biometria não foi validada.'); await prisma.webAuthnCredential.update({ where: { id: credential.id }, data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() } }); return { verified: true };
}

module.exports = { getSecurity, updateSettings, setPin, verifyPin, registrationOptions, registerBiometric, authenticationOptions, verifyBiometric, publicSecurity };
