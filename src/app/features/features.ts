import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatureService } from '../core/data/feature.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-features',
  imports: [FormsModule],
  template: `
    <h2 class="mb-4 text-lg font-semibold">Features</h2>
    <form (submit)="create($event)" class="mb-4 flex max-w-3xl flex-wrap gap-2">
      <input
        [ngModel]="title()"
        (ngModelChange)="title.set($event)"
        name="title"
        placeholder="Title"
        class="grow rounded-md border border-gray-300 px-3 py-2"
      />
      <input
        [ngModel]="description()"
        (ngModelChange)="description.set($event)"
        name="description"
        placeholder="Description"
        class="grow rounded-md border border-gray-300 px-3 py-2"
      />
      <input
        type="number"
        [ngModel]="priority()"
        (ngModelChange)="priority.set(+$event)"
        name="priority"
        placeholder="Priority"
        class="w-24 rounded-md border border-gray-300 px-3 py-2"
      />
      <button
        type="submit"
        [disabled]="!title().trim()"
        class="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
      >
        Add feature
      </button>
    </form>

    @if (features.loading()) {
      <p class="text-gray-500">Loading…</p>
    } @else {
      <ul class="grid max-w-3xl gap-3">
        @for (feature of features.data(); track feature.id) {
          <li class="rounded-md border border-gray-200 p-3">
            <div class="flex items-center gap-3">
              <strong>{{ feature.title }}</strong>
              <span class="text-sm text-gray-500">{{ feature.status }} · p{{ feature.priority }}</span>
              @if (feature.status === 'proposed') {
                <button
                  type="button"
                  (click)="plan(feature.id)"
                  class="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                >
                  Mark planned
                </button>
              }
            </div>
            @if (feature.description) {
              <p class="mt-2 text-sm text-gray-600">{{ feature.description }}</p>
            }
          </li>
        } @empty {
          <li class="text-gray-500">No features yet.</li>
        }
      </ul>
    }
  `,
})
export class FeaturesComponent {
  private readonly featureService = inject(FeatureService);
  private readonly auth = inject(AuthService);

  protected readonly features = this.featureService.features;
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly priority = signal(0);

  async create(event: Event): Promise<void> {
    event.preventDefault();
    const title = this.title().trim();
    if (!title) return;
    await this.featureService.create({
      title,
      description: this.description().trim(),
      priority: this.priority(),
      createdBy: this.auth.user()?.email ?? 'unknown',
    });
    this.title.set('');
    this.description.set('');
    this.priority.set(0);
  }

  plan(id: string): void {
    void this.featureService.setStatus(id, 'planned');
  }
}
