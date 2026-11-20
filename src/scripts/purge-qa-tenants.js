'use strict';

/**
 * Purga administrativa de tenants de QA.
 *
 * Borra de forma definitiva las empresas cuyo dueño tiene correo de QA
 * (`qa.*@example.com`) y todo lo que cuelga de su `userId`: productos, ventas,
 * compras, movimientos, domicilios, mesas, pagos, retiros, empleados y sus
 * accesos. Pensado para limpiar los tenants que crean los smokes E2E.
 *
 * Uso:
 *   npm run purge:qa                 # simulación: solo cuenta documentos
 *   npm run purge:qa -- --apply      # borra de verdad
 *   npm run purge:qa -- --email=qa.retail.123@example.com --apply
 *   npm run purge:qa -- --pattern="^qa\\." --apply
 *
 * Nunca se ejecuta contra producción por accidente: exige `--apply`, imprime
 * cada colección afectada y omite correos que no empiecen por `qa.` salvo que
 * se pasen con `--email` de forma explícita.
 */

const { mongoose } = require('nemkit');
const { mongoClient } = require('../config/db');

const USERS = 'foundation_users';
const DEFAULT_PATTERN = /^qa\.[^@]+@example\.com$/i;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const valuesOf = (name) =>
  args
    .filter((arg) => arg.startsWith(`--${name}=`))
    .map((arg) => arg.slice(name.length + 3));

const apply = hasFlag('apply');
const explicitEmails = valuesOf('email').map((email) => email.trim().toLowerCase());
const patternArg = valuesOf('pattern')[0];
const pattern = patternArg ? new RegExp(patternArg, 'i') : DEFAULT_PATTERN;

if (hasFlag('help') || hasFlag('h')) {
  console.log(`Purga tenants QA (${apply ? 'aplicando' : 'simulación'})

  --apply                borra los documentos (sin esto solo cuenta)
  --email=<correo>       limita a un dueño concreto (repetible)
  --pattern=<regex>      correo del dueño a purgar (por defecto ${DEFAULT_PATTERN})

Sin --email, solo se aceptan correos que cumplan el patrón.`);
  process.exit(0);
}

async function main() {
  await mongoClient.connect();
  const db = mongoose.connection.db;
  const users = db.collection(USERS);

  const filter = explicitEmails.length
    ? { accountType: 'company_owner', email: { $in: explicitEmails } }
    : { accountType: 'company_owner', email: pattern };

  const owners = await users.find(filter, { projection: { _id: 1, email: 1, companyName: 1 } }).toArray();

  if (!owners.length) {
    console.log('No hay tenants QA que coincidan.');
    return;
  }

  const ownerIds = owners.map((owner) => owner._id);
  console.log(`${apply ? 'PURGANDO' : 'SIMULACIÓN'} · ${owners.length} tenant(s):`);
  for (const owner of owners) {
    console.log(`  - ${owner._id} · ${owner.email} · ${owner.companyName || '(sin nombre)'}`);
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  let totalDocs = 0;

  for (const { name } of collections) {
    if (name === USERS || name.startsWith('system.')) continue;
    const collection = db.collection(name);
    const count = await collection.countDocuments({ userId: { $in: ownerIds } });
    if (!count) continue;
    totalDocs += count;
    console.log(`  ${name}: ${count}`);
    if (apply) await collection.deleteMany({ userId: { $in: ownerIds } });
  }

  // Accesos de empleados (tienen userId del dueño) y luego las cuentas dueñas.
  const employeeUsers = await users.countDocuments({
    userId: { $in: ownerIds },
    _id: { $nin: ownerIds },
  });
  if (employeeUsers) {
    totalDocs += employeeUsers;
    console.log(`  ${USERS} (empleados): ${employeeUsers}`);
    if (apply) {
      await users.deleteMany({ userId: { $in: ownerIds }, _id: { $nin: ownerIds } });
    }
  }

  totalDocs += owners.length;
  console.log(`  ${USERS} (dueños): ${owners.length}`);
  if (apply) await users.deleteMany({ _id: { $in: ownerIds } });

  console.log(`\n${apply ? 'Borrados' : 'Se borrarían'} ${totalDocs} documento(s).`);
  if (!apply) console.log('Ejecuta con --apply para borrar de verdad.');
}

main()
  .catch((error) => {
    console.error('ERROR', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
