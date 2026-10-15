process.env.DB_PATH = process.env.E2E_DB_PATH || "/tmp/dream-e2e.sqlite";
process.env.COOKIE_SECURE = "false";
process.env.PUBLIC_ORIGIN = "http://127.0.0.1:3100";
const { createApp } = await import("../backend/server.js");
const app = await createApp({ production: true });
app.listen(3100, "127.0.0.1");
