'use strict';

const { express } = require('nemkit');
const authUsersRoutes = require('../modules/foundation/auth-users/auth-users.routes');
const authEmployeesRoutes = require('../modules/foundation/auth-employees/auth-employees.routes');

const router = express.Router();

router.use('/users', authUsersRoutes);
router.use('/employees', authEmployeesRoutes);

module.exports = router;
