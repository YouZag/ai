import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VisionService } from '../core/data/vision.service';

@Component({
  selector: 'app-vision',
  imports: [FormsModule],
  template: `
    <h2 class="mb-4 text-lg font-semibold">Vision</h2>
    <div class="grid max-w-2xl gap-4">
      <label class="grid gap-1">
        <span class="text-sm text-gray-600">Statement</span>
        <textarea
          rows="3"
          class="rounded-md border border-gray-300 p-2"
          [ngModel]="statement()"
          (ngModelChange)="statement.set($event)"
          name="statement"
        ></textarea>
      </label>
      <label class="grid gap-1">
        <span class="text-sm text-gray-600">Principles (one per line)</span>
        <textarea
          rows="5"
          class="rounded-md border border-gray-300 p-2"
          [ngModel]="principles()"
          (ngModelChange)="principles.set($event)"
          name="principles"
        ></textarea>
      </label>
      <label class="grid gap-1">
        <span class="text-sm text-gray-600">Non-goals (one per line)</span>
        <textarea
          rows="5"
          class="rounded-md border border-gray-300 p-2"
          [ngModel]="nonGoals()"
          (ngModelChange)="nonGoals.set($event)"
          name="nonGoals"
        ></textarea>
      </label>
      <div class="flex items-center gap-3">
        <button
          type="button"
          (click)="save()"
          [disabled]="saving()"
          class="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          Save vision
        </button>
        @if (saved()) {
          <span class="text-sm text-green-700">Saved.</span>
        }
      </div>
    </div>
  `,
})
export class VisionComponent {
  private readonly vision = inject(VisionService);

  protected readonly statement = signal('');
  protected readonly principles = signal('');
  protected readonly nonGoals = signal('');
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  constructor() {
    void this.vision.load().then((current) => {
      if (!current) return;
      this.statement.set(current.statement);
      this.principles.set(current.principles.join('\n'));
      this.nonGoals.set(current.nonGoals.join('\n'));
    });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    try {
      await this.vision.save({
        statement: this.statement().trim(),
        principles: toLines(this.principles()),
        nonGoals: toLines(this.nonGoals()),
        updatedAt: Date.now(),
      });
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}

function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
