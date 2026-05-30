import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { needsWorkspace, integrateWork } from './workspace';

describe('needsWorkspace', () => {
  it('requires a working tree for the roles that read or change the codebase', () => {
    for (const role of ['builder', 'designer', 'tester', 'auditor', 'strategist']) {
      expect(needsWorkspace(role)).toBe(true);
    }
  });

  it('does not for the meta roles', () => {
    for (const role of ['reconciler', 'architect', 'optimizer', 'supervisor']) {
      expect(needsWorkspace(role)).toBe(false);
    }
  });
});

function git(args: string[], cwd: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd });
    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', () => {});
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code: code ?? 1, stdout }));
  });
}

async function configure(dir: string): Promise<void> {
  await git(['config', 'user.email', 'test@test'], dir);
  await git(['config', 'user.name', 'Test'], dir);
  await git(['config', 'commit.gpgsign', 'false'], dir);
}

async function commitFile(
  dir: string,
  file: string,
  content: string,
  message: string,
): Promise<void> {
  writeFileSync(join(dir, file), content);
  await git(['add', '-A'], dir);
  await git(['commit', '-m', message], dir);
}

describe('integrateWork', () => {
  let root: string;

  async function scaffold(): Promise<{
    origin: string;
    work: string;
    other: string;
    base: string;
  }> {
    root = mkdtempSync(join(tmpdir(), 'integrate-'));
    const origin = join(root, 'origin.git');
    const seed = join(root, 'seed');
    const work = join(root, 'work');
    const other = join(root, 'other');
    mkdirSync(origin);
    await git(['init', '--bare', '-b', 'main', origin], root);
    await git(['clone', origin, seed], root);
    await configure(seed);
    await commitFile(seed, 'base.txt', 'base\n', 'base');
    await git(['push', 'origin', 'main'], seed);
    await git(['clone', origin, work], root);
    await configure(work);
    await git(['clone', origin, other], root);
    await configure(other);
    const base = (await git(['rev-parse', 'HEAD'], work)).stdout.trim();
    return { origin, work, other, base };
  }

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const verify = [['true']];

  it('lands a clean commit the agent did not push itself', async () => {
    const { origin, work, base } = await scaffold();
    await commitFile(work, 'feature.txt', 'feature\n', 'add feature');

    const result = await integrateWork({ dir: work, branch: 'main', base, message: 'm', verify });

    expect(result.ok).toBe(true);
    const fresh = join(root, 'fresh');
    await git(['clone', origin, fresh], root);
    expect((await git(['cat-file', '-e', 'HEAD:feature.txt'], fresh)).code).toBe(0);
  });

  it('accepts work the agent already reconciled and pushed', async () => {
    const { origin, work, base } = await scaffold();
    await commitFile(work, 'feature.txt', 'feature\n', 'add feature');
    await git(['push', 'origin', 'main'], work);

    const result = await integrateWork({ dir: work, branch: 'main', base, message: 'm', verify });

    expect(result.ok).toBe(true);
    const fresh = join(root, 'fresh');
    await git(['clone', origin, fresh], root);
    expect((await git(['cat-file', '-e', 'HEAD:feature.txt'], fresh)).code).toBe(0);
  });

  it('fails when the agent produced no commit', async () => {
    const { work, base } = await scaffold();
    const result = await integrateWork({ dir: work, branch: 'main', base, message: 'm', verify });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('no commit');
  });

  it('rebases onto a branch that moved underneath it, then lands', async () => {
    const { origin, work, other, base } = await scaffold();
    await commitFile(other, 'theirs.txt', 'theirs\n', 'their change');
    await git(['push', 'origin', 'main'], other);

    await commitFile(work, 'mine.txt', 'mine\n', 'my change');
    const result = await integrateWork({ dir: work, branch: 'main', base, message: 'm', verify });

    expect(result.ok).toBe(true);
    const fresh = join(root, 'fresh');
    await git(['clone', origin, fresh], root);
    expect((await git(['cat-file', '-e', 'HEAD:theirs.txt'], fresh)).code).toBe(0);
    expect((await git(['cat-file', '-e', 'HEAD:mine.txt'], fresh)).code).toBe(0);
  });

  it('fails safe on a real conflict instead of force-landing', async () => {
    const { work, other, base } = await scaffold();
    await commitFile(other, 'base.txt', 'theirs\n', 'their edit');
    await git(['push', 'origin', 'main'], other);

    await commitFile(work, 'base.txt', 'mine\n', 'my edit');
    const result = await integrateWork({ dir: work, branch: 'main', base, message: 'm', verify });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('conflict');
  });

  it('surfaces the verification output when the build fails', async () => {
    const { work, base } = await scaffold();
    await commitFile(work, 'feature.txt', 'feature\n', 'add feature');

    const result = await integrateWork({
      dir: work,
      branch: 'main',
      base,
      message: 'm',
      verify: [['sh', '-c', 'echo TYPEERROR_X >&2; exit 1']],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('TYPEERROR_X');
  });
});
