'use strict';

const { express } = require('nemkit');
const { platformEmployeesController: controller } = require('./sys-employees.controller');

const router = express.Router();

router.get('/', controller.list.bind(controller));

module.exports = router;
