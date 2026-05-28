import { query } from '@anthropic-ai/claude-agent-sdk';

export interface RunClaudeOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  allowedTools?: string[];
}

export async function runClaude(options: RunClaudeOptions): Promise<string> {
  for await (const message of query({
    prompt: options.prompt,
    options: {
      cwd: options.cwd,
      model: options.model,
      systemPrompt: options.systemPrompt,
      maxTurns: options.maxTurns,
      allowedTools: options.allowedTools,
      permissionMode: 'bypassPermissions',
    },
  })) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        return message.result;
      }
      throw new Error(`Claude run did not succeed: ${message.subtype}`);
    }
  }

  throw new Error('Claude run ended without a result message');
}
