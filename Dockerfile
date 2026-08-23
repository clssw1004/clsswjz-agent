FROM node:20-alpine AS builder
WORKDIR /app
# Install server deps (root package.json)
COPY package*.json ./
RUN npm install
# Copy server source and build first (deleteOutDir wipes dist)
COPY src ./src
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
RUN npm run build
# Build web into its own dist/
COPY web/package*.json ./web/
RUN cd web && npm install
COPY web/ ./web/
RUN cd web && npm run build
# Remove server source so the production image only ships dist + node_modules
RUN rm -rf src

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# Serve static assets from web/dist
COPY --from=builder /app/web/dist ./web/dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
