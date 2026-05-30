import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'node:child_process';

export interface VerifyConfig {
  commands: string[][];
  maxAttempts?: number;
}

export interface RunClaudeOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  allowedTools?: string[];
  mcpServers?: Record<string, McpServerConfig>;
  verify?: VerifyConfig;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function firstFailure(commands: string[][], cwd: string): Promise<string | null> {
  for (const [command, ...args] of commands) {
    const { code, output } = await runCommand(command, args, cwd);
    if (code !== 0) {
      return `\`${[command, ...args].join(' ')}\` failed:\n${output.trim().slice(-2000)}`;
    }
  }
  return null;
}

export async function runClaude(options: RunClaudeOptions): Promise<string> {
  const systemPrompt: { type: 'preset'; preset: 'claude_code'; append?: string } = options
    .systemPrompt
    ? { type: 'preset', preset: 'claude_code', append: options.systemPrompt }
    : { type: 'preset', preset: 'claude_code' };
  const maxVerifyAttempts = options.verify?.maxAttempts ?? 3;

  let prompt = options.prompt;
  let resume: string | undefined;
  let result = '';

  for (let attempt = 0; attempt < maxVerifyAttempts; attempt++) {
    let sessionId: string | undefined;
    for await (const message of query({
      prompt,
      options: {
        cwd: options.cwd,
        model: options.model,
        systemPrompt,
        maxTurns: options.maxTurns,
        allowedTools: options.allowedTools,
        mcpServers: options.mcpServers,
        settingSources: ['project'],
        permissionMode: 'bypassPermissions',
        resume,
      },
    })) {
      if (message.type === 'result') {
        if (message.subtype !== 'success') {
          throw new Error(`Claude run did not succeed: ${message.subtype}`);
        }
        result = message.result;
        sessionId = message.session_id;
      }
    }

    if (!options.verify || !options.cwd) return result;

    const failure = await firstFailure(options.verify.commands, options.cwd);
    if (!failure) return result;
    if (attempt + 1 >= maxVerifyAttempts) return result;

    resume = sessionId;
    prompt = `You reported done, but verification is still failing — you are not finished.\n\n${failure}\n\nFix the underlying cause, not the symptom, then keep going until it passes. Report your outcome as before when it is green.`;
  }

  return result;
}
