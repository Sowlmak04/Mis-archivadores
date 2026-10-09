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

    return env.ASSETS.fetch(request);
  }
};
