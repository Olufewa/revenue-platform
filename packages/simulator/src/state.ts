import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../state/', import.meta.url);

export type SavedService = { id: string; name: string; incomeAccount: string; apiKey: string };

export function loadServices(): SavedService[] {
  const file = new URL('services.json', DIR);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function saveServices(services: SavedService[]) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(new URL('services.json', DIR), JSON.stringify(services, null, 2));
}
