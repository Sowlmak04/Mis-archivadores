import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

// Uses Wrangler's installed Miniflare, with ephemeral D1 only. No Wrangler
// configuration, remote bindings, R2, or existing local database is loaded.
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  scriptPath: fileURLToPath(new URL("../src/worker.js", import.meta.url)),
  compatibilityDate: "2026-10-06",
  telemetry: { enabled: false },
  d1Databases: { DB: "containers-tests" },
  outboundService: () => new Response("Network disabled in tests", { status: 503 })
}));
let db;
const base = {
  inventory_id: "home-main", uid: "new-container", location_id: "home-a",
  zone_id: null, name: "  Documentación  ", type: "", note: ""
};
const timestamp = "2020-01-01T00:00:00.000Z";

before(async () => {
  db = await mf.getD1Database("DB");
  for (const file of ["0001_initial_schema.sql", "0002_add_inventories.sql"]) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean);
    await db.batch(statements.map(s => db.prepare(s)));
  }
  await db.batch([
    ...["home-main", "other"].map(id => db.prepare(
      "INSERT INTO inventories VALUES (?1, ?1, ?2, ?2)"
    ).bind(id, timestamp)),
    ...[["home-a", "home-main"], ["home-b", "home-main"], ["other-a", "other"]].map(([id, inventory]) =>
      db.prepare("INSERT INTO locations VALUES (?1, ?2, ?1, ?3, ?3)").bind(id, inventory, timestamp)),
    ...[["zone-a", "home-a"], ["zone-b", "home-b"]].map(([id, location]) =>
      db.prepare("INSERT INTO zones VALUES (?1, ?2, ?1, ?3, ?3)").bind(id, location, timestamp))
  ]);
});
after(async () => { await mf.dispose(); });
beforeEach(async () => {
  await db.batch([
    db.prepare("DROP TRIGGER IF EXISTS test_failure"),
    db.prepare("DELETE FROM containers"),
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'containers'"),
    db.prepare(`INSERT INTO containers
      (number, uid, location_id, name, type, note, created_at, updated_at)
      VALUES (53, 'seed', 'home-a', 'Seed', '', '', ?1, ?1)`).bind(timestamp)
  ]);
});

async function request(body = base, options = {}) {
  const response = await mf.dispatchFetch("http://localhost/api/containers", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), ...options
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  return response;
}
async function count() {
  return (await db.prepare("SELECT count(*) AS n FROM containers").first()).n;
}
async function expectError(body, status, code, options) {
  const previous = await count();
  const response = await request(body, options);
  assert.equal(response.status, status);
  const result = await response.json();
  assert.equal(result.error.code, code);
  assert.deepEqual(Object.keys(result), ["error"]);
  assert.equal(await count(), previous, "Rejected requests must not insert rows");
  return result;
}

test("creación sin zona aunque la ubicación tenga zonas; estado 53 -> C054", async () => {
  const response = await request();
  assert.equal(response.status, 201);
  const { container } = await response.json();
  assert.equal(container.number, 54);
  assert.equal(container.id, "C054");
  assert.equal(container.zone_id, null);
  assert.equal(container.name, "Documentación");
  assert.equal(container.type, "");
  assert.equal(container.note, "");
});
test("creación válida con zona", async () => {
  const response = await request({ ...base, zone_id: "zone-a", type: " Caja ", note: " Nota " });
  assert.equal(response.status, 201);
  const { container } = await response.json();
  assert.equal(container.zone_id, "zone-a");
  assert.equal(container.location_id, "home-a");
  assert.equal(container.type, " Caja ");
  assert.equal(container.note, " Nota ");
});
test("dos creaciones consecutivas -> C054/C055", async () => {
  const first = await request();
  const second = await request({ ...base, uid: "second" });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const a = (await first.json()).container;
  const b = (await second.json()).container;
  assert.deepEqual([a.number, a.id, b.number, b.id], [54, "C054", 55, "C055"]);
});
test("dos creaciones concurrentes con UIDs distintos -> números e IDs distintos", async () => {
  const responses = await Promise.all([
    request({ ...base, uid: "parallel-a" }), request({ ...base, uid: "parallel-b" })
  ]);
  assert.deepEqual(responses.map(r => r.status), [201, 201]);
  const rows = await Promise.all(responses.map(async r => (await r.json()).container));
  assert.deepEqual(rows.map(r => r.number).sort((a, b) => a - b), [54, 55]);
  assert.deepEqual(rows.map(r => r.id).sort(), ["C054", "C055"]);
  for (const row of rows) {
    assert.deepEqual(await db.prepare("SELECT * FROM containers WHERE uid = ?1").bind(row.uid).first(), row);
  }
  assert.equal(await count(), 3);
});
test("UID duplicado: no altera la fila existente", async () => {
  const original = await db.prepare("SELECT * FROM containers WHERE uid = 'seed'").first();
  await expectError({ ...base, uid: "seed" }, 409, "UID_ALREADY_EXISTS");
  assert.deepEqual(await db.prepare("SELECT * FROM containers WHERE uid = 'seed'").first(), original);
});
test("dos peticiones concurrentes con el mismo UID: un 201, un 409, una fila", async () => {
  const responses = await Promise.all([request(), request()]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  const conflict = responses.find(r => r.status === 409);
  assert.equal((await conflict.json()).error.code, "UID_ALREADY_EXISTS");
  assert.equal((await db.prepare("SELECT count(*) AS n FROM containers WHERE uid = ?1").bind(base.uid).first()).n, 1);
  assert.equal(await count(), 2);
});
for (const [label, patch, status, code] of [
  ["inventario inexistente", { inventory_id: "missing" }, 404, "INVENTORY_NOT_FOUND"],
  ["ubicación inexistente", { location_id: "missing" }, 404, "LOCATION_NOT_FOUND"],
  ["ubicación de otro inventario", { location_id: "other-a" }, 404, "LOCATION_NOT_FOUND"],
  ["zona inexistente", { zone_id: "missing" }, 422, "INVALID_ZONE"],
  ["zona de otra ubicación", { zone_id: "zone-b" }, 422, "INVALID_ZONE"]
]) {
  test(label, () => expectError({ ...base, ...patch }, status, code));
}
test("JSON inválido", () => expectError(base, 400, "INVALID_BODY", { body: "{" }));
test("body vacío", () => expectError(base, 400, "INVALID_BODY", { body: "" }));
for (const body of [null, [], "text", 3, true]) {
  test(`raíz JSON inválida: ${JSON.stringify(body)}`, () => expectError(body, 400, "INVALID_BODY"));
}
for (const field of ["extra", "number", "id", "created_at", "updated_at", "items"]) {
  test(`campo inesperado/prohibido: ${field}`, () =>
    expectError({ ...base, [field]: field === "number" ? 54 : "forbidden" }, 400, "VALIDATION_ERROR"));
}
for (const field of Object.keys(base)) {
  test(`campo obligatorio: ${field}`, () => {
    const body = { ...base };
    delete body[field];
    return expectError(body, 400, "VALIDATION_ERROR");
  });
  for (const value of [42, false, [], {}]) {
    test(`tipo inválido: ${field}=${JSON.stringify(value)}`, () =>
      expectError({ ...base, [field]: value }, 400, "VALIDATION_ERROR"));
  }
  if (field !== "zone_id") {
    test(`null inválido: ${field}`, () => expectError({ ...base, [field]: null }, 400, "VALIDATION_ERROR"));
  }
}
for (const field of ["inventory_id", "uid", "location_id", "zone_id"]) {
  for (const value of ["", " ", " leading", "trailing "]) {
    test(`identificador inválido: ${field}=${JSON.stringify(value)}`, () =>
      expectError({ ...base, [field]: value }, 400, "VALIDATION_ERROR"));
  }
}
for (const name of ["", "  \n\t "]) {
  test(`nombre vacío: ${JSON.stringify(name)}`, () => expectError({ ...base, name }, 400, "VALIDATION_ERROR"));
}
for (const contentType of [null, "text/plain", "application/jsonp"]) {
  test(`Content-Type no admitido: ${contentType}`, () => expectError(base, 415, "UNSUPPORTED_MEDIA_TYPE", {
    headers: contentType ? { "Content-Type": contentType } : {}
  }));
}
test("Content-Type application/json con charset", async () => {
  assert.equal((await request(base, { headers: { "Content-Type": "application/json; charset=utf-8" } })).status, 201);
});
for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
  test(`método no permitido: ${method}`, async () => {
    const previous = await count();
    const response = await request(base, { method, body: undefined });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "POST");
    if (method !== "HEAD") assert.equal((await response.json()).error.code, "METHOD_NOT_ALLOWED");
    assert.equal(await count(), previous);
  });
}
test("timestamps del servidor iguales y fila devuelta idéntica a la persistida", async () => {
  const start = Date.now();
  const response = await request();
  const end = Date.now();
  assert.equal(response.status, 201);
  const { container } = await response.json();
  assert.deepEqual(Object.keys(container).sort(), [
    "number", "id", "uid", "location_id", "zone_id", "name", "type", "note", "created_at", "updated_at"
  ].sort());
  assert.equal(container.created_at, container.updated_at);
  const created = Date.parse(container.created_at);
  assert.ok(created >= start && created <= end);
  assert.equal(new Date(created).toISOString(), container.created_at);
  assert.deepEqual(await db.prepare("SELECT * FROM containers WHERE uid = ?1").bind(base.uid).first(), container);
});
test("conflicto SQL inesperado: 409 genérico y rollback", async () => {
  await db.prepare(`CREATE TRIGGER test_failure BEFORE INSERT ON containers
    BEGIN SELECT RAISE(ABORT, 'CHECK constraint failed: private_test'); END`).run();
  const result = await expectError(base, 409, "CONTAINER_CONFLICT");
  assert.ok(!JSON.stringify(result).includes("private_test"));
});
test("error interno: 500 sin detalles SQL y rollback", async () => {
  await db.prepare(`CREATE TRIGGER test_failure BEFORE INSERT ON containers
    BEGIN SELECT RAISE(ABORT, 'private SQL details'); END`).run();
  const result = await expectError(base, 500, "INTERNAL_ERROR");
  assert.ok(!JSON.stringify(result).includes("private SQL details"));
});
test("restricciones SQL: UNIQUE(uid) y FK compuesta siguen activas", async () => {
  const insert = db.prepare(`INSERT INTO containers
    (uid, location_id, zone_id, name, type, note, created_at, updated_at)
    VALUES (?1, 'home-a', ?2, 'Direct test', '', '', ?3, ?3)`);
  await assert.rejects(insert.bind("seed", null, timestamp).run(), /UNIQUE constraint failed/);
  await assert.rejects(insert.bind("bad-zone", "zone-b", timestamp).run(), /FOREIGN KEY constraint failed/);
  assert.equal(await count(), 1);
});
test("cabeceras de las otras respuestas API existentes", async () => {
  for (const path of ["/api/health", "/api/db-health", "/api/data", "/api/data?inventory_id=home-main"]) {
    const response = await mf.dispatchFetch(`http://localhost${path}`);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    await response.text();
  }
});
