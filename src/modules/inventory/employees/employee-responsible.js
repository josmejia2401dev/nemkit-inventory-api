'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const { positiveInteger } = require('../validation');
const { EMPLOYEE_STATUS } = require('../inventory.constants');

/**
 * Resuelve y valida el empleado responsable de una transacción (venta, compra,
 * movimiento) dentro del tenant indicado. Devuelve el id y un snapshot inmutable
 * del nombre para conservar el historial aunque el empleado se edite o elimine.
 *
 * @param {Object} params
 * @param {import('mongoose').Model} params.Employee - modelo de empleados
 * @param {number} params.userId - tenant/empresa dueña de la transacción
 * @param {*} params.employeeId - id del empleado responsable (opcional)
 * @param {import('mongoose').ClientSession} [params.session] - sesión de la transacción
 * @returns {Promise<{ employeeId: number|null, employeeSnapshot: { name: string } }>}
 */
async function resolveEmployee({ Employee, userId, employeeId, session = null }) {
  if (employeeId == null || employeeId === '') {
    return { employeeId: null, employeeSnapshot: { name: '' } };
  }

  const id = positiveInteger(employeeId, 'employeeId');
  const query = Employee.findOne({
    _id: id,
    userId,
    status: EMPLOYEE_STATUS.ACTIVE,
    recordStatus: RECORD_STATUS.ACTIVE,
  }).select('_id name');
  if (session) query.session(session);
  const employee = await query.lean();

  if (!employee) throw HttpError.badRequest('Invalid or inactive employeeId');

  return { employeeId: employee._id, employeeSnapshot: { name: employee.name } };
}

module.exports = { resolveEmployee };
