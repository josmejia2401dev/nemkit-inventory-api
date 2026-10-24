'use strict';

const {
  express,
  RequestContext,
} = require('nemkit');
const { authenticate } = require('../middlewares/auth.middleware');
const { scopeToTenant } = require('../middlewares/tenant.middleware');
const { requireRole } = require('../middlewares/authorize.middleware');
const { authorizeResource } = require('../modules/inventory/permissions');
const authRoutes = require('../modules/foundation/auth/auth.routes');
const profileRoutes = require('../modules/foundation/profile/profile.routes');
const businessSettingsRoutes = require('../modules/foundation/business-settings/business-settings.routes');
const productsRoutes = require('../modules/inventory/products/products.routes');
const categoriesRoutes = require('../modules/inventory/categories/categories.routes');
const movementsRoutes = require('../modules/inventory/movements/movements.routes');
const dashboardRoutes = require('../modules/inventory/dashboard/dashboard.routes');
const suppliersRoutes = require('../modules/inventory/suppliers/suppliers.routes');
const customersRoutes = require('../modules/inventory/customers/customers.routes');
const purchasesRoutes = require('../modules/inventory/purchases/purchases.routes');
const salesRoutes = require('../modules/inventory/sales/sales.routes');
const kitchenRoutes = require('../modules/inventory/kitchen/kitchen.routes');
const reportsRoutes = require('../modules/inventory/reports/reports.routes');
const employeesRoutes = require('../modules/inventory/employees/employees.routes');
const { employeesController } = require('../modules/inventory/employees/employees.controller');
const deliveriesRoutes = require('../modules/inventory/deliveries/deliveries.routes');
const tablesRoutes = require('../modules/inventory/tables/tables.routes');
const feedbackRoutes = require('../modules/foundation/feedback/feedback.routes');
const platformRoutes = require('../modules/foundation/platform/platform.routes');
const notificationsRoutes = require('../modules/foundation/notifications/notifications.routes');
const platformMembersRoutes = require('../modules/inventory/platform-members/platform-members.routes');

// Conecta los servicios de dominio que colaboran entre micromódulos.
require('../modules/inventory/inventory.module');

const router = express.Router();

router.use('/auth', authRoutes);
router.use(authenticate);

router.use((req, _res, next) => {
  if (req.user?.id != null) RequestContext.setUserId(req.user.id);
  next();
});

router.use('/profile', profileRoutes);

// Reportes de bugs/hallazgos: transversal. Cualquier usuario reporta; el super
// admin los ve TODOS (global, sin acotar por empresa), por eso va antes del scope.
router.use('/feedback', feedbackRoutes);
router.use('/notifications', notificationsRoutes);

// Administración de PLATAFORMA (super admin): usuarios, empresas, logs, métricas.
// Global, sin acotar por tenant → va ANTES de scopeToTenant.
router.use('/platform', platformRoutes);
router.use('/platform', platformMembersRoutes);

// A partir de aquí, el dominio de inventario opera sobre la empresa (tenant).
router.use(scopeToTenant);

router.use('/settings', businessSettingsRoutes);
router.use('/products', authorizeResource('products'), productsRoutes);
router.use('/categories', authorizeResource('categories'), categoriesRoutes);
router.use('/movements', authorizeResource('movements'), movementsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/suppliers', authorizeResource('suppliers'), suppliersRoutes);
router.use('/customers', authorizeResource('customers'), customersRoutes);
router.use('/purchases', authorizeResource('purchases'), purchasesRoutes);
router.use('/sales', authorizeResource('sales'), salesRoutes);
router.use('/kitchen', authorizeResource('kitchen'), kitchenRoutes);
router.use('/reports', requireRole('ADMIN'), reportsRoutes);
router.use('/employees', requireRole('ADMIN'), employeesRoutes);
router.get('/employee-options', authorizeResource('employee-options'), employeesController.options.bind(employeesController));
router.use('/deliveries', authorizeResource('deliveries'), deliveriesRoutes);
router.use('/tables', authorizeResource('tables'), tablesRoutes);

module.exports = router;
