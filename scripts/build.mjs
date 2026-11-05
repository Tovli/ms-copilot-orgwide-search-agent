import { args, build, isMain, reportError } from './project.mjs';
export async function main(argv = process.argv.slice(2), buildOptions = {}) {
  const options = args(argv, ['--config']);
  const result = await build({ ...buildOptions, ...(options['--config'] ? { configFile: options['--config'], profile: 'tenant' } : {}) });
  console.log(`Built ${result.profile} package staging: ${result.directory}`);
}
if (isMain(import.meta.url)) main().catch(reportError);
