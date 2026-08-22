FROM node:20-alpine AS builder
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/
RUN cd server && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
