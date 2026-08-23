const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const auth = require('../middlewares/authMiddleware');
const { avatarUpload } = require('../middlewares/uploadMiddleware');

const router = express.Router();
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.', code: 'AUTH_RATE_LIMITED' } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: 'Muitas solicitações de recuperação. Tente novamente mais tarde.', code: 'RESET_RATE_LIMITED' } });

router.post('/register', credentialLimiter, controller.register);
router.post('/login', credentialLimiter, controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', auth, controller.logout);
router.post('/password-reset/request', resetLimiter, controller.requestPasswordReset);
router.post('/password-reset/confirm', resetLimiter, controller.resetPassword);
router.get('/me', auth, controller.me);
router.put('/me', auth, controller.updateMe);
router.put('/password', auth, controller.changePassword);
router.post('/avatar', auth, avatarUpload, controller.uploadAvatar);
router.get('/security', auth, controller.security);
router.put('/security', auth, controller.updateSecurity);
router.post('/pin/set', auth, controller.setPin);
router.post('/pin/verify', auth, controller.verifyPin);
router.post('/biometric/registration/options', auth, controller.biometricRegistrationOptions);
router.post('/biometric/registration/verify', auth, controller.biometricRegister);
router.post('/biometric/authentication/options', auth, controller.biometricAuthenticationOptions);
router.post('/biometric/authentication/verify', auth, controller.biometricVerify);

module.exports = router;
