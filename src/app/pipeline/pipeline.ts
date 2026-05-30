import { Component, inject } from '@angular/core';
import { RunService } from '../core/data/run.service';
import { StepService } from '../core/data/step.service';

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  leased: 'bg-blue-100 text-blue-800',
  running: 'bg-blue-100 text-blue-800',
  succeeded: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  timed_out: 'bg-red-100 text-red-800',
  abandoned: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-700',
  building: 'bg-blue-100 text-blue-800',
  testing: 'bg-indigo-100 text-indigo-800',
  auditing: 'bg-purple-100 text-purple-800',
  'awaiting-user': 'bg-amber-100 text-amber-800',
  done: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
};

@Component({
  selector: 'app-pipeline',
  template: `
    <div class="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 class="mb-3 text-lg font-semibold">Runs</h2>
        @if (runs.loading()) {
          <p class="text-gray-500">Loading…</p>
        } @else {
          <ul class="grid gap-2">
            @for (run of runs.data(); track run.id) {
              <li class="rounded-md border border-gray-200 p-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ run.role }}</span>
                  <span [class]="badge(run.status)">{{ run.status }}</span>
                  @if (run.target) {
                    <span class="text-gray-500">{{ run.target.kind }}/{{ run.target.id }}</span>
                  }
                </div>
                @if (run.summary) {
                  <p class="mt-1 text-gray-600">{{ run.summary }}</p>
                }
              </li>
            } @empty {
              <li class="text-gray-500">No runs yet.</li>
            }
          </ul>
        }
      </section>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Steps</h2>
        @if (steps.loading()) {
          <p class="text-gray-500">Loading…</p>
        } @else {
          <ul class="grid gap-2">
            @for (step of steps.data(); track step.id) {
              <li class="rounded-md border border-gray-200 p-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ step.title }}</span>
                  <span [class]="badge(step.status)">{{ step.status }}</span>
                  <span class="text-gray-500">{{ step.kind }}</span>
                  @if (step.layer) {
                    <span class="text-gray-500">· {{ step.layer }}</span>
                  }
                </div>
              </li>
            } @empty {
              <li class="text-gray-500">No steps yet.</li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class PipelineComponent {
  protected readonly runs = inject(RunService).recent;
  protected readonly steps = inject(StepService).all;

  badge(status: string): string {
    return 'rounded px-2 py-0.5 text-xs ' + (STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700');
  }
}
