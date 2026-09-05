import test from 'node:test';
import assert from 'node:assert/strict';
import { contentTypeFor } from '../../src/server/core/static-files.ts';

test('production browser assets receive nosniff-compatible MIME types', () => {
  assert.equal(contentTypeFor('/dist/assets/index-abc.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('/dist/assets/index-abc.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('/dist/index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('/dist/unknown.bin'), 'application/octet-stream');
});
