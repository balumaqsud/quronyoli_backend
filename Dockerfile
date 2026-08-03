# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV LOG_DIR=/app/logs
ENV UPLOADS_DIR=/app/uploads

RUN apk add --no-cache libc6-compat openssl wget \
  && addgroup -S nestjs \
  && adduser -S nestjs -G nestjs \
  && mkdir -p /app/logs /app/uploads \
  && chown -R nestjs:nestjs /app

COPY --from=build --chown=nestjs:nestjs /app/package.json ./
COPY --from=build --chown=nestjs:nestjs /app/package-lock.json ./
COPY --from=build --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nestjs /app/dist ./dist
COPY --from=build --chown=nestjs:nestjs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nestjs /app/prisma.config.ts ./
COPY --from=build --chown=nestjs:nestjs /app/src/generated ./dist/generated
COPY --chown=nestjs:nestjs docker/entrypoint.sh /app/docker/entrypoint.sh

RUN chmod +x /app/docker/entrypoint.sh

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "dist/main.js"]
