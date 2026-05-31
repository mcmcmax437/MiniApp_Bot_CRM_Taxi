# Bot service (grammY, long polling). Runs via tsx.
FROM node:22-alpine
WORKDIR /app

COPY package.json ./
COPY packages ./packages
COPY apps/bot ./apps/bot
RUN npm install

ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@taxi/bot"]
