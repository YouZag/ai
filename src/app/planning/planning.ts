import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Vision } from '@schemas';
import { AuthService } from '../core/auth/auth.service';
import { ControlService } from '../core/data/control.service';
import { FeatureService } from '../core/data/feature.service';
import { VisionService } from '../core/data/vision.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-planning',
  imports: [FormsModule],
  template: `
    <div class="grid h-[calc(100vh-3.5rem)] grid-cols-1 gap-4 p-4 lg:grid-cols-2">
      <section class="flex min-h-0 flex-col rounded-md border border-gray-200">
        <div class="border-b border-gray-200 px-4 py-2">
          <h2 class="font-semibold">Planning Studio</h2>
          <p class="text-sm text-gray-500">
            Lead the charge — describe what you want, and it fills in the vision and features.
          </p>
        </div>
        <div class="flex-1 space-y-3 overflow-y-auto p-4">
          @for (m of messages(); track $index) {
            <div [class]="m.role === 'user' ? 'text-right' : ''">
              <span
                [class]="
                  m.role === 'user'
                    ? 'inline-block rounded-lg bg-gray-900 px-3 py-2 text-left text-sm text-white'
                    : 'inline-block rounded-lg bg-gray-100 px-3 py-2 text-sm whitespace-pre-wrap'
                "
                >{{ m.content }}</span
              >
            </div>
          } @empty {
            <p class="text-sm text-gray-400">
              Tell the studio what you want to build — even vaguely. It proposes a vision and
              features, and you refine from there.
            </p>
          }
          @if (sending()) {
            <p class="text-sm text-gray-400">Thinking…</p>
          }
          @if (error()) {
            <p class="text-sm text-red-700">{{ error() }}</p>
          }
        </div>
        <form class="flex gap-2 border-t border-gray-200 p-3" (ngSubmit)="send()">
          <textarea
            rows="2"
            name="draft"
            [ngModel]="draft()"
            (ngModelChange)="draft.set($event)"
            [disabled]="sending()"
            placeholder="e.g. I own funday.io and want to bring people real-world joy…"
            class="flex-1 rounded-md border border-gray-300 p-2 text-sm"
          ></textarea>
          <button
            type="submit"
            [disabled]="sending() || !draft().trim()"
            class="self-end rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </section>

      <section
        class="min-h-0 space-y-4 overflow-y-auto rounded-md border border-gray-200 p-4"
      >
        <div class="flex items-center justify-between border-b border-gray-200 pb-3">
          <span class="text-sm font-semibold">Plan · {{ control.phase() }}</span>
          @if (control.phase() === 'planning') {
            <button
              type="button"
              (click)="startBuild()"
              [disabled]="!features().length || starting()"
              class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {{ starting() ? 'Starting…' : 'Start build' }}
            </button>
          } @else {
            <span class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
              >building</span
            >
          }
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Vision</h3>
          @if (vision(); as v) {
            <p class="mt-1 text-sm">{{ v.statement }}</p>
            @if (v.principles.length) {
              <ul class="mt-2 list-disc pl-5 text-sm text-gray-600">
                @for (p of v.principles; track p) {
                  <li>{{ p }}</li>
                }
              </ul>
            }
          } @else {
            <p class="mt-1 text-sm text-gray-400">No vision yet.</p>
          }
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Features ({{ features().length }})
          </h3>
          @if (featureService.features.loading()) {
            <p class="mt-1 text-sm text-gray-400">Loading…</p>
          } @else if (featureService.features.error(); as e) {
            <p class="mt-1 text-sm text-red-700">{{ e }}</p>
          } @else {
            <ul class="mt-2 space-y-2">
              @for (f of features(); track f.id) {
                <li class="rounded-md border border-gray-200 p-2">
                  <div class="flex items-center gap-2">
                    @if (f.order !== undefined) {
                      <span class="text-xs text-gray-400">#{{ f.order }}</span>
                    }
                    <strong class="text-sm">{{ f.title }}</strong>
                    <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{{
                      f.status
                    }}</span>
                  </div>
                  @if (f.rationale) {
                    <p class="mt-1 text-xs text-gray-600">{{ f.rationale }}</p>
                  }
                </li>
              } @empty {
                <li class="text-sm text-gray-400">No features yet.</li>
              }
            </ul>
          }
        </div>
      </section>
    </div>
  `,
})
export class PlanningComponent {
  private readonly auth = inject(AuthService);
  private readonly visionService = inject(VisionService);
  protected readonly featureService = inject(FeatureService);
  protected readonly control = inject(ControlService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly starting = signal(false);
  protected readonly error = signal('');
  protected readonly vision = signal<Vision | null>(null);

  protected readonly features = computed(() =>
    [...this.featureService.features.data()].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    ),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) void this.refreshVision();
  }

  private async refreshVision(): Promise<void> {
    this.vision.set(await this.visionService.load());
  }

  async startBuild(): Promise<void> {
    if (this.starting()) return;
    this.starting.set(true);
    try {
      await this.control.setPhase('building');
      const proposed = this.featureService.features
        .data()
        .filter((feature) => feature.status === 'proposed');
      await Promise.all(
        proposed.map((feature) => this.featureService.setStatus(feature.id, 'planned')),
      );
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.starting.set(false);
    }
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.draft.set('');
    this.error.set('');
    this.messages.update((m) => [...m, { role: 'user', content: text }]);
    this.sending.set(true);
    try {
      const token = await this.auth.idToken();
      if (!token) throw new Error('Sign in to use the studio.');
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: this.messages() }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      const body = (await response.json()) as { reply: string };
      this.messages.update((m) => [...m, { role: 'assistant', content: body.reply }]);
      await this.refreshVision();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.sending.set(false);
    }
  }
}
