FROM node:20-alpine AS builder
WORKDIR /app
# Install server deps (root package.json)
COPY package*.json ./
RUN npm install
# Copy server source and build first (deleteOutDir wipes dist)
COPY src ./src
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
RUN npm run build
# Build admin-web into its own dist/
COPY admin-web/package*.json ./admin-web/
RUN cd admin-web && npm install
COPY admin-web/ ./admin-web/
# Remove server source so the production image only ships dist + node_modules
RUN rm -rf src

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# Serve static assets from admin-web/dist
COPY --from=builder /app/admin-web/dist ./admin-web/dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
