import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectSensitive, scanRepository } from '../scripts/secrets.mjs';

// Deliberately synthetic strings, assembled so the source itself contains no
// plausible literal credential assignment for either local or hosted scanners.
const fakeSecret = () => ['Abc8Q', '~', 'synthetic-value-', '0'.repeat(20)].join('');

test('detects complete Entra-shaped values in JSON and environment assignments', () => {
  for (const key of ['client_secret', 'clientSecret', 'CLIENT_SECRET', 'AZURE_CLIENT_SECRET']) {
    for (const value of [fakeSecret(), `~${'z'.repeat(35)}`, `${'z'.repeat(35)}~`]) {
      assert(detectSensitive(`${key}=${value}`), key);
      assert(detectSensitive(JSON.stringify({ [key]: value })), key);
    }
  }
  assert(detectSensitive(JSON.stringify({ accessToken: fakeSecret() })));
  assert(detectSensitive(`refresh_token='${fakeSecret()}'`));
});

test('allows explicit placeholders but does not excuse values with placeholder prefixes', () => {
  for (const value of ['${LOCAL_SECRET}', '${{ SECRET_VALUE }}', '<YOUR_CLIENT_SECRET>', 'SECRET_MY_AAD_APP_CLIENT_SECRET', 'placeholder', 'changeme']) {
    assert(!detectSensitive(`clientSecret="${value}"`));
  }
  for (const prefix of ['example', 'placeholder', 'changeme']) {
    const value = prefix + fakeSecret();
    assert(detectSensitive(`clientSecret=${value}`));
  }
});

test('detects Markdown and XML credential values without treating placeholders as secrets', () => {
  const value = fakeSecret();
  const key = ['client', 'Secret'].join('');
  assert(detectSensitive(`\`${key}\` = \`${value}\``));
  assert(detectSensitive(`<${key}>${value}</${key}>`));
  assert(!detectSensitive(`<${key}>\${LOCAL_SECRET}</${key}>`));
});

test('scans publishable env examples and tracked ignored files without exposing values', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'org-search-secrets-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git('init', '--quiet');
    await mkdir(path.join(directory, 'env'));
    await writeFile(path.join(directory, '.gitignore'), 'env/.env.*\n!env/.env.*.example\nlocal/\n');
    const example = path.join(directory, 'env/.env.dev.example');
    await writeFile(example, `CLIENT_SECRET=${fakeSecret()}\n`);
    await assert.rejects(scanRepository(directory), error => error.message.includes('.env.dev.example') && !error.message.includes(fakeSecret()));
    await writeFile(example, 'CLIENT_SECRET=${LOCAL_SECRET}\n');
    await mkdir(path.join(directory, 'local'));
    await writeFile(path.join(directory, 'local/private.txt'), `clientSecret=${fakeSecret()}`);
    assert.equal(await scanRepository(directory), 2); // .gitignore plus safe env example.
    const trackedIgnored = path.join(directory, 'env/.env.dev');
    await writeFile(trackedIgnored, `clientSecret=${fakeSecret()}`);
    git('add', '--force', 'env/.env.dev');
    await assert.rejects(scanRepository(directory), /Potential credential/);
    await writeFile(trackedIgnored, 'CLIENT_SECRET=${LOCAL_SECRET}\n');
    assert.equal(await scanRepository(directory), 3);
    await writeFile(example, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`clientSecret=${fakeSecret()}`, 'utf16le')]));
    await assert.rejects(scanRepository(directory), /Potential credential/);
    const bigEndian = Buffer.from(`clientSecret=${fakeSecret()}`, 'utf16le').swap16();
    await writeFile(example, Buffer.concat([Buffer.from([0xfe, 0xff]), bigEndian]));
    await assert.rejects(scanRepository(directory), /Potential credential/);
  } finally {
    assert(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep + 'org-search-secrets-'));
    await rm(directory, { recursive: true, force: true });
  }
});
