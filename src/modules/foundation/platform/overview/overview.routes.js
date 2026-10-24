'use strict';

const { express } = require('nemkit');
const { platformOverviewController: c } = require('./overview.controller');

const router = express.Router();

router.get('/', c.get.bind(c));

module.exports = router;
