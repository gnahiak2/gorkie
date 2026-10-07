import { setModelChoice } from '../../../db/queries/settings';
import { isOwner } from '../../../lib/owner';
import { modelIdSchema } from '../../../types';
import { chat } from '../../instance';
import { ids } from './ids';

export function registerModel({
  publishHome,
}: {
  publishHome: (userId: string) => Promise<void>;
}): void {
  chat().onAction(ids.model, async (event) => {
    const {
      user: { userId },
    } = event;
    if (!isOwner(userId)) {
      return;
    }
    const model = modelIdSchema.safeParse(event.value);
    if (!model.success) {
      return;
    }
    await setModelChoice({ model: model.data });
    await publishHome(userId);
  });
}
