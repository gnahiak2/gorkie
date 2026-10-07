import { createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { slack } from '../../chat/client';
import { type Target, targetSchema } from '../../chat/target';
import { upload } from '../../config';
import { channelContext } from '../../lib/context';
import { parseSlackId, rawId } from '../../lib/ids';
import { input, output } from '../../types/tools/index';
import {
  requireSandbox,
  sandboxAbsolutePath,
  statSandboxFile,
} from '../../workspace';
import { assertCanPostTo, joinChannel } from './utils';

async function slackDestination(
  target: Target
): Promise<{ channel: string; threadTs: string | undefined }> {
  if (target.type === 'user') {
    const dm = await slack.webClient.conversations.open({
      users: rawId(target.id),
    });
    return { channel: dm.channel?.id ?? '', threadTs: undefined };
  }
  if (target.type === 'thread') {
    const { channel, ts } = parseSlackId(target.id);
    return { channel: channel ?? '', threadTs: ts };
  }
  return { channel: rawId(target.id), threadTs: undefined };
}

export const uploadFileTool = createTool({
  id: 'upload_file',
  description:
    'Upload a file from the sandbox to Slack. Defaults to the current thread; pass target to send it elsewhere. Channel and thread targets must be in the channel this conversation is already in; user targets must be the requester themselves.',
  inputSchema: input({
    path: z
      .string()
      .min(1)
      .describe(
        'Path to the file in the sandbox (relative to the working dir).'
      ),
    filename: z
      .string()
      .optional()
      .describe('Optional filename shown in Slack.'),
    comment: z
      .string()
      .optional()
      .describe('Optional message to post alongside the file.'),
    target: targetSchema
      .optional()
      .describe('Optional destination other than the current thread.'),
  }),
  outputSchema: output({
    filename: z.string(),
    path: z.string(),
    fileId: z.string().optional(),
  }),
  transform: {
    display: {
      output: ({ output }) => ({
        summary: `Uploaded ${output?.filename ?? 'file'}`,
      }),
    },
  },
  execute: async ({ path, filename, comment, target }, context) => {
    if (!context?.requestContext) {
      throw new Error('No workspace context.');
    }
    await requireSandbox(context.requestContext);

    const stat = await statSandboxFile({
      path,
      requestContext: context.requestContext,
    });
    if (stat.size > upload.maxBytes) {
      throw new Error(
        `${path} is ${Math.round(stat.size / 1_000_000)}MB, over the ${upload.maxBytes / 1_000_000}MB upload limit.`
      );
    }
    const name = filename ?? path.split('/').pop() ?? 'file';

    const ctx = channelContext(context.requestContext);
    const resolved =
      target ??
      (ctx.threadId
        ? { type: 'thread' as const, id: ctx.threadId }
        : undefined);
    if (!resolved) {
      throw new Error('No current thread to upload to.');
    }
    assertCanPostTo({ target: resolved, ctx });
    if (resolved.type !== 'user') {
      await joinChannel(resolved.id);
    }
    const destination = await slackDestination(resolved);

    const created = await slack.webClient.files.getUploadURLExternal({
      filename: name,
      length: stat.size,
    });
    if (!(created.upload_url && created.file_id)) {
      throw new Error('Slack did not return an upload URL.');
    }
    // The local sandbox is the host, so the file is read straight off disk as a
    // stream rather than through a sandbox file API with no stream variant.
    const absolute = await sandboxAbsolutePath({
      path,
      requestContext: context.requestContext,
    });
    let uploaded = 0;
    const counted = createReadStream(absolute).pipe(
      new Transform({
        transform(chunk, _encoding, callback) {
          uploaded += chunk.byteLength;
          callback(null, chunk);
        },
      })
    );
    // Node's `stream/web` and the DOM `ReadableStream` disagree on the buffered
    // helpers (blob/text/bytes/json) though the runtime object is the same, so
    // the conversion is cast at the fetch boundary.
    const body = Readable.toWeb(
      counted
    ) as unknown as ReadableStream<Uint8Array>;
    // `duplex: 'half'` is mandatory for a stream body on Node's undici and is
    // missing from the DOM `RequestInit` type. Bun tolerates its absence,
    // which is why this only failed once it ran under `mastra dev`.
    const streamed: RequestInit & { duplex: 'half' } = {
      body,
      duplex: 'half',
      method: 'POST',
    };
    const sent = await fetch(created.upload_url, streamed);
    if (!sent.ok) {
      throw new Error(`Upload to Slack failed with ${sent.status}.`);
    }
    // Slack accepts a body shorter than the length it was promised, so a
    // truncated file otherwise publishes looking intact. Check before
    // completing: an unfinished upload id expires on its own, a published
    // corrupt file does not.
    if (uploaded !== stat.size) {
      throw new Error(
        `${path} was truncated in transit: sent ${uploaded} of ${stat.size} bytes. Nothing was posted to Slack, try the upload again.`
      );
    }
    await slack.webClient.files.completeUploadExternal({
      channel_id: destination.channel,
      files: [{ id: created.file_id, title: name }],
      initial_comment: comment,
      thread_ts: destination.threadTs,
    });
    const fileId = created.file_id;

    return {
      filename: name,
      path,
      fileId,
    };
  },
});
