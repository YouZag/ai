import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { deleteField } from 'firebase/firestore';
import { AgentService, type ModelOption } from '../core/data/agent.service';
import type { WithId } from '../core/firebase/firestore-rx';
import type { AgentDefinition } from '@schemas';

@Component({
  selector: 'app-agents',
  imports: [FormsModule],
  template: `
    <h2 class="mb-4 text-lg font-semibold">Agents</h2>
    @if (agents.loading()) {
      <p class="text-gray-500">Loading…</p>
    } @else if (agents.error()) {
      <p class="text-red-700">Couldn't load agents. {{ agents.error() }}</p>
    } @else {
      <ul class="grid max-w-3xl gap-3">
        @for (agent of agents.data(); track agent.id) {
          <li class="rounded-md border border-gray-200 p-3">
            @if (editingId() === agent.id) {
              <form class="grid gap-3" (submit)="$event.preventDefault(); save(agent)">
                <div class="flex items-center gap-3">
                  <strong>{{ agent.title }}</strong>
                  <span class="text-sm text-gray-500">{{ agent.role }}</span>
                </div>

                <label class="grid gap-1 text-sm">
                  <span class="text-gray-600">Instructions</span>
                  <textarea
                    rows="5"
                    name="instructions"
                    [ngModel]="fInstructions()"
                    (ngModelChange)="fInstructions.set($event)"
                    class="rounded-md border border-gray-300 p-2 font-mono text-xs"
                  ></textarea>
                </label>

                <label class="grid gap-1 text-sm">
                  <span class="text-gray-600">Model</span>
                  <select
                    name="model"
                    [ngModel]="fModel()"
                    (ngModelChange)="fModel.set($event)"
                    class="rounded-md border border-gray-300 p-2"
                  >
                    <option value="">Default (let the SDK choose)</option>
                    @if (modelsLoading()) {
                      <option disabled>Loading models…</option>
                    }
                    @for (model of models(); track model.id) {
                      <option [value]="model.id">{{ model.displayName }}</option>
                    }
                    @if (fModel() && !modelIds().includes(fModel())) {
                      <option [value]="fModel()">{{ fModel() }} (current)</option>
                    }
                  </select>
                  @if (modelsError()) {
                    <span class="text-red-700">Couldn't load the live list: {{ modelsError() }}</span>
                  }
                </label>

                <div class="flex gap-3">
                  <label class="grid flex-1 gap-1 text-sm">
                    <span class="text-gray-600">Max turns</span>
                    <input
                      type="number"
                      min="1"
                      name="maxTurns"
                      [ngModel]="fMaxTurns()"
                      (ngModelChange)="fMaxTurns.set($event)"
                      class="rounded-md border border-gray-300 p-2"
                    />
                  </label>
                  <label class="grid flex-1 gap-1 text-sm">
                    <span class="text-gray-600">Status</span>
                    <select
                      name="status"
                      [ngModel]="fStatus()"
                      (ngModelChange)="fStatus.set($event)"
                      class="rounded-md border border-gray-300 p-2"
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>
                </div>

                <div class="flex gap-2">
                  <button
                    type="submit"
                    [disabled]="saving()"
                    class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {{ saving() ? 'Saving…' : 'Save' }}
                  </button>
                  <button
                    type="button"
                    (click)="cancel()"
                    class="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            } @else {
              <div class="flex items-center gap-3">
                <strong>{{ agent.title }}</strong>
                <span class="text-sm text-gray-500">{{ agent.role }}</span>
                <span class="flex-1"></span>
                <span class="text-xs text-gray-400">{{ agent.model ?? 'default model' }}</span>
                <span class="text-xs text-gray-400">{{ agent.status }}</span>
                <button
                  type="button"
                  (click)="startEdit(agent)"
                  class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
              <p class="mt-2 text-sm whitespace-pre-line text-gray-600">{{ agent.instructions }}</p>
            }
          </li>
        } @empty {
          <li class="text-gray-500">No agents yet.</li>
        }
      </ul>
    }
  `,
})
export class AgentsComponent {
  private readonly agentService = inject(AgentService);

  protected readonly agents = this.agentService.all;

  protected readonly editingId = signal<string | null>(null);
  protected readonly fInstructions = signal('');
  protected readonly fModel = signal('');
  protected readonly fMaxTurns = signal<number | null>(null);
  protected readonly fStatus = signal<'active' | 'inactive'>('active');
  protected readonly saving = signal(false);

  protected readonly models = signal<ModelOption[]>([]);
  protected readonly modelsLoading = signal(false);
  protected readonly modelsError = signal<string | null>(null);
  protected readonly modelIds = computed(() => this.models().map((model) => model.id));

  startEdit(agent: WithId<AgentDefinition>): void {
    this.editingId.set(agent.id);
    this.fInstructions.set(agent.instructions);
    this.fModel.set(agent.model ?? '');
    this.fMaxTurns.set(agent.maxTurns ?? null);
    this.fStatus.set(agent.status);
    void this.loadModels();
  }

  cancel(): void {
    this.editingId.set(null);
  }

  async save(agent: WithId<AgentDefinition>): Promise<void> {
    this.saving.set(true);
    const maxTurns = this.fMaxTurns();
    const model = this.fModel();
    try {
      await this.agentService.update(agent.id, {
        instructions: this.fInstructions(),
        status: this.fStatus(),
        updatedAt: Date.now(),
        model: model ? model : deleteField(),
        maxTurns: typeof maxTurns === 'number' && maxTurns > 0 ? maxTurns : deleteField(),
      });
      this.editingId.set(null);
    } catch (error) {
      this.modelsError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadModels(): Promise<void> {
    if (this.models().length || this.modelsLoading()) return;
    this.modelsLoading.set(true);
    this.modelsError.set(null);
    try {
      this.models.set(await this.agentService.listModels());
    } catch (error) {
      this.modelsError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.modelsLoading.set(false);
    }
  }
}
