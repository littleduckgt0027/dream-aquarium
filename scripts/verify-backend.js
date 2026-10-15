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
const r = await fetch(new URL("/api/health", url), {
  signal: AbortSignal.timeout(15000),
});
if (!r.ok) throw Error("Backend health request failed: " + r.status);
const h = await r.json();
if (h.application !== "dream-aquarium" || h.database !== "ready")
  throw Error("Expected a real Dream Aquarium database-backed server");
console.log("Backend health verified.");
