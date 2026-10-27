'use strict';

const { express } = require('nemkit');
const { platformCompaniesController: c } = require('./sys-companies.controller');

const router = express.Router();

router.get('/', c.list.bind(c));
router.get('/:id', c.get.bind(c));

module.exports = router;
