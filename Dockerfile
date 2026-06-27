# Gunakan image resmi Bun
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install

# Copy source code dan env
COPY . .

# Expose port (Google Cloud Run default is 8080)
EXPOSE 8080

# Jalankan server
CMD ["bun", "run", "start"]
