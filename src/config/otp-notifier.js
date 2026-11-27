'use strict';

const { env } = require('./env');

function configError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Transporte de correo transaccional de Inventory. Envía a Notify (servicio
 * interno) usando la API pública de email.
 */
async function sendEmail({ to, subject, text, html }) {
  if (!env.NOTIFY_API_URL || !env.NOTIFY_API_KEY) {
    throw configError(
      'Notify is not configured (NOTIFY_API_URL / NOTIFY_API_KEY)',
      'EMAIL_NOT_CONFIGURED',
    );
  }

  const url = `${env.NOTIFY_API_URL.replace(/\/+$/, '')}/notifications/email`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': env.NOTIFY_API_KEY,
      },
      body: JSON.stringify({ to, subject, text, html }),
    });
  } catch (error) {
    throw configError(`Could not reach Notify: ${error.message}`, 'EMAIL_SEND_FAILED');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw configError(
      payload?.message ?? payload?.error ?? `Notify responded ${response.status}`,
      payload?.code ?? 'EMAIL_SEND_FAILED',
    );
  }

  return payload?.data ?? payload;
}

module.exports = { sendEmail };
