'use strict';

const { express } = require('nemkit');
const { authorizeResource } = require('../modules/inventory/permissions');
const productsRoutes = require('../modules/inventory/products/products.routes');
const cashWithdrawalsRoutes = require('../modules/inventory/cash-withdrawals/cash-withdrawals.routes');
const categoriesRoutes = require('../modules/inventory/categories/categories.routes');
const movementsRoutes = require('../modules/inventory/movements/movements.routes');
const dashboardRoutes = require('../modules/inventory/dashboard/dashboard.routes');
const statisticsRoutes = require('../modules/inventory/statistics/statistics.routes');
const loyaltyController = require('../modules/inventory/statistics/loyalty/loyalty.controller').loyaltyController;
const suppliersRoutes = require('../modules/inventory/suppliers/suppliers.routes');
const customersRoutes = require('../modules/inventory/customers/customers.routes');
const purchasesRoutes = require('../modules/inventory/purchases/purchases.routes');
const salesRoutes = require('../modules/inventory/sales/sales.routes');
const layawaysRoutes = require('../modules/inventory/layaways/layaways.routes');
const reportsRoutes = require('../modules/inventory/reports/reports.routes');
const deliveriesRoutes = require('../modules/inventory/deliveries/deliveries.routes');
const { employeeOptionsController } = require('../modules/inventory/employee-options/employee-options.controller');

// Conecta los servicios de dominio antes de atender requests.
require('../modules/inventory/inventory.module');

const router = express.Router();

router.use('/products', authorizeResource('products'), productsRoutes);
router.use('/categories', authorizeResource('categories'), categoriesRoutes);
router.use('/movements', authorizeResource('movements'), movementsRoutes);
router.use('/statistics', statisticsRoutes);
router.get('/customers/:id/profile', authorizeResource('customers'), loyaltyController.customerProfile.bind(loyaltyController));
router.use('/dashboard', dashboardRoutes);
router.use('/suppliers', authorizeResource('suppliers'), suppliersRoutes);
router.use('/customers', authorizeResource('customers'), customersRoutes);
router.use('/purchases', authorizeResource('purchases'), purchasesRoutes);
router.use('/sales', authorizeResource('sales'), salesRoutes);
router.use('/layaways', authorizeResource('layaways'), layawaysRoutes);
router.use('/reports', authorizeResource('reports'), reportsRoutes);
router.use('/cash-withdrawals', authorizeResource('cash-withdrawals'), cashWithdrawalsRoutes);
router.get('/employee-options', authorizeResource('employee-options'), employeeOptionsController.options.bind(employeeOptionsController));
router.use('/deliveries', authorizeResource('deliveries'), deliveriesRoutes);

module.exports = router;
