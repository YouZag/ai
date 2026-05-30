import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatureService } from '../core/data/feature.service';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-features',
  imports: [FormsModule],
  template: `
    <h2>Features</h2>
    <form (submit)="create($event)">
      <input
        [ngModel]="title()"
        (ngModelChange)="title.set($event)"
        name="title"
        placeholder="Title"
      />
      <input
        [ngModel]="description()"
        (ngModelChange)="description.set($event)"
        name="description"
        placeholder="Description"
      />
      <input
        type="number"
        [ngModel]="priority()"
        (ngModelChange)="priority.set(+$event)"
        name="priority"
        placeholder="Priority"
      />
      <button type="submit" [disabled]="!title().trim()">Add feature</button>
    </form>

    @if (features.loading()) {
      <p class="muted">Loading…</p>
    } @else {
      <ul>
        @for (feature of features.data(); track feature.id) {
          <li>
            <div class="row">
              <strong>{{ feature.title }}</strong>
              <span class="status">{{ feature.status }} · p{{ feature.priority }}</span>
              @if (feature.status === 'proposed') {
                <button type="button" (click)="plan(feature.id)">Mark planned</button>
              }
            </div>
            @if (feature.description) {
              <p>{{ feature.description }}</p>
            }
          </li>
        } @empty {
          <li>No features yet.</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      max-width: 720px;
    }
    form {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    input {
      font: inherit;
      padding: 0.4rem;
    }
    .muted {
      color: #777;
    }
    ul {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    li {
      border: 1px solid #e3e3e3;
      border-radius: 6px;
      padding: 0.75rem;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .status {
      color: #555;
      font-size: 0.9rem;
    }
    li p {
      margin: 0.5rem 0 0;
      color: #555;
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
