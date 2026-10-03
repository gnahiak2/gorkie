import { commandCodeModels, type ModelId } from '../../../types';
import type { HomeSection } from '../limit';
import { ids } from './ids';

const options = Object.values(commandCodeModels).flatMap((group) =>
  group.models.map((model) => ({
    text: {
      type: 'plain_text' as const,
      text: `${group.label}: ${model.label}`,
    },
    value: model.id,
  }))
);

const labels = new Map(
  options.map((option) => [option.value, option.text.text])
);

export function modelBlocks(selected: ModelId): HomeSection {
  return {
    fixed: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Model*' },
        accessory: {
          type: 'static_select',
          action_id: ids.model,
          placeholder: { type: 'plain_text', text: 'Pick a model' },
          initial_option: {
            text: {
              type: 'plain_text',
              text: labels.get(selected) ?? selected,
            },
            value: selected,
          },
          options,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'every conversation uses this one. gorkie falls back to Z.AI: GLM-5.3 Flash if it fails.',
          },
        ],
      },
    ],
    trailing: [{ type: 'divider' }],
  };
}
