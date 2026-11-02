# Use official Playwright base image based on Ubuntu Jammy
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

# Copy package manifests and install node dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]