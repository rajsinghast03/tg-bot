# Base image with Node.js
FROM node:20-slim

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget ca-certificates typescript fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libnspr4 libnss3 libxss1 libxtst6 xdg-utils libu2f-udev libvulkan1 unzip gnupg \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy only necessary files for install
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build TypeScript to JS
RUN npm run build

# Start the bot
CMD ["npm", "start"]
