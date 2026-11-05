import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { isMain, reportError, root } from './project.mjs';

export function detectSensitive(text) {
  if ([
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{30,}\b/,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    /\bAKIA[A-Z0-9]{16}\b/,
  ].some(pattern => pattern.test(text))) return true;

  // JSON camelCase and environment variable names are both common in Entra
  // projects. Capture the complete value, including '~' and other punctuation,
  // rather than assuming credentials contain only base64-like characters.
  const assignments = /["'`]?\b(?:[a-z0-9]+[_-])*(?:client[_-]?secret|access[_-]?token|refresh[_-]?token|password)["'`]?\s*[:=]\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|\x60([^\x60\r\n]*)\x60|([^\s,;#`]+))/gi;
  const isCredentialValue = raw => {
    const value = raw.trim();
    const placeholder = /^(?:\$\{[^{}]+\}|\$\{\{[^{}]+\}\}|<[^<>]+>|SECRET_(?:MY|YOUR)_[A-Z0-9_]+|example|placeholder|changeme)$/i.test(value);
    return !placeholder && value.length >= 20;
  };
  for (const match of text.matchAll(assignments)) {
    if (isCredentialValue(match[1] ?? match[2] ?? match[3] ?? match[4])) return true;
  }
  const elements = /<(client[_-]?secret|access[_-]?token|refresh[_-]?token|password)>\s*([^<\r\n]+)\s*<\/\1>/gi;
  for (const match of text.matchAll(elements)) {
    if (isCredentialValue(match[2])) return true;
  }
  return false;
}

export async function scanRepository(directory = root) {
  // Git determines publishable files: include ALL tracked files even when an
  // ignore rule would hide them, plus untracked, nonignored contributor files.
  // In particular, committed .env examples must never be skipped by filename.
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: directory, encoding: 'utf8' });
  assert(!listing.error && listing.status === 0, 'Cannot enumerate repository files for credential scanning');
  const base = path.resolve(directory);
  let checked = 0;
  for (const relative of new Set(listing.stdout.split('\0').filter(Boolean))) {
    const filename = path.resolve(base, relative);
    assert(filename.startsWith(base + path.sep), 'Unsafe repository file path');
    let info;
    try { info = await lstat(filename); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isFile()) continue; // Do not follow symlinks out of the checkout.
    assert(info.size < 2 * 1024 * 1024, `Source file exceeds credential-scan size limit: ${relative}`);
    const bytes = await readFile(filename);
    const utf16le = bytes[0] === 0xff && bytes[1] === 0xfe;
    const utf16be = bytes[0] === 0xfe && bytes[1] === 0xff;
    if (!utf16le && !utf16be && bytes.includes(0)) continue; // Binary artwork.
    if (utf16le || utf16be) assert((bytes.length - 2) % 2 === 0, `Invalid UTF-16 source text: ${relative}`);
    const content = utf16be ? Buffer.from(bytes.subarray(2)).swap16().toString('utf16le')
      : utf16le ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8');
    assert(!detectSensitive(content), `Potential credential found in ${relative}; contents redacted`);
    checked++;
  }
  return checked;
}

export async function main() {
  const checked = await scanRepository();
  console.log(`PASS: bounded credential-pattern scan (${checked} tracked/nonignored text files, including env examples). This does not establish GitHub scanning or push-protection status.`);
}
if (isMain(import.meta.url)) main().catch(reportError);
