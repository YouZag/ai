import {
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type UpdateData,
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { type Observable, of } from 'rxjs';
import type { z } from 'zod';
import { zodConverter } from './converter';
import { collection$, doc$, type WithId } from './firestore-rx';
import { loadable, type Loadable } from './loadable';

export interface CollectionRepo<T extends DocumentData> {
  list$(constraints?: readonly QueryConstraint[]): Observable<WithId<T>[]>;
  doc$(id: string): Observable<WithId<T> | null>;
  list(constraints?: readonly QueryConstraint[]): Loadable<WithId<T>[]>;
  get(id: string): Loadable<WithId<T> | null>;
  create(data: T): Promise<string>;
  set(id: string, data: T): Promise<void>;
  update(id: string, patch: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createRepo<T extends DocumentData>(
  firestore: Firestore,
  schema: z.ZodType<T>,
  path: string,
  browser = true,
): CollectionRepo<T> {
  const col = collection(firestore, path).withConverter(zodConverter(schema));
  const typedDoc = (id: string) => doc(firestore, path, id).withConverter(zodConverter(schema));

  const list$ = (constraints: readonly QueryConstraint[] = []) =>
    collection$<T>(firestore, schema, path, constraints);
  const byId$ = (id: string) => doc$<T>(firestore, schema, `${path}/${id}`);

  return {
    list$,
    doc$: byId$,
    list: (constraints = []) =>
      loadable(browser ? list$(constraints) : of<WithId<T>[]>([]), [] as WithId<T>[]),
    get: (id) => loadable(browser ? byId$(id) : of<WithId<T> | null>(null), null),
    async create(data) {
      return (await addDoc(col, data)).id;
    },
    async set(id, data) {
      await setDoc(typedDoc(id), data);
    },
    async update(id, patch) {
      await updateDoc(doc(firestore, path, id), patch as UpdateData<T>);
    },
    async remove(id) {
      await deleteDoc(doc(firestore, path, id));
    },
  };
}
