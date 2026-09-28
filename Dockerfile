FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

RUN npm run build
RUN bash scripts/fetch-ocr-language-data.sh


FROM node:24-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts \
    && npx playwright install --with-deps chromium

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/ocr-lang-data ./ocr-lang-data

EXPOSE 8080

CMD ["node", "dist/src/server.js"]
