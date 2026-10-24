# Nemkit Inventory API

Backend MVP de inventario construido sobre los patrones del `nemkit-timetrack-api`.

## Reutilización

`src/config`, `src/middlewares` y `src/modules/foundation` se mantienen del backend de TimeTrack para reutilizar autenticación, usuarios, tokens, conexión MongoDB, logger y configuración. El dominio nuevo vive bajo `src/modules/inventory`.

Todos los documentos usan `applyPlatformSchema` y `MongoRepository` de `nemkit`, que autogenera `_id` numérico. Las referencias `userId`, `categoryId` y `productId` también son numéricas.

`recordStatus` usa los estados de plataforma exportados como `RECORD_STATUS` por `nemkit`. Los estados de disponibilidad de producto, tipos de movimiento y direcciones de stock se definen en `src/modules/inventory/inventory.constants.js`; modelos, validadores y servicios consumen esa misma fuente. Las listas son constantes congeladas en código, no documentos de catálogo en MongoDB.

El backend se organiza por micro módulos cohesivos. Cada módulo mantiene sus propias rutas, controlador, servicio, validador, modelo y repositorio cuando aplica. Los controladores solo adaptan HTTP; las dependencias entre módulos se realizan mediante servicios. Las operaciones MongoDB comunes se reutilizan desde `BaseService` y `MongoRepository` de `nemkit`; las consultas específicas permanecen en el repositorio del módulo dueño de los datos.

### Módulos

- **Foundation reutilizado:** autenticación, usuarios, tokens y feedback. Sus extensiones de este producto son perfil, configuración del negocio, anuncios, notificaciones y plataforma (`overview`, `users`, `companies`, `operations`).
- **Inventario con datos propios:** `categories`, `products`, `customers`, `suppliers`, `employees`, `movements`, `purchases`, `sales`, `deliveries` y `tables`. Cada uno posee su modelo y repositorio; ningún otro módulo consulta esos modelos o repositorios directamente.
- **Casos de uso de lectura:** `dashboard` y `reports` coordinan consultas a través de servicios propietarios y no tienen modelo propio.
- **Soporte compartido:** `documents` conserva las operaciones transaccionales comunes a compras y ventas mediante `InventoryDocumentRepository`; `contacts` centraliza CRUD común de clientes y proveedores. No son recursos HTTP independientes.
- **Flujo de cocina:** `kitchen` mantiene su propio controller, service, validator y router, y delega transiciones al módulo `sales`.
- **Asociaciones de plataforma:** `inventory/platform-members` expone al superadministrador la asociación, desasociación e historial de empleados. `foundation/platform` no importa servicios de `inventory`; ambos routers se componen en `src/routes/index.js`.

Las operaciones transaccionales reciben y propagan la misma sesión MongoDB entre repositorios. Cada servicio conserva reglas de negocio; los repositorios encapsulan las consultas específicas de su modelo. Los controladores validan y adaptan HTTP, mientras que los servicios vuelven a validar invariantes necesarias para llamadas internas. `src/modules/inventory/inventory.module.js` enlaza las operaciones de ventas requeridas por domicilios, manteniendo la dependencia en una sola dirección y sin imports circulares.

## Política de eliminación

Los endpoints `DELETE` de productos y categorías hacen borrado lógico (`recordStatus: "deleted"`). El ciclo de vida de plataforma también contempla `active`, `inactive` y `archived`; esos valores no son borrado físico. Los movimientos son registros históricos inmutables y no tienen endpoint de eliminación.

No se ofrece borrado físico individual en este MVP. Una categoría o producto puede estar referenciado por productos o movimientos históricos. La purga física en cascada aplica a la eliminación completa de una cuenta o negocio y debe borrar sus movimientos, productos, categorías y tokens asociados en una operación administrativa. Esa operación se implementará cuando exista el flujo de baja de cuenta; no debe exponerse como variante del `DELETE` normal.

La eliminación lógica de una categoría se bloquea si conserva productos vinculados. SKU, códigos de barras y nombres de categorías pueden reutilizarse después del borrado lógico; las restricciones únicas solo aplican a documentos activos.

Un producto con stock no se puede eliminar lógicamente hasta registrar una salida que lo deje en cero. Así el dashboard y la valoración no pierden existencias sin un movimiento que las explique.

## Rutas protegidas

- `GET/POST /api/v1/products`, `GET/PUT/DELETE /api/v1/products/:id`
- `GET/POST /api/v1/categories`, `PUT/DELETE /api/v1/categories/:id`
- `GET/POST /api/v1/movements`, `GET /api/v1/movements/:id`
- `GET/POST /api/v1/suppliers`, `GET/PUT/DELETE /api/v1/suppliers/:id`
- `GET/POST /api/v1/customers`, `GET/PUT/DELETE /api/v1/customers/:id`
- `GET/POST /api/v1/purchases`, `GET /api/v1/purchases/:id`
- `GET/POST /api/v1/sales`, `GET /api/v1/sales/:id`
- `GET /api/v1/dashboard/summary`
- `/api/v1/auth`, `/api/v1/profile` y `/api/v1/settings/business` del foundation
- `/api/v1/notifications`, `/api/v1/notifications/unread-count`, `/api/v1/notifications/:id` y `/api/v1/notifications/read-all`
- `/api/v1/platform/announcements` para crear, publicar y archivar avisos (solo `SUPERADMIN`)
- `/api/v1/platform/companies/:companyId/members` para asociar/desasociar empleados y `/api/v1/platform/users/:userId/employment-history` para ver su historial (solo `SUPERADMIN`)

El prefijo efectivo depende de `API_PREFIX` en la configuración de entorno.

## Movimientos y stock

Las compras y ventas comerciales se registran como documentos inmutables. Cada documento conserva una copia de los datos del contacto y de los productos para mantener el historial aunque después se editen o desactiven. La compra requiere proveedor y la venta requiere cliente; si aún no existe, se puede crear desde el flujo de venta.

Al confirmar una compra o venta, el documento, el cambio de stock y el movimiento asociado se confirman o revierten juntos mediante una transacción MongoDB. Las salidas se condicionan al stock disponible. Daños, pérdidas, consumo interno y ajustes manuales continúan registrándose desde movimientos.

El endpoint manual `POST /movements` rechaza los tipos `purchase` y `sale`; esos movimientos solo se crean junto con una compra o venta para conservar proveedor/cliente, comprobante y trazabilidad.

Los comprobantes de venta se presentan en el frontend en formato imprimible; el navegador permite imprimir en térmica o guardar en PDF. Son comprobantes simples, no facturas electrónicas fiscales.

El backend requiere MongoDB configurado como replica set (MongoDB Atlas cumple este requisito) para habilitar transacciones.

Los reportes agrupados por día, semana y mes usan `$dateTrunc` y requieren MongoDB 5.0 o posterior.

Los avisos publicados generan una entrega persistente en la bandeja de cada usuario activo, excepto `SUPERADMIN`. La bandeja es el canal inicial y fuente de historial; Web Push del navegador queda para una etapa posterior. Los índices de anuncios y entregas se sincronizan al iniciar la API.

## Desarrollo

Instalar dependencias y usar `npm run dev` o `npm start`. Requiere Node.js 20.19 o superior y las variables de entorno de `.env.example`.
