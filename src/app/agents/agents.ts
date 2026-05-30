import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentService, type ModelOption } from '../core/data/agent.service';
import type { AgentDefinition, AgentStatus } from '@schemas';
import type { WithId } from '../core/firebase/firestore-rx';

@Component({
  selector: 'app-agents',
  imports: [FormsModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <h2 class="mr-auto text-lg font-semibold">Agents</h2>
      <button type="button" (click)="loadDefaults()" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
        Load defaults
      </button>
      <button type="button" (click)="exportBundle()" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
        Export
      </button>
      <button type="button" (click)="showImport.set(!showImport())" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
        Import
      </button>
    </div>

    @if (showImport()) {
      <div class="mb-4 grid max-w-3xl gap-2">
        <textarea
          rows="6"
          placeholder="Paste an agent bundle (JSON)"
          class="rounded-md border border-gray-300 p-2 font-mono text-sm"
          [ngModel]="importText()"
          (ngModelChange)="importText.set($event)"
          name="importText"
        ></textarea>
        <div class="flex items-center gap-3">
          <button type="button" (click)="runImport()" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            Load bundle
          </button>
          @if (importError()) {
            <span class="text-sm text-red-700">{{ importError() }}</span>
          }
        </div>
      </div>
    }

    @if (agents.loading()) {
      <p class="text-gray-500">Loading…</p>
    } @else if (agents.error()) {
      <p class="text-red-700">Couldn't load agents. {{ agents.error() }}</p>
    } @else {
      <ul class="grid max-w-3xl gap-3">
        @for (agent of agents.data(); track agent.id) {
          <li class="rounded-md border border-gray-200 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <strong>{{ agent.title }}</strong>
              <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{{ agent.role }}</span>
              <span
                class="rounded px-2 py-0.5 text-xs"
                [class]="agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'"
                >{{ agent.status }}</span
              >
              <span class="flex-1"></span>
              <button type="button" (click)="edit(agent)" class="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
                Edit
              </button>
            </div>

            @if (editing()?.id === agent.id) {
              <div class="mt-3 grid gap-2">
                <textarea
                  rows="4"
                  class="rounded-md border border-gray-300 p-2 text-sm"
                  [ngModel]="instructions()"
                  (ngModelChange)="instructions.set($event)"
                  name="instructions"
                ></textarea>
                <input
                  placeholder="Tools (comma-separated)"
                  class="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  [ngModel]="tools()"
                  (ngModelChange)="tools.set($event)"
                  name="tools"
                />
                <select
                  class="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  [ngModel]="model()"
                  (ngModelChange)="model.set($event)"
                  name="model"
                >
                  <option value="">Default (let the SDK choose)</option>
                  @if (modelsLoading()) {
                    <option disabled>Loading models…</option>
                  }
                  @for (m of models(); track m.id) {
                    <option [value]="m.id">{{ m.displayName }}</option>
                  }
                  @if (model() && !modelIds().includes(model())) {
                    <option [value]="model()">{{ model() }} (current)</option>
                  }
                </select>
                @if (modelsError()) {
                  <span class="text-sm text-red-700">Couldn't load the live list: {{ modelsError() }}</span>
                }
                <select
                  class="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  [ngModel]="status()"
                  (ngModelChange)="status.set($event)"
                  name="status"
                >
                  <option value="active">active</option>
                  <option value="retired">retired</option>
                </select>
                <div class="flex gap-2">
                  <button type="button" (click)="save()" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                    Save
                  </button>
                  <button type="button" (click)="editing.set(null)" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="button" (click)="remove(agent.id)" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                    Remove
                  </button>
                </div>
              </div>
            } @else {
              <p class="mt-2 text-sm text-gray-600">{{ agent.instructions }}</p>
            }
          </li>
        } @empty {
          <li class="text-gray-500">No agents. Load defaults to seed them.</li>
        }
      </ul>
    }
  `,
})
export class AgentsComponent {
  private readonly agentService = inject(AgentService);

  protected readonly agents = this.agentService.agents;
  protected readonly editing = signal<WithId<AgentDefinition> | null>(null);
  protected readonly instructions = signal('');
  protected readonly tools = signal('');
  protected readonly model = signal('');
  protected readonly status = signal<AgentStatus>('active');
  protected readonly showImport = signal(false);
  protected readonly importText = signal('');
  protected readonly importError = signal('');
  protected readonly models = signal<ModelOption[]>([]);
  protected readonly modelsLoading = signal(false);
  protected readonly modelsError = signal('');
  protected readonly modelIds = computed(() => this.models().map((m) => m.id));

  edit(agent: WithId<AgentDefinition>): void {
    this.editing.set(agent);
    this.instructions.set(agent.instructions);
    this.tools.set(agent.tools.join(', '));
    this.model.set(agent.model ?? '');
    this.status.set(agent.status);
    void this.loadModels();
  }

  private async loadModels(): Promise<void> {
    if (this.models().length || this.modelsLoading()) return;
    this.modelsLoading.set(true);
    this.modelsError.set('');
    try {
      this.models.set(await this.agentService.listModels());
    } catch (error) {
      this.modelsError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.modelsLoading.set(false);
    }
  }

  save(): void {
    const agent = this.editing();
    if (!agent) return;
    const model = this.model().trim();
    const definition: AgentDefinition = {
      role: agent.role,
      title: agent.title,
      instructions: this.instructions().trim(),
      tools: this.tools()
        .split(',')
        .map((tool) => tool.trim())
        .filter(Boolean),
      ...(model ? { model } : {}),
      ...(agent.maxTurns !== undefined ? { maxTurns: agent.maxTurns } : {}),
      status: this.status(),
      createdAt: agent.createdAt,
      updatedAt: Date.now(),
    };
    void this.agentService.save(agent.id, definition);
    this.editing.set(null);
  }

  remove(id: string): void {
    void this.agentService.remove(id);
    this.editing.set(null);
  }

  loadDefaults(): void {
    void this.agentService.loadDefaults();
  }

  exportBundle(): void {
    const blob = new Blob([JSON.stringify(this.agentService.toBundle(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'agents.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  runImport(): void {
    this.importError.set('');
    let bundle: Record<string, unknown>;
    try {
      bundle = JSON.parse(this.importText());
    } catch {
      this.importError.set('Invalid JSON');
      return;
    }
    this.agentService
      .importBundle(bundle)
      .then(() => {
        this.showImport.set(false);
        this.importText.set('');
      })
      .catch((err: unknown) => this.importError.set(String(err)));
  }
}
