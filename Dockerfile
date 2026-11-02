# Use official Playwright base image with Node and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.42.0-noble

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy remaining source files
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]