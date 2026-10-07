import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { LocalSandbox } from '@mastra/core/workspace';
import { env } from '@/env';
import { sandbox as config } from '../config';
import { sandboxPrompt } from '../prompts/features/sandbox';

const keyFor = (threadId: string) =>
  createHash('sha256').update(threadId).digest('hex').slice(0, 32);

export function sandboxDirectory(threadId: string): string {
  return join(config.root, keyFor(threadId));
}

export function createSandbox(threadId: string): LocalSandbox {
  const id = keyFor(threadId);

  return new LocalSandbox({
    id: `gorkie-${id}`,
    workingDirectory: join(config.root, id),
    // Local execution runs on this host, so the sandbox inherits only what a
    // build or a git command needs. Slack and database credentials stay out of
    // the environment on purpose.
    env: {
      HOME: homedir(),
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: 'gorkie-agent',
      GIT_AUTHOR_EMAIL: 'gorkie@agentmail.to',
      GIT_COMMITTER_NAME: 'gorkie-agent',
      GIT_COMMITTER_EMAIL: 'gorkie@agentmail.to',
      ...(env.AGENTMAIL_API_KEY
        ? { AGENTMAIL_API_KEY: env.AGENTMAIL_API_KEY }
        : {}),
    },
    instructions: sandboxPrompt,
    timeout: config.timeout,
  });
}
