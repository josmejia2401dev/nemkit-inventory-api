# Nemkit Inventory API

Backend MVP de inventario construido sobre los patrones del `nemkit-timetrack-api`.

## Reutilización

`src/config`, `src/middlewares` y `src/modules/foundation` se mantienen del backend de TimeTrack para reutilizar autenticación, usuarios, tokens, conexión MongoDB, logger y configuración. El dominio nuevo vive bajo `src/modules/inventory`.

Todos los documentos usan `applyPlatformSchema` y `MongoRepository` de `nemkit`, que autogenera `_id` numérico. Las referencias `userId`, `categoryId` y `productId` también son numéricas.

`recordStatus` usa los estados de plataforma exportados como `RECORD_STATUS` por `nemkit`. Los estados de disponibilidad de producto, tipos de movimiento y direcciones de stock se definen en `src/modules/inventory/inventory.constants.js`; modelos, validadores y servicios consumen esa misma fuente. Las listas son constantes congeladas en código, no documentos de catálogo en MongoDB.

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
- `/api/v1/auth` y `/api/v1/profile` heredadas del foundation

El prefijo efectivo depende de `API_PREFIX` en la configuración de entorno.

## Movimientos y stock

Las compras y ventas comerciales se registran como documentos inmutables. Cada documento conserva una copia de los datos del contacto y de los productos para mantener el historial aunque después se editen o desactiven. La compra requiere proveedor y la venta requiere cliente; si aún no existe, se puede crear desde el flujo de venta.

Al confirmar una compra o venta, el documento, el cambio de stock y el movimiento asociado se confirman o revierten juntos mediante una transacción MongoDB. Las salidas se condicionan al stock disponible. Daños, pérdidas, consumo interno y ajustes manuales continúan registrándose desde movimientos.

El endpoint manual `POST /movements` rechaza los tipos `purchase` y `sale`; esos movimientos solo se crean junto con una compra o venta para conservar proveedor/cliente, comprobante y trazabilidad.

Los comprobantes de venta se presentan en el frontend en formato imprimible; el navegador permite imprimir en térmica o guardar en PDF. Son comprobantes simples, no facturas electrónicas fiscales.

El backend requiere MongoDB configurado como replica set (MongoDB Atlas cumple este requisito) para habilitar transacciones.

Los reportes agrupados por día, semana y mes usan `$dateTrunc` y requieren MongoDB 5.0 o posterior.

## Desarrollo

Instalar dependencias y usar `npm run dev` o `npm start`. Requiere Node.js 20.19 o superior y las variables de entorno de `.env.example`. Ejecutar la suite con `npm test`.
