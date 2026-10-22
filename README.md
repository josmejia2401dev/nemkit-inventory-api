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
- `GET /api/v1/dashboard/summary`
- `/api/v1/auth` y `/api/v1/profile` heredadas del foundation

El prefijo efectivo depende de `API_PREFIX` en la configuración de entorno.

## Movimientos y stock

Las compras agregan unidades; ventas, daños, pérdidas y consumo interno las descuentan. `manual_adjustment` acepta `direction: "in" | "out"` por artículo. Las salidas se condicionan al stock disponible. La actualización de stock y la escritura del movimiento se confirman o revierten juntas mediante una transacción MongoDB.

El backend requiere MongoDB configurado como replica set (MongoDB Atlas cumple este requisito) para habilitar transacciones.

## Desarrollo

Instalar dependencias y usar `npm run dev` o `npm start`. Requiere Node.js 20.19 o superior y las variables de entorno de `.env.example`. Ejecutar la suite con `npm test`.
