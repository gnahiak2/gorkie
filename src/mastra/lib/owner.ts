import { env } from '@/env';
import { logger } from './logger';

export function isUserAllowed(userId: string): boolean {
  if (userId === env.OWNER_USER_ID) {
    return true;
  }
  logger.debug('[allowlist] ignoring non-owner message', { userId });
  return false;
}
