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
  d1Databases: { DB: "containers-tests", MIGRATION_DB: "migration-tests" },
  outboundService: () => new Response("Network disabled in tests", { status: 503 })
}));
let db;
const base = {
  inventory_id: "home-main", uid: "new-container", location_id: "home-a",
  zone_id: null, name: "  Documentación  ", type: "", note: ""
};
const timestamp = "2020-01-01T00:00:00.000Z";

async function migrate(database, files) {
  for (const file of files) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean);
    await database.batch(statements.map(s => database.prepare(s)));
  }
}

before(async () => {
  db = await mf.getD1Database("DB");
  await migrate(db, ["0001_initial_schema.sql", "0002_add_inventories.sql", "0003_add_container_version.sql"]);
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
  assert.equal(container.version, 1);
  assert.equal((await db.prepare("SELECT version FROM containers WHERE id = ?1").bind(container.id).first()).version, 1);
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
for (const field of ["extra", "number", "id", "created_at", "updated_at", "items", "version", "expected_version"]) {
  test(`campo inesperado/prohibido: ${field}`, () =>
    expectError({ ...base, [field]: field === "number" ? 54 : ["version", "expected_version"].includes(field) ? 1 : "forbidden" }, 400, "VALIDATION_ERROR"));
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
    "number", "id", "uid", "location_id", "zone_id", "name", "type", "note", "created_at", "updated_at", "version"
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
test("0003 conserva los 53 contenedores existentes, relaciones e items y añade version 1", async () => {
  const database = await mf.getD1Database("MIGRATION_DB");
  await migrate(database, ["0001_initial_schema.sql", "0002_add_inventories.sql"]);
  await database.batch([
    database.prepare("INSERT INTO inventories VALUES ('inventory', 'Inventario', ?1, ?1)").bind(timestamp),
    database.prepare("INSERT INTO locations VALUES ('location', 'inventory', 'Casa', ?1, ?1)").bind(timestamp),
    database.prepare("INSERT INTO zones VALUES ('zone', 'location', 'Zona', ?1, ?1)").bind(timestamp),
    ...Array.from({ length: 53 }, (_, index) => database.prepare(`
      INSERT INTO containers
        (number, uid, location_id, zone_id, name, type, note, created_at, updated_at)
      VALUES (?1, ?2, 'location', ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(index + 1, `uid-${index}`, index % 2 ? 'zone' : null,
      `Nombre ${index}`, `Tipo ${index}`, `Nota ${index}`, timestamp, '2021-02-03T04:05:06.000Z')),
    ...Array.from({ length: 53 }, (_, index) => database.prepare(`
      INSERT INTO items VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `).bind(`item-${index}`, `C${String(index + 1).padStart(3, '0')}`,
      `Item ${index}`, `Nota item ${index}`, index, timestamp, '2022-02-03T04:05:06.000Z'))
  ]);
  const tables = ['inventories', 'locations', 'zones', 'containers', 'items', 'sqlite_sequence'];
  const snapshot = async () => Promise.all(tables.map(async table =>
    (await database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results));
  const beforeMigration = await snapshot();
  await migrate(database, ["0003_add_container_version.sql"]);
  const afterMigration = await snapshot();
  const containersIndex = tables.indexOf('containers');
  assert.equal(afterMigration[containersIndex].length, 53);
  afterMigration[containersIndex] = afterMigration[containersIndex].map(({ version, ...unchanged }) => {
    assert.equal(version, 1);
    return unchanged;
  });
  assert.deepEqual(afterMigration, beforeMigration);
});

test("GET devuelve la version persistida sin cambiar el resto del contenedor", async () => {
  await db.prepare("UPDATE containers SET version = 7 WHERE uid = 'seed'").run();
  const response = await mf.dispatchFetch("http://localhost/api/data?inventory_id=home-main");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.containers.length, 1);
  assert.equal(data.containers[0].version, 7);
  assert.deepEqual(data.containers[0], await db.prepare("SELECT * FROM containers WHERE uid = 'seed'").first());
});

for (const [label, value] of [
  ['cero', 0], ['negativo', -1], ['decimal', 1.5], ['texto', 'invalid'],
  ['fuera del rango seguro', 9007199254740992], ['null', null]
]) {
  test(`version SQL rechaza ${label} sin alterar la fila`, async () => {
    const original = await db.prepare("SELECT * FROM containers WHERE uid = 'seed'").first();
    await assert.rejects(db.prepare("UPDATE containers SET version = ?1 WHERE uid = 'seed'").bind(value).run(),
      /(?:CHECK|NOT NULL) constraint failed/);
    assert.deepEqual(await db.prepare("SELECT * FROM containers WHERE uid = 'seed'").first(), original);
  });
}

test("version SQL admite el máximo entero seguro", async () => {
  await db.prepare("UPDATE containers SET version = ?1 WHERE uid = 'seed'").bind(Number.MAX_SAFE_INTEGER).run();
  assert.equal((await db.prepare("SELECT version FROM containers WHERE uid = 'seed'").first()).version, Number.MAX_SAFE_INTEGER);
});

test("cabeceras de las otras respuestas API existentes", async () => {
  for (const path of ["/api/health", "/api/db-health", "/api/data", "/api/data?inventory_id=home-main"]) {
    const response = await mf.dispatchFetch(`http://localhost${path}`);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    await response.text();
  }
});

// PATCH integration tests exercise the real Worker against ephemeral local D1.
async function seedPatch(zone = null) {
  await db.prepare("UPDATE containers SET version = 4, zone_id = ? WHERE id = 'C053'").bind(zone).run();
  await db.prepare("INSERT INTO items VALUES ('patch-item', 'C053', 'Item', 'Note', 2, ?1, ?1)").bind(timestamp).run();
}
const row = () => db.prepare("SELECT * FROM containers WHERE id = 'C053'").first();
const items = async () => (await db.prepare("SELECT * FROM items ORDER BY id").all()).results;
async function patch(body = { expected_version: 4, name: "New" }, options = {}) {
  const { path = "C053?inventory_id=home-main", ...init } = options;
  const response = await mf.dispatchFetch(`http://localhost/api/containers/${path}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), ...init
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  return response;
}
async function patchError(body, status, code, options) {
  const original = await row();
  const originalItems = await items();
  const response = await patch(body, options);
  assert.equal(response.status, status);
  const result = await response.json();
  assert.equal(result.error.code, code);
  assert.deepEqual(await row(), original);
  assert.deepEqual(await items(), originalItems);
  if (code === "VERSION_CONFLICT") {
    assert.deepEqual(result.current_container, original);
    assert.equal(result.error.message, "El contenedor ha cambiado desde que lo leíste.");
  } else assert.deepEqual(Object.keys(result), ["error"]);
  return result;
}
for (const zone of [null, "zone-a"]) {
  for (const change of [{ name: "  Nuevo  " }, { type: "" }, { note: "" },
    { name: "Several", type: " Type ", note: " Note " }, { name: "Seed" }]) {
    test(`PATCH updates ${JSON.stringify(change)} zone=${zone}, preserves identity/items`, async () => {
      await seedPatch(zone);
      const original = await row();
      const originalItems = await items();
      const start = Date.now();
      const response = await patch({ expected_version: 4, ...change });
      const end = Date.now();
      assert.equal(response.status, 200);
      const { container } = await response.json();
      const expected = { ...original, ...change, version: 5, updated_at: container.updated_at };
      if (change.name) expected.name = change.name.trim();
      assert.deepEqual(container, expected);
      assert.deepEqual(await row(), container);
      assert.deepEqual(await items(), originalItems);
      assert.notEqual(container.updated_at, original.updated_at);
      assert.ok(Date.parse(container.updated_at) >= start && Date.parse(container.updated_at) <= end);
      await patchError({ expected_version: 4, ...change }, 409, "VERSION_CONFLICT");
    });
  }
}
for (const version of [undefined, "4", 1.5, 0, -1, Number.MAX_SAFE_INTEGER + 1, null, true]) {
  test(`PATCH rejects version ${version}`, () => patchError({ expected_version: version, name: "New" }, 400, "VALIDATION_ERROR"));
}
for (const body of [{ expected_version: 1 }, {}, { expected_version: 1, name: " " },
  { expected_version: 1, name: "" }, ...["name", "type", "note"].flatMap(field =>
    [null, 3, false, [], {}].map(value => ({ expected_version: 1, [field]: value })))]) {
  test(`PATCH invalid fields ${JSON.stringify(body)}`, () => patchError(body, 400, "VALIDATION_ERROR"));
}
for (const field of ["extra", "version", "uid", "number", "id", "location_id", "zone_id", "created_at", "updated_at", "items"]) {
  test(`PATCH forbidden ${field}`, () => patchError({ expected_version: 1, name: "New", [field]: 1 }, 400, "VALIDATION_ERROR"));
}
for (const id of ["c053", "C53", "C05x", "C053x", "C-053", "C053/", "C%30%35%33", "C053%20"]) {
  test(`PATCH invalid id ${id}`, () => patchError(undefined, 400, "INVALID_CONTAINER_ID", { path: `${id}?inventory_id=home-main` }));
}
for (const query of ["", "?inventory_id=", "?inventory_id=%20", "?inventory_id=%20home-main", "?inventory_id=home-main%20", "?inventory_id=home-main&inventory_id=home-main"]) {
  test(`PATCH invalid inventory ${query}`, () => patchError(undefined, 400, "INVALID_INVENTORY_ID", { path: `C053${query}` }));
}
for (const [path, code] of [["C053?inventory_id=missing", "INVENTORY_NOT_FOUND"],
  ["C054?inventory_id=home-main", "CONTAINER_NOT_FOUND"], ["C053?inventory_id=other", "CONTAINER_NOT_FOUND"],
  ["C001?inventory_id=home-main", "CONTAINER_NOT_FOUND"], ["C1000?inventory_id=home-main", "CONTAINER_NOT_FOUND"]]) {
  test(`PATCH scoped not found ${path}`, () => patchError(undefined, 404, code, { path }));
}
for (const version of [1, 3, 5, Number.MAX_SAFE_INTEGER]) {
  test(`PATCH conflicting version ${version}`, async () => {
    await seedPatch();
    await patchError({ expected_version: version, note: "Changed" }, 409, "VERSION_CONFLICT");
  });
}
for (const changes of [[{ name: "A" }, { name: "B" }], [{ type: "A" }, { note: "B" }]]) {
  test(`PATCH concurrent ${JSON.stringify(changes)}`, async () => {
    await seedPatch("zone-a");
    const original = await row();
    const originalItems = await items();
    const responses = await Promise.all(changes.map(change => patch({ expected_version: 4, ...change })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    const winner = (await responses.find(r => r.status === 200).json()).container;
    const loser = await responses.find(r => r.status === 409).json();
    assert.equal(loser.error.code, "VERSION_CONFLICT");
    assert.deepEqual(loser.current_container, winner);
    assert.deepEqual(await row(), winner);
    assert.equal(winner.version, 5);
    const winnerIndex = responses.findIndex(r => r.status === 200);
    assert.deepEqual(winner, { ...original, ...changes[winnerIndex], version: 5, updated_at: winner.updated_at });
    assert.deepEqual(await items(), originalItems);
  });
}
for (const body of [null, [], "text", 3, true]) {
  test(`PATCH invalid JSON root ${JSON.stringify(body)}`, () => patchError(body, 400, "INVALID_BODY"));
}
for (const body of ["{", ""]) {
  test(`PATCH invalid JSON ${body}`, () => patchError(undefined, 400, "INVALID_BODY", { body }));
}
for (const contentType of [null, "text/plain", "application/jsonp"]) {
  test(`PATCH content type ${contentType}`, () => patchError(undefined, 415, "UNSUPPORTED_MEDIA_TYPE", {
    headers: contentType ? { "Content-Type": contentType } : {}
  }));
}
test("PATCH accepts JSON charset", async () => {
  assert.equal((await patch({ expected_version: 1, type: "box" }, {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  })).status, 200);
});
for (const method of ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"]) {
  test(`PATCH route disallows ${method}`, async () => {
    const original = await row();
    const response = await patch(undefined, { method, body: undefined });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "PATCH");
    if (method !== "HEAD") assert.equal((await response.json()).error.code, "METHOD_NOT_ALLOWED");
    assert.deepEqual(await row(), original);
  });
}
for (const [detail, status, code] of [["private SQL details", 500, "INTERNAL_ERROR"],
  ["CHECK constraint failed: private_test", 409, "CONTAINER_CONFLICT"]]) {
  test(`PATCH SQL failure rollback ${code}`, async () => {
    await seedPatch();
    // Fail after the write to verify the entire statement/transaction rolls back.
    await db.prepare(`CREATE TRIGGER test_failure AFTER UPDATE ON containers
      BEGIN UPDATE items SET name = 'Damaged'; SELECT RAISE(ABORT, '${detail}'); END`).run();
    const result = await patchError(undefined, status, code);
    assert.ok(!JSON.stringify(result).includes("private"));
  });
}
test("PATCH version overflow is an integrity conflict with rollback", async () => {
  await db.prepare("UPDATE containers SET version = ? WHERE id = 'C053'").bind(Number.MAX_SAFE_INTEGER).run();
  await patchError({ expected_version: Number.MAX_SAFE_INTEGER, name: "New" }, 409, "CONTAINER_CONFLICT");
});
