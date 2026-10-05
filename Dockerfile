FROM node:24-slim AS base
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml ./

# Type-check and run the publish-gate tests on every deploy. If they fail, nothing ships.
FROM base AS verify
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm check && pnpm test

FROM base
ENV NODE_ENV=production CONTENT_DIR=/app/content
RUN pnpm install --frozen-lockfile --prod
COPY --from=verify /app/src ./src
COPY --from=verify /app/assets ./assets
EXPOSE 3000
CMD ["node", "src/server.ts"]
