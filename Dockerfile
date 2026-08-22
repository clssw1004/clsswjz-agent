FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/
COPY web/ ./web/
# Build server first (deleteOutDir wipes dist), then web outputs into dist/public
RUN cd server && npx nest build && cd ../web && npm install && npx vite build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
