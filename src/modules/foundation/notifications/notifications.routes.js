'use strict';

const { express } = require('nemkit');
const { notificationsController: c } = require('./notifications.controller');

const router = express.Router();

router.get('/', c.list.bind(c));
router.get('/unread-count', c.unreadCount.bind(c));
router.put('/read-all', c.markAllRead.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id/read', c.markRead.bind(c));

module.exports = router;
