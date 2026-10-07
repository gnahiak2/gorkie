import { join } from 'node:path';
import { env } from '@/env';

export const sandbox = {
  // Each thread gets its own working directory under here. The local sandbox
  // runs commands directly on this host, so these are real paths, not a VM.
  root: join(env.PROJECT_ROOT, '.sandbox'),
  // LocalSandbox default per-operation timeout, and the cap on one foreground
  // command.
  timeout: 15 * 60 * 1000,
  // A cold clone or a large push runs well past a shell default, and a timeout
  // there retries the whole clone inside the credential window.
  gitTimeout: 5 * 60 * 1000,
};

export const upload = {
  maxBytes: 1_000_000_000,
};

export const file = {
  // Without a cap, `fallocate -l 8G x && read_file x` OOMs the host (reachable
  // from injected repo content).
  maxReadBytes: 10 * 1024 * 1024,
};

export const image = {
  // Cap on an image inlined into the model context, matching Mastra read_file's
  // 10MB media default; a larger file is refused rather than blowing up context.
  maxViewBytes: 10 * 1024 * 1024,
  // Vision models cap inline images per request (GLM: 8 images, 64 MiB total,
  // non-retryable 400 over that). Keep only the most recent within these bounds.
  maxContextImages: 8,
  maxContextBytes: 60 * 1024 * 1024,
};

export const agent = {
  id: 'orchestrator',
  maxTokens: { input: 1_000_000, output: 65_536 },
  maxSteps: 1000,
  modelTimeout: { firstChunkMs: 2 * 60 * 1000, stepMs: 5 * 60 * 1000 },
};

export const summarizer = {
  id: 'summarizer',
  maxTokens: { output: 32_768 },
};

export const scheduledTasks = {
  minInterval: env.NODE_ENV === 'production' ? 30 * 60 * 1000 : 60 * 1000,
};
