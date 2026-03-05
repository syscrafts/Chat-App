FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies
RUN npm install

# Copy source code and entrypoint
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Expose backend port
EXPOSE 5000

# Run migrations then start server
ENTRYPOINT ["sh", "entrypoint.sh"]
