# API service (Fastify + Prisma). Runs via tsx.
FROM node:22-alpine
WORKDIR /app

# Prisma needs openssl on alpine.
RUN apk add --no-cache openssl

# Install all workspace dependencies (monorepo).
COPY package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm install

# Generate the Prisma client.
RUN npm run prisma:generate -w @taxi/api

ENV NODE_ENV=production
EXPOSE 3000

# Sync the schema then start the API (env comes from the container, not a .env file).
CMD ["sh", "-c", "npm run db:sync -w @taxi/api && npm run start -w @taxi/api"]
