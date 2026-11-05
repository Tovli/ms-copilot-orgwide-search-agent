import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { args, assertInstallationIdentity, build, defaultPackage, installationEnv, isMain, packageDirectory, readConfig, reportError, root } from './project.mjs';
export async function main(argv = process.argv.slice(2), { envFile = installationEnv } = {}) {
  const options = args(argv, ['--config']);
  assert(options['--config'], 'Supply --config local/deployment.json');
  const config = await readConfig(options['--config'], { deployment: true });
  await assertInstallationIdentity(config, { envFile });
  // Invoke the installed compiler directly; do not concatenate configuration into shell code.
  const result = spawnSync(process.execPath, ['node_modules/@typespec/compiler/cmd/tsp.js', 'compile', 'src/agent/main.tsp', '--config', 'tspconfig.yaml'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'TypeSpec compilation failed');
  const built = await build({ configFile: options['--config'], profile: 'tenant', envFile });
  const packaged = await packageDirectory(built.directory, await defaultPackage('tenant'));
  console.log(`Packaged deployment-specific artifact (not published): ${packaged.output}\nSHA-256: ${packaged.sha256}`);
}
if (isMain(import.meta.url)) main().catch(reportError);
