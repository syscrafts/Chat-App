FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (force to resolve peer dep conflicts)
RUN npm install --force && \
    npm install @clerk/nextjs --force && \
    npm install baseline-browser-mapping@latest -D --force

# Copy source code
COPY . .

# Expose Next.js port
EXPOSE 4000

# Start the dev server
CMD ["npm", "run", "dev"]
