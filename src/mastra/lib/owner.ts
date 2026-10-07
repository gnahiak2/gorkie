import { env } from '@/env';

export function isOwner(userId: string): boolean {
  return userId === env.OWNER_USER_ID;
}
