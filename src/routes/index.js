'use strict';

const {
  express,
  success,
  HttpError,
  hashPassword,
  comparePassword,
  RequestContext,
  createValidator,
} = require('nemkit');
const { authenticate } = require('../middlewares/auth.middleware');
const { scopeToTenant } = require('../middlewares/tenant.middleware');
const { requireRole } = require('../middlewares/authorize.middleware');
const { authorizeResource } = require('../modules/inventory/permissions');
const authRoutes = require('../modules/foundation/auth/auth.routes');
const { usersService } = require('../modules/foundation/users/users.service');
const productsRoutes = require('../modules/inventory/products/products.routes');
const categoriesRoutes = require('../modules/inventory/categories/categories.routes');
const movementsRoutes = require('../modules/inventory/movements/movements.routes');
const dashboardRoutes = require('../modules/inventory/dashboard/dashboard.routes');
const suppliersRoutes = require('../modules/inventory/suppliers/suppliers.routes');
const customersRoutes = require('../modules/inventory/customers/customers.routes');
const purchasesRoutes = require('../modules/inventory/purchases/purchases.routes');
const salesRoutes = require('../modules/inventory/sales/sales.routes');
const kitchenRoutes = require('../modules/inventory/sales/kitchen.routes');
const reportsRoutes = require('../modules/inventory/reports/reports.routes');
const employeesRoutes = require('../modules/inventory/employees/employees.routes');
const { employeesController } = require('../modules/inventory/employees/employees.controller');
const deliveriesRoutes = require('../modules/inventory/deliveries/deliveries.routes');
const tablesRoutes = require('../modules/inventory/tables/tables.routes');

const router = express.Router();

const profileSchema = createValidator({
  fullName: { type: 'string', required: true, trim: true, minLength: 2, maxLength: 160 },
  email: { type: 'email', required: true, trim: true, lowercase: true, maxLength: 254 },
});
const businessSchema = createValidator({
  companyName: { type: 'string', trim: true, maxLength: 160 },
  businessType: { type: 'string', enum: ['retail', 'restaurant'] },
});
const passwordSchema = createValidator({
  currentPassword: { type: 'string', required: true, minLength: 1, maxLength: 128 },
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});

router.use('/auth', authRoutes);
router.use(authenticate);

router.use((req, _res, next) => {
  if (req.user?.id != null) RequestContext.setUserId(req.user.id);
  next();
});

router.get('/profile', async (req, res, next) => {
  try {
    const user = await usersService.getById(req.user.id);
    return success(res, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      companyName: user.companyName ?? '',
      businessType: user.businessType ?? 'retail',
      security: {
        loginAttempts: user.security?.loginAttempts ?? 0,
        lastLockedAt: user.security?.lastLockedAt ?? null,
        lockedUntil: user.security?.lockedUntil ?? null,
        lastLoginAt: user.security?.lastLoginAt ?? null,
        mustChangePassword: user.security?.mustChangePassword ?? false,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { errorResponse, sanitized } = profileSchema.check(req.body ?? {}, req);
    if (errorResponse) return res.status(400).json(errorResponse);

    let user;
    try {
      user = await usersService.updateById(req.user.id, sanitized, req.user.id);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Email already registered');
      throw error;
    }

    return success(res, { fullName: user.fullName, email: user.email }, 'Profile updated');
  } catch (error) {
    next(error);
  }
});

router.put('/profile/password', async (req, res, next) => {
  try {
    const { errorResponse, sanitized } = passwordSchema.check(req.body ?? {}, req);
    if (errorResponse) return res.status(400).json(errorResponse);
    const { currentPassword, newPassword } = sanitized;

    const user = await usersService.findByIdWithPassword(req.user.id);
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      throw HttpError.badRequest('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    await usersService.updateById(req.user.id, { passwordHash }, req.user.id);

    return success(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
});

// Configuración del negocio (nombre y tipo). Solo el administrador de la cuenta,
// y aplica sobre el usuario dueño (tenant), no sobre un empleado.
router.put('/settings/business', requireRole('ADMIN', 'SUPERADMIN'), async (req, res, next) => {
  try {
    const { errorResponse, sanitized } = businessSchema.check(req.body ?? {}, req);
    if (errorResponse) return res.status(400).json(errorResponse);
    const tenantId = req.user.tenantId ?? req.user.id;
    const update = {};
    if (sanitized.companyName !== undefined) update.companyName = sanitized.companyName;
    if (sanitized.businessType !== undefined) update.businessType = sanitized.businessType;
    const user = await usersService.updateById(tenantId, update, req.user.id);
    return success(res, {
      companyName: user.companyName ?? '',
      businessType: user.businessType ?? 'retail',
    }, 'Business settings updated. Sign in again to apply the new mode.');
  } catch (error) {
    next(error);
  }
});

// A partir de aquí, el dominio de inventario opera sobre la empresa (tenant).
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
router.use('/reports', requireRole('ADMIN', 'SUPERADMIN'), reportsRoutes);
router.use('/employees', requireRole('ADMIN', 'SUPERADMIN'), employeesRoutes);
router.get('/employee-options', authorizeResource('employee-options'), employeesController.options.bind(employeesController));
router.use('/deliveries', authorizeResource('deliveries'), deliveriesRoutes);
router.use('/tables', authorizeResource('tables'), tablesRoutes);

module.exports = router;
