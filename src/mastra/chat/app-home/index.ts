import { logger } from '../../lib/logger';
import { chat } from '../instance';
import { registerCustomInstructions } from './instructions';
import { registerMCPServers } from './mcp';
import { registerModel } from './model';
import { registerScheduledTasks } from './scheduled-tasks';
import { publishHome } from './view';

export function registerAppHome(): void {
  chat().onAppHomeOpened((event) =>
    publishHome(event.userId).catch((error: unknown) =>
      logger.error('[app-home] publishHome failed', { error })
    )
  );
  registerCustomInstructions({ publishHome });
  registerModel({ publishHome });
  registerMCPServers({ publishHome });
  registerScheduledTasks({ publishHome });
}
