import { mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchSlackFile } from '@chat-adapter/slack/api';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { env } from '@/env';
import { slack } from '../../chat/client';
import { channelContext } from '../../lib/context';
import { spendSlackCall } from '../../lib/slack-budget';
import { input, output } from '../../types/tools/index';
import {
  sandboxPath as p,
  requireSandbox,
  sandboxAbsolutePath,
} from '../../workspace';
import { assertReadableResource } from './utils';

function formatBytes(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.ceil(value / 1024)} KB`;
  }
  return `${Math.ceil(value / 1024 / 1024)} MB`;
}

export const getSlackFileTool = createTool({
  id: 'get_slack_file',
  description:
    'Download one Slack upload, snippet, or image into the thread sandbox for reading or processing. Pass a Slack file id such as F0123ABCD, or a Slack file permalink containing one. Use fetch_url for web URLs and read_canvas for canvases. Preserve a useful image extension so read_file can infer its MIME type.',
  inputSchema: input({
    file: z
      .string()
      .min(1)
      .describe(
        'A Slack file id (e.g. F0123ABCD). A Slack file permalink containing the id also works; the id is extracted from it.'
      ),
    filename: z.string().optional().describe('Optional name to save it as.'),
  }),
  outputSchema: output({
    path: z.string(),
    filename: z.string(),
    mimeType: z.string().optional(),
    size: z.number(),
  }),
  transform: {
    display: {
      output: ({ output }) => ({
        summary: output?.filename ?? output?.path ?? 'File downloaded',
      }),
    },
  },
  execute: async ({ file, filename }, context) => {
    if (!context?.requestContext) {
      throw new Error('No workspace context.');
    }
    // Resolves the thread and makes sure its working directory exists. The
    // download then streams straight to disk, since the local sandbox is the
    // host and there is no remote filesystem to route through.
    await requireSandbox(context.requestContext);

    const fileId = /(F[A-Z0-9]{6,})/.exec(file)?.[1];
    if (!fileId) {
      throw new Error(
        `Not a Slack file id: "${file}". Pass a Slack file id like F0123ABCD (or a Slack file permalink that contains one). get_slack_file only downloads Slack files; use fetch_url for arbitrary web URLs.`
      );
    }

    spendSlackCall(context.requestContext);

    const fileInfo = (await slack.webClient.files.info({ file: fileId })).file;
    await assertReadableResource({
      channelIds: [
        ...(fileInfo?.channels ?? []),
        ...(fileInfo?.groups ?? []),
        ...(fileInfo?.ims ?? []),
      ],
      currentThreadId: channelContext(context.requestContext).threadId,
    });
    const url = fileInfo?.url_private_download ?? fileInfo?.url_private;
    if (!url) {
      throw new Error(
        `Could not resolve a download URL for Slack file ${fileId}. It may have been deleted, or the bot may not have access to it.`
      );
    }
    const defaultName = fileInfo?.name ?? fileId;
    const sanitized = (filename ?? defaultName).replace(/[^\w.-]+/g, '_');
    const name =
      sanitized === '' || sanitized === '.' || sanitized === '..'
        ? 'slack-file'
        : sanitized;
    const path = p('downloads', name);
    const absolute = await sandboxAbsolutePath({
      path,
      requestContext: context.requestContext,
    });
    await mkdir(dirname(absolute), { recursive: true });
    const formatResult = (size: number) => ({
      path,
      filename: name,
      mimeType: fileInfo?.mimetype,
      size,
    });

    const expectedSize =
      fileInfo?.size ??
      (await fetch(url, {
        headers: { authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
        method: 'HEAD',
        signal: context.abortSignal,
      })
        .then((response) => Number(response.headers.get('content-length')))
        .then((size) => (Number.isFinite(size) && size >= 0 ? size : undefined))
        .catch(() => undefined));

    const existing = await stat(absolute).catch(() => undefined);
    if (expectedSize !== undefined && existing?.size === expectedSize) {
      return formatResult(expectedSize);
    }

    if (expectedSize === 0) {
      await writeFile(absolute, '');
      return formatResult(0);
    }

    const response = await fetchSlackFile({
      fetch: Object.assign(
        (input: URL | RequestInfo, init?: RequestInit) =>
          fetch(input, { ...init, signal: context.abortSignal }),
        { preconnect: fetch.preconnect }
      ),
      token: env.SLACK_BOT_TOKEN,
      url,
    });
    if (!response.ok) {
      throw new Error(`Failed to download Slack file: ${response.status}`);
    }
    if (!response.body) {
      throw new Error('Slack file response did not include a body.');
    }

    const handle = await open(absolute, 'w');
    try {
      for await (const chunk of response.body) {
        await handle.write(chunk);
      }
    } catch (error) {
      // A failed or aborted download must not leave a partial file at the final
      // path, where a later read would take it for the whole file.
      await rm(absolute, { force: true }).catch(() => undefined);
      throw error;
    } finally {
      await handle.close();
    }

    const final = await stat(absolute);
    if (expectedSize !== undefined && final.size !== expectedSize) {
      throw new Error(
        `Downloaded ${formatBytes(final.size)} but expected ${formatBytes(expectedSize)}.`
      );
    }
    return formatResult(expectedSize ?? final.size);
  },
});
