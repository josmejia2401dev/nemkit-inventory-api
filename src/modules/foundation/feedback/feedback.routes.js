'use strict';

const { express } = require('nemkit');
const { feedbackController: c } = require('./feedback.controller');
const { requireRole } = require('../../../middlewares/authorize.middleware');

const router = express.Router();

// Cualquier usuario autenticado puede enviar un reporte.
router.post('/', c.create.bind(c));
// Solo el super admin ve y gestiona todos los reportes (transversal, sin tenant).
router.get('/', requireRole('SUPERADMIN'), c.list.bind(c));
router.put('/:id/status', requireRole('SUPERADMIN'), c.changeStatus.bind(c));

module.exports = router;
