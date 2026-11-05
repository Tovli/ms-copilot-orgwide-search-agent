import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv-draft-04';
import Ajv07 from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { zipSync, unzipSync } from 'fflate';
import { PNG } from 'pngjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const files = ['color.png', 'declarativeAgent.json', 'manifest.json', 'outline.png'];
export const exampleId = '00000000-0000-4000-8000-000000000001';
export const installationEnv = path.join(root, 'env/.env.dev');
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const json = async p => JSON.parse(await readFile(p, 'utf8'));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const isMain = url => process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === url;
export const reportError = error => { console.error(error.message); process.exitCode = 1; };

export function args(argv, allowed = []) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.includes(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--') || parsed[argv[i]]) throw new Error('Invalid or duplicate command argument');
    parsed[argv[i]] = argv[i + 1];
  }
  return parsed;
}

function exactKeys(object, expected, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label} must be an object`);
  assert.deepEqual(Object.keys(object).sort(), [...expected].sort(), `${label} has missing or unsupported keys`);
}

export function validateConfig(config, { deployment = false } = {}) {
  exactKeys(config, ['appId', 'developer'], 'Configuration');
  assert(typeof config.appId === 'string' && uuidV4.test(config.appId), 'appId must be a persistent UUID v4 generated for this installation');
  exactKeys(config.developer, ['name', 'websiteUrl', 'privacyUrl', 'termsOfUseUrl'], 'developer');
  for (const [key, value] of Object.entries(config.developer)) {
    assert(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= (key === 'name' ? 32 : 2048), `Invalid developer.${key}`);
    assert(!/[\u0000-\u001f\u007f\u2028\u2029]/u.test(value) && !value.includes('$') && !value.includes('"') && !value.includes('\\'), `Unsafe developer.${key}`);
    if (key !== 'name') {
      let url;
      try { url = new URL(value); } catch { throw new Error(`Invalid developer.${key} URL`); }
      assert(url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search && url.hostname.includes('.') && !url.hostname.endsWith('.') && !/^(localhost|127\.|0\.|\[)/i.test(url.hostname), `developer.${key} must be a public HTTPS URL without credentials, query, fragment, or trailing-dot hostname`);
      if (deployment) assert(!/(^|\.)(example\.(com|org|net)|invalid|test|localhost)$/i.test(url.hostname), 'Replace example developer URLs before tenant packaging');
    }
  }
  if (deployment) assert(config.appId.toLowerCase() !== exampleId, 'Generate your own persistent appId before tenant packaging');
  return config;
}

export async function readConfig(filename = 'config/deployment.example.json', options) {
  let config;
  try { config = await json(path.resolve(root, filename)); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error('Invalid deployment configuration JSON (contents redacted)');
    throw error;
  }
  return validateConfig(config, options);
}

export async function readInstallationIdentity({ envFile = installationEnv, allowMissing = false } = {}) {
  let contents;
  try { contents = await readFile(envFile, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (allowMissing) return { appId: null, contents: '' };
    throw new Error('Missing pinned installation identity in env/.env.dev. Restore the approved installation environment; run configure only when enrolling a new installation.');
  }
  const assignments = [...contents.matchAll(/^\s*(?:export\s+)?TEAMS_APP_ID\s*=\s*([^\r\n]*)$/gm)];
  assert.equal(assignments.length, 1, 'Existing installation environment must contain exactly one valid TEAMS_APP_ID; restore its approved identity rather than generating a new one.');
  const value = assignments[0][1].trim();
  const appId = /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value;
  assert(uuidV4.test(appId) && appId.toLowerCase() !== exampleId, 'Existing installation environment has an invalid or synthetic TEAMS_APP_ID; restore the approved identity.');
  return { appId, contents };
}

export async function assertInstallationIdentity(config, options = {}) {
  const installation = await readInstallationIdentity(options);
  assert(!installation.appId || installation.appId.toLowerCase() === config.appId.toLowerCase(), 'Deployment configuration appId differs from the pinned env/.env.dev identity. Restore the approved appId; use a separate checkout for a new installation.');
  return installation;
}

export function renderManifest(template, config, version) {
  const values = {
    TEAMS_APP_ID: config.appId,
    DEVELOPER_NAME: config.developer.name,
    DEVELOPER_WEBSITE_URL: config.developer.websiteUrl,
    DEVELOPER_PRIVACY_URL: config.developer.privacyUrl,
    DEVELOPER_TERMS_URL: config.developer.termsOfUseUrl,
  };
  function visit(value) {
    if (typeof value === 'string') return value.replace(/\$\{\{([A-Z_]+)\}\}/g, (_, key) => {
      assert(Object.hasOwn(values, key), `Unsupported manifest placeholder ${key}`);
      return values[key];
    });
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    return value;
  }
  const manifest = visit(template);
  manifest.version = version;
  assert(!JSON.stringify(manifest).includes('${'), 'Unresolved manifest placeholder');
  return manifest;
}

let validators;
async function schemaValidators() {
  if (validators) return validators;
  const options = { allErrors: true, strict: false, validateFormats: true };
  const ajv = new Ajv(options);
  const ajv07 = new Ajv07(options);
  addFormats(ajv);
  addFormats(ajv07);
  const provenance = await json(path.join(root, 'schemas/provenance.json'));
  validators = {};
  for (const entry of provenance.schemas) {
    const bytes = await readFile(path.join(root, 'schemas', entry.file));
    assert.equal(sha256(bytes), entry.sha256, `Vendored schema integrity mismatch: ${entry.file}`);
    validators[entry.kind] = (entry.kind === 'toolkit' ? ajv07 : ajv).compile(JSON.parse(bytes));
  }
  return validators;
}

export function validateInvariants(manifest, agent) {
  assert.equal(manifest.manifestVersion, '1.30', 'Unsupported app manifest schema');
  assert.equal(manifest.$schema, 'https://developer.microsoft.com/en-us/json-schemas/teams/v1.30/MicrosoftTeams.schema.json', 'App schema URL must match its selected version');
  assert.equal(agent.version, 'v1.5', 'Stable TypeSpec emitter schema changed; review schema/toolkit compatibility');
  assert.equal(agent.$schema, 'https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.5/schema.json', 'Agent schema URL must match the stable emitter version');
  assert.equal(manifest.name.short, 'Org Document Search');
  assert.equal(agent.name, 'Org Document Search');
  assert.deepEqual(manifest.copilotAgents, { declarativeAgents: [{ id: 'orgDocumentSearch', file: 'declarativeAgent.json' }] }, 'App must reference exactly one local declarative agent');
  assert.deepEqual(manifest.icons, { color: 'color.png', outline: 'outline.png' });
  assert.deepEqual(agent.capabilities, [{ name: 'OneDriveAndSharePoint' }], 'Only the native unscoped OneDriveAndSharePoint capability is allowed');
  assert.deepEqual(agent.behavior_overrides, { special_instructions: { discourage_model_knowledge: true } }, 'Source-grounding behavior override must remain enabled');
  for (const property of ['actions', 'worker_agents', 'agent_skills', 'user_overrides', 'editorial_answers', 'extensions']) assert(!Object.hasOwn(agent, property), `Unsupported agent surface ${property}`);
  for (const property of ['webApplicationInfo', 'authorization', 'bots', 'composeExtensions', 'staticTabs', 'configurableTabs', 'permissions']) assert(!Object.hasOwn(manifest, property), `Unnecessary app capability or permission ${property}`);
  assert(!manifest.validDomains || manifest.validDomains.length === 0, 'External application domains are unnecessary');
  assert(typeof agent.instructions === 'string' && agent.instructions.length > 0 && agent.instructions.length <= 8000, 'Instructions must fit the supported 8000-character limit');
  assert(agent.conversation_starters.length === 6, 'Keep all six requested conversation starters');
  assert(agent.conversation_starters.some(starter => /[\u0590-\u05ff]/u.test(starter.text)), 'Hebrew conversation starter is required');
  assert(agent.instructions.includes('שיווק') && agent.instructions.includes('Statement of Work'), 'English and Hebrew semantic examples are required');
  assert(!/items_by_url|items_by_sharepoint_ids|https:\/\/[^\s"]+\.sharepoint\.com/i.test(JSON.stringify({ manifest, agent })), 'Tenant source restriction or hard-coded source URL');
}

export async function validateManifests(manifest, agent) {
  const compiled = await schemaValidators();
  for (const [name, data] of [['app', manifest], ['agent', agent]]) {
    const validate = compiled[name];
    assert(validate(data), `${name} schema validation failed: ${JSON.stringify(validate.errors)}`);
  }
  validateInvariants(manifest, agent);
}

export function validateIcon(bytes, size, outline = false) {
  const png = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
  assert(png.width === size && png.height === size, `Icon must be ${size}x${size}`);
  let visible = 0;
  let transparent = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b, a] = png.data.subarray(i, i + 4);
    if (a) {
      visible++;
      if (outline) assert(r === 255 && g === 255 && b === 255, 'Outline icon visible pixels must be white');
    } else transparent++;
  }
  assert(visible > size, 'Icon must contain visible artwork');
  if (outline) assert(transparent > 0, 'Outline icon must have a transparent background');
}

export async function validateDirectory(directory) {
  assert.deepEqual((await readdir(directory)).sort(), files, 'Package staging directory must contain exactly the four required files');
  const manifest = await json(path.join(directory, 'manifest.json'));
  const agent = await json(path.join(directory, 'declarativeAgent.json'));
  await validateManifests(manifest, agent);
  validateIcon(await readFile(path.join(directory, 'color.png')), 192);
  validateIcon(await readFile(path.join(directory, 'outline.png')), 32, true);
  return { manifest, agent };
}

export async function validateSource() {
  const template = await json(path.join(root, 'appPackage/manifest.json'));
  const pkg = await json(path.join(root, 'package.json'));
  assert.equal(template.version, pkg.version, 'Source manifest version must match package.json; update both for releases');
  assert.equal(template.id, '${{TEAMS_APP_ID}}', 'Source app ID must remain a deployment placeholder');
  assert.deepEqual(template.developer, {
    name: '${{DEVELOPER_NAME}}',
    websiteUrl: '${{DEVELOPER_WEBSITE_URL}}',
    privacyUrl: '${{DEVELOPER_PRIVACY_URL}}',
    termsOfUseUrl: '${{DEVELOPER_TERMS_URL}}',
  }, 'Source developer identity and URLs must remain deployment placeholders');
  const config = await readConfig();
  assert.equal(config.appId, exampleId, 'Public example must use the documented synthetic app ID');
  const main = await readFile(path.join(root, 'src/agent/main.tsp'), 'utf8');
  assert(!/items_by_url|items_by_sharepoint_ids|ItemsByUrl|ItemsBySharePointIds|\.sharepoint\.com/i.test(main), 'TypeSpec source must not contain tenant source restrictions');
  assert.equal((main.match(/AgentCapabilities\./g) ?? []).length, 1, 'TypeSpec source must declare only one capability');
  assert(main.includes('AgentCapabilities.OneDriveAndSharePoint;'), 'Source must preserve unscoped native capability');
  await validateLifecycle(parseYaml(await readFile(path.join(root, 'm365agents.yml'), 'utf8'), { maxAliasCount: 0, uniqueKeys: true }));
}

export async function validateLifecycle(lifecycle) {
  const compiled = await schemaValidators();
  assert(compiled.toolkit(lifecycle), `Toolkit lifecycle schema validation failed: ${JSON.stringify(compiled.toolkit.errors)}`);
  exactKeys(lifecycle, ['version', 'environmentFolderPath', 'provision'], 'Toolkit lifecycle');
  assert.equal(lifecycle.version, 'v1.12');
  assert.equal(lifecycle.environmentFolderPath, './env');
  assert.deepEqual(lifecycle.provision, [
    { uses: 'cli/runNpmCommand', with: { args: 'run compile' } },
    { uses: 'cli/runNpmCommand', with: { args: 'run stage -- --config local/deployment.json' } },
    { uses: 'teamsApp/zipAppPackage', with: {
      manifestPath: './dist/tenant/appPackage/manifest.json',
      outputZipPath: './appPackage/build/appPackage.${{TEAMSFX_ENV}}.zip',
      outputFolder: './appPackage/build',
    } },
    { uses: 'teamsApp/validateAppPackage', with: { appPackagePath: './appPackage/build/appPackage.${{TEAMSFX_ENV}}.zip' } },
    { uses: 'copilotAgent/publish', with: { appPackagePath: './appPackage/build/appPackage.${{TEAMSFX_ENV}}.zip', scope: 'personal' },
      writeToEnvironmentFile: { titleId: 'M365_TITLE_ID', appId: 'M365_APP_ID', shareLink: 'SHARE_LINK' } },
  ], 'Toolkit lifecycle must compile, stage, package, validate and publish only the configured personal agent');
}

export async function build({ configFile = 'config/deployment.example.json', profile = 'validation', envFile = installationEnv,
  agentFile = path.join(root, 'appPackage/.generated/declarativeAgent.json'), outputDirectory } = {}) {
  assert(['validation', 'tenant'].includes(profile), 'Invalid build profile');
  const config = await readConfig(configFile, { deployment: profile === 'tenant' });
  if (profile === 'tenant') await assertInstallationIdentity(config, { envFile });
  const pkg = await json(path.join(root, 'package.json'));
  const manifest = renderManifest(await json(path.join(root, 'appPackage/manifest.json')), config, pkg.version);
  let agent;
  try { agent = await json(agentFile); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Compiled agent manifest is missing. Run npm run compile before staging a package.');
    throw error;
  }
  await validateSource();
  await validateManifests(manifest, agent);
  const directory = outputDirectory ?? path.join(root, 'dist', profile, 'appPackage');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(directory, 'declarativeAgent.json'), `${JSON.stringify(agent, null, 2)}\n`);
  for (const file of ['color.png', 'outline.png']) await writeFile(path.join(directory, file), await readFile(path.join(root, 'appPackage', file)));
  await validateDirectory(directory);
  return { directory, version: pkg.version, profile };
}

export async function packageDirectory(directory, output) {
  await validateDirectory(directory);
  const entries = {};
  // ZIP stores local DOS date fields, without a timezone. Construct a fixed local
  // wall-clock date so builders in different timezones emit identical bytes.
  for (const filename of files) entries[filename] = [new Uint8Array(await readFile(path.join(directory, filename))), { mtime: new Date(2000, 0, 1, 0, 0, 0) }];
  const zip = zipSync(entries, { level: 9 });
  await verifyBytes(zip);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, zip);
  await writeFile(`${output}.sha256`, `${sha256(zip)}  ${path.basename(output)}\n`);
  return { bytes: zip.length, sha256: sha256(zip), output };
}

export async function verifyBytes(bytes) {
  assert(bytes.length < 10 * 1024 * 1024, 'Package exceeds the 10 MB safety limit');
  const seen = new Set();
  const entries = unzipSync(bytes, { filter: entry => {
    assert(files.includes(entry.name), 'Unexpected or unsafe ZIP path');
    assert(!seen.has(entry.name), 'Duplicate ZIP path');
    assert(entry.originalSize < 1024 * 1024, 'ZIP entry exceeds safety limit');
    seen.add(entry.name);
    return true;
  } });
  assert.deepEqual(Object.keys(entries).sort(), files, 'ZIP is missing required files');
  const parse = file => JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(entries[file]));
  const manifest = parse('manifest.json');
  const agent = parse('declarativeAgent.json');
  await validateManifests(manifest, agent);
  validateIcon(entries['color.png'], 192);
  validateIcon(entries['outline.png'], 32, true);
  return { manifest, agent, files: Object.keys(entries).sort(), sha256: sha256(bytes) };
}

export async function verifyPackage(filename, { profile = 'validation', configFile, envFile = installationEnv, expectedAppId } = {}) {
  assert(['validation', 'tenant'].includes(profile), 'Verification profile must be validation or tenant');
  if (profile === 'validation') assert(!configFile && !expectedAppId, 'Deployment identity arguments require --profile tenant');
  const bytes = await readFile(filename);
  let checksum;
  try { checksum = await readFile(`${filename}.sha256`, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Package checksum sidecar is missing; obtain the .zip.sha256 file from the package producer.');
    throw error;
  }
  const recorded = checksum.match(/^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i);
  assert(recorded && recorded[2] === path.basename(filename), 'Checksum sidecar must contain exactly the digest and this ZIP filename');
  assert.equal(recorded[1].toLowerCase(), sha256(bytes), 'Package checksum does not match the recorded sidecar');
  const result = await verifyBytes(bytes);
  if (profile === 'tenant') {
    assert(configFile, 'Tenant verification requires --config local/deployment.json');
    const config = await readConfig(configFile, { deployment: true });
    await assertInstallationIdentity(config, { envFile });
    validateConfig({ appId: result.manifest.id, developer: result.manifest.developer }, { deployment: true });
    assert.equal(result.manifest.id.toLowerCase(), config.appId.toLowerCase(), 'Package app identity differs from the approved deployment configuration');
    assert.deepEqual(result.manifest.developer, config.developer, 'Package publisher metadata differs from the deployment configuration');
    if (expectedAppId) {
      assert(uuidV4.test(expectedAppId), '--expected-app-id must be a UUID v4 from the approved release record');
      assert.equal(result.manifest.id.toLowerCase(), expectedAppId.toLowerCase(), 'Package app identity differs from the independently approved release identity');
    }
  }
  return { ...result, profile, checksumVerified: true };
}

export async function defaultPackage(profile = 'validation') {
  const pkg = await json(path.join(root, 'package.json'));
  return path.join(root, 'dist', profile, `org-document-search-${pkg.version}.zip`);
}
