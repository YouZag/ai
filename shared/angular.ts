import type { McpStdioServerConfig } from '@anthropic-ai/claude-agent-sdk';

export function angularMcpServer(): McpStdioServerConfig {
  return {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@angular/cli', 'mcp'],
  };
}
