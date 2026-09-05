import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile, writeJsonAtomic } from '../../src/server/core/atomic-json-store.ts';

test('atomic JSON writes remain valid and private', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'companion-store-'));
  const file = join(directory, 'nested', 'state.json');
  t.after(() => rm(directory, { recursive: true, force: true }));

  await Promise.all([writeJsonAtomic(file, { revision: 1 }), writeJsonAtomic(file, { revision: 2 })]);

  const saved = await readJsonFile<{ revision: number }>(file);
  assert.ok([1, 2].includes(saved.revision));
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});
