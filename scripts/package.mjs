import path from 'node:path';
import { args, defaultPackage, isMain, packageDirectory, reportError, root } from './project.mjs';
export async function main(argv = process.argv.slice(2)) {
  args(argv);
  const result = await packageDirectory(path.join(root, 'dist/validation/appPackage'), await defaultPackage());
  console.log(`Packaged validation-only example: ${result.output}\nSHA-256: ${result.sha256}`);
}
if (isMain(import.meta.url)) main().catch(reportError);
