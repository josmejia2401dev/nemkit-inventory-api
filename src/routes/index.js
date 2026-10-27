'use strict';

const { express } = require('nemkit');
const { scopeToUser } = require('../middlewares/inventory.middleware');
const foundationRoutes = require('./foundation.routes');
const inventoryRoutes = require('./inventory.routes');

const router = express.Router();

router.use('/', foundationRoutes);
router.use(scopeToUser);
router.use('/', inventoryRoutes);

module.exports = router;
