import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const catalogue = JSON.parse(await readFile(new URL('../site/apps.json', import.meta.url), 'utf8'));
assert.equal(catalogue.version, 1);
assert.equal(catalogue.rendererReady, false, 'Public renderer must not be advertised until authenticated hosting is verified');
assert.ok(Array.isArray(catalogue.apps) && catalogue.apps.length > 0);
const ids = new Set();
for (const app of catalogue.apps) {
  assert.match(app.id, /^[a-z][a-z0-9-]{0,39}$/);
  assert.ok(!ids.has(app.id)); ids.add(app.id);
  for (const key of ['name', 'description', 'access']) assert.ok(typeof app[key] === 'string' && app[key].length > 0 && app[key].length <= 200);
  const url = new URL(app.url);
  assert.equal(url.protocol, 'https:'); assert.ok(!url.username && !url.password);
  assert.match(app.color, /^#[a-f0-9]{6}$/i);
  assert.ok(Array.isArray(app.devices) && app.devices.length > 0 && app.devices.every(device => ['phone','tablet','desktop'].includes(device)));
}
console.log(`PASS: ${ids.size} public app entries, HTTPS URLs, renderer not falsely advertised.`);
