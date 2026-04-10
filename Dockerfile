# Stage 1: Build client
FROM node:20-alpine AS build-client
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS build-server
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# Copy server build and production deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY --from=build-server /app/server/dist ./server/dist

# Copy client build
COPY --from=build-client /app/client/dist ./client/dist

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
