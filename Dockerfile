# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder: resolve dependencies and produce the standalone Mastra server.
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS builder

RUN apk add --no-cache \
      ca-certificates \
      git \
      make \
      g++ \
      python3 \
      nodejs \
      npm

WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches

# Force NODE_ENV=development so Coolify's build-arg doesn't skip devDependencies
RUN --mount=type=cache,target=/root/.bun/install/cache \
    NODE_ENV=development bun install --frozen-lockfile --ignore-scripts

COPY . .

RUN bun run build

# Ship a production-only node_modules tree
RUN rm -rf node_modules \
  && NODE_ENV=production bun install --frozen-lockfile --production --ignore-scripts

# ---------------------------------------------------------------------------
# Runtime: the bot plus the sandbox toolchain.
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runtime

ENV NODE_ENV=production \
    HOME=/home/bun \
    PROJECT_ROOT=/app \
    MASTRA_HOST=0.0.0.0 \
    PORT=4111 \
    PATH=/home/bun/.local/bin:/home/bun/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Alpine equivalents of your sandbox toolchain (much smaller & faster than Debian)
RUN apk add --no-cache \
      ca-certificates \
      curl \
      wget \
      git \
      openssh-client \
      ripgrep \
      fd \
      jq \
      unzip \
      zip \
      tar \
      gzip \
      bzip2 \
      xz \
      file \
      less \
      tree \
      procps \
      tini \
      build-base \
      python3 \
      py3-pip \
      python3-dev \
      imagemagick \
      poppler-utils \
      ffmpeg \
      nodejs \
      npm

# Install Python packages needed by shipped skills
RUN python3 -m pip install --no-cache-dir --break-system-packages \
      agentmail \
      gTTS \
      SpeechRecognition \
      pydub

# Configure writable per-user npm prefix for the bun user
RUN mkdir -p /home/bun/.local \
  && echo "prefix=/home/bun/.local" > /home/bun/.npmrc \
  && chown -R bun:bun /home/bun

WORKDIR /app

COPY --from=builder --chown=bun:bun /app/.mastra/output /app/.mastra/output
COPY --from=builder --chown=bun:bun /app/node_modules /app/node_modules
COPY --from=builder --chown=bun:bun /app/drizzle /app/drizzle
COPY --from=builder --chown=bun:bun /app/workspace /app/workspace

# Per-thread sandbox working directories
RUN mkdir -p /app/.sandbox && chown bun:bun /app/.sandbox

USER bun

EXPOSE 4111

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", ".mastra/output/index.mjs"]
