import { describe, it, expect } from 'vitest';
import { toErrorDocument } from './errors';

describe('toErrorDocument', () => {
  it('omits absent optional fields so Firestore does not reject undefined', () => {
    const doc = toErrorDocument(new Error('boom'));
    expect(doc.message).toBe('boom');
    expect(typeof doc.createdAt).toBe('number');
    expect('context' in doc).toBe(false);
    expect('source' in doc).toBe(false);
    expect(Object.values(doc).every((value) => value !== undefined)).toBe(true);
  });

  it('keeps context when it is provided', () => {
    const doc = toErrorDocument(new Error('boom'), { runId: 'r1' });
    expect(doc.context).toEqual({ runId: 'r1' });
  });

  it('coerces non-Error throwables to a message', () => {
    expect(toErrorDocument('a string').message).toBe('a string');
  });
});
