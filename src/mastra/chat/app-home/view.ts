import { listMCPServers } from '../../db/queries/mcps';
import { getInstructions, getModelChoice } from '../../db/queries/settings';
import { logger } from '../../lib/logger';
import { isOwner } from '../../lib/owner';
import { slack } from '../client';
import { content } from '../content';
import { customInstructionsBlocks } from './instructions';
import { fitHome, type HomeSection } from './limit';
import { mcpServersBlocks } from './mcp';
import { modelBlocks } from './model';
import { scheduledTasksBlocks } from './scheduled-tasks';

async function settled<T>({
  label,
  userId,
  work,
}: {
  label: string;
  userId: string;
  work: Promise<T>;
}): Promise<T | undefined> {
  try {
    return await work;
  } catch (error) {
    logger.error('[app-home] section failed to load', { error, label, userId });
  }
}

async function buildHomeView(userId: string): Promise<Record<string, unknown>> {
  const [instructions, mcpServers, scheduled, model] = await Promise.all([
    settled({ label: 'instructions', userId, work: getInstructions(userId) }),
    settled({ label: 'mcp', userId, work: listMCPServers(userId) }),
    settled({
      label: 'scheduled',
      userId,
      work: scheduledTasksBlocks(userId),
    }),
    settled({ label: 'model', userId, work: getModelChoice() }),
  ]);

  const sections: HomeSection[] = [
    { fixed: [...content.home.blocks, { type: 'divider' }] },
    ...(model && isOwner(userId) ? [modelBlocks(model)] : []),
    customInstructionsBlocks(instructions),
    mcpServersBlocks(mcpServers ?? []),
    ...(scheduled ? [scheduled] : []),
  ];

  return { type: 'home', blocks: fitHome(sections) };
}

export async function publishHome(userId: string): Promise<void> {
  await slack.publishHomeView(userId, await buildHomeView(userId));
}
