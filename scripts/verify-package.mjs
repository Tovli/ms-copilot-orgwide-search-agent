import assert from 'node:assert/strict';
import path from 'node:path';
import { args, defaultPackage, isMain, reportError, root, verifyPackage } from './project.mjs';
export async function main(argv = process.argv.slice(2)) {
  const options = args(argv, ['--package', '--profile', '--config', '--expected-app-id']);
  assert(!(options['--package'] || options['--config'] || options['--expected-app-id']) || options['--profile'], 'An explicit package or deployment identity requires --profile validation or --profile tenant; tenant acceptance also requires --config.');
  const profile = options['--profile'] ?? 'validation';
  const filename = options['--package'] ? path.resolve(root, options['--package']) : await defaultPackage(profile);
  const result = await verifyPackage(filename, { profile, configFile: options['--config'], expectedAppId: options['--expected-app-id'] });
  const purpose = result.profile === 'tenant' ? 'TENANT artifact: identity and publisher match the pinned installation' : 'VALIDATION ONLY — NOT FOR DEPLOYMENT';
  console.log(`${purpose}\nPASS: recorded checksum, ZIP structure, schema, icons, native-only permissions and references\nFiles: ${result.files.join(', ')}\nSHA-256: ${result.sha256}`);
}
if (isMain(import.meta.url)) main().catch(reportError);
