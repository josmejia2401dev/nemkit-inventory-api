'use strict';

const { express } = require('nemkit');
const { employeesProfileController: c } = require('./employees-profile.controller');

const router = express.Router();

router.get('/', c.get.bind(c));
router.put('/', c.update.bind(c));
router.put('/password', c.changePassword.bind(c));

module.exports = router;
