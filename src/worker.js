const apiJson = (body, status = 200, extraHeaders = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });

const apiError = (status, code, message, headers) =>
  apiJson({ error: { code, message } }, status, headers);

async function createContainer(request, env) {
  if (request.method !== "POST") {
    return apiError(405, "METHOD_NOT_ALLOWED", "Solo se permite el método POST.", { Allow: "POST" });
  }
  const mediaType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Se requiere Content-Type application/json.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_BODY", "El body debe contener JSON válido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError(400, "INVALID_BODY", "El body debe ser un objeto JSON.");
  }

  const fields = ["inventory_id", "uid", "location_id", "zone_id", "name", "type", "note"];
  const validIdentifier = value =>
    typeof value === "string" && value.length > 0 && value === value.trim();
  if (
    Object.keys(body).some(key => !fields.includes(key)) ||
    fields.some(key => !Object.hasOwn(body, key)) ||
    ![body.inventory_id, body.uid, body.location_id].every(validIdentifier) ||
    (body.zone_id !== null && !validIdentifier(body.zone_id)) ||
    typeof body.name !== "string" || !body.name.trim() ||
    typeof body.type !== "string" || typeof body.note !== "string"
  ) {
    return apiError(400, "VALIDATION_ERROR", "Campos ausentes, inesperados o con valores inválidos.");
  }

  try {
    const timestamp = new Date().toISOString();
    const identifiers = [body.inventory_id, body.location_id, body.zone_id, body.uid];
    // The guarded INSERT repeats validation inside the same D1 transaction.
    // Neither number nor the generated id is supplied by the Worker.
    const [validation, insertion] = await env.DB.batch([
      env.DB.prepare(`
        SELECT
          EXISTS(SELECT 1 FROM inventories WHERE id = ?1) AS inventory_exists,
          EXISTS(SELECT 1 FROM locations WHERE id = ?2 AND inventory_id = ?1) AS location_valid,
          (?3 IS NULL OR EXISTS(
            SELECT 1 FROM zones WHERE id = ?3 AND location_id = ?2
          )) AS zone_valid,
          EXISTS(SELECT 1 FROM containers WHERE uid = ?4) AS uid_exists
      `).bind(...identifiers),
      env.DB.prepare(`
        INSERT INTO containers (
          uid, location_id, zone_id, name, type, note, created_at, updated_at
        )
        SELECT ?4, ?2, ?3, ?5, ?6, ?7, ?8, ?8
        WHERE EXISTS (
          SELECT 1 FROM inventories AS i
          JOIN locations AS l ON l.inventory_id = i.id
          WHERE i.id = ?1 AND l.id = ?2
        )
        AND (?3 IS NULL OR EXISTS (
          SELECT 1 FROM zones WHERE id = ?3 AND location_id = ?2
        ))
        AND NOT EXISTS (SELECT 1 FROM containers WHERE uid = ?4)
        RETURNING number, id, uid, location_id, zone_id,
                  name, type, note, created_at, updated_at, version
      `).bind(...identifiers, body.name.trim(), body.type, body.note, timestamp)
    ]);

    if (!validation.success || !insertion.success || validation.results.length !== 1) {
      throw new Error("Unexpected D1 batch result");
    }
    const checks = validation.results[0];
    if (!checks.inventory_exists) {
      return apiError(404, "INVENTORY_NOT_FOUND", "El inventario no existe.");
    }
    if (!checks.location_valid) {
      return apiError(404, "LOCATION_NOT_FOUND", "La ubicación no existe en ese inventario.");
    }
    if (!checks.zone_valid) {
      return apiError(422, "INVALID_ZONE", "La zona no existe en esa ubicación.");
    }
    if (checks.uid_exists) {
      return apiError(409, "UID_ALREADY_EXISTS", "Ya existe un contenedor con ese UID.");
    }
    if (insertion.results.length !== 1) {
      throw new Error("Unexpected D1 insertion result");
    }
    return apiJson({ container: insertion.results[0] }, 201);
  } catch (error) {
    // Only recognized integrity failures are conflicts; never expose SQL details.
    const message = String(error?.cause?.message || error?.message || "");
    if (/UNIQUE constraint failed: containers\.uid(?:\s|:|$)/.test(message)) {
      return apiError(409, "UID_ALREADY_EXISTS", "Ya existe un contenedor con ese UID.");
    }
    if (/(?:UNIQUE|PRIMARY KEY|FOREIGN KEY|CHECK|NOT NULL) constraint failed/.test(message)) {
      return apiError(409, "CONTAINER_CONFLICT", "No se pudo crear el contenedor por un conflicto de integridad.");
    }
    return apiError(500, "INTERNAL_ERROR", "No se pudo crear el contenedor.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/containers") {
      return createContainer(request, env);
    }

    if (url.pathname === "/api/health") {
      return apiJson({
        ok: true,
        service: "mis-archivadores",
        timestamp: new Date().toISOString()
      });
    }

    if (request.method === "GET" && url.pathname === "/api/db-health") {
      try {
        await env.DB.prepare("SELECT 1 AS value").first();

        return apiJson(
          { ok: true, database: "D1" },
          200
        );
      } catch {
        return apiJson(
          { ok: false, error: "No se pudo comprobar la conexión con D1." },
          503
        );
      }
    }

    if (url.pathname === "/api/data") {
      const json = apiJson;

      if (request.method !== "GET") {
        return json(
          {
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Solo se permite el método GET."
            }
          },
          405,
          { Allow: "GET" }
        );
      }

      const inventoryIds = url.searchParams.getAll("inventory_id");

      if (inventoryIds.length === 0) {
        return json(
          {
            error: {
              code: "INVENTORY_ID_REQUIRED",
              message: "El parámetro inventory_id es obligatorio."
            }
          },
          400
        );
      }

      if (
        inventoryIds.length !== 1 ||
        inventoryIds[0].trim().length === 0
      ) {
        return json(
          {
            error: {
              code: "INVALID_INVENTORY_ID",
              message:
                "El parámetro inventory_id debe aparecer exactamente una vez y no estar vacío."
            }
          },
          400
        );
      }

      const inventoryId = inventoryIds[0];

      try {
        const inventory = await env.DB.prepare(`
          SELECT id, name, created_at, updated_at
          FROM inventories
          WHERE id = ?1
        `).bind(inventoryId).first();

        if (!inventory) {
          return json(
            {
              error: {
                code: "INVENTORY_NOT_FOUND",
                message: "El inventario no existe."
              }
            },
            404
          );
        }

        const queries = [
          `
            SELECT id, inventory_id, name, created_at, updated_at
            FROM locations
            WHERE inventory_id = ?1
          `,
          `
            SELECT
              z.id, z.location_id, z.name, z.created_at, z.updated_at
            FROM zones AS z
            JOIN locations AS l ON l.id = z.location_id
            WHERE l.inventory_id = ?1
          `,
          `
            SELECT
              c.number, c.id, c.uid, c.location_id, c.zone_id,
              c.name, c.type, c.note, c.created_at, c.updated_at, c.version
            FROM containers AS c
            JOIN locations AS l ON l.id = c.location_id
            WHERE l.inventory_id = ?1
            ORDER BY c.number
          `,
          `
            SELECT
              i.id, i.container_id, i.name, i.note,
              i.position, i.created_at, i.updated_at
            FROM items AS i
            JOIN containers AS c ON c.id = i.container_id
            JOIN locations AS l ON l.id = c.location_id
            WHERE l.inventory_id = ?1
            ORDER BY i.container_id, i.position, i.id
          `,
          `
            SELECT
              p.id, p.item_id, p.object_key, p.position,
              p.mime_type, p.size_bytes, p.width, p.height,
              p.created_at
            FROM item_photos AS p
            JOIN items AS i ON i.id = p.item_id
            JOIN containers AS c ON c.id = i.container_id
            JOIN locations AS l ON l.id = c.location_id
            WHERE l.inventory_id = ?1
            ORDER BY p.item_id, p.position, p.id
          `
        ];

        const results = await env.DB.batch(
          queries.map(sql => env.DB.prepare(sql).bind(inventoryId))
        );

        if (results.some(result => !result.success)) {
          throw new Error("D1 read failed");
        }

        const [
          locationsResult,
          zonesResult,
          containersResult,
          itemsResult,
          photosResult
        ] = results;

        const collator = new Intl.Collator("es");
        const compareByName = (a, b) =>
          collator.compare(a.name, b.name) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

        return json({
          inventory,
          locations: locationsResult.results.sort(compareByName),
          zones: zonesResult.results.sort(compareByName),
          containers: containersResult.results,
          items: itemsResult.results,
          item_photos: photosResult.results
        });
      } catch {
        return json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "No se pudieron obtener los datos del inventario."
            }
          },
          500
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
