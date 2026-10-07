import { eq } from 'drizzle-orm';
import { rawId } from '../../lib/ids';
import { DEFAULT_MODEL, type ModelId, modelIdSchema } from '../../types';
import { db } from '../client';
import { userSettings } from '../schema';

export async function getInstructions(
  userId: string
): Promise<string | undefined> {
  const [row] = await db
    .select({ instructions: userSettings.instructions })
    .from(userSettings)
    .where(eq(userSettings.userId, rawId(userId)));
  return row?.instructions ?? undefined;
}

export async function setInstructions({
  userId,
  instructions,
}: {
  userId: string;
  instructions: string | undefined;
}): Promise<void> {
  const set = { instructions: instructions ?? null, updatedAt: new Date() };
  await db
    .insert(userSettings)
    .values({ ...set, userId: rawId(userId) })
    .onConflictDoUpdate({ target: userSettings.userId, set });
}

// The model picker is shared: whoever picks, every turn uses that model. The
// choice lives in one `user_settings` row under this key instead of a Slack
// user id, so it does not belong to whoever happened to pick it.
const SHARED_MODEL_USER = 'shared';

export async function getModelChoice(): Promise<ModelId> {
  const [row] = await db
    .select({ model: userSettings.model })
    .from(userSettings)
    .where(eq(userSettings.userId, SHARED_MODEL_USER));
  return modelIdSchema.catch(DEFAULT_MODEL).parse(row?.model);
}

export async function setModelChoice({
  model,
}: {
  model: ModelId;
}): Promise<void> {
  const set = { model, updatedAt: new Date() };
  await db
    .insert(userSettings)
    .values({ ...set, userId: SHARED_MODEL_USER })
    .onConflictDoUpdate({ target: userSettings.userId, set });
}
