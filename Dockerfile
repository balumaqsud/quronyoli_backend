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

RUN apk add --no-cache libc6-compat openssl \
  && addgroup -S nestjs \
  && adduser -S nestjs -G nestjs

COPY --from=build --chown=nestjs:nestjs /app/package.json ./
COPY --from=build --chown=nestjs:nestjs /app/package-lock.json ./
COPY --from=build --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nestjs /app/dist ./dist
COPY --from=build --chown=nestjs:nestjs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nestjs /app/prisma.config.ts ./
COPY --from=build --chown=nestjs:nestjs /app/src/generated ./dist/generated

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
