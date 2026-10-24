'use strict';

const { express } = require('nemkit');
const { platformUsersController: c } = require('./platform-users.controller');

const router = express.Router();

router.get('/', c.list.bind(c));
router.get('/:id', c.get.bind(c));

module.exports = router;
