'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const overviewRoutes = require('./overview/overview.routes');
const usersRoutes = require('./users/platform-users.routes');
const companiesRoutes = require('./companies/platform-companies.routes');
const operationsRoutes = require('./operations/platform-operations.routes');
const announcementsRoutes = require('../announcements/announcements.routes');

const router = express.Router();

// Todo el espacio de plataforma es exclusivo del super administrador.
router.use(requireRole('SUPERADMIN'));

router.use('/overview', overviewRoutes);
router.use('/users', usersRoutes);
router.use('/companies', companiesRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/', operationsRoutes);

module.exports = router;
