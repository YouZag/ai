import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKSPACE_ROLES = new Set(['builder', 'designer', 'tester', 'auditor']);

export function needsWorkspace(role: string): boolean {
  return WORKSPACE_ROLES.has(role);
}

export interface WorkspaceConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  dir: string;
}

function run(command: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)),
    );
  });
}

async function installIfNeeded(dir: string): Promise<void> {
  const lockHash = createHash('sha1')
    .update(readFileSync(join(dir, 'package-lock.json')))
    .digest('hex');
  const marker = join(dir, 'node_modules', '.ai-lock-hash');
  if (existsSync(marker) && readFileSync(marker, 'utf8') === lockHash) return;
  await run('npm', ['ci'], dir);
  writeFileSync(marker, lockHash);
}

export async function prepareWorkspace(config: WorkspaceConfig): Promise<string> {
  const url = `https://x-access-token:${config.token}@github.com/${config.owner}/${config.repo}.git`;

  if (existsSync(join(config.dir, '.git'))) {
    await run('git', ['-C', config.dir, 'remote', 'set-url', 'origin', url]);
    await run('git', ['-C', config.dir, 'fetch', '--depth', '1', 'origin', config.branch]);
    await run('git', ['-C', config.dir, 'checkout', '-B', config.branch, `origin/${config.branch}`]);
    await run('git', ['-C', config.dir, 'reset', '--hard', `origin/${config.branch}`]);
    await run('git', ['-C', config.dir, 'clean', '-fd']);
  } else {
    await run('git', ['clone', '--depth', '1', '--branch', config.branch, url, config.dir]);
  }

  await run('git', ['-C', config.dir, 'config', 'user.name', 'AI Worker']);
  await run('git', ['-C', config.dir, 'config', 'user.email', 'worker@youzag.com']);
  await installIfNeeded(config.dir);
  return config.dir;
}
