'use strict';

const { mongoose } = require('nemkit');
const { mongoClient } = require('../../config/db');
const { ACCOUNT_TYPE } = require('../../modules/foundation/users/users.constants');

const APPLY_CHANGES = process.argv.includes('--apply');

function isCompanyOwner(user) {
  if (user.accountType === ACCOUNT_TYPE.COMPANY_OWNER) return true;
  if (user.accountType && user.accountType !== ACCOUNT_TYPE.COMPANY_OWNER) return false;
  if (user.employeeId != null || user.accountType === ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE) return false;

  const roles = user.roles ?? [];
  if (roles.includes('SUPERADMIN') && !roles.includes('ADMIN') && !user.companyName) return false;
  return true;
}

function resolveUserId(user, employeeUserIds) {
  if (user.accountType === ACCOUNT_TYPE.SUPERADMIN
    || user.accountType === ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE) return null;
  const roles = user.roles ?? [];
  if (roles.includes('SUPERADMIN') && !roles.includes('ADMIN') && !user.companyName) return null;

  if (isCompanyOwner(user)) return user._id;

  if (user.employeeId != null) {
    return employeeUserIds.get(user.employeeId) ?? user.userId ?? user.tenantId ?? null;
  }

  return user.userId ?? user.tenantId ?? null;
}

async function run() {
  await mongoClient.connect();
  const database = mongoose.connection.db;
  const employees = database.collection('foundation_employees');
  const users = database.collection('users');
  const feedback = database.collection('feedback');

  const employeeCount = await employees.countDocuments({
    $or: [
      { tenantId: { $exists: true } },
      { userId: { $exists: false } },
    ],
  });
  const userCount = await users.countDocuments({
    $or: [
      { tenantId: { $exists: true } },
      { userId: { $exists: false } },
    ],
  });
  const feedbackCount = await feedback.countDocuments({ tenantId: { $exists: true } });

  console.info(JSON.stringify({
    mode: APPLY_CHANGES ? 'apply' : 'dry-run',
    collections: {
      foundation_employees: employeeCount,
      users: userCount,
      feedback: feedbackCount,
    },
  }, null, 2));

  if (!APPLY_CHANGES) {
    console.info('No documents changed. Re-run with --apply after taking a database backup.');
    return;
  }

  const employeeResult = await employees.updateMany(
    {},
    [
      { $set: { userId: { $ifNull: ['$userId', '$tenantId'] } } },
      { $unset: 'tenantId' },
    ],
  );

  const employeeDocuments = await employees.find({}, { projection: { _id: 1, userId: 1 } }).toArray();
  const employeeUserIds = new Map(employeeDocuments.map((employee) => [employee._id, employee.userId]));
  const userDocuments = await users.find({}, {
    projection: {
      _id: 1,
      accountType: 1,
      employeeId: 1,
      userId: 1,
      tenantId: 1,
      roles: 1,
      companyName: 1,
    },
  }).toArray();

  let usersModified = 0;
  for (const user of userDocuments) {
    const userId = resolveUserId(user, employeeUserIds);
    const result = await users.updateOne(
      { _id: user._id },
      { $set: { userId }, $unset: { tenantId: '' } },
    );
    usersModified += result.modifiedCount;
  }

  const feedbackResult = await feedback.updateMany(
    { tenantId: { $exists: true } },
    [
      { $set: { userId: { $ifNull: ['$userId', '$tenantId'] } } },
      { $unset: 'tenantId' },
    ],
  );

  console.info(JSON.stringify({
    completed: true,
    modified: {
      foundation_employees: employeeResult.modifiedCount,
      users: usersModified,
      feedback: feedbackResult.modifiedCount,
    },
    nextStep: 'Restart the API so its declared indexes are synchronized.',
  }, null, 2));
}

run()
  .catch((error) => {
    console.error('Company user ID migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoClient.close();
  });
