const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middlewares/authMiddleware');
const { avatarUpload } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
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
