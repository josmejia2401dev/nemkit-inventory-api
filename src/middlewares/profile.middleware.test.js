'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Las pruebas cubren la lógica de AUTORIZACIÓN por perfil (quién puede entrar a
// cada espacio), que no depende de la base de datos. El scoping con BD se cubre
// en pruebas de integración aparte.
const {
  requireSuperAdmin,
  requireCompany,
  requireEmployee,
} = require('./profile.middleware');

/** Captura el error pasado a next() (o null si llamó next sin args). */
function run(mw, req) {
  return new Promise((resolve) => {
    mw(req, {}, (err) => resolve(err ?? null));
  });
}

test('requireSuperAdmin: deja pasar al SUPERADMIN', async () => {
  const err = await run(requireSuperAdmin, { user: { id: 1, roles: ['SUPERADMIN'] } });
  assert.equal(err, null);
});

test('requireSuperAdmin: rechaza a una empresa', async () => {
  const err = await run(requireSuperAdmin, { user: { id: 1, roles: ['ADMIN'] } });
  assert.ok(err, 'debe pasar un error a next');
  assert.equal(err.statusCode, 403);
});

test('requireSuperAdmin: rechaza a un empleado', async () => {
  const err = await run(requireSuperAdmin, { user: { id: 5, roles: ['CASHIER'], employeeId: 5 } });
  assert.ok(err);
  assert.equal(err.statusCode, 403);
});

test('requireCompany: rechaza a un empleado (tiene employeeId)', async () => {
  const err = await run(requireCompany, { user: { id: 5, roles: ['CASHIER'], employeeId: 5 } });
  assert.ok(err);
  assert.equal(err.statusCode, 403);
});

test('requireCompany: rechaza al SUPERADMIN', async () => {
  const err = await run(requireCompany, { user: { id: 1, roles: ['SUPERADMIN'], employeeId: null } });
  assert.ok(err);
  assert.equal(err.statusCode, 403);
});

test('requireEmployee: rechaza a una empresa (sin employeeId)', async () => {
  const err = await run(requireEmployee, { user: { id: 1, roles: ['ADMIN'], employeeId: null } });
  assert.ok(err);
  assert.equal(err.statusCode, 403);
});
