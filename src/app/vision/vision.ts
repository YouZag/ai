import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VisionService } from '../core/data/vision.service';

@Component({
  selector: 'app-vision',
  imports: [FormsModule],
  template: `
    <h2>Vision</h2>
    <label>
      Statement
      <textarea
        rows="3"
        [ngModel]="statement()"
        (ngModelChange)="statement.set($event)"
        name="statement"
      ></textarea>
    </label>
    <label>
      Principles (one per line)
      <textarea
        rows="5"
        [ngModel]="principles()"
        (ngModelChange)="principles.set($event)"
        name="principles"
      ></textarea>
    </label>
    <label>
      Non-goals (one per line)
      <textarea
        rows="5"
        [ngModel]="nonGoals()"
        (ngModelChange)="nonGoals.set($event)"
        name="nonGoals"
      ></textarea>
    </label>
    <div>
      <button type="button" (click)="save()" [disabled]="saving()">Save vision</button>
      @if (saved()) {
        <span class="saved">Saved.</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      max-width: 640px;
    }
    label {
      display: grid;
      gap: 0.25rem;
    }
    textarea {
      font: inherit;
      padding: 0.5rem;
    }
    .saved {
      margin-left: 0.75rem;
      color: #1a7f37;
    }
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
