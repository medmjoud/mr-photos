# syntax=docker/dockerfile:1
# SOURA — production image (Node 22, sharp/libvips, libSQL). Build: docker build -t soura .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
# Runtime dependencies are also needed by the maintenance scripts
# (migrations, admin creation, cleanup) which run with tsx.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.output ./.output
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src
COPY assets ./assets
COPY tsconfig.json ./
RUN mkdir -p /app/.data && chown -R node:node /app/.data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "node_modules/.bin/tsx scripts/migrate.ts && node .output/server/index.mjs"]
