'use strict';

const { express } = require('nemkit');
const { logsController } = require('./logs.controller');
const { requireRole } = require('../../../middlewares/authorize.middleware');

const router = express.Router();

// All log endpoints require ADMIN role
router.use(requireRole('ADMIN'));

router.get('/files', logsController.listFiles.bind(logsController));
router.get('/read',  logsController.read.bind(logsController));

module.exports = router;
