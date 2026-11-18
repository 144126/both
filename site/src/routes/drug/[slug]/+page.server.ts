import { readFileSync } from 'node:fs';
import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () =>
	(JSON.parse(readFileSync('static/api/v1/index.json', 'utf8')).c as [string, string][]).filter(([, slug]) => slug).map(([, slug]) => ({ slug }));
