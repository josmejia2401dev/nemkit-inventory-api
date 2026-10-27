'use strict';

const { express } = require('nemkit');
const { authController } = require('./auth.controller');
const { authEmployeeController } = require('./auth-employee.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');

const router = express.Router();

// ── Login de EMPRESAS (dueños de cuenta) ─────────────────────────────────
router.post('/register',        authController.register.bind(authController));
router.post('/login',           authController.login.bind(authController));
router.post('/refresh',         authController.refresh.bind(authController));
router.post('/logout',          authenticate, authController.logout.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password',  authController.resetPassword.bind(authController));

// ── Login de EMPLEADOS (colección propia) ────────────────────────────────
router.post('/employee/login',           authEmployeeController.login.bind(authEmployeeController));
router.post('/employee/refresh',          authEmployeeController.refresh.bind(authEmployeeController));
router.post('/employee/logout',           authenticate, authController.logout.bind(authController));
router.post('/employee/forgot-password',  authEmployeeController.forgotPassword.bind(authEmployeeController));
router.post('/employee/reset-password',   authEmployeeController.resetPassword.bind(authEmployeeController));

module.exports = router;
