import { z } from 'zod';

const modelGroupSchema = z.object({
  label: z.string(),
  models: z.array(z.object({ id: z.string(), label: z.string() })),
});

export const commandCodeModels = {
  anthropic: {
    label: 'Anthropic',
    endpoint: 'messages',
    models: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    ],
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'chat',
    models: [
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
    ],
  },
  google: {
    label: 'Google',
    endpoint: 'chat',
    models: [
      { id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
    ],
  },
  meta: {
    label: 'Meta',
    endpoint: 'chat',
    models: [
      {
        id: 'meta/muse-spark-1.3-contributor',
        label: 'Muse Spark 1.3 Contributor',
      },
    ],
  },
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'chat',
    models: [
      {
        id: 'deepseek/deepseek-v4-flash',
        label: 'DeepSeek V4 Flash (latest)',
      },
      { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
      {
        id: 'deepseek/deepseek-v4-flash-vision-exp',
        label: 'DeepSeek V4 Flash Vision (exp)',
      },
    ],
  },
  zai: {
    label: 'Z.AI',
    endpoint: 'chat',
    models: [{ id: 'z-ai/glm-5.3-flash', label: 'GLM-5.3 Flash' }],
  },
  moonshot: {
    label: 'Moonshot',
    endpoint: 'chat',
    models: [{ id: 'moonshotai/Kimi-K3', label: 'Kimi K3' }],
  },
  minimax: {
    label: 'MiniMax',
    endpoint: 'chat',
    models: [{ id: 'MiniMaxAI/MiniMax-M3', label: 'MiniMax M3' }],
  },
  xiaomi: {
    label: 'Xiaomi',
    endpoint: 'chat',
    models: [
      { id: 'xiaomi/mimo-v2.5', label: 'MiMo V2.5' },
      { id: 'xiaomi/mimo-v2.5-pro', label: 'MiMo V2.5 Pro' },
    ],
  },
  qwen: {
    label: 'Qwen',
    endpoint: 'chat',
    models: [{ id: 'Qwen/Qwen3.8-Flash', label: 'Qwen 3.8 Flash' }],
  },
} as const satisfies Record<
  string,
  z.infer<typeof modelGroupSchema> & { endpoint: 'chat' | 'messages' }
>;

export type ModelId =
  (typeof commandCodeModels)[keyof typeof commandCodeModels]['models'][number]['id'];

export const modelIds: ModelId[] = Object.values(commandCodeModels).flatMap(
  (group) => group.models.map((model) => model.id) as ModelId[]
);

export const modelIdSchema = z.enum(modelIds as [ModelId, ...ModelId[]]);

export const DEFAULT_MODEL: ModelId = 'z-ai/glm-5.3-flash';
export const SUMMARIZER_MODEL: ModelId = 'xiaomi/mimo-v2.5';
