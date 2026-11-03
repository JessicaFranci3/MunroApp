FROM mcr.microsoft.com/playwright:v1.64.1-jammy

WORKDIR /app

# Force native modules (like sqlite3) to compile from source instead of downloading prebuilt binaries
ENV npm_config_build_from_source=true

# Install build tools required for compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install dependencies (will now compile sqlite3 locally using Jammy's libraries)
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]