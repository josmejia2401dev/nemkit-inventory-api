'use strict';

const {
  express,
  RequestContext,
} = require('nemkit');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  requireSuperAdmin,
  requireCompany,
  requireEmployee,
  scopeToTenant,
} = require('../middlewares/profile.middleware');
const { authorizeResource } = require('../modules/inventory/permissions');

// ── Auth (público) ───────────────────────────────────────────────────────
const authUsersRoutes = require('../modules/foundation/auth-users/auth-users.routes');
const authEmployeesRoutes = require('../modules/foundation/auth-employees/auth-employees.routes');

// ── Perfiles ──────────────────────────────────────────────────────────────
const usersProfileRoutes = require('../modules/foundation/users-profile/users-profile.routes');
const employeesProfileRoutes = require('../modules/foundation/employees-profile/employees-profile.routes');

// ── Gestión de empleados (la hace la empresa) ──────────────────────────────
const employeesRoutes = require('../modules/foundation/employees/employees.routes');
const { employeesController } = require('../modules/foundation/employees/employees.controller');

// ── Super admin (/sys) ──────────────────────────────────────────────────────
const sysOverviewRoutes = require('../modules/foundation/sys-overview/sys-overview.routes');
const sysUsersRoutes = require('../modules/foundation/sys-users/sys-users.routes');
const sysCompaniesRoutes = require('../modules/foundation/sys-companies/sys-companies.routes');

// ── Transversal ─────────────────────────────────────────────────────────────
const feedbackRoutes = require('../modules/foundation/feedback/feedback.routes');

// ── Dominio de inventario (empresa + empleados) ────────────────────────────
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
const deliveriesRoutes = require('../modules/inventory/deliveries/deliveries.routes');
const tablesRoutes = require('../modules/inventory/tables/tables.routes');

// Conecta los servicios de dominio que colaboran entre micromódulos.
require('../modules/inventory/inventory.module');

const router = express.Router();

// ── Autenticación (sin sesión previa) ──────────────────────────────────────
router.use('/auth/users', authUsersRoutes);
router.use('/auth/employees', authEmployeesRoutes);

// A partir de aquí todo exige sesión válida.
router.use(authenticate);
router.use((req, _res, next) => {
  if (req.user?.id != null) RequestContext.setUserId(req.user.id);
  next();
});

// Transversal: cualquier usuario autenticado puede reportar.
router.use('/feedback', feedbackRoutes);

// ── /sys — Super administrador (global, sin tenant) ─────────────────────────
router.use('/sys', requireSuperAdmin);
router.use('/sys/overview', sysOverviewRoutes);
router.use('/sys/users', sysUsersRoutes);
router.use('/sys/companies', sysCompaniesRoutes);

// ── /users — Espacio de la EMPRESA (dueño) ─────────────────────────────────
router.use('/users', requireCompany);
router.use('/users/profile', usersProfileRoutes);
router.use('/users/employees', employeesRoutes); // la empresa gestiona su equipo

// ── /employees — Espacio del EMPLEADO (self-service) ───────────────────────
router.use('/employees', requireEmployee);
router.use('/employees/profile', employeesProfileRoutes);

// ── Dominio de inventario — empresa O empleado (nunca super admin) ─────────
router.use(scopeToTenant);
router.use('/products', authorizeResource('products'), productsRoutes);
router.use('/categories', authorizeResource('categories'), categoriesRoutes);
router.use('/movements', authorizeResource('movements'), movementsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/suppliers', authorizeResource('suppliers'), suppliersRoutes);
router.use('/customers', authorizeResource('customers'), customersRoutes);
router.use('/purchases', authorizeResource('purchases'), purchasesRoutes);
router.use('/sales', authorizeResource('sales'), salesRoutes);
router.use('/kitchen', authorizeResource('kitchen'), kitchenRoutes);
router.use('/reports', authorizeResource('reports'), reportsRoutes);
router.get('/employee-options', authorizeResource('employee-options'), employeesController.options.bind(employeesController));
router.use('/deliveries', authorizeResource('deliveries'), deliveriesRoutes);
router.use('/tables', authorizeResource('tables'), tablesRoutes);

module.exports = router;
