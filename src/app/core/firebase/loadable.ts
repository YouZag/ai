import { type Signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

export interface Loadable<T> {
  readonly data: Signal<T>;
  readonly loading: Signal<boolean>;
}

export function loadable<T>(source: Observable<T>, empty: T): Loadable<T> {
  const raw = toSignal(source);
  return {
    loading: computed(() => raw() === undefined),
    data: computed(() => raw() ?? empty),
  };
}
