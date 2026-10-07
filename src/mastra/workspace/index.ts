import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RequestContext } from '@mastra/core/request-context';
import {
  LocalFilesystem,
  LocalSandbox,
  LocalSkillSource,
  WORKSPACE_TOOLS,
  Workspace,
} from '@mastra/core/workspace';
import { channelContext } from '../lib/context';
import { createSandbox, sandboxDirectory } from './sandbox';
import {
  DELETE_FILE,
  EDIT_FILE,
  EXECUTE_COMMAND,
  FILE_STAT,
  GET_PROCESS_OUTPUT,
  GREP,
  KILL_PROCESS,
  LIST_FILES,
  READ_FILE,
  WRITE_FILE,
} from './tool-names';

export async function requireSandbox(
  requestContext: RequestContext
): Promise<LocalSandbox> {
  // Real command/filesystem work needs a real thread. The `sandbox` resolver
  // degrades to a shared `__unscoped__` directory so Mastra's pre-bind
  // instruction read never crashes a turn, but a tool must not silently run
  // commands in that scratch directory: fail loudly instead.
  if (!channelContext(requestContext).threadId) {
    throw new Error(
      'No Slack thread bound for this run, so a sandbox tool cannot run here.'
    );
  }
  const sandbox = await getSandbox(requestContext);
  if (!sandbox) {
    throw new Error('No sandbox available.');
  }
  await sandbox.ensureRunning();
  return sandbox;
}

export async function getSandbox(
  requestContext: RequestContext
): Promise<LocalSandbox | undefined> {
  const sandbox = await workspace.resolveSandbox({ requestContext });
  return sandbox instanceof LocalSandbox ? sandbox : undefined;
}

export async function readSandboxFile({
  path,
  requestContext,
}: {
  path: string;
  requestContext: RequestContext;
}): Promise<Buffer> {
  const filesystem = await workspace.resolveFilesystem({ requestContext });
  if (!filesystem) {
    throw new Error('No workspace filesystem available.');
  }
  const content = await filesystem.readFile(path);
  return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

export async function statSandboxFile({
  path,
  requestContext,
}: {
  path: string;
  requestContext: RequestContext;
}) {
  const filesystem = await workspace.resolveFilesystem({ requestContext });
  if (!filesystem) {
    throw new Error('No workspace filesystem available.');
  }
  return filesystem.stat(path);
}

// Absolute host path for a sandbox file, containment-checked by the resolved
// filesystem. The local sandbox is the host, so tools that stream (a large
// upload or download) work on this path with node:fs instead of buffering.
export async function sandboxAbsolutePath({
  path,
  requestContext,
}: {
  path: string;
  requestContext: RequestContext;
}): Promise<string> {
  const filesystem = await workspace.resolveFilesystem({ requestContext });
  const absolute = filesystem?.resolveAbsolutePath?.(path);
  if (!absolute) {
    throw new Error('No workspace filesystem available.');
  }
  return absolute;
}

export { sandboxPath } from './path';
export { codeModeToolNames } from './tool-names';

export const workspace: Workspace = new Workspace({
  id: 'main-workspace',
  name: 'Workspace',
  sandbox: ({ requestContext }) => {
    const { threadId } = channelContext(requestContext);
    // Degrade instead of throw. Mastra can resolve workspace instructions
    // before a thread is bound (and a scheduled/idle wake may arrive without
    // channel context), and throwing here failed the whole turn and every
    // fallback model. A contextless run gets a shared scratch directory; real
    // turns still key on their own thread, so sandbox continuity is unchanged.
    return createSandbox(threadId ?? '__unscoped__');
  },
  filesystem: ({ requestContext }) => {
    const { threadId } = channelContext(requestContext);
    return new LocalFilesystem({
      basePath: sandboxDirectory(threadId ?? '__unscoped__'),
    });
  },
  sandboxCacheKey: ({ requestContext }) =>
    channelContext(requestContext).threadId ?? '__unscoped__',
  skillSource: new LocalSkillSource({
    basePath:
      [
        resolve(process.cwd(), 'workspace/skills'),
        resolve(process.cwd(), '../../../workspace/skills'),
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          '../../workspace/skills'
        ),
      ].find(existsSync) ?? resolve(process.cwd(), 'workspace/skills'),
  }),
  skills: ['.'],
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
      name: READ_FILE,
      // Images go through view_image (which types by magic bytes), not read_file:
      // read_file trusts the extension, which is how a mislabeled file becomes a
      // bad image part. Keep PDFs, which view_image does not handle.
      mediaTypes: ['application/pdf'],
    },
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      name: WRITE_FILE,
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      name: EDIT_FILE,
      requireReadBeforeWrite: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: { name: LIST_FILES },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { name: DELETE_FILE },
    [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: { name: FILE_STAT },
    [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { enabled: false },
    [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { name: GREP },
    [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: false },
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      name: EXECUTE_COMMAND,
      // Without this the default is the agent's own abort signal, so every
      // `background: true` process is killed the moment the turn ends. The
      // background process is meant to outlive the agent that started it.
      backgroundProcesses: { abortSignal: false },
    },
    [WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]: {
      name: GET_PROCESS_OUTPUT,
    },
    [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS]: { name: KILL_PROCESS },
    [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: false },
  },
});
