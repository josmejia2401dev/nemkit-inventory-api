'use strict';

const { express, RequestContext } = require('nemkit');
const { authenticate } = require('../middlewares/auth.middleware');
const authRoutes = require('./auth.routes');
const feedbackRoutes = require('../modules/foundation/feedback/feedback.routes');
const sysRoutes = require('./sys.routes');
const usersRoutes = require('./users.routes');
const employeesRoutes = require('./employees.routes');

const router = express.Router();

router.use('/auth', authRoutes);

router.use(authenticate);
router.use((req, _res, next) => {
  if (req.user?.id != null) RequestContext.setUserId(req.user.id);
  next();
});

router.use('/feedback', feedbackRoutes);
router.use('/sys', sysRoutes);
router.use('/users', usersRoutes);
router.use('/employees', employeesRoutes);

module.exports = router;
