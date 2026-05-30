import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StepService } from '../core/data/step.service';

@Component({
  selector: 'app-tasks',
  imports: [FormsModule],
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
            <strong>{{ task.title }}</strong>
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
            <textarea
              rows="2"
              name="note-{{ task.id }}"
              [ngModel]="noteFor(task.id)"
              (ngModelChange)="setNote(task.id, $event)"
              placeholder="Note back to the agent — e.g. provider, from address, secret name"
              class="mt-2 w-full rounded-md border border-gray-300 p-2 text-sm"
            ></textarea>
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                (click)="done(task.id)"
                class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                Mark done
              </button>
              <button
                type="button"
                (click)="block(task.id)"
                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Can't do this
              </button>
            </div>
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

  private readonly notes = signal<Record<string, string>>({});

  noteFor(id: string): string {
    return this.notes()[id] ?? '';
  }

  setNote(id: string, value: string): void {
    this.notes.update((current) => ({ ...current, [id]: value }));
  }

  done(id: string): void {
    void this.stepService.complete(id, this.noteFor(id));
  }

  block(id: string): void {
    void this.stepService.block(id, this.noteFor(id));
  }
}
