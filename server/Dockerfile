# Use official Node.js runtime as parent image
FROM node:20-slim

# Install LibreOffice and essential fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    fonts-nanum \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy dependency configuration files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source files
COPY . .

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD [ "node", "app.js" ]
