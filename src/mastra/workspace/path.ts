import { posix as path } from 'node:path';

export function sandboxPath(...parts: string[]): string {
  return path.join(...parts);
}
