"use strict";

/** Periodicidad de un límite: tope de existencia o consumo mensual. */
const LIMIT_PERIOD = Object.freeze({
  TOTAL: "total",
  MONTH: "month",
});

/** Zona horaria que define el corte del mes para los límites mensuales. */
const BUSINESS_TIMEZONE = "America/Bogota";

/**
 * Catálogo único de planes. Precio y límites viven SOLO aquí: el usuario
 * guarda únicamente la referencia al plan, de modo que cualquier cambio en
 * este archivo se refleja en todas las empresas sin migrar datos.
 */
const PLANS = Object.freeze({
  free: Object.freeze({
    code: "free",
    name: "Gratuito",
    price: 0,
    currency: "COP",
    limits: Object.freeze({
      employees: Object.freeze({ max: 15, period: LIMIT_PERIOD.TOTAL }),
      products: Object.freeze({ max: 100, period: LIMIT_PERIOD.TOTAL }),
      contacts: Object.freeze({ max: 300, period: LIMIT_PERIOD.TOTAL }),
    }),
  }),
});

/** Plan por defecto y fallback para documentos sin `limitUsage`. */
const DEFAULT_PLAN = "free";

const LIMIT_LABELS = Object.freeze({
  employees: "empleados",
  products: "productos",
  contacts: "contactos",
});

module.exports = {
  LIMIT_PERIOD,
  BUSINESS_TIMEZONE,
  PLANS,
  DEFAULT_PLAN,
  LIMIT_LABELS,
};
