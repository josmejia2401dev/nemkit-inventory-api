'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const {
  LIMIT_PERIOD,
  BUSINESS_TIMEZONE,
  PLANS,
  DEFAULT_PLAN,
  LIMIT_LABELS,
} = require('./limits.constants');
const User = require('../users/users.model');
const Employee = require('../employees/employees.model');
const { EMPLOYEE_STATUS } = require('../employees/employees.constants');
const Product = require('../../inventory/products/products.model');
const Customer = require('../../inventory/customers/customers.model');
const Supplier = require('../../inventory/suppliers/suppliers.model');

const ACTIVE_FILTER = Object.freeze({ recordStatus: RECORD_STATUS.ACTIVE });

/** Contadores de límites con periodo `total`. Se consultan en vivo. */
const TOTAL_COUNTERS = Object.freeze({
  employees: (userId) => Employee.countDocuments({
    userId,
    ...ACTIVE_FILTER,
    status: EMPLOYEE_STATUS.ACTIVE,
  }),
  products: (userId) => Product.countDocuments({ userId, ...ACTIVE_FILTER }),
  contacts: async (userId) => {
    const [customers, suppliers] = await Promise.all([
      Customer.countDocuments({ userId, ...ACTIVE_FILTER }),
      Supplier.countDocuments({ userId, ...ACTIVE_FILTER }),
    ]);
    return customers + suppliers;
  },
});

/** Periodo mensual actual (`YYYY-MM`) en la zona horaria del negocio. */
function currentPeriod() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

/** Normaliza a un número de uso válido (nunca negativo ni NaN). */
function normalizeUsed(value) {
  const used = Number(value);
  return Number.isFinite(used) && used > 0 ? used : 0;
}

class LimitsService {
  /**
   * Resuelve el plan del usuario desde el catálogo. Acepta documentos viejos
   * donde `limitUsage.plan` era un string y documentos sin `limitUsage`.
   */
  resolvePlan(user) {
    const stored = user?.limitUsage?.plan;
    const code = typeof stored === 'string' ? stored : stored?.code;
    return PLANS[code] ?? PLANS[DEFAULT_PLAN];
  }

  /** Catálogo de planes disponibles (precio y límites salen de constantes). */
  getPlans() {
    return Object.values(PLANS).map((plan) => ({
      code: plan.code,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      limits: Object.fromEntries(
        Object.entries(plan.limits).map(([key, config]) => [
          key,
          { max: config.max, period: config.period },
        ]),
      ),
    }));
  }

  /** Uso real del tenant según la periodicidad de cada límite. */
  async getLimitUsage(userId) {
    const user = await User.findById(userId).select('limitUsage').lean();
    const plan = this.resolvePlan(user);
    const period = currentPeriod();
    const monthlyUsed = this.#monthlyUsed(user, period);
    const totalUsed = await this.#countTotals(userId, plan);

    const limits = {};
    for (const [key, config] of Object.entries(plan.limits)) {
      const used = config.period === LIMIT_PERIOD.MONTH
        ? normalizeUsed(monthlyUsed[key])
        : normalizeUsed(totalUsed[key]);
      limits[key] = {
        max: config.max,
        used,
        remaining: Math.max(0, config.max - used),
        period: config.period,
      };
    }

    return {
      plan: {
        code: plan.code,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
      },
      period,
      limits,
    };
  }

  /** Corta la creación cuando el tenant ya alcanzó el límite del plan. */
  async assertCanCreate(userId, key) {
    const usage = await this.getLimitUsage(userId);
    const current = usage.limits[key];
    if (!current) return;

    if (current.used >= current.max) {
      throw new HttpError(
        409,
        `Límite del plan ${usage.plan.name} alcanzado: ${current.used}/${current.max} ${LIMIT_LABELS[key] ?? key}`,
        { code: 'PLAN_LIMIT_REACHED' },
      );
    }
  }

  /**
   * Suma consumo a un límite mensual. Es un no-op para límites totales.
   * El reinicio es perezoso: si cambió el mes, primero se limpian los valores.
   */
  async recordUsage(userId, key, amount = 1) {
    const user = await User.findById(userId).select('limitUsage.plan').lean();
    const plan = this.resolvePlan(user);
    const config = plan.limits[key];
    if (!config || config.period !== LIMIT_PERIOD.MONTH) return;

    const period = currentPeriod();
    await User.updateOne(
      { _id: userId, 'limitUsage.used.period': { $ne: period } },
      {
        $set: {
          'limitUsage.used.period': period,
          'limitUsage.used.values': {},
          'limitUsage.used.updatedAt': new Date(),
        },
      },
    );
    await User.updateOne(
      { _id: userId },
      {
        $inc: { [`limitUsage.used.values.${key}`]: amount },
        $set: { 'limitUsage.used.updatedAt': new Date() },
      },
    );
  }

  /** Valores mensuales guardados, solo si pertenecen al periodo actual. */
  #monthlyUsed(user, period) {
    const used = user?.limitUsage?.used;
    if (!used || used.period !== period || !used.values) return {};
    return used.values;
  }

  /** Cuenta en vivo los límites con periodo `total` definidos por el plan. */
  async #countTotals(userId, plan) {
    const keys = Object.keys(plan.limits).filter(
      (key) => plan.limits[key].period === LIMIT_PERIOD.TOTAL && TOTAL_COUNTERS[key],
    );
    const entries = await Promise.all(
      keys.map(async (key) => [key, await TOTAL_COUNTERS[key](userId)]),
    );
    return Object.fromEntries(entries);
  }
}

module.exports = { LimitsService, limitsService: new LimitsService() };
