'use strict';

const { express } = require('nemkit');
const {
  requireCompanyAdmin,
  requireCompanyOrSuperAdmin,
} = require('../middlewares/users.middleware');
const usersProfileRoutes = require('../modules/foundation/users-profile/users-profile.routes');
const employeesRoutes = require('../modules/foundation/employees/employees.routes');

const router = express.Router();

router.use('/profile', requireCompanyOrSuperAdmin, usersProfileRoutes);
router.use('/employees', requireCompanyAdmin, employeesRoutes);

module.exports = router;
