import { Observable, combineLatest, map, of, shareReplay } from 'rxjs';
import type { MonoTypeOperatorFunction } from 'rxjs';
import {
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  collection,
  collectionGroup,
  doc,
  documentId,
  onSnapshot,
  query as fsQuery,
  where,
} from 'firebase/firestore';
import type { z } from 'zod';
import { zodConverter } from './converter';

export type WithId<T> = T extends { id: string } ? T : T & { id: string };

export function withId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): WithId<T> {
  return { ...snap.data(), id: snap.id } as WithId<T>;
}

export function withIdOrNull<T extends DocumentData>(snap: DocumentSnapshot<T>): WithId<T> | null {
  const data = snap.data();
  return data ? ({ ...data, id: snap.id } as WithId<T>) : null;
}

export function shareOne<T>(): MonoTypeOperatorFunction<T> {
  return shareReplay({ bufferSize: 1, refCount: true });
}

export function collection$<T extends DocumentData>(
  firestore: Firestore,
  schema: z.ZodType<T>,
  path: string,
  constraints: readonly QueryConstraint[] = [],
): Observable<WithId<T>[]> {
  const ref = collection(firestore, path).withConverter(zodConverter(schema));
  return new Observable<WithId<T>[]>((subscriber) => {
    const unsubscribe = onSnapshot(
      fsQuery(ref, ...constraints),
      (snap) => subscriber.next(snap.docs.map((d) => withId<T>(d))),
      (err) => subscriber.error(err),
    );
    return () => unsubscribe();
  });
}

export function collectionGroup$<T extends DocumentData>(
  firestore: Firestore,
  schema: z.ZodType<T>,
  collectionId: string,
  constraints: readonly QueryConstraint[] = [],
): Observable<WithId<T>[]> {
  const ref = collectionGroup(firestore, collectionId).withConverter(zodConverter(schema));
  return new Observable<WithId<T>[]>((subscriber) => {
    const unsubscribe = onSnapshot(
      fsQuery(ref, ...constraints),
      (snap) => subscriber.next(snap.docs.map((d) => withId<T>(d))),
      (err) => subscriber.error(err),
    );
    return () => unsubscribe();
  });
}

export function doc$<T extends DocumentData>(
  firestore: Firestore,
  schema: z.ZodType<T>,
  path: string,
): Observable<WithId<T> | null> {
  const ref = doc(firestore, path).withConverter(zodConverter(schema));
  return new Observable<WithId<T> | null>((subscriber) => {
    const unsubscribe = onSnapshot(
      ref,
      (snap) => subscriber.next(withIdOrNull<T>(snap)),
      (err) => subscriber.error(err),
    );
    return () => unsubscribe();
  });
}

export function chunkedInQuery$<T extends DocumentData>(
  firestore: Firestore,
  schema: z.ZodType<T>,
  path: string,
  ids: readonly string[],
): Observable<WithId<T>[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return of([]);

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) {
    chunks.push(unique.slice(i, i + 30));
  }

  return combineLatest(
    chunks.map((chunk) =>
      collection$<T>(firestore, schema, path, [where(documentId(), 'in', chunk)]),
    ),
  ).pipe(
    map((lists) => {
      const byId = new Map<string, WithId<T>>();
      for (const list of lists) {
        for (const row of list) byId.set(row.id, row);
      }
      return unique.map((id) => byId.get(id)).filter((row): row is WithId<T> => row !== undefined);
    }),
  );
}
