import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const adminEmails = defineString('ADMIN_EMAILS', { default: 'drew@youzag.com' });

interface AnthropicModel {
  id: string;
  display_name?: string;
}

export const listModels = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  const token = request.auth?.token as { email?: string; email_verified?: boolean } | undefined;
  const allowed = adminEmails
    .value()
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  if (token?.email_verified !== true || !token.email || !allowed.includes(token.email)) {
    throw new HttpsError('permission-denied', 'Admins only.');
  }

  const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: {
      'x-api-key': anthropicApiKey.value(),
      'anthropic-version': '2023-06-01',
    },
  });
  if (!response.ok) {
    throw new HttpsError('unavailable', `Anthropic models request failed (${response.status}).`);
  }

  const body = (await response.json()) as { data?: AnthropicModel[] };
  return {
    models: (body.data ?? []).map((model) => ({
      id: model.id,
      displayName: model.display_name ?? model.id,
    })),
  };
});
