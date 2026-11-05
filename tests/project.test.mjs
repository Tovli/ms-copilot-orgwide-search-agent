import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, stat, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { zipSync } from 'fflate';
import { PNG } from 'pngjs';
import { parse as parseYaml } from 'yaml';
import {
  args, assertInstallationIdentity, build, exampleId, files, json, packageDirectory, readConfig, readInstallationIdentity, renderManifest, root,
  validateConfig, validateIcon, validateInvariants, validateLifecycle, validateManifests, validateSource, verifyBytes, verifyPackage,
} from '../scripts/project.mjs';
import { detectSensitive } from '../scripts/secrets.mjs';
import { envContent, main as configure } from '../scripts/configure.mjs';
import { main as stage } from '../scripts/build.mjs';
import { main as tenantPackage } from '../scripts/tenant-package.mjs';

const example = await readConfig();
const template = await json(path.join(root, 'appPackage/manifest.json'));
const pkg = await json(path.join(root, 'package.json'));
const manifest = renderManifest(template, example, pkg.version);
let agent, agentFile, suiteTemp;
before(async () => {
  suiteTemp = await mkdtemp(path.join(tmpdir(), 'org-search-test-'));
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@typespec/compiler/cmd/tsp.js'),
    'compile', 'src/agent/main.tsp', '--config', 'tspconfig.yaml', '--option',
    `@microsoft/typespec-m365-copilot.emitter-output-dir=${suiteTemp}`], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `Isolated test-fixture compilation failed; install dependencies with npm ci --ignore-scripts.\n${result.stderr}\n${result.stdout}`);
  agentFile = path.join(suiteTemp, 'declarativeAgent.json');
  agent = await json(agentFile);
});
after(async () => {
  if (!suiteTemp) return;
  assert(path.resolve(suiteTemp).startsWith(path.resolve(tmpdir()) + path.sep + 'org-search-test-'));
  await rm(suiteTemp, { recursive: true, force: true });
});

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'org-search-test-'));
  t.after(async () => {
    assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'org-search-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

const tenantConfig = () => ({ appId: '11111111-2222-4333-8444-555555555555', developer: {
  name: 'Synthetic Test', websiteUrl: 'https://docs.synthetic.io', privacyUrl: 'https://docs.synthetic.io/privacy', termsOfUseUrl: 'https://docs.synthetic.io/terms',
} });

async function tenantFixture(t) {
  const directory = await temporaryDirectory(t);
  const config = tenantConfig();
  const configFile = path.join(directory, 'deployment.json');
  const envFile = path.join(directory, '.env.dev');
  await writeFile(configFile, JSON.stringify(config));
  await writeFile(envFile, envContent(config));
  return { config, configFile, envFile, directory, outputDirectory: path.join(directory, 'staging'), agentFile };
}

test('official schemas validate generated native manifest pair', async () => {
  await validateSource();
  await validateManifests(manifest, agent);
  assert.equal(manifest.id, exampleId);
  assert.equal(manifest.version, pkg.version);
});

test('reject source scoping, web search and extra native capabilities', () => {
  for (const capability of [
    { name: 'OneDriveAndSharePoint', items_by_url: [] },
    { name: 'OneDriveAndSharePoint', items_by_sharepoint_ids: [] },
    { name: 'WebSearch' },
  ]) assert.throws(() => validateInvariants(manifest, { ...agent, capabilities: [capability] }));
  assert.throws(() => validateInvariants(manifest, { ...agent, capabilities: [...agent.capabilities, { name: 'People' }] }));
});

test('reject external actions, application auth and app permissions', () => {
  for (const property of ['actions', 'worker_agents', 'agent_skills', 'extensions', 'user_overrides']) assert.throws(() => validateInvariants(manifest, { ...agent, [property]: [] }));
  for (const property of ['webApplicationInfo', 'authorization', 'permissions', 'bots', 'composeExtensions']) assert.throws(() => validateInvariants({ ...manifest, [property]: {} }, agent));
  assert.throws(() => validateInvariants({ ...manifest, validDomains: ['example.com'] }, agent));
});

test('schema version URLs and grounding override cannot drift silently', () => {
  assert.throws(() => validateInvariants({ ...manifest, $schema: 'https://example.com/schema' }, agent));
  assert.throws(() => validateInvariants(manifest, { ...agent, $schema: 'https://example.com/schema' }));
  assert.throws(() => validateInvariants(manifest, { ...agent, behavior_overrides: undefined }));
  assert.throws(() => validateInvariants(manifest, { ...agent, behavior_overrides: { special_instructions: { discourage_model_knowledge: false } } }));
});

test('schema rejects unknown properties and invalid instruction length', async () => {
  await assert.rejects(validateManifests({ ...manifest, unexpected: true }, agent));
  await assert.rejects(validateManifests(manifest, { ...agent, instructions: 'x'.repeat(8001) }));
});

test('all requested conversation starters and English/Hebrew examples survive compilation', () => {
  assert.equal(agent.conversation_starters.length, 6);
  assert(agent.conversation_starters.some(item => /מצא מסמכים/.test(item.text)));
  for (const term of ['שיווק', 'סיום העסקה', 'Statement of Work', 'SOW', 'מסמך תכולת עבודה']) assert(agent.instructions.includes(term));
  assert(agent.instructions.includes('untrusted evidence'));
  assert(agent.instructions.includes('Never claim exhaustive'));
});

test('render configuration by values without injecting JSON or unresolved placeholders', () => {
  assert.equal(renderManifest(template, example, '2.3.4').version, '2.3.4');
  assert.throws(() => renderManifest({ title: '${{UNSUPPORTED}}' }, example, pkg.version));
});

test('tenant config requires own persistent identity and genuine HTTPS developer URLs', () => {
  assert.throws(() => validateConfig(example, { deployment: true }));
  const valid = { appId: '11111111-2222-4333-8444-555555555555', developer: { name: 'Synthetic Test', websiteUrl: 'https://docs.synthetic.io', privacyUrl: 'https://docs.synthetic.io/privacy', termsOfUseUrl: 'https://docs.synthetic.io/terms' } };
  assert.equal(validateConfig(valid, { deployment: true }), valid);
  assert(!envContent(valid).includes('undefined'));
  for (const invalid of ['http://docs.synthetic.io', 'https://name:pass@docs.synthetic.io', 'https://docs.synthetic.io/path?token=value', 'https://localhost', 'https://127.0.0.1', 'https://example.com.', 'https://example.com..']) {
    assert.throws(() => validateConfig({ ...valid, developer: { ...valid.developer, websiteUrl: invalid } }));
  }
});

test('configuration rejects secret fields, invalid IDs and environment injection', () => {
  assert.throws(() => validateConfig({ ...example, clientSecret: 'unused' }));
  assert.throws(() => validateConfig({ ...example, appId: 'not-a-uuid' }));
  assert.throws(() => validateConfig({ ...example, developer: { ...example.developer, name: 'Bad\nINJECT=value' } }));
  assert.throws(() => validateConfig({ ...example, developer: { ...example.developer, name: '${DANGEROUS}' } }));
  assert.throws(() => args(['--config', 'one.json', '--config', 'two.json'], ['--config']));
  assert.throws(() => args(['--output', '../outside'], ['--config']));
});

test('all tenant packaging routes reject a changed identity before writing output', async t => {
  const fixture = await tenantFixture(t);
  const changed = { ...fixture.config, appId: '99999999-2222-4333-8444-555555555555' };
  await writeFile(fixture.configFile, JSON.stringify(changed));
  await assert.rejects(build({ ...fixture, profile: 'tenant' }), /differs from the pinned/);
  await assert.rejects(stage(['--config', fixture.configFile], fixture), /differs from the pinned/);
  await assert.rejects(tenantPackage(['--config', fixture.configFile], fixture), /differs from the pinned/);
  await assert.rejects(configure(['--config', fixture.configFile], fixture), /differs from the pinned/);
  await assert.rejects(stat(fixture.outputDirectory), { code: 'ENOENT' });
  assert.equal((await readInstallationIdentity(fixture)).appId, fixture.config.appId);
});

test('tenant staging and packaging require a pinned installation environment', async t => {
  const fixture = await tenantFixture(t);
  fixture.envFile = path.join(fixture.directory, 'missing.env');
  await assert.rejects(build({ ...fixture, profile: 'tenant' }), /Missing pinned installation identity/);
  await assert.rejects(stage(['--config', fixture.configFile], fixture), /Missing pinned installation identity/);
  await assert.rejects(tenantPackage(['--config', fixture.configFile], fixture), /Missing pinned installation identity/);
  await assert.rejects(stat(fixture.outputDirectory), { code: 'ENOENT' });
});

test('malformed, absent, duplicate or synthetic pinned identities cannot be silently replaced', async t => {
  const fixture = await tenantFixture(t);
  for (const invalid of ['', 'OTHER=value\n', 'TEAMS_APP_ID=not-an-id\n', `TEAMS_APP_ID=${exampleId}\n`, `${envContent(fixture.config)}TEAMS_APP_ID=${fixture.config.appId}\n`]) {
    await writeFile(fixture.envFile, invalid);
    await assert.rejects(assertInstallationIdentity(fixture.config, fixture));
    await assert.rejects(configure(['--config', fixture.configFile], fixture));
    assert.equal(await readFile(fixture.envFile, 'utf8'), invalid);
  }
});

test('configure enrolls a new identity once and refreshes metadata without discarding Toolkit state', async t => {
  const fixture = await tenantFixture(t);
  fixture.envFile = path.join(fixture.directory, 'new.env');
  await configure(['--config', fixture.configFile], fixture);
  await writeFile(fixture.envFile, `${envContent(fixture.config)}M365_TITLE_ID=synthetic-title\n`);
  if (process.platform !== 'win32') await chmod(fixture.envFile, 0o644);
  await configure(['--config', fixture.configFile], fixture);
  assert.match(await readFile(fixture.envFile, 'utf8'), /^M365_TITLE_ID=synthetic-title$/m);
  assert.equal((await readInstallationIdentity(fixture)).appId, fixture.config.appId);
  if (process.platform !== 'win32') assert.equal((await stat(fixture.envFile)).mode & 0o777, 0o600);
});

test('staging reports an actionable error for absent compiled output', async t => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(build({ agentFile: path.join(directory, 'missing.json'), outputDirectory: path.join(directory, 'staging') }), /Run npm run compile/);
});

test('icons enforce platform sizes and white transparent outline artwork', async () => {
  validateIcon(await readFile(path.join(root, 'appPackage/color.png')), 192);
  validateIcon(await readFile(path.join(root, 'appPackage/outline.png')), 32, true);
  const wrong = new PNG({ width: 32, height: 32 });
  wrong.data.fill(255);
  assert.throws(() => validateIcon(PNG.sync.write(wrong), 192));
  assert.throws(() => validateIcon(PNG.sync.write(wrong), 32, true));
  wrong.data.fill(0);
  assert.throws(() => validateIcon(PNG.sync.write(wrong), 32, true));
});

test('package is deterministic, contains exactly required root files, and preserves unscoped native retrieval', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'org-search-test-'));
  try {
    const built = await build({ agentFile, outputDirectory: path.join(temp, 'staging') });
    const first = await packageDirectory(built.directory, path.join(temp, 'first.zip'));
    const second = await packageDirectory(built.directory, path.join(temp, 'second.zip'));
    assert.equal(first.sha256, second.sha256);
    const verified = await verifyBytes(await readFile(first.output));
    assert.deepEqual(verified.files, files);
    assert.deepEqual(verified.agent.capabilities, [{ name: 'OneDriveAndSharePoint' }]);
  } finally {
    assert(path.resolve(temp).startsWith(path.resolve(tmpdir()) + path.sep + 'org-search-test-'));
    await rm(temp, { recursive: true, force: true });
  }
});

test('ZIP verifier rejects traversal paths, extra contents and missing files', async () => {
  await assert.rejects(verifyBytes(zipSync({ '../manifest.json': new Uint8Array() })), /unsafe ZIP path/);
  await assert.rejects(verifyBytes(zipSync({ 'manifest.json': new Uint8Array() })), /missing required files/);
  await assert.rejects(verifyBytes(zipSync({ 'token.txt': new Uint8Array() })), /unsafe ZIP path/);
});

test('tenant package verification checks pinned identity, publisher and independent approved identity', async t => {
  const fixture = await tenantFixture(t);
  const built = await build({ ...fixture, profile: 'tenant' });
  const output = path.join(fixture.directory, 'tenant.zip');
  await packageDirectory(built.directory, output);
  const verified = await verifyPackage(output, { ...fixture, profile: 'tenant', expectedAppId: fixture.config.appId });
  assert.equal(verified.profile, 'tenant');
  assert.equal(verified.checksumVerified, true);
  await assert.rejects(verifyPackage(output, { ...fixture, profile: 'tenant', expectedAppId: '99999999-2222-4333-8444-555555555555' }), /independently approved release identity/);
  await writeFile(fixture.envFile, envContent({ ...fixture.config, appId: '99999999-2222-4333-8444-555555555555' }));
  await assert.rejects(verifyPackage(output, { ...fixture, profile: 'tenant' }), /differs from the pinned/);
  await writeFile(fixture.envFile, envContent(fixture.config));
  const packagedManifest = await json(path.join(built.directory, 'manifest.json'));
  packagedManifest.developer.name = 'Different Publisher';
  await writeFile(path.join(built.directory, 'manifest.json'), JSON.stringify(packagedManifest));
  await packageDirectory(built.directory, output);
  await assert.rejects(verifyPackage(output, { ...fixture, profile: 'tenant' }), /publisher metadata differs/);
});

test('a synthetic ZIP renamed as a tenant artifact cannot pass tenant acceptance', async t => {
  const fixture = await tenantFixture(t);
  const built = await build({ agentFile, outputDirectory: fixture.outputDirectory });
  const output = path.join(fixture.directory, 'renamed-tenant.zip');
  await packageDirectory(built.directory, output);
  await assert.rejects(verifyPackage(output, { ...fixture, profile: 'tenant' }), /example|synthetic|persistent appId/);
  const result = await verifyPackage(output);
  assert.equal(result.profile, 'validation');
  const ambiguous = spawnSync(process.execPath, ['scripts/verify-package.mjs', '--package', output], { cwd: root, encoding: 'utf8' });
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /requires --profile/);
  const cli = spawnSync(process.execPath, ['scripts/verify-package.mjs', '--profile', 'validation', '--package', output], { cwd: root, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /VALIDATION ONLY.*NOT FOR DEPLOYMENT/);
});

test('package verification requires a matching checksum and exact sidecar filename', async t => {
  const directory = await temporaryDirectory(t);
  const built = await build({ agentFile, outputDirectory: path.join(directory, 'staging') });
  const output = path.join(directory, 'validation.zip');
  await packageDirectory(built.directory, output);
  const checksum = await readFile(`${output}.sha256`, 'utf8');
  await rm(`${output}.sha256`);
  await assert.rejects(verifyPackage(output), /checksum sidecar is missing/);
  await writeFile(`${output}.sha256`, checksum.replace('validation.zip', 'other.zip'));
  await assert.rejects(verifyPackage(output), /this ZIP filename/);
  await writeFile(`${output}.sha256`, checksum.replace(/^[a-f0-9]+/, '0'.repeat(64)));
  await assert.rejects(verifyPackage(output), /checksum does not match/);
  await writeFile(`${output}.sha256`, checksum);
  await writeFile(output, Buffer.concat([await readFile(output), Buffer.from([0])]));
  await assert.rejects(verifyPackage(output), /checksum does not match/);
});

test('package bytes are reproducible across UTC, Jerusalem and Los Angeles timezones', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'org-search-test-'));
  try {
    const built = await build({ agentFile, outputDirectory: path.join(temp, 'staging') });
    const digests = ['UTC', 'Asia/Jerusalem', 'America/Los_Angeles'].map((timezone, index) => {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e',
        "import { packageDirectory } from './scripts/project.mjs'; const result = await packageDirectory(process.argv[1], process.argv[2]); console.log(result.sha256);",
        built.directory, path.join(temp, `${index}.zip`)], { cwd: root, env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    });
    assert.equal(new Set(digests).size, 1, 'Artifact digest must not depend on builder timezone');
  } finally {
    assert(path.resolve(temp).startsWith(path.resolve(tmpdir()) + path.sep + 'org-search-test-'));
    await rm(temp, { recursive: true, force: true });
  }
});

test('secret scanner catches private key and token patterns without disclosing their value', () => {
  assert(detectSensitive(['-----BEGIN ', 'PRIVATE KEY-----'].join('')));
  assert(detectSensitive(['ghp_', 'a'.repeat(36)].join('')));
  assert(!detectSensitive('client_secret=${LOCAL_SECRET}'));
  assert(!detectSensitive('Native OneDriveAndSharePoint'));
});

test('Toolkit lifecycle stages compiled files before personal-only publication', async () => {
  const lifecycle = await readFile(path.join(root, 'm365agents.yml'), 'utf8');
  const actions = [...lifecycle.matchAll(/^\s+- uses: (.+)$/gm)].map(match => match[1].trim());
  assert.deepEqual(actions, ['cli/runNpmCommand', 'cli/runNpmCommand', 'teamsApp/zipAppPackage', 'teamsApp/validateAppPackage', 'copilotAgent/publish']);
  assert.match(lifecycle, /args: run compile[\s\S]*args: run stage -- --config local\/deployment\.json[\s\S]*manifestPath: \.\/dist\/tenant\/appPackage\/manifest\.json/);
  assert.match(lifecycle, /^\s+scope: personal$/m);
  assert(!/^publish:|scope:\s*(?:tenant|shared)|teamsApp\/update|aadApp\//m.test(lifecycle));
  assert.equal(pkg.scripts.stage, 'node scripts/build.mjs');
  const parsed = parseYaml(lifecycle);
  await validateLifecycle(parsed);
  const tenantScope = structuredClone(parsed);
  tenantScope.provision.at(-1).with.scope = 'tenant';
  await assert.rejects(validateLifecycle(tenantScope));
  await assert.rejects(validateLifecycle({ ...parsed, publish: parsed.provision }));
  const sourceManifest = structuredClone(parsed);
  sourceManifest.provision[2].with.manifestPath = './appPackage/manifest.json';
  await assert.rejects(validateLifecycle(sourceManifest));
});
