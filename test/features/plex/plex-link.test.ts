import test from 'node:test';
import assert from 'node:assert/strict';
import { plexItemUrl } from '../../../src/server/features/plex/plex-link-server.ts';

test('Plex item links target the selected server and metadata item', () => {
  assert.equal(
    plexItemUrl('server id', '123'),
    'https://app.plex.tv/desktop/#!/server/server%20id/details?key=%2Flibrary%2Fmetadata%2F123',
  );
  assert.throws(() => plexItemUrl('', '123'), /server identifier/);
  assert.throws(() => plexItemUrl('server', '../123'), /Invalid Plex item/);
});
