import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { ErrorDocumentSchema, type ErrorDocument } from '@schemas';
import { initErrorReporting } from '@shared/errors';
import { getDb } from './firebase-admin';

const errorConverter: FirestoreDataConverter<ErrorDocument> = {
  toFirestore(doc: ErrorDocument) {
    return doc;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot) {
    return ErrorDocumentSchema.parse(snapshot.data());
  },
};

export function initServerErrorReporting(): void {
  initErrorReporting({
    source: 'express',
    write: (doc) => getDb().collection('errors').withConverter(errorConverter).add(doc),
  });
}
