'use strict';
const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { dashboardController } = require('./dashboard.controller');
const router = express.Router();

// El resumen global (inventario, ventas, clientes, empleados, entregas) es una
// vista de gestión; solo para administradores. Los roles operativos tienen su
// propio tablero ligero en el front y no consumen este endpoint.
router.get('/summary', requireRole('ADMIN', 'SUPERADMIN'), dashboardController.summary.bind(dashboardController));
// Las alertas de stock las usan administración y bodega.
router.get('/alerts', requireRole('ADMIN', 'SUPERADMIN', 'WAREHOUSE'), dashboardController.alerts.bind(dashboardController));

module.exports = router;
