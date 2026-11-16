'use strict';

const { express } = require('nemkit');
const { limitsController: c } = require('./limits.controller');

const router = express.Router();

router.get('/plans', c.plans.bind(c));
router.get('/', c.get.bind(c));

module.exports = router;
