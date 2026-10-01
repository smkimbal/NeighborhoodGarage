import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSiteUrl} from '../scripts/site-url.mjs';
test('deployment callbacks preserve GitHub subpaths and support custom domains', () => {
  assert.equal(normalizeSiteUrl('https://smkimbal.github.io/NeighborhoodGarage'), 'https://smkimbal.github.io/NeighborhoodGarage/');
  assert.equal(normalizeSiteUrl('https://garage.example'), 'https://garage.example/');
});
test('deployment callbacks reject insecure or ambiguous configuration', () => {
  for (const value of ['http://garage.example', 'javascript:alert(1)', 'https://user:pass@garage.example/', 'https://garage.example/?next=evil', 'https://garage.example/#/login', 'not a URL']) {
    assert.throws(() => normalizeSiteUrl(value));
  }
});
