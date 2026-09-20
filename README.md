# Mis Archivadores — v0.11.1

PWA personal para localizar objetos guardados en casa mediante una estructura sencilla y configurable. El objetivo es poder saber rápidamente **qué hay guardado y dónde está**, con preparación para sincronización entre dispositivos, fotografías y acceso mediante NFC.

## Estado actual

La aplicación funciona actualmente de forma local en el dispositivo y está preparada para iniciar la migración a Cloudflare.

La estructura física es:

`Ubicación → Zona opcional → Contenedor → Elemento`

- Una ubicación puede tener zonas, contenedores directos o ambas cosas.
- Los contenedores pueden moverse entre ubicaciones y zonas sin perder su identidad.
- Cada contenedor tiene un código visible (`C001`, `C002`...) y un UID permanente interno.
- Cada elemento del índice tiene también un ID permanente, nombre, nota opcional y una referencia preparada para fotografía futura.

## Funcionalidades

- Creación, edición y eliminación de ubicaciones y zonas.
- Reordenación manual de zonas mediante arrastre; el orden queda guardado y se refleja en la navegación.
- Creación, edición, traslado y eliminación de contenedores.
- Contenedores con o sin zona.
- Índice editable mediante una entrada por línea.
- Ficha individual y nota opcional para cada elemento del índice.
- Búsqueda global por contenedores, elementos y notas.
- Importación y exportación completa de los datos estructurados en JSON.
- Temas Automático, Claro y Oscuro.
- Seis colores de acento.
- PWA instalable con Service Worker.
- Rutas internas permanentes de contenedor basadas en UID, preparadas para futuros enlaces NFC.

## Almacenamiento actual

Los datos estructurados se guardan temporalmente en `localStorage`. Las preferencias visuales se guardan por separado en `misArchivadores.settings.v1`.

Importar/Exportar se mantiene como mecanismo de copia de seguridad y resulta especialmente útil durante el desarrollo, ya que permite reinstalar la PWA y restaurar después los datos.

Las fotografías **todavía no se almacenan**. La interfaz y el modelo están preparados para asociar una fotografía a un elemento, pero la subida real se implementará con almacenamiento remoto.

## Próxima fase: Cloudflare

v0.11.1 cierra la fase puramente local. La siguiente etapa prevista es migrar la persistencia y habilitar sincronización entre dispositivos mediante:

- **Cloudflare D1** para los datos estructurados.
- **Worker/API** para las operaciones de lectura y escritura.
- **Cloudflare R2** para fotografías.
- **Subdominio propio** como dirección estable de la aplicación y base de los enlaces NFC definitivos.

La función «Copiar enlace» permanece retirada hasta disponer de una URL pública permanente. Las etiquetas NFC no deben grabarse todavía.

## Identidad y copias de seguridad

La exportación actual utiliza el formato JSON v3 y conserva los UID permanentes de contenedores y los IDs de los elementos. Restaurar una copia no debe cambiar la identidad de esos registros.

Las preferencias de apariencia no forman parte del JSON de datos.

## Archivos principales

- `index.html` — estructura base de la interfaz.
- `styles.css` — diseño, temas y adaptación móvil.
- `app.js` — modelo local, navegación, búsqueda, edición e importación/exportación.
- `manifest.webmanifest` — configuración de la PWA.
- `sw.js` — Service Worker y caché de la aplicación.
- `assets/icon.svg` — icono de la PWA.

## Despliegue actual

Durante esta fase el código se publica mediante GitHub Pages. Para probar un despliegue desde cero puede exportarse primero una copia JSON, reinstalar la PWA y volver a importar los datos.

El número de versión actual aparece también en el menú `•••`, lo que permite comprobar rápidamente qué versión está ejecutando el dispositivo.

## Historial resumido

- **v0.1–v0.3** — prototipo PWA, ubicaciones iniciales, índice y búsqueda.
- **v0.4–v0.7** — evolución y simplificación de la jerarquía física; creación de contenedores e Importar/Exportar.
- **v0.8** — estructura completamente configurable por el usuario.
- **v0.9** — reorganización de contenedores, zonas opcionales y eliminación explícita.
- **v0.10** — personalización, temas, colores de acento e iconografía SVG.
- **v0.11** — IDs permanentes, elementos enriquecidos con notas y preparación para fotografías/NFC.
- **v0.11.1** — orden manual persistente de zonas, navegación superior más accesible, versión visible y documentación consolidada.

## Nota de desarrollo

Hasta completar la migración a Cloudflare, la información local no se sincroniza automáticamente entre dispositivos. Importar/Exportar debe seguir considerándose el respaldo manual de referencia.
