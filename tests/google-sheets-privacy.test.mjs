import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, mkdtemp} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {basename, extname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {buildSite} from '../scripts/build-site.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);
const textual = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.txt', '.md']);
const privatePaths = /(?:^|\/)(?:integrations|docs|preparation|supabase|tests?|node_modules|\.git|\.codex|\.agents)(?:\/|$)/i;
const forbiddenFiles = /(?:\.(?:gs|xlsx?|xlsm|ods|csv|tsv|sql|db|sqlite3?|zip|tgz|map)$|(?:accounts|roster|students|credentials|passwords|scores|exam[-_]?history)[-_]?\d*\.(?:json|js|txt)$|^\.env(?:\.|$))/i;

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    assert(!entry.isSymbolicLink(), `Unexpected symbolic link: ${relative(root, directory)}`);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

test('public Sheets configuration contains only the deployment URL', async () => {
  const source = await readFile(join(root, 'assets/integrations/sheets-config.js'), 'utf8');
  const context = vm.createContext({window: {}});
  vm.runInContext(source, context, {timeout: 1000});
  const config = context.window.SLH_SHEETS_CONFIG;
  assert(config && typeof config === 'object', 'Public configuration must be present');
  assert.deepEqual(Object.keys(config), ['endpoint'], 'Public configuration must not contain account lists, passwords, tokens or scores');
  assert.equal(typeof config.endpoint, 'string');
  assert(config.endpoint === '' || /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint), 'Only a deployed Apps Script URL belongs in public configuration');
});

test('Pages artifact excludes account workbooks, backend, credential exports and score data', async t => {
  await mkdir(join(root, 'tmp'), {recursive: true});
  const scratch = await mkdtemp(join(root, 'tmp', 'google-sheets-privacy-'));
  const output = join(scratch, 'site');
  await buildSite(output);
  const files = await walk(output);
  let checked = 0;
  for (const path of files) {
    const name = relative(output, path).replaceAll('\\', '/');
    // assets/integrations is the public transport client, not Apps Script source.
    const serverPath = name.startsWith('assets/integrations/') ? name.slice('assets/integrations/'.length) : name;
    assert(!privatePaths.test(serverPath), `Private directory shipped: ${name}`);
    assert(!forbiddenFiles.test(basename(path)), `Private data/backend file shipped: ${name}`);
    if (!name.startsWith('assets/')) {
      assert(/^(?:index\.html|\.nojekyll|build-report\.json|inline-[a-f0-9]+\.(?:js|css))$/.test(name), `Unexpected deployment root file: ${name}`);
    }
    if (!textual.has(extname(path).toLowerCase())) continue;
    const content = await readFile(path, 'utf8');
    // Report filenames only so an accidental future leak cannot enter CI logs.
    assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content), `Private key shipped: ${name}`);
    assert(!/Science_Learning_Hub_Accounts_2569\.xlsx/i.test(content), `Private account workbook reference shipped: ${name}`);
    assert(!/\b(?:SpreadsheetApp|PropertiesService|LockService)\s*\./.test(content), `Server implementation shipped: ${name}`);
    assert(!/"type"\s*:\s*"service_account"/.test(content), `Service account credentials shipped: ${name}`);
    assert(!/\bconst\s+USERS\s*=|\bpw\s*===\s*['"]|\bpassword\s*===\s*['"]/.test(content), `Embedded account directory or password shipped: ${name}`);
    assert(!/id="login(?:User|Pass)"[^>]*\bvalue="[^"]+"/.test(content), `Prefilled login credential shipped: ${name}`);
    checked++;
  }
  assert(checked > 0);
  await execute(process.execPath, [join(root, 'tests/deployment-regression.mjs'), output], {
    cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true,
  });
  t.diagnostic(`Checked ${files.length} build files and ${checked} textual files; original script/style order and bytes preserved in deployment.`);
  t.diagnostic(`Build retained locally: ${relative(root, output)}`);
});
