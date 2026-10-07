import type { LocalSandbox } from '@mastra/core/workspace';
import { sandbox as sandboxConfig } from '../../config';
import { githubAccessToken } from '../../lib/github';

export const git = async ({
  command,
  cwd,
  sandbox,
}: {
  command: string;
  cwd?: string;
  sandbox: LocalSandbox;
}): Promise<string> => {
  if (!sandbox.executeCommand) {
    throw new Error('The sandbox cannot run commands.');
  }
  const result = await sandbox.executeCommand('bash', ['-lc', command], {
    ...(cwd ? { cwd } : {}),
    timeout: sandboxConfig.gitTimeout,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `git exited ${result.exitCode}: ${(result.stderr || result.stdout).trim()}`
    );
  }
  return result.stdout.trim();
};

// One credential window per sandbox at a time. Two overlapping operations
// interleave badly: the first's cleanup clears the git config overlay while the
// second is still pushing.
const windows = new Map<string, Promise<unknown>>();

const serialize = async <T>(
  key: string,
  work: () => Promise<T>
): Promise<T> => {
  const next = (windows.get(key) ?? Promise.resolve()).then(work, work);
  const settled = next.then(
    () => undefined,
    () => undefined
  );
  windows.set(key, settled);
  try {
    return await next;
  } finally {
    if (windows.get(key) === settled) {
      windows.delete(key);
    }
  }
};

export const withCredential = async <T>({
  operation,
  sandbox,
  userId,
}: {
  operation: () => Promise<T>;
  sandbox: LocalSandbox;
  userId: string;
}): Promise<T> => {
  const token = await githubAccessToken(userId);
  if (!token) {
    throw new Error('GitHub is not connected. Ask them to sign in again.');
  }
  // Git reads this overlay per spawn, so the header reaches every git call in
  // the window without touching the remote URL or .git/config. The URL scope
  // keeps the header from being sent to any host other than github.com.
  const header = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  return await serialize(sandbox.id, async () => {
    sandbox.setEnv((current) => ({
      ...current,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: header,
    }));
    try {
      return await operation();
    } finally {
      sandbox.setEnv(
        ({ GIT_CONFIG_COUNT, GIT_CONFIG_KEY_0, GIT_CONFIG_VALUE_0, ...rest }) =>
          rest
      );
    }
  });
};
