# Use official Playwright base image
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean install dependencies and force re-compiling native modules like sqlite3 inside Jammy
RUN npm ci --build-from-source sqlite3

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]