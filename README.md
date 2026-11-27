# Nemkit Inventory API

Backend de **retail simple** construido sobre `nemkit`.

## Alcance

- Ventas de mostrador y domicilios.
- Productos simples con stock, compras, proveedores, movimientos y categorías.
- Clientes opcionales en mostrador.
- Caja, retiros y reportes.
- Plan separe con abonos, entrega inmediata con 0 % y sin autorización de ADMIN.
- Sin cocina, mesas, recetas, platos preparados ni preparación de pedidos.

## Foundation

La autenticación, usuarios, empleados, tokens, feedback, límites y panel `sys`
viven en `nemkit` y se montan con `createFoundation`.

```text
/api/v1/inventory/foundation/auth/...
/api/v1/inventory/foundation/users/...
/api/v1/inventory/foundation/employees/...
/api/v1/inventory/foundation/limits
/api/v1/inventory/foundation/feedback
/api/v1/inventory/foundation/sys/...
```

## Roles

- `ADMIN`: catálogo, compras, caja, reportes, empleados, plan separe.
- `CASHIER`: ventas, cobros, plan separe, domicilios, clientes, catálogo.
- `SELLER`: ventas, plan separe, domicilios, clientes, catálogo.
- `COURIER`: solo sus domicilios asignados.

## Flujo de pedido

```text
Mostrador: pending -> pago/entrega -> delivered
Domicilio: pending -> on_route -> delivered
Cancelación: -> cancelled
```

No existen `preparing` ni `ready`.

## Endpoints principales

```text
GET/POST /api/v1/inventory/products
GET/POST /api/v1/inventory/categories
GET/POST /api/v1/inventory/purchases
GET/POST /api/v1/inventory/suppliers
GET/POST /api/v1/inventory/customers
GET/POST /api/v1/inventory/sales
PUT      /api/v1/inventory/sales/:id/pay
PUT      /api/v1/inventory/sales/:id/cancel
GET/POST /api/v1/inventory/layaways
POST     /api/v1/inventory/layaways/:id/payments
POST     /api/v1/inventory/layaways/:id/deliver
POST     /api/v1/inventory/layaways/:id/cancel
GET/PUT  /api/v1/inventory/layaways/settings
GET/POST /api/v1/inventory/deliveries
PUT      /api/v1/inventory/deliveries/:id/status
GET      /api/v1/inventory/reports/...
GET      /api/v1/inventory/dashboard/...
GET/POST /api/v1/inventory/cash-withdrawals
```

## Ejecución local

```bash
cp .env.example .env
npm install
npm run dev
```

## Verificación de cuenta con OTP

El registro de empresa no inicia sesión hasta confirmar el correo. El OTP se
guarda hasheado en `foundation_users`, vence a los 10 minutos y se limpia al
usarse.

```text
POST /foundation/auth/users/register
POST /foundation/auth/users/verify-email
POST /foundation/auth/users/resend-verification
```

El correo se envía por Notify. Configura:

```env
NOTIFY_API_URL=
NOTIFY_API_KEY=
OTP_TTL_MINUTES=10
OTP_LENGTH=6
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_SECRET=
```

El correo y la pantalla de verificación advierten que el mensaje puede llegar a
spam.
