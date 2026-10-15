# Online setup

Current deployment target: GitHub Pages frontend + Render Free Docker backend + Neon Free PostgreSQL. Follow [NEON_RENDER.md](NEON_RENDER.md) for environment variables, safe legacy-data import, authentication and the deployment sequence.

`PRODUCTION_API_URL` is a GitHub Actions **repository variable** containing the real backend HTTPS origin. `DATABASE_URL` is a private **Render environment variable** and must never reach Pages or Git. Render does not use a persistent disk. The workflow blocks Pages publication if the real PostgreSQL backend or Pages CORS is unhealthy.

This change prepares code and a review branch only. Production provisioning, deployment, import and cutover need owner approval; none are claimed complete by this document.
