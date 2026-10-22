'use strict';
const { express } = require('nemkit');
const { categoriesController: c } = require('./categories.controller');
const router = express.Router();

router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.put('/:id', c.update.bind(c));
router.delete('/:id', c.remove.bind(c));

module.exports = router;
