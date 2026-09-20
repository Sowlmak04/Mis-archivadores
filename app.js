const STORAGE_KEY = "misArchivadores.data.v8";

const EMPTY_DATA = { locations: [], zones: [], containers: [] };

const SETTINGS_KEY = "misArchivadores.settings.v1";
const DEFAULT_SETTINGS = { theme: "auto", accent: "blue" };
const ACCENTS = {
  blue: "#0a84ff",
  indigo: "#5e5ce6",
  purple: "#af52de",
  green: "#30d158",
  orange: "#ff9f0a",
  pink: "#ff375f"
};

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return {
      theme: ["auto", "light", "dark"].includes(stored?.theme) ? stored.theme : DEFAULT_SETTINGS.theme,
      accent: ACCENTS[stored?.accent] ? stored.accent : DEFAULT_SETTINGS.accent
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function resolvedTheme() {
  if (settings.theme !== "auto") return settings.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applySettings() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--accent", ACCENTS[settings.accent]);
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#000000" : "#f5f5f7");
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
}

applySettings();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (settings.theme === "auto") applySettings();
});



function uiIcon(name, className = "ui-icon") {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-7h5v7"/>',
    zone: '<path d="M4 6.5h6l2 2h8v10H4z"/><path d="M4 10.5h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    box: '<path d="M4 7.5 12 4l8 3.5-8 3.5z"/><path d="M4 7.5V17l8 3 8-3V7.5"/><path d="M12 11v9"/>',
    archive: '<path d="M4 6h16v4H4z"/><path d="M5.5 10v10h13V10"/><path d="M9 14h6"/>',
    drawer: '<path d="M4 5h16v14H4z"/><path d="M4 12h16"/><path d="M10 8.5h4"/><path d="M10 15.5h4"/>',
    download: '<path d="M12 3v12"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
    upload: '<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 20h16"/>'
  };
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.box}</svg>`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeItem(item) {
  if (typeof item === "string") return { id: newId("item"), name: item, note: "", photoKey: null };
  return {
    id: item?.id || newId("item"),
    name: String(item?.name || "").trim(),
    note: String(item?.note || "").trim(),
    photoKey: item?.photoKey || null
  };
}

function normalizeData(candidate) {
  const normalized = clone(candidate);
  normalized.zones = Array.isArray(normalized.zones) ? normalized.zones : [];
  const nextOrder = new Map();
  normalized.zones = normalized.zones.map(zone => {
    const current = nextOrder.get(zone.locationId) || 0;
    const order = Number.isFinite(zone.order) ? zone.order : current;
    nextOrder.set(zone.locationId, Math.max(current, order + 1));
    return { ...zone, order };
  });
  normalized.containers = normalized.containers.map(c => ({
    ...c,
    uid: c.uid || newId("container"),
    items: Array.isArray(c.items) ? c.items.map(normalizeItem).filter(item => item.name) : []
  }));
  return normalized;
}

function itemById(container, itemId) {
  return container?.items.find(item => item.id === itemId);
}

function containerByUid(uid) {
  return data.containers.find(c => c.uid === uid);
}

function zonesForLocation(locationId) {
  return data.zones
    .filter(zone => zone.locationId === locationId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function persistZoneOrder(locationId, orderedIds) {
  orderedIds.forEach((id, order) => {
    const zone = data.zones.find(z => z.id === id && z.locationId === locationId);
    if (zone) zone.order = order;
  });
  saveData();
}

function itemNamesFromTextarea(value) {
  return value.split("\n").map(v => v.trim()).filter(Boolean);
}

function reconcileItems(oldItems, names) {
  const used = new Set();
  return names.map((name, index) => {
    let match = oldItems[index]?.name === name ? oldItems[index] : null;
    if (match && used.has(match.id)) match = null;
    if (!match) match = oldItems.find(item => item.name === name && !used.has(item.id));
    if (match) { used.add(match.id); return { ...match, name }; }
    return { id: newId("item"), name, note: "", photoKey: null };
  });
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return clone(EMPTY_DATA);
    const loaded = JSON.parse(stored);
    if (!Array.isArray(loaded.locations) || !Array.isArray(loaded.zones) || !Array.isArray(loaded.containers)) {
      return clone(EMPTY_DATA);
    }
    const normalized = normalizeData(loaded);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return clone(EMPTY_DATA);
  }
}

let data = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function exportBackup() {
  const backup = {
    app: "Mis Archivadores",
    formatVersion: 3,
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
  if (!candidate || typeof candidate !== "object" ||
      !Array.isArray(candidate.locations) || !Array.isArray(candidate.zones) || !Array.isArray(candidate.containers)) {
    throw new Error("El archivo no tiene la estructura de Mis Archivadores v0.8.");
  }

  const imported = normalizeData(candidate);
  const locationIds = new Set();
  const zoneIds = new Set();
  const containerIds = new Set();
  const containerUids = new Set();
  const itemIds = new Set();

  for (const loc of imported.locations) {
    if (!loc?.id || !loc?.name || locationIds.has(loc.id)) throw new Error("Hay una ubicación incompleta o duplicada.");
    locationIds.add(loc.id);
  }
  for (const zone of imported.zones) {
    if (!zone?.id || !zone?.name || !locationIds.has(zone.locationId) || zoneIds.has(zone.id)) throw new Error("Hay una zona incompleta, duplicada o sin ubicación válida.");
    zoneIds.add(zone.id);
  }
  for (const c of imported.containers) {
    if (!c?.id || !c?.name || !locationIds.has(c.locationId) || containerIds.has(c.id)) throw new Error("Hay un contenedor incompleto o duplicado.");
    if (c.zoneId && !zoneIds.has(c.zoneId)) throw new Error("Hay un contenedor asociado a una zona inexistente.");
    if (c.zoneId && zoneByImportedId(imported, c.zoneId)?.locationId !== c.locationId) throw new Error("Hay un contenedor asociado a una ubicación incorrecta.");
    if (!c.uid || containerUids.has(c.uid)) throw new Error("Hay un identificador permanente de contenedor inválido o duplicado.");
    if (!Array.isArray(c.items)) throw new Error("El índice de uno de los contenedores no es válido.");
    for (const item of c.items) {
      if (!item?.id || !item?.name || itemIds.has(item.id)) throw new Error("Hay un elemento incompleto o con identificador duplicado.");
      itemIds.add(item.id);
    }
    containerIds.add(c.id);
    containerUids.add(c.uid);
  }
  return imported;
}

function zoneByImportedId(imported, id) {
  return imported.zones.find(zone => zone.id === id);
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

function newId(prefix) {
  const raw = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${raw}`;
}

function zonePath(zoneId) {
  const zone = zoneById(zoneId);
  return zone ? [zone.name] : [];
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
    ${counts.locations ? `
      <div class="section-title"><h2>Ubicaciones</h2><span>${counts.locations}</span></div>
      <section class="grid">
        ${data.locations.map(loc => {
          const count = data.containers.filter(c => c.locationId === loc.id).length;
          const zones = data.zones.filter(z => z.locationId === loc.id).length;
          return `<button class="card" data-location="${loc.id}">
            <div class="card-icon">${uiIcon("home")}</div><h3>${escapeHTML(loc.name)}</h3>
            <p>${zones ? `${zones} zonas · ` : ""}${count} contenedores</p>
          </button>`;
        }).join("")}
      </section>` : `
      <section class="setup-empty">
        <div class="setup-icon">${uiIcon("home")}</div>
        <h2>Configura tu espacio</h2>
        <p>Todavía no has creado ninguna ubicación. Añade las estancias o espacios donde guardas tus cosas.</p>
        <button class="primary-button" data-configure>Configurar zonas</button>
      </section>`}
  `;
  app.querySelectorAll("[data-location]").forEach(btn => btn.addEventListener("click", () => navigate(`#location/${btn.dataset.location}`)));
  app.querySelector("[data-configure]")?.addEventListener("click", () => navigate("#zones-edit"));
}
function containerRow(c) {
  const loc = locationById(c.locationId);
  const zone = zoneById(c.zoneId);
  return `
    <button class="list-row" data-container="${c.id}">
      <div class="row-icon">${uiIcon(c.type.includes("Archivador") ? "archive" : c.type.includes("Cajón") ? "drawer" : "box")}</div>
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

  const zones = zonesForLocation(locationId);
  const containers = data.containers.filter(c => c.locationId === locationId);
  const directContainers = containers.filter(c => !c.zoneId);

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-home>Inicio</button><span>›</span><span>${escapeHTML(loc.name)}</span>
    </div>

    ${zones.length ? `
      <div class="section-title">
        <h2>Zonas</h2>
        <span>${zones.length}</span>
      </div>
      <section class="list">
        ${zones.map(zone => {
          const count = containers.filter(c => c.zoneId === zone.id).length;
          return `<button class="list-row" data-zone="${zone.id}">
            <div class="row-icon">${uiIcon("zone")}</div>
            <div class="row-copy"><strong>${escapeHTML(zone.name)}</strong><small>${count} contenedores</small></div>
            <span class="chevron">›</span>
          </button>`;
        }).join("")}
      </section>
    ` : ""}

    ${(!zones.length || directContainers.length) ? `
      <div class="section-title ${zones.length ? "section-spaced" : ""}">
        <h2>${zones.length ? "Contenedores sin zona" : "Contenido"}</h2>
        <span>${directContainers.length} contenedores</span>
      </div>
      <section class="list">
        ${directContainers.length ? directContainers.map(containerRow).join("") : `<div class="empty"><strong>Sin contenedores</strong>Añade aquí el primer archivador, caja, cajón u otro elemento que quieras indexar.</div>`}
      </section>
    ` : ""}

    <div class="actions">
      <button class="primary-button" data-add-location-container>+ Añadir contenedor sin zona</button>
    </div>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelectorAll("[data-zone]").forEach(btn => btn.addEventListener("click", () => navigate(`#zone/${btn.dataset.zone}`)));
  app.querySelector("[data-add-location-container]")?.addEventListener("click", () => navigate(`#new-location/${loc.id}`));
  bindContainerLinks();
}
function zoneView(zoneId) {
  const zone = zoneById(zoneId);
  if (!zone) return notFound();

  const loc = locationById(zone.locationId);
  const containers = data.containers.filter(c => c.zoneId === zoneId);

  screenTitle.textContent = zone.name;
  setActiveTab("home");

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-home>Inicio</button><span>›</span>
      <button data-location-link>${escapeHTML(loc?.name || "")}</button><span>›</span>
      <span>${escapeHTML(zone.name)}</span>
    </div>

    <div class="section-title">
      <h2>Contenido</h2>
      <span>${containers.length} contenedores</span>
    </div>

    <section class="list">
      ${containers.length ? containers.map(containerRow).join("") : `<div class="empty"><strong>Sin contenedores</strong>Añade aquí el primer archivador, caja, cajón u otro elemento que quieras indexar.</div>`}
    </section>

    <div class="actions">
      <button class="primary-button" data-add-container>+ Añadir contenedor</button>
    </div>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelector("[data-location-link]")?.addEventListener("click", () => navigate(`#location/${zone.locationId}`));
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
      uid: newId("container"),
      locationId: zone.locationId,
      zoneId: zone.id,
      name,
      type,
      note: document.querySelector("#newNote").value.trim(),
      items: itemNamesFromTextarea(document.querySelector("#newItems").value).map(name => normalizeItem(name))
    };

    data.containers.push(container);
    saveData();
    showToast("Contenedor creado");
    setTimeout(() => navigate(`#container/${id}`), 250);
  });
}


function newLocationContainerView(locationId) {
  const loc = locationById(locationId);
  if (!loc) return notFound();

  screenTitle.textContent = "Nuevo";
  setActiveTab("home");

  app.innerHTML = `
    <div class="breadcrumbs">
      <button data-back>‹ Volver a ${escapeHTML(loc.name)}</button>
    </div>

    <section class="detail-header">
      <div class="detail-meta">
        <span class="pill">${escapeHTML(loc.name)}</span>
      </div>
      <h2>Nuevo contenedor</h2>
      <p>Crea aquí un archivador, caja, cajón u otro elemento cuyo contenido quieras consultar.</p>
    </section>

    <form class="editor" id="newContainerForm">
      <div class="field">
        <label for="newName">Nombre</label>
        <input id="newName" placeholder="Ej. Sillón izquierdo" autocomplete="off" required />
      </div>

      <div class="field">
        <label for="newType">Tipo</label>
        <input id="newType" placeholder="Ej. Caja, cajón, compartimento…" autocomplete="off" required />
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

  const back = () => navigate(`#location/${loc.id}`);
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
    data.containers.push({
      id,
      uid: newId("container"),
      locationId: loc.id,
      zoneId: null,
      name,
      type,
      note: document.querySelector("#newNote").value.trim(),
      items: itemNamesFromTextarea(document.querySelector("#newItems").value).map(name => normalizeItem(name))
    });

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
        <button class="index-item index-item-button" data-item="${item.id}">
          <div class="index-number">${String(i + 1).padStart(2, "0")}</div>
          <div class="index-item-copy"><strong>${escapeHTML(item.name)}</strong>${item.note ? `<small>Con nota</small>` : ""}</div>
          <span class="chevron">›</span>
        </button>
      `).join("") : `<div class="empty"><strong>Índice vacío</strong>Edita este contenedor para añadir contenido.</div>`}
    </section>

    <div class="actions single-action">
      <button class="primary-button" data-edit>Editar contenedor</button>
    </div>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelector("[data-location-link]")?.addEventListener("click", () => navigate(`#location/${c.locationId}`));
  app.querySelector("[data-zone-link]")?.addEventListener("click", () => navigate(`#zone/${c.zoneId}`));
  app.querySelector("[data-edit]")?.addEventListener("click", () => navigate(`#edit/${c.id}`));
  app.querySelectorAll("[data-item]").forEach(btn => btn.addEventListener("click", () => navigate(`#item/${c.uid}/${btn.dataset.item}`)));
}

function editView(id) {
  const c = containerById(id);
  if (!c) return notFound();

  screenTitle.textContent = "Editar contenedor";
  setActiveTab("home");

  const locationOptions = data.locations.map(loc => `<option value="${loc.id}" ${loc.id === c.locationId ? "selected" : ""}>${escapeHTML(loc.name)}</option>`).join("");

  app.innerHTML = `
    <div class="breadcrumbs"><button data-back>‹ Volver a ${escapeHTML(c.id)}</button></div>
    <form class="editor" id="editorForm">
      <div class="field"><label for="name">Nombre</label><input id="name" value="${escapeHTML(c.name)}" autocomplete="off" /></div>
      <div class="field"><label for="type">Tipo</label><input id="type" value="${escapeHTML(c.type)}" autocomplete="off" /></div>
      <div class="field"><label for="note">Nota</label><input id="note" value="${escapeHTML(c.note || "")}" autocomplete="off" /></div>

      <div class="field"><label for="locationSelect">Ubicación</label><select id="locationSelect">${locationOptions}</select></div>
      <div class="field"><label for="zoneSelect">Zona</label><select id="zoneSelect"></select><p class="helper">Puedes dejar el contenedor directamente en la ubicación o asignarlo a una de sus zonas.</p></div>

      <div class="field"><label for="items">Índice</label><textarea id="items" spellcheck="true">${escapeHTML(c.items.map(item => item.name).join("\n"))}</textarea><p class="helper">Una entrada por línea. Puedes añadir, borrar o reordenar libremente.</p></div>

      <div class="actions">
        <button type="button" class="secondary-button" data-cancel>Cancelar</button>
        <button type="submit" class="primary-button">Guardar cambios</button>
      </div>
    </form>

    <section class="danger-zone">
      <strong>Eliminar contenedor</strong>
      <p>Elimina este contenedor y todo su índice. Esta acción no se puede deshacer.</p>
      <button class="danger-button" type="button" data-delete-container>Eliminar contenedor</button>
    </section>
  `;

  const back = () => navigate(`#container/${c.id}`);
  const locationSelect = app.querySelector("#locationSelect");
  const zoneSelect = app.querySelector("#zoneSelect");

  function renderZoneOptions(preferredZoneId = null) {
    const zones = data.zones.filter(zone => zone.locationId === locationSelect.value);
    zoneSelect.innerHTML = `<option value="">Sin zona</option>` + zones.map(zone => `<option value="${zone.id}" ${zone.id === preferredZoneId ? "selected" : ""}>${escapeHTML(zone.name)}</option>`).join("");
  }

  renderZoneOptions(c.zoneId || null);
  locationSelect.addEventListener("change", () => renderZoneOptions(null));
  app.querySelector("[data-back]")?.addEventListener("click", back);
  app.querySelector("[data-cancel]")?.addEventListener("click", back);

  app.querySelector("#editorForm").addEventListener("submit", event => {
    event.preventDefault();
    c.name = app.querySelector("#name").value.trim() || c.name;
    c.type = app.querySelector("#type").value.trim() || c.type;
    c.note = app.querySelector("#note").value.trim();
    c.locationId = locationSelect.value;
    c.zoneId = zoneSelect.value || null;
    c.items = reconcileItems(c.items, itemNamesFromTextarea(app.querySelector("#items").value));
    saveData();
    showToast("Contenedor actualizado");
    setTimeout(back, 250);
  });

  app.querySelector("[data-delete-container]")?.addEventListener("click", () => {
    if (!window.confirm(`¿Eliminar “${c.name}” y todo su índice?\n\nEsta acción no se puede deshacer.`)) return;
    const returnLocation = c.locationId;
    data.containers = data.containers.filter(item => item.id !== c.id);
    saveData();
    showToast("Contenedor eliminado");
    setTimeout(() => navigate(`#location/${returnLocation}`), 250);
  });
}
function itemView(containerUid, itemId) {
  const c = containerByUid(containerUid);
  const item = itemById(c, itemId);
  if (!c || !item) return notFound();
  const loc = locationById(c.locationId);
  const zone = zoneById(c.zoneId);

  screenTitle.textContent = item.name;
  setActiveTab("home");
  app.innerHTML = `
    <div class="breadcrumbs"><button data-container-back>‹ Volver a ${escapeHTML(c.name)}</button></div>
    <section class="detail-header item-detail-header">
      <div class="detail-meta"><span class="pill">Elemento</span><span class="pill">${escapeHTML(c.id)}</span></div>
      <h2>${escapeHTML(item.name)}</h2>
      <p>${escapeHTML(loc?.name || "")}${zone ? ` · ${escapeHTML(zone.name)}` : ""} · ${escapeHTML(c.name)}</p>
    </section>
    <form class="editor" id="itemForm">
      <div class="field"><label for="itemName">Nombre</label><input id="itemName" value="${escapeHTML(item.name)}" autocomplete="off" required /></div>
      <div class="field"><label for="itemNote">Nota</label><textarea id="itemNote" class="item-note-input" placeholder="Opcional. Añade aquí detalles que ayuden a identificar este objeto.">${escapeHTML(item.note || "")}</textarea></div>
      <section class="photo-placeholder">
        <div class="photo-placeholder-icon">${uiIcon("box")}</div>
        <div><strong>Fotografía opcional</strong><p>La ficha ya está preparada para asociar una imagen a este elemento. La subida se activará con Cloudflare R2 para que la foto esté sincronizada entre dispositivos.</p></div>
      </section>
      <div class="actions"><button type="button" class="secondary-button" data-cancel>Cancelar</button><button type="submit" class="primary-button">Guardar elemento</button></div>
    </form>
  `;
  const back = () => navigate(`#c/${c.uid}`);
  app.querySelector("[data-container-back]")?.addEventListener("click", back);
  app.querySelector("[data-cancel]")?.addEventListener("click", back);
  app.querySelector("#itemForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = app.querySelector("#itemName").value.trim();
    if (!name) return showToast("Escribe un nombre");
    item.name = name;
    item.note = app.querySelector("#itemNote").value.trim();
    saveData();
    showToast("Elemento actualizado");
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
        ...c.items.flatMap(item => [item.name, item.note])
      ].join(" ").toLowerCase();

      if (haystack.includes(q)) {
        const matchedItems = c.items.filter(item => `${item.name} ${item.note}`.toLowerCase().includes(q));
        matches.push({ c, loc, zone, matchedItems });
      }
    }

    if (!matches.length) {
      results.innerHTML = `<div class="empty"><strong>Sin resultados</strong>No hay ninguna coincidencia con “${escapeHTML(query)}”.</div>`;
      return;
    }

    results.innerHTML = matches.map(({ c, loc, zone, matchedItems }) => `
      <button class="list-row" data-container="${c.id}">
        <div class="row-icon">${uiIcon("search")}</div>
        <div class="row-copy">
          <strong>${escapeHTML(c.id)} · ${escapeHTML(c.name)}</strong>
          <small>${escapeHTML(loc?.name || "")}${zone ? ` · ${escapeHTML(zone.name)}` : ""}${matchedItems.length ? ` · ${escapeHTML(matchedItems.slice(0,2).map(item => item.name).join(" · "))}` : ""}</small>
        </div>
        <span class="chevron">›</span>
      </button>
    `).join("");

    bindContainerLinks();
  }

  renderResults("");
  input.addEventListener("input", () => renderResults(input.value));
}


function zonesEditView() {
  screenTitle.textContent = "Editar zonas";
  setActiveTab("");
  app.innerHTML = `
    <section class="detail-header settings-header"><h2>Ubicaciones y zonas</h2><p>Crea la estructura que necesites. Una ubicación puede funcionar directamente con contenedores o dividirse en zonas.</p></section>
    <form class="inline-create" id="locationForm">
      <input id="locationName" maxlength="60" placeholder="Nueva ubicación" autocomplete="off" required />
      <button class="primary-button" type="submit">Añadir</button>
    </form>
    <section class="structure-editor">
      ${data.locations.length ? data.locations.map(loc => {
        const zones = zonesForLocation(loc.id);
        const direct = data.containers.filter(c => c.locationId === loc.id && !c.zoneId).length;
        const total = data.containers.filter(c => c.locationId === loc.id).length;
        return `<article class="structure-card" data-location-card="${loc.id}">
          <div class="structure-head">
            <div><strong>${escapeHTML(loc.name)}</strong><small>${zones.length} zonas · ${total} contenedores</small></div>
            <div class="mini-actions"><button data-rename-location="${loc.id}">Renombrar</button><button class="danger-text" data-delete-location="${loc.id}">Eliminar</button></div>
          </div>
          <div class="zone-editor-list ${zones.length ? "has-zones" : ""}">
            ${zones.length ? zones.map((zone, index) => {
              const count=data.containers.filter(c=>c.zoneId===zone.id).length;
              return `<div class="zone-editor-row" data-zone-row="${zone.id}"><button class="drag-handle" type="button" data-drag-zone="${zone.id}" aria-label="Mantén pulsado y arrastra para mover ${escapeHTML(zone.name)}" title="Arrastrar para ordenar"><span aria-hidden="true">≡</span></button><span class="tree-branch" aria-hidden="true">${index === zones.length - 1 ? "└" : "├"}</span><div class="zone-editor-copy"><strong>${escapeHTML(zone.name)}</strong><small>${count} contenedores</small></div><div class="mini-actions"><button data-rename-zone="${zone.id}">Renombrar</button><button class="danger-text" data-delete-zone="${zone.id}">Eliminar</button></div></div>`;
            }).join("") : `<p class="structure-note">Sin zonas. Los contenedores se pueden guardar directamente aquí.</p>`}
          </div>
          <form class="add-zone-form zone-child-form" data-add-zone="${loc.id}">
            <input maxlength="60" placeholder="Nueva zona" autocomplete="off" required />
            <button class="secondary-button" type="submit">+ Zona</button>
          </form>
          ${direct ? `<p class="helper zone-direct-note">${direct} contenedores están directamente en esta ubicación y pueden convivir con las zonas.</p>` : ""}
        </article>`;
      }).join("") : `<div class="empty"><strong>Aún no hay ubicaciones</strong>Crea la primera para empezar a organizar tu espacio.</div>`}
    </section>`;

  app.querySelector("#locationForm")?.addEventListener("submit", e => {
    e.preventDefault(); const input=app.querySelector("#locationName"); const name=input.value.trim(); if(!name)return;
    data.locations.push({id:newId("loc"),name}); saveData(); zonesEditView(); showToast("Ubicación añadida");
  });
  app.querySelectorAll("[data-add-zone]").forEach(form => form.addEventListener("submit", e => {
    e.preventDefault(); const locationId=form.dataset.addZone; const input=form.querySelector("input"); const name=input.value.trim(); if(!name)return;
    const order=zonesForLocation(locationId).length; data.zones.push({id:newId("zone"),locationId,name,order}); saveData(); zonesEditView(); showToast("Zona añadida");
  }));
  app.querySelectorAll("[data-drag-zone]").forEach(handle => {
    let dragging = false;
    let row = null;
    let list = null;
    const finish = () => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(handle._pointerId);
      row?.classList.remove("is-dragging");
      document.body.classList.remove("is-reordering");
      const card = row?.closest("[data-location-card]");
      if (card && list) {
        const ids = [...list.querySelectorAll("[data-zone-row]")].map(el => el.dataset.zoneRow);
        persistZoneOrder(card.dataset.locationCard, ids);
        zonesEditView();
        showToast("Orden de zonas actualizado");
      }
    };
    handle.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      row = handle.closest("[data-zone-row]");
      list = row?.closest(".zone-editor-list");
      if (!row || !list) return;
      dragging = true;
      handle._pointerId = event.pointerId;
      handle.setPointerCapture?.(event.pointerId);
      row.classList.add("is-dragging");
      document.body.classList.add("is-reordering");
      event.preventDefault();
    });
    handle.addEventListener("pointermove", event => {
      if (!dragging || !list || !row) return;
      const siblings = [...list.querySelectorAll("[data-zone-row]")].filter(el => el !== row);
      const target = siblings.find(el => event.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
      if (target) list.insertBefore(row, target); else list.appendChild(row);
      event.preventDefault();
    });
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });

  app.querySelectorAll("[data-rename-location]").forEach(btn => btn.addEventListener("click", () => {
    const loc=locationById(btn.dataset.renameLocation); const name=window.prompt("Nuevo nombre de la ubicación:",loc.name)?.trim(); if(!name)return;
    loc.name=name; saveData(); zonesEditView(); showToast("Ubicación actualizada");
  }));
  app.querySelectorAll("[data-rename-zone]").forEach(btn => btn.addEventListener("click", () => {
    const zone=zoneById(btn.dataset.renameZone); const name=window.prompt("Nuevo nombre de la zona:",zone.name)?.trim(); if(!name)return;
    zone.name=name; saveData(); zonesEditView(); showToast("Zona actualizada");
  }));
  app.querySelectorAll("[data-delete-zone]").forEach(btn => btn.addEventListener("click", () => {
    const zone=zoneById(btn.dataset.deleteZone); const count=data.containers.filter(c=>c.zoneId===zone.id).length;
    const msg=count ? `“${zone.name}” contiene ${count} contenedores. Si continúas se eliminarán también.\n\n¿Eliminar zona?` : `¿Eliminar la zona “${zone.name}”?`;
    if(!window.confirm(msg))return; data.containers=data.containers.filter(c=>c.zoneId!==zone.id); data.zones=data.zones.filter(z=>z.id!==zone.id); saveData(); zonesEditView(); showToast("Zona eliminada");
  }));
  app.querySelectorAll("[data-delete-location]").forEach(btn => btn.addEventListener("click", () => {
    const loc=locationById(btn.dataset.deleteLocation); const count=data.containers.filter(c=>c.locationId===loc.id).length; const zcount=data.zones.filter(z=>z.locationId===loc.id).length;
    if(!window.confirm(`Eliminar “${loc.name}” eliminará también ${zcount} zonas y ${count} contenedores.\n\n¿Continuar?`))return;
    data.containers=data.containers.filter(c=>c.locationId!==loc.id); data.zones=data.zones.filter(z=>z.locationId!==loc.id); data.locations=data.locations.filter(l=>l.id!==loc.id); saveData(); zonesEditView(); showToast("Ubicación eliminada");
  }));
}

function personalizationView() {
  screenTitle.textContent = "Personalización";
  setActiveTab("");

  const accentOptions = [
    ["blue", "Azul"], ["indigo", "Índigo"], ["purple", "Morado"],
    ["green", "Verde"], ["orange", "Naranja"], ["pink", "Rosa"]
  ];

  app.innerHTML = `
    <section class="detail-header settings-header">
      <h2>Personalización</h2>
      <p>Ajusta la apariencia de este dispositivo. Estas preferencias se guardan por separado de tus archivadores.</p>
    </section>

    <section class="preference-card">
      <div class="preference-heading">
        <strong>Tema</strong>
        <span>El modo automático sigue la apariencia del iPhone.</span>
      </div>
      <div class="segmented-control" role="group" aria-label="Tema">
        ${[["auto","Automático"],["light","Claro"],["dark","Oscuro"]].map(([value,label]) => `
          <button class="${settings.theme === value ? "is-selected" : ""}" data-theme="${value}">${label}</button>
        `).join("")}
      </div>
    </section>

    <section class="preference-card">
      <div class="preference-heading">
        <strong>Color de acento</strong>
        <span>Se aplica a botones, navegación y elementos destacados.</span>
      </div>
      <div class="accent-grid" role="group" aria-label="Color de acento">
        ${accentOptions.map(([value,label]) => `
          <button class="accent-option ${settings.accent === value ? "is-selected" : ""}" data-accent="${value}">
            <span class="accent-swatch" style="--swatch:${ACCENTS[value]}"></span>
            <span>${label}</span>
            <span class="accent-check">${settings.accent === value ? "✓" : ""}</span>
          </button>
        `).join("")}
      </div>
    </section>

    <section class="backup-note preference-note">
      <strong>Preferencia local</strong>
      <p>El tema y el color no se incluyen en las copias de Importar/Exportar. Los datos de tus archivadores permanecen independientes.</p>
    </section>
  `;

  app.querySelectorAll("[data-theme]").forEach(btn => btn.addEventListener("click", () => {
    settings.theme = btn.dataset.theme;
    saveSettings();
    personalizationView();
  }));

  app.querySelectorAll("[data-accent]").forEach(btn => btn.addEventListener("click", () => {
    settings.accent = btn.dataset.accent;
    saveSettings();
    personalizationView();
  }));
}

function transferView() {
  screenTitle.textContent = "Importar/Exportar";
  setActiveTab("");

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
        <div class="transfer-icon">${uiIcon("download")}</div>
        <div>
          <h3>Exportar</h3>
          <p>Guarda ubicaciones, zonas, contenedores e índices en un único archivo JSON.</p>
        </div>
        <button class="primary-button" data-export>Exportar JSON</button>
      </article>

      <article class="transfer-card">
        <div class="transfer-icon">${uiIcon("upload")}</div>
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
  if (section === "zones-edit") return zonesEditView();
  if (section === "personalization") return personalizationView();
  if (section === "location") return locationView(id);
  if (section === "zone") return zoneView(id);
  if (section === "new") return newContainerView(id);
  if (section === "new-location") return newLocationContainerView(id);
  if (section === "container") return containerView(id);
  if (section === "c") { const c = containerByUid(id); return c ? containerView(c.id) : notFound(); }
  if (section === "item") { const parts = raw.split("/"); return itemView(parts[1], parts[2]); }
  if (section === "edit") return editView(id);
  return notFound();
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => navigate(`#${btn.dataset.route}`));
});

const settingsBtn = document.querySelector("#settingsBtn");
const settingsMenu = document.querySelector("#settingsMenu");
settingsBtn.addEventListener("click", event => {
  event.stopPropagation();
  const open = settingsMenu.classList.toggle("is-open");
  settingsBtn.setAttribute("aria-expanded", String(open));
});
settingsMenu.querySelectorAll("[data-menu-route]").forEach(btn => btn.addEventListener("click", () => {
  settingsMenu.classList.remove("is-open");
  settingsBtn.setAttribute("aria-expanded", "false");
  navigate(`#${btn.dataset.menuRoute}`);
}));
document.addEventListener("click", event => {
  if (!settingsMenu.contains(event.target) && event.target !== settingsBtn) {
    settingsMenu.classList.remove("is-open");
    settingsBtn.setAttribute("aria-expanded", "false");
  }
});

window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
