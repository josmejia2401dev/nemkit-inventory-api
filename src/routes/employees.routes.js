'use strict';

const { express } = require('nemkit');
const { requireEmployee } = require('../middlewares/employees.middleware');
const employeesProfileRoutes = require('../modules/foundation/employees-profile/employees-profile.routes');

const router = express.Router();

router.use(requireEmployee);
router.use('/profile', employeesProfileRoutes);

module.exports = router;
