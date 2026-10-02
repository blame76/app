import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';
import { validateRegistry } from '../src/helpers/contract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('Shell, manifest, icons and registry are present; registry may contain helpers', () => {
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'assets/styles.css', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'src/app.js', 'src/db.js', 'src/context.js', 'src/schema.js', 'src/helpers/registry.js', 'src/helpers/contract.js']) {
    assert.ok(fs.existsSync(path.join(root, file)), `Fehlt: ${file}`);
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const label of ['Jetzt', 'Favoriten', 'Alle Helfer']) assert.ok(html.includes(`>${label}<`));
  for (const id of ['view-helper', 'helperHost', 'helperSettingsButton', 'data-composer="place"', 'data-composer="note"', 'data-composer="person"']) assert.ok(html.includes(id));
  validateRegistry(HELPERS);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes(`0815-v${version}`));
});
