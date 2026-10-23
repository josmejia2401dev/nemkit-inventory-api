'use strict';

const { express } = require('nemkit');
const { platformController: c } = require('./platform.controller');
const { requireRole } = require('../../../middlewares/authorize.middleware');

const router = express.Router();

// Todo el espacio de plataforma es exclusivo del super administrador.
router.use(requireRole('SUPERADMIN'));

router.get('/overview', c.overview.bind(c));

router.get('/users', c.listUsers.bind(c));
router.get('/users/:id', c.getUser.bind(c));

router.get('/companies', c.listCompanies.bind(c));
router.get('/companies/:id', c.getCompany.bind(c));

router.get('/metrics', c.metrics.bind(c));
router.get('/logs/files', c.listLogFiles.bind(c));
router.get('/logs/read', c.readLogs.bind(c));

module.exports = router;
