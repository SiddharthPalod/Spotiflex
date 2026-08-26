FROM node:20-bookworm-slim

# Install Python 3, pip, compilation tools, and OpenBLAS for FAISS/Implicit
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    python-is-python3 \
    build-essential \
    g++ \
    libopenblas-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Python ML dependencies
COPY ml/requirements.txt /app/ml/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/ml/requirements.txt

# 2. Install Node.js API dependencies
WORKDIR /app/api
COPY api/package*.json ./
RUN npm install

# 3. Generate Prisma client
COPY api/prisma ./prisma
RUN npx prisma generate

# 4. Copy source code for API and ML
COPY api /app/api
COPY ml /app/ml

# Environment variables
ENV PORT=3001
ENV PYTHONUNBUFFERED=1
ENV OPENBLAS_NUM_THREADS=1
ENV NODE_ENV=development

EXPOSE 3001

CMD ["npm", "run", "dev"]
