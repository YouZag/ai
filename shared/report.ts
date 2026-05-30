import { RunReportSchema, type RunReport } from '@schemas';

export const REPORT_INSTRUCTIONS =
  'When you are finished, end your reply with a single JSON object on its own line: {"outcome":"succeeded"|"failed","summary":"<one sentence>"}. Use "failed" if you could not complete the work or it did not meet its acceptance criteria.';

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function parseRunReport(text: string): RunReport {
  const matches = text.match(/\{[^{}]*"outcome"[^{}]*\}/g);
  const candidate = matches?.[matches.length - 1];
  if (candidate) {
    const parsed = RunReportSchema.safeParse(safeJson(candidate));
    if (parsed.success) return parsed.data;
  }
  return { outcome: 'failed', summary: text.trim().slice(0, 500) || 'agent did not report an outcome' };
}
