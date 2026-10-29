import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleDir = resolve(root, 'bundle');
const frontendDir = resolve(root, 'frontend');
const push = process.argv.slice(2).includes('--push');
const unexpectedArgs = process.argv.slice(2).filter((arg) => arg !== '--push');

function runGit(args, cwd = root) {
  const result = spawnSync('git', args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function runProgram(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function hasStagedChanges(cwd, paths = ['.']) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet', '--', ...paths], {
    cwd,
    stdio: 'ignore',
  });
  if (result.error) throw result.error;
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(`git diff --cached failed with exit code ${result.status}`);
}

function copyWithMode(source, destination) {
  copyFileSync(source, destination);
  chmodSync(destination, statSync(source).mode & 0o777);
}

function writeGeneratedFile(path, contents) {
  writeFileSync(path, contents, 'utf8');
}

function commitBundleIfChanged() {
  runGit(['add', '-A'], bundleDir);
  if (!hasStagedChanges(bundleDir)) {
    console.log('Bundle output unchanged; nothing to commit.');
    return;
  }

  runGit(['commit', '-m', 'Build generated bundle'], bundleDir);
  console.log('Committed generated bundle output.');
}

function commitPointersIfChanged() {
  const paths = ['.gitmodules', 'backend', 'frontend', 'cli', 'bundle'];
  runGit(['add', '--', ...paths]);
  if (!hasStagedChanges(root, paths)) {
    console.log('Superproject pointers unchanged; nothing to commit.');
    return;
  }

  runGit(['commit', '-m', 'Update generated bundle pointers', '--', ...paths]);
  console.log('Committed updated superproject pointers.');
}

function assembleBundle() {
  const buildDir = resolve(frontendDir, 'dist/snip-frontend/browser');
  const indexPath = resolve(buildDir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`Expected Angular build output is missing: ${indexPath}`);
  }

  rmSync(resolve(bundleDir, 'public'), { recursive: true, force: true });
  cpSync(buildDir, resolve(bundleDir, 'public'), { recursive: true });
  copyWithMode(resolve(root, 'backend/server.js'), resolve(bundleDir, 'server.js'));
  copyWithMode(resolve(root, 'cli/cli.js'), resolve(bundleDir, 'cli.js'));

  writeGeneratedFile(resolve(bundleDir, '.env'), 'PUBLIC_DIR=./public\n');
  writeGeneratedFile(
    resolve(bundleDir, 'package.json'),
    `${JSON.stringify({
      name: 'snip-bundle',
      version: '1.0.0',
      private: true,
      scripts: { start: 'bun server.js' },
    }, null, 2)}\n`,
  );
  writeGeneratedFile(
    resolve(bundleDir, 'Dockerfile'),
    'FROM oven/bun:1-alpine\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD bun server.js\n',
  );
  writeGeneratedFile(
    resolve(bundleDir, '.dockerignore'),
    '.git\nnode_modules\nnpm-debug.log*\n.DS_Store\n',
  );
  writeGeneratedFile(
    resolve(bundleDir, 'railway.json'),
    `${JSON.stringify({
      '$schema': 'https://railway.app/railway.schema.json',
      build: { builder: 'DOCKERFILE' },
    }, null, 2)}\n`,
  );
}

function build() {
  if (unexpectedArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unexpectedArgs.join(', ')}`);
  }
  if (!existsSync(resolve(bundleDir, '.git'))) {
    throw new Error('The bundle submodule is not initialized.');
  }

  console.log('Updating backend, frontend, and cli submodules...');
  runGit(['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);

  console.log('Installing frontend dependencies...');
  runProgram(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], frontendDir);
  console.log('Building Angular frontend...');
  runProgram(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['ng', 'build'], frontendDir);

  console.log('Assembling bundle submodule...');
  assembleBundle();
  commitBundleIfChanged();
  commitPointersIfChanged();

  if (push) {
    runGit(['push', 'origin', 'HEAD:bundle'], bundleDir);
    runGit(['push', 'origin', 'main']);
  } else {
    console.log('Local only; pass --push to publish bundle and main.');
  }
}

try {
  build();
} catch (error) {
  console.error(`build-bundle: ${error.message}`);
  process.exitCode = 1;
}