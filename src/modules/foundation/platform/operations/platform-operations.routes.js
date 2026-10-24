'use strict';

const { express } = require('nemkit');
const { platformOperationsController: c } = require('./platform-operations.controller');

const router = express.Router();

router.get('/metrics', c.metrics.bind(c));
router.get('/logs/files', c.listLogFiles.bind(c));
router.get('/logs/read', c.readLogs.bind(c));

module.exports = router;
