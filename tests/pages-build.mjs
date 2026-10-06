import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
function snapshot(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const file = join(directory, name);
    const path = prefix + name;
    return lstatSync(file).isDirectory()
      ? snapshot(file, path + '/')
      : [[path, readFileSync(file).toString('base64')]];
  });
}

test('Pages build is reproducible, complete under /app/ and excludes development data', () => {
  const fixture = mkdtempSync(join(tmpdir(), '0815-pages-'));
  try {
    for (const path of ['bin', 'src', 'assets', 'index.html', 'manifest.webmanifest', 'sw.js', 'package.json']) {
      cpSync(join(root, path), join(fixture, path), { recursive: true });
    }
    writeFileSync(join(fixture, '.env'), 'NOT FOR DEPLOYMENT');
    writeFileSync(join(fixture, 'src', 'local-export.json'), 'NOT FOR DEPLOYMENT');
    const build = () => spawnSync(process.execPath, [join(fixture, 'bin/build-pages')], { encoding: 'utf8' });
    assert.equal(build().status, 0);
    const output = join(fixture, 'dist');
    const first = snapshot(output);
    assert.ok(existsSync(join(output, '.nojekyll')));
    assert.equal(readFileSync(join(output, 'src/time-windows.js'), 'utf8'), readFileSync(join(root, 'src/time-windows.js'), 'utf8'));
    assert.ok(!first.some(([path]) => /README|\.md$|\.env|local-export|package\.json|^bin\//.test(path)));
    for (const helper of HELPERS) {
      for (const path of [`./src/helpers/${helper.id}/index.js`, ...(helper.offlineAssets || [])]) {
        assert.ok(existsSync(join(output, path)), path);
      }
    }
    const base = new URL('https://example.test/app/');
    const requireAsset = (path, relativeTo = base) => {
      const url = new URL(path, relativeTo);
      assert.equal(url.origin, base.origin);
      assert.ok(url.pathname.startsWith(base.pathname), `Outside project scope: ${url}`);
      assert.ok(existsSync(join(output, url.pathname.slice(base.pathname.length))), `Missing: ${url}`);
    };
    const html = readFileSync(join(output, 'index.html'), 'utf8');
    for (const [, path] of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) requireAsset(path);
    const manifest = JSON.parse(readFileSync(join(output, 'manifest.webmanifest'), 'utf8'));
    assert.equal(new URL(manifest.start_url, base).href, base.href);
    assert.equal(new URL(manifest.scope, base).href, base.href);
    for (const icon of manifest.icons) requireAsset(icon.src);
    for (const [path] of first.filter(([path]) => path.endsWith('.css'))) {
      const source = readFileSync(join(output, path), 'utf8');
      for (const [, asset] of source.matchAll(/url\(['"](\.\.?\/[^'"]+)['"]\)/g)) requireAsset(asset, new URL(path, base));
    }
    for (const font of ['CormorantGaramond', 'GreatVibes']) {
      requireAsset(`./assets/fonts/${font}.woff2`);
      requireAsset(`./assets/fonts/OFL-${font}.txt`);
    }
    for (const [path] of first.filter(([path]) => path.endsWith('.js'))) {
      const source = readFileSync(join(output, path), 'utf8');
      const relativeTo = new URL(path, base);
      for (const [, asset] of source.matchAll(/(?:from\s*|import\s*\(\s*|new URL\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g)) {
        requireAsset(asset, relativeTo);
      }
    }
    writeFileSync(join(output, 'stale-export.json'), 'NOT FOR DEPLOYMENT');
    assert.equal(build().status, 0);
    assert.deepEqual(snapshot(output), first);
    const icon = join(fixture, 'assets/icons/icon-192.png');
    rmSync(icon);
    symlinkSync(join(fixture, '.env'), icon);
    const rejected = build();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Runtime symlink/);
    assert.deepEqual(snapshot(output), first, 'Rejected build preserves the previous output');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('Every changed deployed asset updates the worker cache without a manual version bump', () => {
  const fixture = mkdtempSync(join(tmpdir(), '0815-release-'));
  try {
    for (const path of ['bin', 'src', 'assets', 'index.html', 'manifest.webmanifest', 'sw.js', 'package.json']) {
      cpSync(join(root, path), join(fixture, path), { recursive: true });
    }
    const build = () => {
      const result = spawnSync(process.execPath, [join(fixture, 'bin/build-pages')], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return readFileSync(join(fixture, 'dist/sw.js'), 'utf8').match(/const CACHE = '([^']+)'/)[1];
    };
    const original = build();
    assert.match(original, /^0815-v[\d.]+-[a-f0-9]{16}$/);
    assert.equal(build(), original, 'Same runtime files produce the same release');
    mkdirSync(join(fixture, 'design/signature'), { recursive: true });
    writeFileSync(join(fixture, 'design/signature/mockup.html'), 'Design only');
    assert.equal(build(), original, 'Design studies do not affect the production release');
    for (const file of ['assets/styles.css', 'assets/signature.css', 'assets/fonts/CormorantGaramond.woff2', 'assets/fonts/GreatVibes.woff2', 'src/theme.js', 'src/time-windows.js', 'src/helpers/pain/index.js', 'src/pwa-update.js', 'index.html']) {
      const source = readFileSync(join(fixture, file));
      writeFileSync(join(fixture, file), Buffer.concat([source, Buffer.from('\n/* changed runtime asset */\n')]));
      assert.notEqual(build(), original, file);
      writeFileSync(join(fixture, file), source);
      assert.equal(build(), original, 'Restoring content restores the release');
    }
    assert.ok(existsSync(join(fixture, 'dist/src/pwa-update.js')));
    assert.ok(existsSync(join(fixture, 'dist/src/theme.js')));
    assert.ok(existsSync(join(fixture, 'dist/assets/signature.css')));
    assert.ok(!existsSync(join(fixture, 'dist/design')));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
