'use strict';

const {
  express,
  success,
  HttpError,
  hashPassword,
  comparePassword,
  RequestContext,
} = require('nemkit');
const { authenticate } = require('../middlewares/auth.middleware');
const authRoutes = require('../modules/foundation/auth/auth.routes');
const { usersService } = require('../modules/foundation/users/users.service');
const productsRoutes = require('../modules/inventory/products/products.routes');
const categoriesRoutes = require('../modules/inventory/categories/categories.routes');
const movementsRoutes = require('../modules/inventory/movements/movements.routes');
const dashboardRoutes = require('../modules/inventory/dashboard/dashboard.routes');

const router = express.Router();

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
    const { fullName, email } = req.body;
    const user = await usersService.updateById(
      req.user.id,
      { fullName, email },
      req.user.id,
    );

    return success(res, { fullName: user.fullName, email: user.email }, 'Profile updated');
  } catch (error) {
    next(error);
  }
});

router.put('/profile/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      throw HttpError.badRequest('A valid current password and new password (at least 6 characters) are required');
    }

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

router.use('/products', productsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/movements', movementsRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
