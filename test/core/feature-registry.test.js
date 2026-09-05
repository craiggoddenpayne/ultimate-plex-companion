import test from 'node:test';
import assert from 'node:assert/strict';
import { features, navigation, validateFeatureRegistry } from '../../src/shared/feature-registry.js';

test('feature registry is unique and drives navigation metadata', () => {
  assert.equal(validateFeatureRegistry(), true);
  assert.equal(navigation.length, features.length);
  assert.ok(features.find(feature=>feature.id==='playlists'));
  assert.throws(()=>validateFeatureRegistry([{id:'same',icon:'play',label:'A'},{id:'same',icon:'play',label:'B'}]),/unique/);
});
