# Gunakan image resmi Bun
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code dan env
COPY . .

# Expose port (biasanya environment di cloud pakai port 3000)
EXPOSE 3000

# Jalankan server
CMD ["bun", "run", "start"]
