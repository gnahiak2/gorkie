import { createTool, webFetchTool } from '@mastra/core/tools';
import { z } from 'zod';
import { htmlToText } from '../lib/html';
import { input, output } from '../types/tools/index';

export const fetchUrlTool = createTool({
  id: 'fetch_url',
  description: `Fetch a readable excerpt from a specific, known public URL (an article, doc page, README, or link someone shared). Not for search; use search_web to find URLs first.

Returns the page text with HTML tags stripped, truncated to about 8000 characters. It does not render JavaScript or extract articles, so it fails on anything that isn't a plain public page:
- GitHub source/directory pages (blob, tree, raw.githubusercontent.com) come back as page chrome and code noise; clone the repo or use the gh CLI instead.
- Authenticated or private services: Google Docs, Confluence, Jira, internal wikis, paywalled articles.
- Slack URLs; use Slack tools instead.
- Search result or directory listing pages.
- PDFs, images, and other binaries; they are not parsed. Download them with a command instead.`,
  inputSchema: input({
    url: z.url().describe('The exact URL to fetch.'),
  }),
  outputSchema: output({
    url: z.url(),
    text: z.string(),
    truncated: z.boolean(),
  }),
  transform: {
    display: {
      output: ({ output }) => ({
        summary: output?.url ?? 'URL fetched',
      }),
    },
  },
  execute: async ({ url }, context) => {
    const runWebFetch = webFetchTool.execute;
    if (!runWebFetch) {
      throw new Error('The web_fetch tool is unavailable.');
    }
    const page = await runWebFetch({ url }, context);
    if (!(page && 'content' in page)) {
      throw new Error(`Could not fetch content from ${url}.`);
    }
    if (page.isError) {
      throw new Error(page.content);
    }
    const text = page.contentType?.includes('text/html')
      ? htmlToText(page.content)
      : page.content;
    return {
      url: page.url ?? url,
      text: text.slice(0, 8000),
      truncated: (page.truncated ?? false) || text.length > 8000,
    };
  },
});
