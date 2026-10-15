FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN --mount=type=secret,id=extra_ca if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npm ci --fetch-retries=1 --fetch-timeout=30000
COPY --chown=node:node frontend ./frontend
COPY --chown=node:node shared ./shared
COPY --chown=node:node vite.config.js ./
RUN npm run build
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/aquarium.sqlite
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN --mount=type=secret,id=extra_ca if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npm ci --omit=dev --fetch-retries=1 --fetch-timeout=30000 && mkdir data && chown node:node data
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node backend ./backend
COPY --chown=node:node shared ./shared
COPY --chown=node:node scripts ./scripts
USER node
EXPOSE 3000
VOLUME /app/data
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","backend/server.js"]
