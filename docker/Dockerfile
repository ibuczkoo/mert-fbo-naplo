# Későbbi költözéshez (VPS / felhő). A cPanel-telepítéshez nem kell.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
RUN pnpm --filter @fbo/api deploy --prod --legacy /out/api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 WEB_DIST_DIR=/app/web STORAGE_DIR=/data
COPY --from=build /out/api /app/api
COPY --from=build /app/apps/web/dist /app/web
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "/app/api/dist/server.js"]
