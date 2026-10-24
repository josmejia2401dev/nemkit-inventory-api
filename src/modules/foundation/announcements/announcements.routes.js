'use strict';

const { express } = require('nemkit');
const { announcementsController: c } = require('./announcements.controller');

const router = express.Router();

router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id', c.update.bind(c));
router.post('/:id/publish', c.publish.bind(c));
router.post('/:id/archive', c.archive.bind(c));

module.exports = router;
