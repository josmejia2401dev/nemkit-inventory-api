'use strict';

const { express } = require('nemkit');
const { systemController } = require('./system.controller');
const { requireRole } = require('../../../middlewares/authorize.middleware');

const router = express.Router();

router.get('/metrics', requireRole('ADMIN'), systemController.getMetrics.bind(systemController));

module.exports = router;
