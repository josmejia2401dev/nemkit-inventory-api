'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { HttpError } = require('nemkit');
const { env } = require('../../../config/env');

/**
 * Servicio de lectura de archivos de log (*.log).
 *
 * Los logs los escribe el logger de nemkit como JSON por línea:
 *   {"timestamp","level","service","message", ...meta}
 *
 * Seguridad: solo se permite leer archivos que:
 *  - estén DENTRO de LOGS_LOCAL_PATH (previene path traversal)
 *  - terminen en .log
 */
class LogsService {
  #logsDir;

  constructor() {
    this.#logsDir = path.resolve(env.LOGS_LOCAL_PATH);
  }

  /**
   * Lista los archivos .log disponibles con su tamaño y fecha de modificación.
   */
  listFiles() {
    if (!fs.existsSync(this.#logsDir)) return [];
    return fs.readdirSync(this.#logsDir)
      .filter((f) => f.endsWith('.log'))
      .map((name) => {
        const stat = fs.statSync(path.join(this.#logsDir, name));
        return { name, sizeBytes: stat.size, modifiedAt: stat.mtime };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  /**
   * Resuelve y valida de forma segura la ruta de un archivo de log.
   */
  #resolveSafe(fileName) {
    if (!fileName || !fileName.endsWith('.log')) {
      throw HttpError.badRequest('Invalid log file');
    }
    // basename evita cualquier segmento de path (../, /, etc.)
    const safeName = path.basename(fileName);
    const full = path.join(this.#logsDir, safeName);

    // Doble verificación: el path resuelto debe estar dentro de logsDir
    if (!full.startsWith(this.#logsDir + path.sep) && full !== path.join(this.#logsDir, safeName)) {
      throw HttpError.forbidden('Access denied');
    }
    if (!fs.existsSync(full)) throw HttpError.notFound('Log file not found');
    return full;
  }

  /**
   * Lee un archivo de log con filtros.
   *
   * @param {Object} query
   * @param {string} query.file       - nombre del archivo .log (requerido)
   * @param {string} [query.level]    - filtrar por nivel (error, warn, info, ...)
   * @param {string} [query.search]   - buscar texto en el message
   * @param {string} [query.requestId]- filtrar por requestId
   * @param {number} [query.limit=200]- máximo de líneas a devolver (las más recientes)
   * @returns {Promise<{ file, total, returned, entries: object[] }>}
   */
  async read(query = {}) {
    const full = this.#resolveSafe(query.file);
    const level = query.level ? String(query.level).toLowerCase() : null;
    const search = query.search ? String(query.search).toLowerCase() : null;
    const requestId = query.requestId ?? null;
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 200, 1), 2000);

    const entries = [];
    let total = 0;

    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      let entry;
      try { entry = JSON.parse(line); }
      catch { entry = { level: 'info', message: line, timestamp: null, raw: true }; }

      if (level && String(entry.level).toLowerCase() !== level) continue;
      if (requestId && entry.requestId !== requestId) continue;
      if (search && !String(entry.message ?? '').toLowerCase().includes(search)) continue;

      total++;
      entries.push(entry);
      // Mantener solo las últimas `limit` en memoria (ventana deslizante)
      if (entries.length > limit) entries.shift();
    }

    return { file: path.basename(full), total, returned: entries.length, entries };
  }
}

module.exports = { LogsService, logsService: new LogsService() };
