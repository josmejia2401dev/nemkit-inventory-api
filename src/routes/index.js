'use strict';

const { express } = require('nemkit');
const { foundation } = require('../config/foundation');
const { scopeToUser } = require('../middlewares/inventory.middleware');
const inventoryRoutes = require('./inventory.routes');

const router = express.Router();

// Foundation transversal (auth, usuarios, empleados, límites, feedback, sys).
router.use('/foundation', foundation.router);

// Rutas operativas del dominio: JWT + scope a la empresa/empleado.
router.use(foundation.middlewares.authenticate);
router.use(scopeToUser);
router.use('/', inventoryRoutes);

module.exports = router;
