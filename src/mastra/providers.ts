import { createAnthropic } from '@ai-sdk/anthropic';
import type { ModelWithRetries } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { env } from '@/env';
import { getModelChoice } from './db/queries/settings';
import {
  commandCodeModels,
  DEFAULT_MODEL,
  type ModelId,
  SUMMARIZER_MODEL,
} from './types';

const BASE_URL = 'https://api.commandcode.ai/provider/v1';

const anthropic = createAnthropic({
  apiKey: env.COMMANDCODE_API_KEY,
  baseURL: BASE_URL,
});

// The Provider API serves each model on exactly one wire format: Claude only on
// `/messages`, everything else only on `/chat/completions`. The AI SDK factory
// per wire decides the endpoint, so a model has to be built by its own wire or
// the request comes back a 400. Mastra's `url` escape hatch cannot do this
// split, because its router forces the OpenAI format for any custom URL
// (`ModelRouterLanguageModel.resolveLanguageModel` in `@mastra/core`).
function commandCode(id: ModelId): MastraModelConfig {
  const group = Object.values(commandCodeModels).find((entry) =>
    entry.models.some((model) => model.id === id)
  );
  if (!group) {
    throw new Error(`Unknown Command Code model: ${id}`);
  }
  if (group.endpoint === 'messages') {
    return anthropic(id);
  }
  return {
    id: `openai-compatible/${id}`,
    url: BASE_URL,
    apiKey: env.COMMANDCODE_API_KEY,
  };
}

export const orchestrator = async (): Promise<ModelWithRetries[]> => {
  const picked = await getModelChoice();
  const models = [
    { model: commandCode(picked), maxRetries: 3 },
    { model: commandCode(DEFAULT_MODEL), maxRetries: 3 },
  ];
  return picked === DEFAULT_MODEL ? models.slice(0, 1) : models;
};

export const scout = orchestrator;
export const explorer = orchestrator;

export const summarizer: ModelWithRetries[] = [
  { model: commandCode(SUMMARIZER_MODEL), maxRetries: 3 },
];
