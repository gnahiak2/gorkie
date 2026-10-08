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
    ],
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'chat',
    models: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
      { id: 'gpt-5.6-luna'}], label: 'GPT-5.6 Luna' }
    ],
  },
  google: {
    label: 'Google',
    endpoint: 'chat',
    models: [
      { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    ],
  },
  meta: {
    label: 'Meta',
    endpoint: 'chat',
    models: [
      { id: 'meta/muse-spark-1.2-contributor', label: 'Muse Spark 1.2 Contributor' },
      { id: 'meta/muse-spark-1.3-contributor', label: 'Muse Spark 1.3 Contributor' },
      { id: 'meta/muse-spark-1.3', label: 'Muse Spark 1.3' },
      { id: 'meta/muse-spark-1.2', label: 'Muse Spark 1.2' },
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
      { id: 'xiaomi/mimo-v2.6-pro-ultraspeed'}], label: 'MiMo V2.6 Pro Ultraspeed' }
      { id: 'xiaomi/mimo-v2.6-pro'}], label: 'MiMo V2.6 Pro' }
      { id: 'xiaomi/mimo-v2.6-flash'}], label: 'MiMo V2.6 Flash' }
    ],
  },
  qwen: {
    label: 'Qwen',
    endpoint: 'chat',
    models: [
      { id: 'qwen/qwen3.8-omni-flash', label: 'Qwen 3.8 Omni Flash' }
      { id: 'qwen/qwen3.8-max-0902'}], label: 'Qwen 3.8 Max 0902' }
      { id: 'qwen/qwen3.8-flash'}], label: 'Qwen 3.8 Flash' }
      { id: 'qwen/qwen3.8-27b'}], label: 'Qwen 3.8 27B' }
      { id: 'qwen/qwen3.8-max'}], label: 'Qwen 3.8 Max' }
      { id: 'qwen/qwen3.7-flash'}], label: 'Qwen 3.7 Flash' }
      { id: 'qwen/qwen3.7-max'}], label: 'Qwen 3.7 Max' }
      { id: 'qwen/qwen3.6-max-preview'}], label: 'Qwen 3.6 Max Preview' }
      { id: 'qwen/qwen3.6-plus'}], label: 'Qwen 3.6 Plus' }
    ]
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

export const DEFAULT_MODEL: ModelId = 'xiaomi/mimo-v2.5';
export const SUMMARIZER_MODEL: ModelId = 'xiaomi/mimo-v2.5';
