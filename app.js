const STORAGE_KEY = "misArchivadores.data.v2";

const seedData = {
  locations: [
    { id: "salon", name: "Salón", icon: "⌂" },
    { id: "oficina", name: "Oficina", icon: "▣" },
    { id: "habitacion", name: "Habitación", icon: "□" },
    { id: "habitacion-luna", name: "Habitación Luna", icon: "◇" },
    { id: "terraza-salon", name: "Terraza salón", icon: "⌑" },
    { id: "terraza-habita", name: "Terraza habita", icon: "▱" }
  ],
  zones: [],
  containers: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : clone(seedData);
  } catch {
    return clone(seedData);
  }
}

let data = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    <section class="hero">
      <p class="hero-kicker">Índice doméstico</p>
      <h2>Encuentra lo que guardaste, sin abrir nada.</h2>
      <p>${counts.containers} contenedores · ${counts.items} referencias indexadas</p>
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

    <div class="section-title">
      <h2>Estructura</h2>
      <span>Siguiente capa</span>
    </div>

    <section class="list">
      <div class="empty">
        <strong>Ubicaciones definidas</strong>
        Las zonas de cada ubicación se configurarán en el siguiente paso.
      </div>
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

  const zones = data.zones.filter(z => z.locationId === locationId);
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
        const count = containers.filter(c => c.zoneId === zone.id).length;
        return `
          <button class="list-row" data-zone="${zone.id}">
            <div class="row-icon">⌗</div>
            <div class="row-copy">
              <strong>${escapeHTML(zone.name)}</strong>
              <small>${count} contenedores</small>
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
      ${containers.length ? containers.map(containerRow).join("") : `<div class="empty"><strong>Zona vacía</strong>No hay contenedores registrados todavía.</div>`}
    </section>
  `;

  app.querySelector("[data-home]")?.addEventListener("click", () => navigate("#home"));
  app.querySelector("[data-location-link]")?.addEventListener("click", () => navigate(`#location/${zone.locationId}`));
  bindContainerLinks();
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
  if (section === "location") return locationView(id);
  if (section === "zone") return zoneView(id);
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
