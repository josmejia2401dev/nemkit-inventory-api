'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { employeePaymentsController: c } = require('./employee-payments.controller');
const router = express.Router();

router.use(requireRole('ADMIN'));
router.get('/summary', c.summary.bind(c));
router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));

module.exports = router;
