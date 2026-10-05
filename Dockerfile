FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production CI=true CONTENT_DIR=/app/content
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY *.ts ./
EXPOSE 3000
CMD ["node", "server.ts"]
