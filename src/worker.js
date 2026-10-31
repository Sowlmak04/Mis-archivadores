export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "mis-archivadores",
        timestamp: new Date().toISOString()
      });
    }

    if (request.method === "GET" && url.pathname === "/api/db-health") {
      try {
        await env.DB.prepare("SELECT 1 AS value").first();

        return Response.json(
          { ok: true, database: "D1" },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch {
        return Response.json(
          { ok: false, error: "No se pudo comprobar la conexión con D1." },
          {
            status: 503,
            headers: { "Cache-Control": "no-store" }
          }
        );
      }
    }

    if (url.pathname === "/api/data") {
      const json = (body, status = 200, extraHeaders = {}) =>
        Response.json(body, {
          status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            ...extraHeaders
          }
        });

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
              c.name, c.type, c.note, c.created_at, c.updated_at
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
