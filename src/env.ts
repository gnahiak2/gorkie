import 'dotenv/config';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // Injected by the Mastra CLI, not set by hand. `mastra dev` and
    // `mastra start` each run with a different cwd, neither of which is the
    // repo root, so anything writing a file relative to cwd needs this.
    // Not `MASTRA_PROJECT_ROOT`: the Mastra CLI sets that itself, after our
    // .env is loaded, and points it at `.mastra` rather than the repo root.
    // Anything anchored to it lands in the wrong directory.
    PROJECT_ROOT: z.string().default(process.cwd()),

    SLACK_BOT_TOKEN: z.string().min(1),
    SLACK_APP_TOKEN: z.string().min(1),
    SLACK_USER_TOKEN: z.string().min(1),

    // The account allowed to change the model from App Home. Everyone else in
    // the workspace can use the bot, but not the picker.
    OWNER_USER_ID: z.string().regex(/^U[A-Z0-9]+$/),

    // Command Code Provider API. https://commandcode.ai/docs/provider
    COMMANDCODE_API_KEY: z.string().min(1),

    DATABASE_URL: z.url(),

    CREDENTIALS_KEY: z
      .base64()
      .refine((value) => Buffer.from(value, 'base64').length === 32, {
        message:
          'CREDENTIALS_KEY must be 32 bytes, base64 encoded. Generate one with: openssl rand -base64 32',
      }),

    AGENTMAIL_API_KEY: z.string().min(1).optional(),
    EMOJI_PROXY_TOKEN: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
