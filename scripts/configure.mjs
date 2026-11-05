import assert from 'node:assert/strict';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { args, assertInstallationIdentity, installationEnv, isMain, readConfig, reportError } from './project.mjs';

export function envContent(config) {
  return [
    '# Generated locally. Keep this file private and retain TEAMS_APP_ID for upgrades.',
    `TEAMS_APP_ID=${config.appId}`,
    `DEVELOPER_NAME="${config.developer.name}"`,
    `DEVELOPER_WEBSITE_URL=${config.developer.websiteUrl}`,
    `DEVELOPER_PRIVACY_URL=${config.developer.privacyUrl}`,
    `DEVELOPER_TERMS_URL=${config.developer.termsOfUseUrl}`,
    '',
  ].join('\n');
}

export async function main(argv = process.argv.slice(2), { envFile = installationEnv } = {}) {
  const options = args(argv, ['--config']);
  assert(options['--config'], 'Supply --config local/deployment.json after replacing all example values');
  const config = await readConfig(options['--config'], { deployment: true });
  const filename = envFile;
  const { contents: previous } = await assertInstallationIdentity(config, { envFile, allowMissing: true });
  await mkdir(path.dirname(filename), { recursive: true });
  // Preserve identifiers written by Toolkit provisioning when refreshing metadata.
  const managed = new Set(['TEAMS_APP_ID', 'DEVELOPER_NAME', 'DEVELOPER_WEBSITE_URL', 'DEVELOPER_PRIVACY_URL', 'DEVELOPER_TERMS_URL']);
  const retained = (previous ?? '').split(/\r?\n/).filter(line => {
    const key = line.match(/^([A-Z_][A-Z0-9_]*)=/)?.[1];
    return key && !managed.has(key);
  });
  await writeFile(filename, envContent(config) + (retained.length ? `${retained.join('\n')}\n` : ''), { mode: 0o600 });
  await chmod(filename, 0o600);
  console.log('Created ignored env/.env.dev. No authentication, provisioning, consent, or publishing was performed.');
}
if (isMain(import.meta.url)) main().catch(reportError);
