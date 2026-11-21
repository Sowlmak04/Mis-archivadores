import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const remote = { inventory: { id: "home-main" }, locations: [{ id: "l", name: "Remota" }], zones: [{ id: "z", location_id: "l", name: "Zona" }], containers: [{ id: "C053", uid: "u", location_id: "l", zone_id: null, name: "Caja", type: null }], items: [{ id: "i", container_id: "C053", name: "Objeto", note: "Nota" }], item_photos: [{ id: "p", item_id: "i", object_key: "foto" }] };
const legacy = { locations: [{ id: "old", name: "Local" }], zones: [], containers: [], nextContainerNumber: 1 };

async function launch(response, hash = "#home") {
  const elements = new Map();
  const element = () => ({ innerHTML: "", textContent: "", hidden: false, dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; } });
  const get = key => { if (!elements.has(key)) elements.set(key, element()); return elements.get(key); };
  const writes = [], calls = [];
  const context = { console, URL, Blob, setTimeout() {}, location: { hash }, navigator: {},
    localStorage: { getItem(key) { return key.includes("data") ? JSON.stringify(legacy) : null; }, setItem(...args) { writes.push(args); } },
    document: { documentElement: get("html"), querySelector: get, querySelectorAll() { return []; }, addEventListener() {} },
    window: { matchMedia() { return { matches: false, addEventListener() {} }; }, addEventListener() {}, alert() {} },
    fetch: async (...args) => { calls.push(args); if (response instanceof Error) throw response; return response; }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, get, writes, calls };
}
const ok = () => ({ ok: true, status: 200, json: async () => remote });

test("carga remota y renderiza sin mezclar ni escribir datos locales", async () => {
  const app = await launch(ok());
  assert.equal(app.calls[0][0], "/api/data?inventory_id=home-main");
  assert.match(app.get("#app").innerHTML, /Remota/);
  assert.doesNotMatch(app.get("#app").innerHTML, /Local/);
  assert.match(app.get("#app").innerHTML, /1 contenedores · 1 referencias/);
  assert.equal(app.writes.length, 0);
  assert.equal(vm.runInContext('data.containers[0].items[0].photos[0].object_key', app.context), "foto");
  assert.equal(vm.runInContext('data.containers[0].zoneId', app.context), null);
});

test("fallo de red usa solo la copia local con aviso", async () => {
  const app = await launch(new Error("offline"));
  assert.match(app.get("#app").innerHTML, /Local/);
  assert.match(app.get("#loadStatus").textContent, /copia local/);
  assert.equal(app.writes.length, 0);
});

for (const status of [401, 403, 404]) test(`${status} muestra error sin revelar la copia local`, async () => {
  const app = await launch({ ok: false, status });
  assert.match(app.get("#app").innerHTML, /no disponible/);
  assert.ok(app.get("#loadStatus").textContent);
  assert.doesNotMatch(app.get("#app").innerHTML, /Local/);
  assert.equal(app.writes.length, 0);
});

test("rutas de escritura quedan bloqueadas y la ficha de elemento es de lectura", async () => {
  for (const hash of ["#zones-edit", "#new/z", "#new-location/l", "#edit/C053", "#move/C053"]) {
    const app = await launch(ok(), hash);
    assert.match(app.get("#app").innerHTML, /no está conectada/);
    assert.equal(app.writes.length, 0);
  }
  const item = await launch(ok(), "#item/u/i");
  assert.match(item.get("#app").innerHTML, /readonly/);
  assert.doesNotMatch(item.get("#app").innerHTML, /Guardar elemento/);
  const transfer = await launch(ok(), "#transfer");
  assert.doesNotMatch(transfer.get("#app").innerHTML, /data-import>/);
});

test("importación desactivada en remoto y fallback, sin leer archivos ni alterar datos", async () => {
  for (const response of [ok(), new Error("offline")]) {
    const app = await launch(response, "#transfer");
    const before = vm.runInContext("JSON.stringify(data)", app.context);
    assert.doesNotMatch(app.get("#app").innerHTML, /id="importFile"|data-import/);
    assert.match(app.get("#app").innerHTML, /data-export/);
    let read = false;
    app.context.testFile = { text() { read = true; throw new Error("should not read"); } };
    assert.equal(await vm.runInContext("importBackup(testFile)", app.context), false);
    assert.equal(read, false);
    assert.equal(vm.runInContext("JSON.stringify(data)", app.context), before);
    assert.equal(app.writes.length, 0);
    assert.throws(() => vm.runInContext("saveData()", app.context), /read-only/);
  }
});

test("eliminación ausente en detalle y editor heredado; envío heredado protegido", async () => {
  const app = await launch(ok(), "#container/C053");
  const before = vm.runInContext("JSON.stringify(data)", app.context);
  assert.doesNotMatch(app.get("#app").innerHTML, /data-delete-container/);
  vm.runInContext(`
    globalThis.handlers = {};
    app.querySelector = selector => ({ addEventListener: (event, callback) => { handlers[selector + ':' + event] = callback; } });
    editView('C053');
  `, app.context);
  assert.doesNotMatch(app.get("#app").innerHTML, /data-delete-container/);
  assert.equal(app.context.handlers["[data-delete-container]:click"], undefined);
  app.context.handlers["#editorForm:submit"]({ preventDefault() {} });
  assert.equal(vm.runInContext("JSON.stringify(data)", app.context), before);
  assert.equal(app.writes.length, 0);
});
