# Instrucciones del proyecto

## Forma de trabajar

- Hacer cambios pequeños, aislados, reversibles y fáciles de comprobar.
- Antes de modificar código, explicar qué archivos se tocarán y por qué.
- Limitarse a lo solicitado, sin cambios adicionales.
- No hacer commit, push, merge ni deploy sin aprobación explícita.
- No escribir ni borrar datos de D1 remota ni objetos de R2 remoto sin aprobación explícita.
- `main` representa la versión estable.
- Mientras dure la migración actual a Cloudflare, trabajar en `cloudflare-migration` y no modificar `main` salvo aprobación explícita.

## Modelo e interfaz

- Jerarquía funcional: Ubicación → Zona opcional → Contenedor → Índice.
- Una ubicación puede tener cero o varias zonas.
- Un contenedor puede pertenecer directamente a una ubicación, sin zona. La existencia de zonas nunca debe impedir contenedores «Sin zona».
- Conservar los identificadores permanentes de los contenedores, también al moverlos, editarlos o importar datos.
- Ordenar ubicaciones y zonas alfabéticamente, con comparación adaptada al español.
- No reintroducir drag-and-drop de zonas.
- Mantener Inicio y Buscar en la navegación inferior.

## Arquitectura Cloudflare

- Un único Cloudflare Worker sirve el frontend y la API.
- Frontend estático en `public/`; Worker en `src/worker.js`; API bajo `/api/*`.
- Bindings: `DB` para D1, `IMAGES` para R2 y `ASSETS` para archivos estáticos.
- D1 almacena estructura y metadatos; R2 almacena fotografías. No guardar fotografías como blobs en D1.
- Las preferencias visuales pueden seguir siendo locales por dispositivo.
- Actualmente los datos siguen en `localStorage`; declarar bindings no implica haber completado la migración.

## Comprobación de cambios

- Antes de dar un cambio por terminado, revisar `git diff` y ejecutar las pruebas relevantes.
- El script actual `npm test` es un marcador que falla: no considerarlo una validación ni afirmar que las pruebas pasan.
- Si el cambio afecta a Cloudflare, ejecutar `npx wrangler deploy --dry-run`. Esta comprobación no autoriza un deploy real.
- Si afecta a la interfaz, realizar una comprobación manual visual.
- Indicar qué se ha comprobado y cualquier comprobación pendiente.
