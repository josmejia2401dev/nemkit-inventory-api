'use strict';

const { express } = require('nemkit');
const { authorizeResource } = require('../permissions');
const { statisticsController: c } = require('./statistics.controller');
const router = express.Router();

router.use(authorizeResource('customers'));
router.get('/loyalty-rules', c.customerLoyaltyRules.bind(c));
router.get('/:id/profile', c.customerProfile.bind(c));

module.exports = router;
