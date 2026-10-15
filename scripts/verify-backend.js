const raw = process.env.API_URL;
if (!raw)
  throw Error(
    "BLOCKED: Set repository variable PRODUCTION_API_URL to your deployed HTTPS backend. No placeholder frontend will be published.",
  );
const url = new URL(raw);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
)
  throw Error(
    "API_URL must be an HTTPS origin without credentials, path or query.",
  );
// Render Free can take over a minute to wake. Retry read-only health checks only.
let healthy = false;
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    const r = await fetch(new URL("/api/health", url), {
      signal: AbortSignal.timeout(20000),
      headers: { Origin: "https://littleduckgt0027.github.io" },
    });
    const h = await r.json();
    if (
      r.ok &&
      h.status === "ok" &&
      h.application === "dream-aquarium" &&
      h.database === "ready" &&
      h.databaseEngine === "postgresql" &&
      r.headers.get("access-control-allow-origin") ===
        "https://littleduckgt0027.github.io"
    ) {
      healthy = true;
      break;
    }
  } catch {
    /* cold start / transient outage */
  }
  if (attempt < 9) await new Promise((r) => setTimeout(r, 3000));
}
if (!healthy)
  throw Error(
    "Backend PostgreSQL readiness/CORS check failed; Pages publication blocked",
  );
console.log("Backend PostgreSQL health and Pages CORS verified.");
