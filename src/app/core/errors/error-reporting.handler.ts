import { isPlatformBrowser } from '@angular/common';
import { ErrorHandler, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { addDoc, collection, type FirestoreDataConverter } from 'firebase/firestore';
import { ErrorDocumentSchema, type ErrorDocument } from '@schemas';
import { initErrorReporting, reportError } from '@shared/errors';
import { FIRESTORE } from '../firebase/firebase.providers';

const errorConverter: FirestoreDataConverter<ErrorDocument> = {
  toFirestore(doc: ErrorDocument) {
    return doc;
  },
  fromFirestore(snapshot) {
    return ErrorDocumentSchema.parse(snapshot.data());
  },
};

@Injectable()
export class ErrorReportingHandler implements ErrorHandler {
  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const firestore = inject(FIRESTORE);
      initErrorReporting({
        source: 'client',
        write: (doc) => addDoc(collection(firestore, 'errors').withConverter(errorConverter), doc),
      });
    }
  }

  handleError(error: unknown): void {
    console.error(error);
    void reportError(error);
  }
}
