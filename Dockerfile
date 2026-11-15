# Resello – Vinted-Cockpit (Next.js) in einem Container
FROM node:22-bookworm-slim AS base
ENV TZ=Europe/Berlin

FROM base AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3010 HOSTNAME=0.0.0.0 DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3010
CMD ["node", "server.js"]
