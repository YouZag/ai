import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from 'firebase/firestore';
import type { z } from 'zod';

export function zodConverter<T extends DocumentData>(schema: z.ZodType<T>): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T) {
      return value;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      return schema.parse(snapshot.data(options));
    },
  };
}
