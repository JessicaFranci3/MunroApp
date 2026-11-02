# Use official Playwright base image based on Ubuntu Jammy
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Install build essentials required to compile native C++ modules like sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Clean install dependencies (native scripts will run automatically with build tools ready)
RUN npm ci

# Copy remaining source code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]