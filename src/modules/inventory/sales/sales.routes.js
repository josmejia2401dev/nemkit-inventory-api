'use strict';
const { express } = require('nemkit');
const { salesController: c } = require('./sales.controller');
const router = express.Router();
router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:id', c.get.bind(c));
module.exports = router;
