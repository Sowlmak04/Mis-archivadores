# Mis Archivadores — v0.3

Segunda versión: estructura real de ubicaciones.

## Qué incluye

- Interfaz mobile-first con aspecto de aplicación.
- Seis ubicaciones reales definidas en Inicio.
- Zonas y contenedores vaciados deliberadamente para configurarlos por capas.
- Vista individual de cada archivador, caja o cajón.
- Índice editable.
- Buscador global.
- Rutas directas por contenedor, preparadas para NFC.
- Persistencia local mediante `localStorage`.
- Manifest y Service Worker para comportamiento PWA básico.
- Sin Cloudflare ni base de datos externa todavía.

## Probar en GitHub Pages

1. Sube todos los archivos respetando la estructura.
2. En GitHub abre `Settings > Pages`.
3. Publica desde la rama principal y carpeta raíz.
4. Abre la URL de Pages desde el móvil.

## Enlaces directos de ejemplo

- `#container/A01`
- `#container/K01`
- `#container/C01`

Una etiqueta NFC podría apuntar en esta fase a una URL como:

`https://TU-USUARIO.github.io/TU-REPO/#container/A01`

Más adelante sustituiremos la persistencia local por Cloudflare D1 y podremos usar URLs limpias y permanentes.

## Importante

En v0.1 los cambios se guardan solamente en el navegador/dispositivo actual. Todavía NO se sincronizan entre dos móviles.

## Archivos

- `index.html` — estructura principal.
- `styles.css` — diseño y responsive.
- `app.js` — navegación, búsqueda, edición y datos locales.
- `manifest.webmanifest` — configuración PWA.
- `sw.js` — caché básica/offline.
- `assets/icon.svg` — icono provisional.

## Pruebas recomendadas

1. Abrir Inicio.
2. Entrar en Salón > Kallax > K01.
3. Editar el índice.
4. Volver a K01 y comprobar el cambio.
5. Recargar la página y confirmar que el cambio permanece.
6. Buscar una palabra como `HDMI`.
7. Abrir directamente `#container/A01`.


## Cambios v0.2

Ubicaciones de Inicio:

- Salón
- Oficina
- Habitación
- Habitación Luna
- Terraza salón
- Terraza habita

La clave de almacenamiento local cambia a `misArchivadores.data.v2` para evitar
que los datos de demostración de v0.1 permanezcan visibles tras desplegar esta versión.


## Cambios v0.3

- El resumen superior de Inicio se ha reducido notablemente en altura.
- Se elimina la frase promocional y se conservan las métricas de contenedores y referencias.
- Inicio queda centrado exclusivamente en la sección `Ubicaciones`.
- Se elimina el bloque adicional `Estructura`.
- No se añaden nuevas formas de navegación en Inicio.


## Ajuste v0.3.1

- `ÍNDICE DOMÉSTICO` pasa a `ÍNDICE` para que el resumen superior completo quepa en una sola línea en móvil.


## v0.4 — Jerarquía real de zonas

Se incorpora la primera estructura completa de zonas y subzonas de las seis ubicaciones.
La navegación admite ahora un nivel adicional (por ejemplo `Salón > Kallax > Cajón izquierdo`).
Los contenedores continúan vacíos deliberadamente: esta versión define únicamente la estructura física.


## v0.5 — Contenedores reales

- Se puede crear un contenedor desde cualquier zona o subzona.
- Cada contenedor recibe automáticamente un ID estable (`C001`, `C002`, etc.).
- Al crearlo se pueden introducir nombre, tipo, nota e índice.
- El índice sigue siendo editable desde la vista del contenedor.
- Los nuevos contenedores aparecen en navegación y buscador global.
- Inicio actualiza automáticamente el número de contenedores y referencias.
- Los datos continúan almacenándose únicamente en `localStorage`; todavía no hay sincronización entre dispositivos.


## v0.5.1 — Corrección de jerarquía

- Se eliminan como subzonas `Balda 0` a `Balda 3` de `Salón > Mueble Pelis`.
- Se eliminan como subzonas `Balda 0` a `Balda 3` de `Terraza habita > Armario empotrado`.
- Las baldas podrán crearse a partir de ahora como contenedores.
- Se conserva el `localStorage` existente.
- Si hubiera algún contenedor creado dentro de una de esas antiguas subzonas, se mueve automáticamente al mueble padre para evitar pérdida de datos.
