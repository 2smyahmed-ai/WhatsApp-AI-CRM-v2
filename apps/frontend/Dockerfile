# Frontend image. Build context is the REPO ROOT (npm workspaces monorepo).
# NEXT_PUBLIC_* are baked at BUILD time, so they're passed as build args.
#   docker build -f apps/frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://acme.yourapp.com -t crm-frontend .
FROM node:22-slim AS build
WORKDIR /app
COPY . .
# --ignore-scripts: skip postinstalls (e.g. ffmpeg-static's GitHub binary
# download) that the frontend never uses. The schema package and Next build are
# run explicitly below.
RUN npm ci --ignore-scripts
RUN npm run build --workspace=packages/messaging-schema

# Public URLs the browser will call — must be the tenant's public origin.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN npm run build --workspace=apps/frontend

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
COPY --from=build /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=build /app/apps/frontend/next.config.js ./apps/frontend/next.config.js
WORKDIR /app/apps/frontend
EXPOSE 3000
# NEXTAUTH_SECRET / NEXTAUTH_URL are runtime env (set by compose).
CMD ["npm", "run", "start"]
