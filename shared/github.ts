import type { McpHttpServerConfig } from '@anthropic-ai/claude-agent-sdk';

export function githubMcpServer(token: string): McpHttpServerConfig {
  return {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { Authorization: `Bearer ${token}` },
  };
}
