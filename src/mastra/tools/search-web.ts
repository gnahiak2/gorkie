import { createTool } from '@mastra/core/tools';
import { SafeSearchType, search } from 'duck-duck-scrape';
import { z } from 'zod';
import { htmlToText } from '../lib/html';
import { input, output } from '../types/tools/index';

export const searchWebTool = createTool({
  id: 'search_web',
  description:
    'Search the web for current information, documentation, news, and facts. Do not guess at recent or external facts. For unfamiliar names, acronyms, projects, links, screenshots, or "what is X" questions, also use search_slack when available before answering because the reference may be internal.',
  inputSchema: input({
    query: z
      .string()
      .min(1)
      .max(500)
      .describe("A specific, clear web search query for what you're after."),
  }),
  outputSchema: output({
    links: z.array(z.url()),
    results: z.array(
      z.strictObject({
        title: z.string(),
        url: z.url(),
        text: z.string(),
      })
    ),
  }),
  transform: {
    display: {
      output: ({ input, output }) => ({
        summary: `Found ${output?.results.length ?? 0} web results for "${input?.query ?? ''}"`,
      }),
    },
  },
  execute: async ({ query }) => {
    const { results } = await search(query, {
      safeSearch: SafeSearchType.MODERATE,
    });
    const trimmed = results.slice(0, 8).map((result) => ({
      title: htmlToText(result.title) || result.url,
      url: result.url,
      text: htmlToText(result.description),
    }));
    return {
      links: trimmed.slice(0, 5).map((result) => result.url),
      results: trimmed,
    };
  },
});
