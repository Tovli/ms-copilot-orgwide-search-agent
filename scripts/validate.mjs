import path from 'node:path';
import { args, isMain, reportError, root, validateDirectory, validateSource } from './project.mjs';
export async function main(argv = process.argv.slice(2)) {
  const options = args(argv, ['--directory']);
  await validateSource();
  await validateDirectory(path.resolve(root, options['--directory'] ?? 'dist/validation/appPackage'));
  console.log('PASS: official offline app/agent/Toolkit lifecycle schemas, source scope, permissions, references, instructions, and icons');
}
if (isMain(import.meta.url)) main().catch(reportError);
