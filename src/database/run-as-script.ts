import { pathToFileURL } from 'node:url';

export function isEntryPoint(moduleUrl: string): boolean {
  return process.argv[1] !== undefined && moduleUrl === pathToFileURL(process.argv[1]).href;
}
