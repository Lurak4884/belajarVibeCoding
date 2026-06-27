# Gunakan image resmi Bun
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code dan env
COPY . .

# Expose port (Hugging Face Spaces default is 7860)
EXPOSE 7860

# Jalankan server
CMD ["bun", "run", "start"]
