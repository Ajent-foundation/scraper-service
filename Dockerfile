# Multi-stage build for scraper-service
FROM node:18 AS builder

# Install dependencies for canvas compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libpixman-1-0 \
    libpixman-1-dev \
    libcairo2 \
    libcairo2-dev \
    libpango-1.0-0 \
    libpango1.0-dev \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies including devDependencies for building
RUN npm ci

# Copy source files and configs
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Copy cachedPrompts (JSON files not processed by tsc)
RUN cp -r ./src/ai/cachedPrompts ./dist/ai/cachedPrompts

# Production stage
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies (canvas needs build tools)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libpixman-1-0 \
    libpixman-1-dev \
    libcairo2 \
    libcairo2-dev \
    libpango-1.0-0 \
    libpango1.0-dev \
    libpangocairo-1.0-0 \
    && npm ci --omit=dev \
    && rm -rf /var/lib/apt/lists/*

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Define the ports exposed from the built container
EXPOSE 8080

# Define the default start command
CMD ["node", "./dist/main.js"]