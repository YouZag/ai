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
    await run('git', ['-C', config.dir, 'fetch', 'origin', config.branch]);
    await run('git', ['-C', config.dir, 'checkout', '-B', config.branch, `origin/${config.branch}`]);
    await run('git', ['-C', config.dir, 'reset', '--hard', `origin/${config.branch}`]);
    await run('git', ['-C', config.dir, 'clean', '-fd']);
  } else {
    await run('git', ['clone', '--branch', config.branch, url, config.dir]);
  }

  await run('git', ['-C', config.dir, 'config', 'user.name', 'AI Worker']);
  await run('git', ['-C', config.dir, 'config', 'user.email', 'worker@youzag.com']);
  await installIfNeeded(config.dir);
  return config.dir;
}

function capture(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export interface IntegrateConfig {
  dir: string;
  branch: string;
  message: string;
  verify?: string[][];
  maxPushAttempts?: number;
}

export interface IntegrateResult {
  ok: boolean;
  sha?: string;
  reason?: string;
}

export async function integrateWork(config: IntegrateConfig): Promise<IntegrateResult> {
  const { dir, branch } = config;
  const verify = config.verify ?? [['npm', 'run', 'build']];
  const maxPushAttempts = config.maxPushAttempts ?? 5;
  const git = (...args: string[]) => capture('git', ['-C', dir, ...args], dir);

  const base = (await git('rev-parse', `origin/${branch}`)).stdout.trim();

  if ((await git('status', '--porcelain')).stdout.trim()) {
    await git('add', '-A');
    const committed = await git('commit', '-m', config.message);
    if (committed.code !== 0) {
      return { ok: false, reason: `commit failed: ${committed.stderr.trim()}` };
    }
  }

  if (!(await git('rev-list', `${base}..HEAD`)).stdout.trim()) {
    return { ok: false, reason: 'no commit was produced — nothing to integrate' };
  }

  for (let attempt = 0; attempt < maxPushAttempts; attempt++) {
    await git('fetch', 'origin', branch);

    const rebase = await git('rebase', `origin/${branch}`);
    if (rebase.code !== 0) {
      await git('rebase', '--abort');
      return { ok: false, reason: 'cannot rebase onto the shared branch — a conflict needs resolving' };
    }

    for (const [cmd, ...args] of verify) {
      const checked = await capture(cmd, args, dir);
      if (checked.code !== 0) {
        return { ok: false, reason: `verification failed after rebase: ${[cmd, ...args].join(' ')}` };
      }
    }

    const push = await git('push', 'origin', `HEAD:${branch}`);
    if (push.code === 0) {
      const sha = (await git('rev-parse', 'HEAD')).stdout.trim();
      await git('fetch', 'origin', branch);
      const ancestor = await git('merge-base', '--is-ancestor', sha, `origin/${branch}`);
      if (ancestor.code !== 0) {
        return { ok: false, reason: 'push reported success but the commit is not on the shared branch' };
      }
      return { ok: true, sha };
    }
  }

  return { ok: false, reason: `could not land the push after ${maxPushAttempts} attempts` };
}
