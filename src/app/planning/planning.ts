import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
        <div #scroller class="flex-1 space-y-3 overflow-y-auto p-4">
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
            (keydown.meta.enter)="send()"
            (keydown.control.enter)="send()"
            [disabled]="sending()"
            placeholder="Describe what you want to build — even vaguely…"
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

      <section class="min-h-0 space-y-4 overflow-y-auto rounded-md border border-gray-200 p-4">
        <div class="flex items-center justify-between border-b border-gray-200 pb-3">
          <span class="text-sm font-semibold">Plan · {{ control.phase() }}</span>
          @switch (control.phase()) {
            @case ('planning') {
              <button
                type="button"
                (click)="startBuild()"
                [disabled]="!features().length || starting()"
                class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {{ starting() ? 'Starting…' : 'Start build' }}
              </button>
            }
            @case ('building') {
              <button
                type="button"
                (click)="pause()"
                class="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                Pause
              </button>
            }
            @case ('paused') {
              <button
                type="button"
                (click)="resume()"
                class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Resume
              </button>
            }
          }
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Vision</h3>
          @if (visionService.current.loading()) {
            <p class="mt-1 text-sm text-gray-400">Loading…</p>
          } @else if (visionService.current.error(); as e) {
            <p class="mt-1 text-sm text-red-700">Couldn't load the vision. {{ e }}</p>
          } @else if (visionService.current.data(); as v) {
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
  protected readonly visionService = inject(VisionService);
  protected readonly featureService = inject(FeatureService);
  protected readonly control = inject(ControlService);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly starting = signal(false);
  protected readonly error = signal('');

  protected readonly features = computed(() =>
    [...this.featureService.features.data()].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    ),
  );

  constructor() {
    effect(() => {
      this.messages();
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  pause(): void {
    void this.control.setPhase('paused');
  }

  resume(): void {
    void this.control.setPhase('building');
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
    } catch (err) {
      this.messages.update((m) => m.slice(0, -1));
      this.draft.set(text);
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.sending.set(false);
    }
  }
}
