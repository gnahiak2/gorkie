# syntax=docker/dockerfile:1

# gorkie executes commands on its own host through Mastra's LocalSandbox, so the
# runtime image is not only the bot: it is the toolchain those commands run
# against. Anything installed below is reachable from a Slack turn, and the
# image is intentionally large for that reason.

# ---------------------------------------------------------------------------
# Builder: resolve dependencies and produce the standalone Mastra server.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.2-slim AS builder

# nodejs/npm are for `mastra build`, not the runtime: the deployer shells out to
# npm to lay down the output's dependencies.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates \
       git \
       make \
       g++ \
       python3 \
       nodejs \
       npm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so this layer only moves when the lockfile moves. patches/
# must exist before install: `patchedDependencies` rewrites @mastra/core during
# resolution, not after it.
#
# --ignore-scripts skips the `prepare` hook (`lefthook install`), which needs a
# git checkout and fails here because .git is excluded from the build context.
# The only other install script is esbuild's, and its binary comes from the
# @esbuild/linux-x64 optional package rather than that script.
COPY package.json bun.lock ./
COPY patches ./patches
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

COPY . .

# `mastra build` writes .mastra/output; the postbuild script copies patches/ and
# drizzle/ in beside it.
RUN bun run build

# The bundle resolves its external packages from a node_modules above it and the
# deployer does not always leave a complete one in the output, so ship a
# production-only tree and drop the devDependencies the build needed.
RUN rm -rf node_modules \
  && bun install --frozen-lockfile --production --ignore-scripts

# ---------------------------------------------------------------------------
# Runtime: the bot plus the sandbox toolchain.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.2-slim AS runtime

# HOME must be set explicitly: the base image's default is /root, and
# node:os.homedir() reads it, so every sandbox command would inherit an
# unwritable home. PROJECT_ROOT pins the paths that env.ts derives from cwd
# (drizzle/ and .sandbox/), which otherwise depend on where the process starts.
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    HOME=/home/bun \
    PROJECT_ROOT=/app \
    MASTRA_HOST=0.0.0.0 \
    PORT=4111 \
    PATH=/home/bun/.local/bin:/home/bun/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Sandbox toolchain. LocalSandbox inherits PATH and HOME from this process, so
# this is the set the agent reasons about: language managers, git, search,
# archives, media and a C toolchain for anything pip or npm has to compile.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       wget \
       git \
       openssh-client \
       ripgrep \
       fd-find \
       jq \
       unzip \
       zip \
       tar \
       gzip \
       bzip2 \
       xz-utils \
       file \
       less \
       tree \
       procps \
       tini \
       build-essential \
       python3 \
       python3-pip \
       python3-dev \
       python3-venv \
       imagemagick \
       poppler-utils \
       ffmpeg \
       nodejs \
       npm \
  && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
  && rm -rf /var/lib/apt/lists/*

# The sandbox prompt tells the agent to install Python packages with pip, and
# Debian's EXTERNALLY-MANAGED marker blocks exactly that. Remove the marker and
# preinstall what the shipped skills import so the common paths need no network.
RUN rm -f /usr/lib/python3*/EXTERNALLY-MANAGED \
  && python3 -m pip install --no-cache-dir --break-system-packages \
       agentmail \
       gTTS \
       SpeechRecognition \
       pydub

# The agent installs CLIs at runtime through npm and bun. Point both at a
# per-user prefix that is already on PATH and writable by the bun user, because
# the system prefixes are root-owned.
RUN echo "prefix=/home/bun/.local" > /home/bun/.npmrc

WORKDIR /app

COPY --from=builder --chown=bun:bun /app/.mastra/output /app/.mastra/output
COPY --from=builder --chown=bun:bun /app/node_modules /app/node_modules
COPY --from=builder --chown=bun:bun /app/drizzle /app/drizzle
COPY --from=builder --chown=bun:bun /app/workspace /app/workspace

# Per-thread sandbox working directories. Mount a volume here to keep them
# across restarts; everything else the bot persists is in Postgres.
RUN mkdir -p /app/.sandbox && chown bun:bun /app/.sandbox

USER bun

EXPOSE 4111

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bun", ".mastra/output/index.mjs"]
