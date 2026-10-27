# Migraciones de identidad de empresa

La relación de empresa se almacena como `userId` en documentos de `users` y
`foundation_employees`. La migración `001-company-user-id.js` traslada los
registros existentes y elimina el campo anterior.

Antes de desplegar el backend que usa el nuevo esquema:

1. Haz una copia de seguridad de MongoDB.
2. Desde este repositorio, ejecuta `npm run migrate:company-user-id` para revisar
   el número de documentos afectados sin modificarlos.
3. Cuando la copia esté lista, ejecuta
   `npm run migrate:company-user-id -- --apply`.
4. Reinicia la API. Su arranque sincroniza los índices declarados con los
   campos nuevos.

La migración es repetible. No se ejecuta automáticamente al iniciar la API y
no se ha ejecutado contra la base de datos desde esta sesión.
