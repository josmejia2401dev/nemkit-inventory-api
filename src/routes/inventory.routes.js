'use strict';

const { express } = require('nemkit');
const { authorizeResource } = require('../modules/inventory/permissions');
const productsRoutes = require('../modules/inventory/products/products.routes');
const categoriesRoutes = require('../modules/inventory/categories/categories.routes');
const movementsRoutes = require('../modules/inventory/movements/movements.routes');
const dashboardRoutes = require('../modules/inventory/dashboard/dashboard.routes');
const statisticsRoutes = require('../modules/inventory/statistics/statistics.routes');
const statisticsController = require('../modules/inventory/statistics/statistics.controller').statisticsController;
const suppliersRoutes = require('../modules/inventory/suppliers/suppliers.routes');
const customersRoutes = require('../modules/inventory/customers/customers.routes');
const purchasesRoutes = require('../modules/inventory/purchases/purchases.routes');
const salesRoutes = require('../modules/inventory/sales/sales.routes');
const kitchenRoutes = require('../modules/inventory/kitchen/kitchen.routes');
const reportsRoutes = require('../modules/inventory/reports/reports.routes');
const employeePaymentsRoutes = require('../modules/inventory/employee-payments/employee-payments.routes');
const deliveriesRoutes = require('../modules/inventory/deliveries/deliveries.routes');
const tablesRoutes = require('../modules/inventory/tables/tables.routes');
const { employeesController } = require('../modules/foundation/employees/employees.controller');

// Connect cohesive domain services before any inventory request is handled.
require('../modules/inventory/inventory.module');

const router = express.Router();

router.use('/products', authorizeResource('products'), productsRoutes);
router.use('/categories', authorizeResource('categories'), categoriesRoutes);
router.use('/movements', authorizeResource('movements'), movementsRoutes);
router.use('/statistics', statisticsRoutes);
// Legacy profile URL remains an adapter; analytics are owned by statistics.
router.get('/customers/:id/profile', authorizeResource('customers'), statisticsController.customerProfile.bind(statisticsController));
router.use('/dashboard', dashboardRoutes);
router.use('/suppliers', authorizeResource('suppliers'), suppliersRoutes);
router.use('/customers', authorizeResource('customers'), customersRoutes);
router.use('/purchases', authorizeResource('purchases'), purchasesRoutes);
router.use('/sales', authorizeResource('sales'), salesRoutes);
router.use('/kitchen', authorizeResource('kitchen'), kitchenRoutes);
router.use('/reports', authorizeResource('reports'), reportsRoutes);
router.use('/employee-payments', authorizeResource('employee-payments'), employeePaymentsRoutes);
router.get('/employee-options', authorizeResource('employee-options'), employeesController.options.bind(employeesController));
router.use('/deliveries', authorizeResource('deliveries'), deliveriesRoutes);
router.use('/tables', authorizeResource('tables'), tablesRoutes);

module.exports = router;
