import { describe, it, expect } from 'vitest';
import { parseRunReport } from './report';

describe('parseRunReport', () => {
  it('parses a trailing JSON report', () => {
    expect(parseRunReport('did the work\n{"outcome":"succeeded","summary":"built it"}')).toEqual({
      outcome: 'succeeded',
      summary: 'built it',
    });
  });

  it('reads a failed verdict', () => {
    expect(parseRunReport('{"outcome":"failed","summary":"tests red"}').outcome).toBe('failed');
  });

  it('takes the last report when several appear', () => {
    const text = '{"outcome":"failed","summary":"a"} then later {"outcome":"succeeded","summary":"b"}';
    expect(parseRunReport(text)).toEqual({ outcome: 'succeeded', summary: 'b' });
  });

  it('defaults to failed when there is no valid report', () => {
    const report = parseRunReport('I think it went fine');
    expect(report.outcome).toBe('failed');
    expect(report.summary).toContain('went fine');
  });

  it('defaults to failed on an invalid outcome value', () => {
    expect(parseRunReport('{"outcome":"maybe","summary":"x"}').outcome).toBe('failed');
  });
});
