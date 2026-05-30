import { type Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Observable, catchError, map, of } from 'rxjs';

type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'error'; readonly error: unknown };

export interface Loadable<T> {
  readonly data: Signal<T>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<unknown>;
}

export function loadable<T>(source: Observable<T>, empty: T): Loadable<T> {
  const state = toSignal(
    source.pipe(
      map((value): LoadState<T> => ({ status: 'ready', value })),
      catchError((error): Observable<LoadState<T>> => of({ status: 'error', error })),
    ),
    { initialValue: { status: 'loading' } as LoadState<T> },
  );
  return {
    loading: computed(() => state().status === 'loading'),
    error: computed(() => {
      const current = state();
      return current.status === 'error' ? current.error : null;
    }),
    data: computed(() => {
      const current = state();
      return current.status === 'ready' ? current.value : empty;
    }),
  };
}
