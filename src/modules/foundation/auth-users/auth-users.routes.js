'use strict';

const { express } = require('nemkit');
const { authController } = require('./auth-users.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');

const router = express.Router();

// Autenticación de EMPRESAS (dueños de cuenta).
router.post('/register',        authController.register.bind(authController));
router.post('/login',           authController.login.bind(authController));
router.post('/refresh',         authController.refresh.bind(authController));
router.post('/logout',          authenticate, authController.logout.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password',  authController.resetPassword.bind(authController));

module.exports = router;
