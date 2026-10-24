'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { platformMembersController: c } = require('./platform-members.controller');

const router = express.Router();

router.use(requireRole('SUPERADMIN'));
router.post('/companies/:companyId/members', c.associate.bind(c));
router.delete('/companies/:companyId/members/:userId', c.disassociate.bind(c));
router.get('/users/:userId/employment-history', c.employmentHistory.bind(c));

module.exports = router;
