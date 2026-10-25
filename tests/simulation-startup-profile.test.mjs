import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {access,appendFile,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const profiler = join(root, 'tests/simulation-startup-profile.mjs');
const fixtureRoot = join(root, 'tmp/simulation-profile-tests');
const sourcePaths = [
  'index.html',
  'assets/simulations/scene3d.js',
  'assets/simulations/plant-growth-studio.js',
  'assets/simulations/plant-growth-model.js',
  'assets/simulations/plant-growth-botany.js',
  'assets/simulations/plant-growth-leaf-surface.js'
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  await mkdir(fixtureRoot, {recursive: true});
  const folder = await mkdtemp(join(fixtureRoot, 'case-'));
  t.after(async () => {
    assert(resolve(folder).startsWith(resolve(fixtureRoot) + sep));
    await rm(folder, {recursive: true, force: true});
  });
  const manifest = {before: join(folder, 'before'), after: join(folder, 'after'), frontendHashes: {}};
  for (const variant of ['before', 'after']) {
    manifest.frontendHashes[variant] = {};
    for (const path of sourcePaths) {
      let bytes = await readFile(join(root, path));
      // Distinct snapshots catch accidentally validating one variant twice.
      if (variant === 'after' && path.endsWith('plant-growth-leaf-surface.js')) {
        bytes = Buffer.concat([bytes, Buffer.from('\n// Independent after snapshot.\n')]);
      }
      const destination = join(manifest[variant], path);
      await mkdir(dirname(destination), {recursive: true});
      await writeFile(destination, bytes);
      manifest.frontendHashes[variant][path] = hash(bytes);
    }
  }
  const manifestPath = join(folder, 'manifest.json');
  const output = join(folder, 'reports', 'result.json');
  const browserAttempt = join(folder, 'browser-attempted.txt');
  const preload = join(folder, 'browser-guard.cjs');
  // These are CLI safety checks, so even a regression must never launch Chrome.
  await writeFile(preload, `const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === 'playwright' || request.replaceAll('\\\\', '/').endsWith('playwright/driver/package')) {
    return {chromium: {launch() {
      require('node:fs').writeFileSync(${JSON.stringify(browserAttempt)}, 'attempted');
      throw new Error('Unexpected Chrome launch during profiler CLI checks');
    }}};
  }
  return originalLoad.call(this, request, ...args);
};
`);
  const saveManifest = () => writeFile(manifestPath, JSON.stringify(manifest));
  await saveManifest();
  const run = (...args) => {
    const result = spawnSync(process.execPath, [
      '--require', preload, profiler, '--manifest', manifestPath, '--output', output, ...args
    ], {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 20000});
    assert.ifError(result.error);
    assert.notEqual(result.status, null, result.stderr);
    return result;
  };
  return {folder, manifest, output, browserAttempt, saveManifest, run};
}

test('--check validates both independent frontend snapshots without writing or launching a browser', async t => {
  const f = await fixture(t);
  const result = f.run('--check');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.checked, true);
  assert.equal(report.productionFilesChanged, false);
  assert.deepEqual(report.sourceHashes, f.manifest.frontendHashes);
  for (const variant of ['before', 'after']) {
    assert(report.instrumentedFiles.some(path => path.startsWith(variant + '/')));
    for (const path of sourcePaths) {
      assert.equal(hash(await readFile(join(f.manifest[variant], path))), f.manifest.frontendHashes[variant][path]);
    }
  }
  await assert.rejects(access(dirname(f.output)), {code: 'ENOENT'});
  await assert.rejects(access(f.browserAttempt), {code: 'ENOENT'});
});

test('--check rejects changed leaf-surface source against the recorded frontend hash', async t => {
  const f = await fixture(t);
  await appendFile(join(f.manifest.after, 'assets/simulations/plant-growth-leaf-surface.js'), '\n// Changed after capture.\n');
  const result = f.run('--check');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /after\/assets\/simulations\/plant-growth-leaf-surface\.js: frontend snapshot changed/);
  await assert.rejects(access(f.output), {code: 'ENOENT'});
  await assert.rejects(access(f.browserAttempt), {code: 'ENOENT'});
});

test('an existing report is preserved and rejected before Chrome is launched', async t => {
  const f = await fixture(t);
  const original = '{"status":"previous evidence","runs":[{"readyMs":123}]}\n';
  await mkdir(dirname(f.output), {recursive: true});
  await writeFile(f.output, original);
  const result = f.run('--samples', '1');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EEXIST/);
  assert.equal(await readFile(f.output, 'utf8'), original);
  await assert.rejects(access(f.browserAttempt), {code: 'ENOENT'});
});

test('invalid sample counts fail without producing a report', async t => {
  const f = await fixture(t);
  for (const samples of ['0', '1.5', '11']) {
    const result = f.run('--check', '--samples', samples);
    assert.notEqual(result.status, 0, samples);
    assert.match(result.stderr, /AssertionError/);
  }
  await assert.rejects(access(f.output), {code: 'ENOENT'});
  await assert.rejects(access(f.browserAttempt), {code: 'ENOENT'});
});

test('frontend snapshot paths outside the workspace are rejected before reading their files', async t => {
  const f = await fixture(t);
  f.manifest.after = resolve(root, '..');
  await f.saveManifest();
  const result = f.run('--check');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Frontend snapshots must remain in the workspace/);
  await assert.rejects(access(f.output), {code: 'ENOENT'});
  await assert.rejects(access(f.browserAttempt), {code: 'ENOENT'});
});
