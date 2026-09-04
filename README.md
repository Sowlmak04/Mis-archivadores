# Mis Archivadores — v0.1

Primera versión funcional del frontend.

## Qué incluye

- Interfaz mobile-first con aspecto de aplicación.
- Ubicaciones, zonas y contenedores.
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
