## R8.4 - Endpoint actualizado

La URL /exec entregada el 15-09-2026 ya está integrada. Si republicas Apps Script y Google genera otra URL, cambia solo `API_URL` en `config.js`.

R8.4 - CONEXION ESTABLE

# ALE ATENCIO — INSTALACIÓN / ACTUALIZACIÓN

## Base oficial
- Google Sheets: `ALE_ATENCIO_BD_WEB`
- ID: `1InQ9gXtuSAMj6LsM9Z_LRj-A0GFCIttRYnYABVVJtkI`
- API conectada: `https://script.google.com/macros/s/AKfycby8CMiU8TGuEsMeUgl2ztHPKpngSKKvb2y1Fi4LCue0N3nYettWi50AUqsBL-7L8cco/exec`

## Backend Google Apps Script
El proyecto usa **un solo archivo GS: `Codigo.gs`**.

Para activar esta versión (usuarios + contraseñas + fotos de perfil):
1. Abre el proyecto de Google Apps Script que actualmente publica la URL `/exec` indicada arriba.
2. Reemplaza el contenido del archivo GS por el `Codigo.gs` incluido en este ZIP. Debe quedar un solo archivo GS llamado **Codigo.gs**.
3. Ejecuta una vez `instalarAleAtencio()` y autoriza los permisos. La contraseña de administración existente se conserva.
4. Ve a **Implementar > Administrar implementaciones > Editar** la implementación actual y selecciona **Nueva versión**. No crees otro Web App si quieres conservar la misma URL `/exec`.
5. Acceso del Web App: ejecutar como propietario y permitir acceso según la configuración pública usada por la tienda.

## Usuarios del cPanel
- Usuario inicial: `admin`.
- Su contraseña actual se conserva automáticamente al migrar.
- Desde **Usuarios** se pueden crear usuarios, cambiar contraseña, elegir rol Administrador/Editor, activar/desactivar y subir foto de perfil.
- Las contraseñas no se guardan en texto visible: se almacenan como salt + hash SHA-256.
- Las fotos de perfil se guardan en `04_IMAGENES/USUARIOS`.

## Loader circular
Todos los botones de la Web y del cPanel muestran respuesta visual circular. Las operaciones de red mantienen el loader mientras se procesa el guardado/envío.

## Corrección de confirmación de solicitudes y pedidos
La Web ya no interpreta un error CORS/redirect de Apps Script como un fallo de guardado. Cada solicitud/pedido genera un ID único en el navegador, el backend guarda de forma idempotente y la Web verifica ese ID mediante `checkRecord` antes de mostrar el resultado.

- **Check verde**: el registro fue confirmado en Google Sheets.
- **X roja**: después del envío/reintento el registro no pudo confirmarse.
- Los reintentos usan el mismo ID y **no duplican filas**.

### IMPORTANTE después de actualizar `Codigo.gs`
En Apps Script usa **Implementar > Administrar implementaciones > Editar** y publica una nueva versión de la implementación existente. Mantén la implementación como Aplicación web ejecutada por ti y con acceso público según tu configuración actual. Si editas la implementación existente, la URL `/exec` puede conservarse.

## Transporte API sin falso error CORS
Esta versión usa un iframe oculto + `postMessage` para TODOS los POST (Web y cPanel). Apps Script devuelve la confirmación desde el mismo `doPost` que ejecutó la operación, por lo que una solicitud que fue guardada ya no puede terminar marcada como error solo porque `fetch()` no pudo leer una redirección de Google.

IMPORTANTE: reemplazar nuevamente el contenido de `Codigo.gs` en el proyecto Apps Script y crear una NUEVA VERSIÓN de la implementación existente. La URL `/exec` se mantiene si se edita la misma implementación.
