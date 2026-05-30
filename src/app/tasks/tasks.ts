import { Component, computed, inject } from '@angular/core';
import { StepService } from '../core/data/step.service';

@Component({
  selector: 'app-tasks',
  template: `
    <h2 class="mb-4 text-lg font-semibold">Your tasks</h2>
    @if (loading()) {
      <p class="text-gray-500">Loading…</p>
    } @else if (error()) {
      <p class="text-red-700">Couldn't load your tasks. {{ error() }}</p>
    } @else {
      <ul class="grid max-w-3xl gap-3">
        @for (task of tasks(); track task.id) {
          <li class="rounded-md border border-gray-200 p-3">
            <div class="flex items-center gap-3">
              <strong>{{ task.title }}</strong>
              <span class="flex-1"></span>
              <button
                type="button"
                (click)="done(task.id)"
                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Mark done
              </button>
            </div>
            @if (task.instruction) {
              <p class="mt-2 text-sm text-gray-600">{{ task.instruction }}</p>
            }
            @for (link of task.links ?? []; track link) {
              <a
                [href]="link"
                target="_blank"
                rel="noopener"
                class="mt-1 block text-sm text-blue-700 hover:underline"
                >{{ link }}</a
              >
            }
          </li>
        } @empty {
          <li class="text-gray-500">No tasks for you right now.</li>
        }
      </ul>
    }
  `,
})
export class TasksComponent {
  private readonly stepService = inject(StepService);

  protected readonly loading = this.stepService.all.loading;
  protected readonly error = this.stepService.all.error;
  protected readonly tasks = computed(() =>
    this.stepService.all
      .data()
      .filter((step) => step.assignee === 'user' && step.status === 'awaiting-user'),
  );

  done(id: string): void {
    void this.stepService.complete(id);
  }
}
