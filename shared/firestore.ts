import type { McpHttpServerConfig } from '@anthropic-ai/claude-agent-sdk';

export function firestoreMcpServer(accessToken: string): McpHttpServerConfig {
  return {
    type: 'http',
    url: 'https://firestore.googleapis.com/mcp',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json, text/event-stream',
    },
  };
}
