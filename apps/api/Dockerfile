# Stage 1: Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace=@opssentinel/api
COPY apps/api ./apps/api
RUN npm run build --workspace=@opssentinel/api

# Stage 2: Minimal Distroless/Production Image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]