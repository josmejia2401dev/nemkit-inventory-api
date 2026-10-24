'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { businessSettingsController: c } = require('./business-settings.controller');

const router = express.Router();

router.put('/business', requireRole('ADMIN'), c.update.bind(c));

module.exports = router;
