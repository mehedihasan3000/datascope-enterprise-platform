# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm --filter @datascope/api... install --frozen-lockfile --prod

FROM deps AS runner
ENV NODE_ENV=production
ENV PORT=4000

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @datascope/api db:migrate && pnpm --filter @datascope/api db:seed && cd /app/apps/api && exec ./node_modules/.bin/tsx src/index.ts"]
