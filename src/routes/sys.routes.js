'use strict';

const { express } = require('nemkit');
const { requireSuperAdmin } = require('../middlewares/sys.middleware');
const sysOverviewRoutes = require('../modules/foundation/sys-overview/sys-overview.routes');
const sysUsersRoutes = require('../modules/foundation/sys-users/sys-users.routes');
const sysCompaniesRoutes = require('../modules/foundation/sys-companies/sys-companies.routes');
const sysEmployeesRoutes = require('../modules/foundation/sys-employees/sys-employees.routes');

const router = express.Router();

router.use(requireSuperAdmin);
router.use('/overview', sysOverviewRoutes);
router.use('/users', sysUsersRoutes);
router.use('/companies', sysCompaniesRoutes);
router.use('/employees', sysEmployeesRoutes);

module.exports = router;
