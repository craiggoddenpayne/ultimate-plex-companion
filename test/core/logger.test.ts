import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../../src/server/core/logger.ts';

test('structured logs redact secrets and retain useful error details', () => {
  const output = [];
  const logger = createLogger({ sink: (entry) => output.push(entry) });
  logger.error('plex.failed', {
    token: 'never-print-this',
    url: 'http://plex.local/?X-Plex-Token=never-print-this',
    error: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }),
  });
  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /never-print-this/);
  assert.match(serialized, /\[REDACTED\]/);
  assert.match(serialized, /ECONNREFUSED/);
});

test('child loggers add context to the shared diagnostic history', () => {
  const logger = createLogger({ sink: () => {} });
  logger.child({ component: 'plex' }).warn('request.failed', { status: 500 });
  assert.equal(logger.entries()[0].component, 'plex');
  assert.equal(logger.entries()[0].status, 500);
});
