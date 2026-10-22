'use strict';

const { createLogger, RequestContext } = require('nemkit');
const { env } = require('./env');

module.exports = createLogger({
  level: env.LOG_LEVEL,
  logsPath: env.LOGS_LOCAL_PATH,
  environment: env.NODE_ENV,
  appName: 'nemkit-timetrack',
  contextProvider: () => ({
    requestId: RequestContext.getRequestId(),
    userId: RequestContext.getUserId(),
  }),
});
