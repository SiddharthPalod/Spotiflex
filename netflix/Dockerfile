FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

# Expose Vite development server port
EXPOSE 5173

# Start Vite dev server binding to 0.0.0.0 for container network access
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
