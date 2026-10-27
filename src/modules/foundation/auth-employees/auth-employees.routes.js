'use strict';

const { express } = require('nemkit');
const { authEmployeeController } = require('./auth-employees.controller');
const { authController } = require('../auth-users/auth-users.controller');
const { authenticate } = require('../../../middlewares/auth.middleware');

const router = express.Router();

// Autenticación de EMPLEADOS (colección propia). El logout reutiliza el del
// controlador de empresas: solo revoca la sesión por jti/audiencia.
router.post('/login',           authEmployeeController.login.bind(authEmployeeController));
router.post('/refresh',         authEmployeeController.refresh.bind(authEmployeeController));
router.post('/logout',          authenticate, authController.logout.bind(authController));
router.post('/forgot-password', authEmployeeController.forgotPassword.bind(authEmployeeController));
router.post('/reset-password',  authEmployeeController.resetPassword.bind(authEmployeeController));

module.exports = router;
