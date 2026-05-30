import type { DocumentData, FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { z } from 'zod';

export function zodConverter<T extends DocumentData>(schema: z.ZodType<T>): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T) {
      return value;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return schema.parse(snapshot.data());
    },
  };
}
