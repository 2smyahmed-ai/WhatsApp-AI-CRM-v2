# Backend image. Build context is the REPO ROOT (npm workspaces monorepo).
#   docker build -f apps/backend/Dockerfile -t crm-backend .
FROM node:22-slim AS build
WORKDIR /app
# Prisma needs openssl present to generate/run its query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Copy the whole workspace (node_modules/dist/.next are excluded via .dockerignore).
COPY . .
# --ignore-scripts: skip dependency postinstalls — notably ffmpeg-static's binary
# download from GitHub, which would make the build depend on GitHub being
# reachable (a real source of flaky builds). ffmpeg is provided via apt in the
# runtime stage; the Prisma client is generated explicitly below. No other
# dependency in this workspace needs a postinstall.
RUN npm ci --ignore-scripts
# Build the shared schema package, generate the Prisma client, then the backend.
RUN npm run build --workspace=packages/messaging-schema
RUN npx prisma generate --schema apps/backend/prisma/schema.prisma
RUN npm run build --workspace=apps/backend

FROM node:22-slim AS runtime
WORKDIR /app
# openssl: required by the Prisma query engine. ffmpeg: voice-note transcoding
# (replaces the ffmpeg-static binary download so the build has no GitHub dependency).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# node_modules carries the generated Prisma client + the prisma CLI (for migrate deploy).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
WORKDIR /app/apps/backend
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
