const STORAGE_KEY = "misArchivadores.data.v4";

const seedData = {
  locations: [
    { id: "salon", name: "Salón", icon: "⌂" },
    { id: "oficina", name: "Oficina", icon: "▣" },
    { id: "habitacion", name: "Habitación", icon: "□" },
    { id: "habitacion-luna", name: "Habitación Luna", icon: "◇" },
    { id: "terraza-salon", name: "Terraza salón", icon: "⌑" },
    { id: "terraza-habita", name: "Terraza habita", icon: "▱" }
  ],
  zones: [
    { id: "salon-kallax", locationId: "salon", name: "Kallax", parentZoneId: null },
    { id: "salon-kallax-cajon-izquierdo", locationId: "salon", name: "Cajón izquierdo", parentZoneId: "salon-kallax" },
    { id: "salon-kallax-cajon-central", locationId: "salon", name: "Cajón central", parentZoneId: "salon-kallax" },
    { id: "salon-kallax-cajon-derecho", locationId: "salon", name: "Cajón derecho", parentZoneId: "salon-kallax" },
    { id: "salon-mueble-tv", locationId: "salon", name: "Mueble TV", parentZoneId: null },
    { id: "salon-mueble-pelis", locationId: "salon", name: "Mueble Pelis", parentZoneId: null },
    { id: "salon-aparador", locationId: "salon", name: "Aparador", parentZoneId: null },

    { id: "oficina-kallax", locationId: "oficina", name: "Kallax", parentZoneId: null },
    { id: "oficina-kallax-cajon-izquierdo", locationId: "oficina", name: "Cajón izquierdo", parentZoneId: "oficina-kallax" },
    { id: "oficina-kallax-cajon-central", locationId: "oficina", name: "Cajón central", parentZoneId: "oficina-kallax" },
    { id: "oficina-kallax-cajon-derecho", locationId: "oficina", name: "Cajón derecho", parentZoneId: "oficina-kallax" },
    { id: "oficina-mueble-empotrado", locationId: "oficina", name: "Mueble empotrado", parentZoneId: null },
    { id: "oficina-mueble-empotrado-inferior", locationId: "oficina", name: "Parte inferior", parentZoneId: "oficina-mueble-empotrado" },
    { id: "oficina-mueble-empotrado-superior", locationId: "oficina", name: "Parte superior", parentZoneId: "oficina-mueble-empotrado" },
    { id: "oficina-armario-largo", locationId: "oficina", name: "Armario largo", parentZoneId: null },

    { id: "habitacion-canape-cama", locationId: "habitacion", name: "Canapé cama", parentZoneId: null },
    { id: "habitacion-armario-superior", locationId: "habitacion", name: "Armario superior", parentZoneId: null },

    { id: "luna-kallax", locationId: "habitacion-luna", name: "Kallax", parentZoneId: null },
    { id: "luna-comoda-visi", locationId: "habitacion-luna", name: "Cómoda Visi", parentZoneId: null },
    { id: "luna-comoda-visi-cajon-inferior", locationId: "habitacion-luna", name: "Cajón inferior", parentZoneId: "luna-comoda-visi" },


    { id: "terraza-habita-armario-empotrado", locationId: "terraza-habita", name: "Armario empotrado", parentZoneId: null },
    { id: "terraza-habita-armario-superior", locationId: "terraza-habita", name: "Armario superior", parentZoneId: null }
  ],
  containers: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const loaded = stored ? JSON.parse(stored) : clone(seedData);

    const removedZoneParents = {
      "salon-mueble-pelis-balda-0": "salon-mueble-pelis",
      "salon-mueble-pelis-balda-1": "salon-mueble-pelis",
      "salon-mueble-pelis-balda-2": "salon-mueble-pelis",
      "salon-mueble-pelis-balda-3": "salon-mueble-pelis",
      "terraza-habita-balda-0": "terraza-habita-armario-empotrado",
      "terraza-habita-balda-1": "terraza-habita-armario-empotrado",
      "terraza-habita-balda-2": "terraza-habita-armario-empotrado",
      "terraza-habita-balda-3": "terraza-habita-armario-empotrado",
      "luna-kallax-cajon-inferior": "luna-kallax"
    };

    const removableLocationZones = new Set([
      "terraza-salon-sillon-izquierdo",
      "terraza-salon-sillon-derecho"
    ]);

    loaded.zones = loaded.zones.filter(zone => {
      if (removedZoneParents[zone.id]) return false;

      if (removableLocationZones.has(zone.id)) {
        const hasContainers = loaded.containers.some(container => container.zoneId === zone.id);
        return hasContainers;
      }

      return true;
    });

    loaded.containers = loaded.containers.map(container => ({
      ...container,
      zoneId: removedZoneParents[container.zoneId] || container.zoneId
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    return loaded;
  } catch {
    return clone(seedData);
  }
}

let data = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function exportBackup() {
  const backup = {
    app: "Mis Archivadores",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `mis-archivadores-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function validateImportedData(payload) {
  const candidate = payload?.data || payload;

  if (!candidate || typeof candidate !== "object") {
    throw new Error("El archivo no contiene datos válidos.");
  }

  if (!Array.isArray(candidate.locations) ||
      !Array.isArray(candidate.zones) ||
      !Array.isArray(candidate.containers)) {
    throw new Error("El archivo no tiene la estructura de Mis Archivadores.");
  }

  const locationIds = new Set(candidate.locations.map(item => item?.id).filter(Boolean));
  const zoneIds = new Set(candidate.zones.map(item => item?.id).filter(Boolean));

  if (locationIds.size !== candidate.locations.length) {
    throw new Error("Hay ubicaciones sin identificador válido o duplicadas.");
  }

  if (zoneIds.size !== candidate.zones.length) {
    throw new Error("Hay zonas sin identificador válido o duplicadas.");
  }

  for (const zone of candidate.zones) {
    if (!zone?.id || !zone?.name || !locationIds.has(zone.locationId)) {
      throw new Error("Hay una zona con datos incompletos o una ubicación inexistente.");
    }

    if (zone.parentZoneId && !zoneIds.has(zone.parentZoneId)) {
      throw new Error("Hay una subzona cuyo nivel superior no existe.");
    }
  }

  const containerIds = new Set();

  for (const container of candidate.containers) {
    if (!container?.id || !container?.name || !container?.zoneId ||
        !zoneIds.has(container.zoneId) || !locationIds.has(container.locationId)) {
      throw new Error("Hay un contenedor con datos incompletos o una zona inexistente.");
    }

    if (containerIds.has(container.id)) {
      throw new Error("Hay identificadores de contenedor duplicados.");
    }

    containerIds.add(container.id);

    if (container.items !== undefined && !Array.isArray(container.items)) {
      throw new Error("El índice de uno de los contenedores no es válido.");
    }
  }

  return {
    locations: candidate.locations,
    zones: candidate.zones,
    containers: candidate.containers
  };
}

async function importBackup(file) {
  if (!file) return false;

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error("El archivo seleccionado no es un JSON válido.");
  }

  const imported = validateImportedData(payload);

  const confirmed = window.confirm(
    `Se sustituirán los datos actuales por el contenido de este archivo.\n\n` +
    `${imported.locations.length} ubicaciones · ` +
    `${imported.zones.length} zonas · ` +
    `${imported.containers.length} contenedores\n\n` +
    `Esta acción no se puede deshacer salvo que antes hayas exportado una copia.`
  );

  if (!confirmed) return false;

  data = imported;
  saveData();
  return true;
}

const app = document.querySelector("#app");
const screenTitle = document.querySelector("#screenTitle");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHTML(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function locationById(id) {
  return data.locations.find(x => x.id === id);
}

function zoneById(id) {
  return data.zones.find(x => x.id === id);
}

function containerById(id) {
  return data.containers.find(x => x.id === id);
}

function nextContainerId() {
  const numbers = data.containers
    .map(c => /^C(\d+)$/.exec(c.id))
    .filter(Boolean)
    .map(match => Number(match[1]));

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `C${String(next).padStart(3, "0")}`;
}

function zonePath(zoneId) {
  const parts = [];
  let current = zoneById(zoneId);

  while (current) {
    parts.unshift(current.name);
    current = current.parentZoneId ? zoneById(current.parentZoneId) : null;
  }

  return parts;
}

function setActiveTab(route) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.route === route);
  });
}

function navigate(hash) {
  location.hash = hash;
}

function homeView() {
  screenTitle.textContent = "Mis Archivadores";
  setActiveTab("home");

  const counts = {
    locations: data.locations.length,
    containers: data.containers.length,
    items: data.containers.reduce((sum, c) => sum + c.items.length, 0)
  };

  app.innerHTML = `
    <section class="hero hero-compact">
      <div class="hero-compact-copy">
        <p class="hero-kicker">Índice</p>
        <p class="hero-summary">${counts.containers} contenedores · ${counts.items} referencias</p>
      </div>
    </section>

    <div class="section-title">
      <h2>Ubicaciones</h2>
      <span>${counts.locations} zonas</span>
    </div>

    <section class="grid">
      ${data.locations.map(loc => {
        const count = data.containers.filter(c => c.locationId === loc.id).length;
        return `
          <button class="card" data-location="${loc.id}">
            <div class="card-icon">${escapeHTML(loc.icon)}</div>
            <h3>${escapeHTML(loc.name)}</h3>
            <p>${count === 0 ? "Zonas por configurar" : `${count} contenedores`}</p>
          </button>
        `;
      }).join("")}
    </section>


  `;

  app.querySelectorAll("[data-location]").forEach(btn => {
    btn.addEventListener("click", () => navigate(`#location/${btn.dataset.location}`));
  });

  bindContainerLinks();
}

function containerRow(c) {
  const loc = locationById(c.locationId);
  const zone = zoneById(c.zoneId);
  return `
    <button class="list-row" data-container="${c.id}">
      <div class="row-icon">${c.type.includes("Archivador") ? "▤" : c.type.includes("Cajón") ? "▭" : "□"}</div>
      <div class="row-copy">
        <strong>${escapeHTML(c.id)} · ${escapeHTML(c.name)}</strong>
        <small>${escapeHTML(c.type)} · ${escapeHTML(loc?.name || "")}${zone ? ` · ${escapeHTML(zone.name)}` : ""}</small>
      </div>
      <span class="chevron">›</span>
    </button>
  `;
}

function bindContainerLinks() {
  app.querySelectorAll("[data-container]").forEach(btn => {
    btn.addEventListener("click", () => navigate(`#container/${btn.dataset.container}`));
  });
}

function locationView(locationId) {
  const loc = locationById(locationId);
  if (!loc) return notFound();

  screenTitle.textContent = loc.name;
  setActiveTab("home");

  const zones = data.zones.filter(z => z.locationId === locationId && !z.parentZoneId);
  const containers = data.containers.filter(c => c.locationId === locationId);

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-home>Inicio</button><span>›</span><span>${escapeHTML(loc.name)}</span>
    </div>

    <div class="section-title">
      <h2>Zonas</h2>
      <span>${zones.length}</span>
    </div>

    <section class="list">
      ${zones.length ? zones.map(zone => {
        const childCount = data.zones.filter(z => z.parentZoneId === zone.id).length;
        const count = containers.filter(c => c.zoneId === zone.id).length;
        const detail = childCount ? `${childCount} ${childCount === 1 ? "zona" : "zonas"}` : `${count} contenedores`;
        return `
          <button class="list-row" data-zone="${zone.id}">
            <div class="row-icon">⌗</div>
            <div class="row-copy">
              <strong>${escapeHTML(zone.name)}</strong>
              <small>${detail}</small>
            </div>
            <span class="chevron">›</span>
          </button>
        `;
      }).join("") : `<div class="empty"><strong>Sin zonas todavía</strong>Podrás añadirlas más adelante.</div>`}
    </section>

    <div class="section-title">
      <h2>Todo en ${escapeHTML(loc.name)}</h2>
      <span>${containers.length}</span>
    </div>

    <section class="list">
      ${containers.length ? containers.map(containerRow).join("") : `<div class="empty"><strong>Sin contenedores</strong>No hay elementos registrados aquí.</div>`}
    </section>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelectorAll("[data-zone]").forEach(btn => {
    btn.addEventListener("click", () => navigate(`#zone/${btn.dataset.zone}`));
  });
  bindContainerLinks();
}

function zoneView(zoneId) {
  const zone = zoneById(zoneId);
  if (!zone) return notFound();

  const loc = locationById(zone.locationId);
  const childZones = data.zones.filter(z => z.parentZoneId === zoneId);
  const containers = data.containers.filter(c => c.zoneId === zoneId);
  const parentZone = zone.parentZoneId ? zoneById(zone.parentZoneId) : null;

  screenTitle.textContent = zone.name;
  setActiveTab("home");

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-home>Inicio</button><span>›</span>
      <button data-location-link>${escapeHTML(loc?.name || "")}</button><span>›</span>
      ${parentZone ? `<button data-parent-zone>${escapeHTML(parentZone.name)}</button><span>›</span>` : ""}
      <span>${escapeHTML(zone.name)}</span>
    </div>

    ${childZones.length ? `
      <div class="section-title">
        <h2>Zonas</h2>
        <span>${childZones.length}</span>
      </div>
      <section class="list">
        ${childZones.map(child => {
          const grandchildren = data.zones.filter(z => z.parentZoneId === child.id).length;
          const childContainers = data.containers.filter(c => c.zoneId === child.id).length;
          const detail = grandchildren ? `${grandchildren} ${grandchildren === 1 ? "zona" : "zonas"}` : `${childContainers} contenedores`;
          return `
            <button class="list-row" data-zone="${child.id}">
              <div class="row-icon">⌗</div>
              <div class="row-copy">
                <strong>${escapeHTML(child.name)}</strong>
                <small>${detail}</small>
              </div>
              <span class="chevron">›</span>
            </button>
          `;
        }).join("")}
      </section>
    ` : ""}

    <div class="section-title">
      <h2>Contenido</h2>
      <span>${containers.length} contenedores</span>
    </div>

    <section class="list">
      ${containers.length ? containers.map(containerRow).join("") : `<div class="empty"><strong>Sin contenedores</strong>Añade aquí el primer archivador, caja o cajón que quieras indexar.</div>`}
    </section>

    <div class="actions">
      <button class="primary-button" data-add-container>+ Añadir contenedor</button>
    </div>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelector("[data-location-link]")?.addEventListener("click", () => navigate(`#location/${zone.locationId}`));
  app.querySelector("[data-parent-zone]")?.addEventListener("click", () => navigate(`#zone/${zone.parentZoneId}`));
  app.querySelectorAll("[data-zone]").forEach(btn => {
    btn.addEventListener("click", () => navigate(`#zone/${btn.dataset.zone}`));
  });
  app.querySelector("[data-add-container]")?.addEventListener("click", () => navigate(`#new/${zone.id}`));
  bindContainerLinks();
}


function newContainerView(zoneId) {
  const zone = zoneById(zoneId);
  if (!zone) return notFound();

  const loc = locationById(zone.locationId);
  const path = zonePath(zoneId);

  screenTitle.textContent = "Nuevo";
  setActiveTab("home");

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-back>‹ Volver a ${escapeHTML(zone.name)}</button>
    </div>

    <section class="detail-header">
      <div class="detail-meta">
        <span class="pill">${escapeHTML(loc?.name || "")}</span>
        <span class="pill">${escapeHTML(path.join(" › "))}</span>
      </div>
      <h2>Nuevo contenedor</h2>
      <p>Crea aquí un archivador, caja, cajón u otro elemento cuyo contenido quieras consultar.</p>
    </section>

    <form class="editor" id="newContainerForm">
      <div class="field">
        <label for="newName">Nombre</label>
        <input id="newName" placeholder="Ej. Documentación vivienda" autocomplete="off" required />
      </div>

      <div class="field">
        <label for="newType">Tipo</label>
        <input id="newType" placeholder="Ej. Archivador, caja, cajón…" autocomplete="off" required />
      </div>

      <div class="field">
        <label for="newNote">Nota</label>
        <input id="newNote" placeholder="Opcional" autocomplete="off" />
      </div>

      <div class="field">
        <label for="newItems">Índice</label>
        <textarea id="newItems" spellcheck="true" placeholder="Una entrada por línea"></textarea>
        <p class="helper">Puedes dejarlo vacío y completar el índice más adelante.</p>
      </div>

      <div class="actions">
        <button type="button" class="secondary-button" data-cancel>Cancelar</button>
        <button type="submit" class="primary-button">Crear contenedor</button>
      </div>
    </form>
  `;

  const back = () => navigate(`#zone/${zone.id}`);
  app.querySelector("[data-back]")?.addEventListener("click", back);
  app.querySelector("[data-cancel]")?.addEventListener("click", back);

  app.querySelector("#newContainerForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = document.querySelector("#newName").value.trim();
    const type = document.querySelector("#newType").value.trim();

    if (!name || !type) {
      showToast("Completa nombre y tipo");
      return;
    }

    const id = nextContainerId();
    const container = {
      id,
      locationId: zone.locationId,
      zoneId: zone.id,
      name,
      type,
      note: document.querySelector("#newNote").value.trim(),
      items: document.querySelector("#newItems").value
        .split("\n")
        .map(v => v.trim())
        .filter(Boolean)
    };

    data.containers.push(container);
    saveData();
    showToast("Contenedor creado");
    setTimeout(() => navigate(`#container/${id}`), 250);
  });
}


function containerView(id) {
  const c = containerById(id);
  if (!c) return notFound();
  const loc = locationById(c.locationId);
  const zone = zoneById(c.zoneId);

  screenTitle.textContent = c.name;
  setActiveTab("home");

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-home>Inicio</button><span>›</span>
      <button data-location-link>${escapeHTML(loc?.name || "")}</button><span>›</span>
      ${zone ? `<button data-zone-link>${escapeHTML(zone.name)}</button><span>›</span>` : ""}
      <span>${escapeHTML(c.id)}</span>
    </div>

    <section class="detail-header">
      <div class="detail-meta">
        <span class="pill">${escapeHTML(c.type)}</span>
        <span class="pill">ID ${escapeHTML(c.id)}</span>
        <span class="pill">${c.items.length} elementos</span>
      </div>
      <h2>${escapeHTML(c.name)}</h2>
      <p>${escapeHTML(c.note || "Sin notas adicionales.")}</p>
    </section>

    <div class="section-title">
      <h2>Índice</h2>
      <span>${c.items.length} entradas</span>
    </div>

    <section class="index-list">
      ${c.items.length ? c.items.map((item, i) => `
        <div class="index-item">
          <div class="index-number">${String(i + 1).padStart(2, "0")}</div>
          <p>${escapeHTML(item)}</p>
        </div>
      `).join("") : `<div class="empty"><strong>Índice vacío</strong>Edita este contenedor para añadir contenido.</div>`}
    </section>

    <div class="actions">
      <button class="secondary-button" data-copy-link>Copiar enlace</button>
      <button class="primary-button" data-edit>Editar índice</button>
    </div>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelector("[data-location-link]")?.addEventListener("click", () => navigate(`#location/${c.locationId}`));
  app.querySelector("[data-zone-link]")?.addEventListener("click", () => navigate(`#zone/${c.zoneId}`));
  app.querySelector("[data-edit]")?.addEventListener("click", () => navigate(`#edit/${c.id}`));
  app.querySelector("[data-copy-link]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("Enlace copiado");
    } catch {
      showToast("No se pudo copiar");
    }
  });
}

function editView(id) {
  const c = containerById(id);
  if (!c) return notFound();

  screenTitle.textContent = "Editar";
  setActiveTab("home");

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-back>‹ Volver a ${escapeHTML(c.id)}</button>
    </div>

    <form class="editor" id="editorForm">
      <div class="field">
        <label for="name">Nombre</label>
        <input id="name" value="${escapeHTML(c.name)}" autocomplete="off" />
      </div>

      <div class="field">
        <label for="type">Tipo</label>
        <input id="type" value="${escapeHTML(c.type)}" autocomplete="off" />
      </div>

      <div class="field">
        <label for="note">Nota</label>
        <input id="note" value="${escapeHTML(c.note || "")}" autocomplete="off" />
      </div>

      <div class="field">
        <label for="items">Índice</label>
        <textarea id="items" spellcheck="true">${escapeHTML(c.items.join("\n"))}</textarea>
        <p class="helper">Una entrada por línea. Puedes añadir, borrar o reordenar libremente.</p>
      </div>

      <div class="actions">
        <button type="button" class="secondary-button" data-cancel>Cancelar</button>
        <button type="submit" class="primary-button">Guardar cambios</button>
      </div>
    </form>
  `;

  const back = () => navigate(`#container/${c.id}`);
  app.querySelector("[data-back]")?.addEventListener("click", back);
  app.querySelector("[data-cancel]")?.addEventListener("click", back);

  app.querySelector("#editorForm").addEventListener("submit", (event) => {
    event.preventDefault();
    c.name = document.querySelector("#name").value.trim() || c.name;
    c.type = document.querySelector("#type").value.trim() || c.type;
    c.note = document.querySelector("#note").value.trim();
    c.items = document.querySelector("#items").value
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

    saveData();
    showToast("Índice actualizado");
    setTimeout(back, 250);
  });
}

function searchView() {
  screenTitle.textContent = "Buscar";
  setActiveTab("search");

  app.innerHTML = `
    <div class="search-box">
      <input id="globalSearch" class="search-input" type="search" placeholder="Buscar cualquier cosa…" autocomplete="off" autofocus />
    </div>
    <section id="searchResults" class="list"></section>
  `;

  const input = app.querySelector("#globalSearch");
  const results = app.querySelector("#searchResults");

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      results.innerHTML = `
        <div class="empty">
          <strong>Busca por contenido o contenedor</strong>
          Prueba con “HDMI”, “seguro”, “A01” o “papelería”.
        </div>`;
      return;
    }

    const matches = [];
    for (const c of data.containers) {
      const loc = locationById(c.locationId);
      const zone = zoneById(c.zoneId);
      const haystack = [
        c.id, c.name, c.type, c.note,
        loc?.name || "", zone?.name || "",
        ...c.items
      ].join(" ").toLowerCase();

      if (haystack.includes(q)) {
        const matchedItems = c.items.filter(item => item.toLowerCase().includes(q));
        matches.push({ c, loc, zone, matchedItems });
      }
    }

    if (!matches.length) {
      results.innerHTML = `<div class="empty"><strong>Sin resultados</strong>No hay ninguna coincidencia con “${escapeHTML(query)}”.</div>`;
      return;
    }

    results.innerHTML = matches.map(({ c, loc, zone, matchedItems }) => `
      <button class="list-row" data-container="${c.id}">
        <div class="row-icon">⌕</div>
        <div class="row-copy">
          <strong>${escapeHTML(c.id)} · ${escapeHTML(c.name)}</strong>
          <small>${escapeHTML(loc?.name || "")}${zone ? ` · ${escapeHTML(zone.name)}` : ""}${matchedItems.length ? ` · ${escapeHTML(matchedItems.slice(0,2).join(" · "))}` : ""}</small>
        </div>
        <span class="chevron">›</span>
      </button>
    `).join("");

    bindContainerLinks();
  }

  renderResults("");
  input.addEventListener("input", () => renderResults(input.value));
}


function transferView() {
  screenTitle.textContent = "Importar/Exportar";
  setActiveTab("transfer");

  const counts = {
    locations: data.locations.length,
    zones: data.zones.length,
    containers: data.containers.length,
    items: data.containers.reduce((sum, container) => sum + (container.items?.length || 0), 0)
  };

  app.innerHTML = `
    <section class="detail-header transfer-header">
      <div class="detail-meta">
        <span class="pill">${counts.locations} ubicaciones</span>
        <span class="pill">${counts.zones} zonas</span>
        <span class="pill">${counts.containers} contenedores</span>
      </div>
      <h2>Copia de seguridad</h2>
      <p>Exporta toda la información guardada en este dispositivo o restaura una copia anterior.</p>
    </section>

    <section class="transfer-grid">
      <article class="transfer-card">
        <div class="transfer-icon">↓</div>
        <div>
          <h3>Exportar</h3>
          <p>Guarda ubicaciones, zonas, contenedores e índices en un único archivo JSON.</p>
        </div>
        <button class="primary-button" data-export>Exportar JSON</button>
      </article>

      <article class="transfer-card">
        <div class="transfer-icon">↑</div>
        <div>
          <h3>Importar</h3>
          <p>Restaura una copia JSON. Los datos actuales se sustituirán únicamente después de confirmar.</p>
        </div>
        <input type="file" id="importFile" accept=".json,application/json" hidden />
        <button class="secondary-button" data-import>Elegir archivo JSON</button>
      </article>
    </section>

    <section class="backup-note">
      <strong>${counts.items} referencias indexadas</strong>
      <p>La copia incluye también toda la estructura de ubicaciones y zonas.</p>
    </section>
  `;

  app.querySelector("[data-export]")?.addEventListener("click", () => {
    exportBackup();
    showToast("Copia preparada");
  });

  const fileInput = app.querySelector("#importFile");

  app.querySelector("[data-import]")?.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      const imported = await importBackup(file);
      if (imported) {
        showToast("Copia importada");
        setTimeout(() => navigate("#home"), 350);
      }
    } catch (error) {
      window.alert(error.message || "No se pudo importar el archivo.");
    }
  });
}

function notFound() {
  screenTitle.textContent = "No encontrado";
  app.innerHTML = `
    <div class="empty">
      <strong>Ese elemento no existe</strong>
      Comprueba la dirección o vuelve al inicio.
      <div class="actions">
        <button class="primary-button" data-home>Ir al inicio</button>
      </div>
    </div>
  `;
  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
}

function route() {
  const raw = location.hash.replace(/^#/, "") || "home";
  const [section, id] = raw.split("/");

  if (section === "home") return homeView();
  if (section === "search") return searchView();
  if (section === "transfer") return transferView();
  if (section === "location") return locationView(id);
  if (section === "zone") return zoneView(id);
  if (section === "new") return newContainerView(id);
  if (section === "container") return containerView(id);
  if (section === "edit") return editView(id);
  return notFound();
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => navigate(`#${btn.dataset.route}`));
});

document.querySelector("#settingsBtn").addEventListener("click", () => {
  showToast("Personalización llegará más adelante");
});

window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
