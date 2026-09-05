import { isAbsolute, relative, resolve } from 'node:path';

export function resolveWithin(root: string, requested: string): string | null {
  const absoluteRoot = resolve(root);
  const candidate = resolve(absoluteRoot, requested);
  const pathFromRoot = relative(absoluteRoot, candidate);
  return pathFromRoot && (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) ? null : candidate;
}
