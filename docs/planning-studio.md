# Planning Studio — specification

## 1. The problem

`planFeature` fires **one Strategist run per feature**, each targeting a single feature in
isolation (`onFeaturePlanned` → `planFeature` → a `strategist` run with `target: { kind:
'feature' }`). Nothing ever reconciles the vision, the *whole* feature set, and the
architecture into one coherent thing. Each feature is decomposed blind to the others; steps
inherit a thin slice of intent; no agent holds the whole picture. The result is disconnected
fragments instead of one cohesive product — exactly what the first drive produced.

There is an assembly line (Strategist → Builder/Designer → Tester → Auditor → integrate) but
**no design studio in front of it.** This spec adds that studio: a human-in-the-loop,
conversational planning stage that produces one coherent, approved plan, which the whole
pipeline then inherits.

## 2. Goals / non-goals

**Goals**
- A single interactive stage where a human and an Opus agent build the vision, the full
  cross-aware feature set, and the architecture **together**, iterating until it's coherent.
- One durable, approved **plan artifact** that becomes the inherited context for every
  downstream agent — no more cold-boot rediscovery, no more per-feature isolation.
- An explicit **planning → building gate**: nothing autonomous touches code until the human
  locks the plan. This also front-loads steering and kills most live-correcting branch thrash.

**Non-goals**
- The human does **not** hand-author steps. The studio stops at *vision + features +
  architecture + ordering*; step decomposition stays automated (now context-rich).
- Not a replacement for the execution pipeline — it feeds it.
- Not Claude Code; just **Opus over the Anthropic API**, in a chat loop, with tools.

## 3. The artifact: the approved Plan

The studio reads and writes four Firestore shapes (all Zod schemas under `schemas/`, exported
from `schemas/index.ts`, per the firestore rule). The plan is the live truth during planning;
on lock it is frozen into a repo-committed brief (see §7).

### 3.1 Vision (extend existing `vision/current`)
```ts
export const VisionSchema = z.object({
  statement: z.string(),
  principles: z.array(z.string()),
  nonGoals: z.array(z.string()),
  northStar: z.string().optional(),   // the one outcome everything serves
  updatedAt: TimestampSchema,
});
```

### 3.2 Feature (extend existing `features`)
```ts
export const FeatureStatusSchema = z.enum([
  'draft', 'proposed', 'approved', 'planned', 'building', 'done', 'archived',
]);
export const FeatureSchema = z.object({
  title: z.string(),
  description: z.string(),
  rationale: z.string(),              // the WHY — the intent a builder must preserve
  acceptance: z.array(z.string()),    // feature-level acceptance criteria
  dependsOn: z.array(IdSchema),       // cross-feature dependencies
  touches: z.array(IdSchema),         // architecture node ids this feature needs
  status: FeatureStatusSchema,
  priority: z.number().int(),
  order: z.number().int().optional(), // explicit build ordering (human or agent set)
  createdBy: z.string(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
```

### 3.3 Architecture node (align with existing `architecture` collection + Reconciler)
```ts
// LayerSchema already exists (schema | service | component) and is reused by StepSchema.layer
export const ArchitectureNodeSchema = z.object({
  name: z.string(),
  layer: LayerSchema,
  description: z.string(),
  dependsOn: z.array(IdSchema),         // other node ids — the backbone of build order
  featureIds: z.array(IdSchema),        // features that require this node
  status: z.enum(['planned', 'exists']),// studio authors 'planned'; Reconciler marks 'exists'
  updatedAt: TimestampSchema,
});
```

### 3.4 Planning session (the conversation, resumable)
```ts
export const PlanningMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: TimestampSchema,
});
export const PlanningSessionSchema = z.object({
  status: z.enum(['active', 'locked']),
  title: z.string(),
  lockedAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema,
});
// messages live in subcollection planningSessions/{id}/messages for scale
```

### 3.5 Pipeline phase gate
```ts
export const PipelinePhaseSchema = z.enum(['planning', 'building']);
export const ControlSchema = z.object({
  phase: PipelinePhaseSchema,
  updatedAt: TimestampSchema,
});
// single doc control/pipeline
```

## 4. The studio agent (runtime)

Reuse the **Express server already on App Hosting** (the `/api/models` endpoint set the
precedent). Add a streaming chat endpoint:

- `POST /api/plan` `{ sessionId, message }` → **SSE** stream of assistant tokens + tool-call
  events. Admin-only (same auth as the cockpit).
- Per turn the server: loads the session transcript + current vision/features/architecture,
  builds the studio system prompt + current-plan context (**prompt-cached** across turns),
  calls **Opus (`claude-opus-4-8`)** with tool use, applies each tool call to Firestore
  through typed Admin converters (so the cockpit updates live), streams the reply, and
  persists the user + assistant messages.

### 4.1 The studio's tools (Anthropic tool use → typed Firestore writes)
- `upsert_vision`, `upsert_feature`, `remove_feature`, `set_feature_dependencies`,
  `reorder_features`
- `upsert_architecture_node`, `link_architecture_nodes`
- `read_repo` / `read_architecture` (ground in current reality for amend/iteration)

The agent **proposes and writes**; it never locks. Locking is the human's act (§6).

### 4.2 Persona
The studio folds together three things that exist today but float disconnected: the Vision
doc, the **Architect** agent, and the **front half of the Strategist** — now as one
interactive co-designer. It interrogates the human for intent, proposes a coherent feature
set and the architecture that supports it, surfaces cross-feature dependencies and ordering,
and flags gaps/contradictions against the vision and non-goals.

## 5. The cockpit Planning view (`/planning`)

- **Chat panel** — transcript + input, streaming from `/api/plan` over SSE.
- **Live plan panels**, each a Firestore live query with explicit loading / error / ready
  states (per the firestore rule — never a stuck spinner):
  - **Vision** (statement, principles, non-goals, north star)
  - **Features** — ordered list with status, priority, cross-feature deps, acceptance
  - **Architecture** — nodes grouped by layer with their dependency edges
- **"Start build"** button — the gate (§6). Disabled until validation passes.

New browser-read collections (`planningSessions`, `architecture`, `control`) each need a
`firestore.rules` entry in the same change, plus any composite index a list query requires.

## 6. The gate (planning → building)

Today the pipeline runs unconditionally (`dispatchPendingSteps` every minute;
`onFeaturePlanned` on any feature→`planned`). The gate makes the phase explicit:

- `control/pipeline.phase` starts at **`planning`**.
- While `planning`: the studio is live; **`dispatchPendingSteps` and `onFeaturePlanned`
  no-op** (guarded on phase). No autonomous code work happens.
- **Start build** (human) runs a callable/endpoint that:
  1. **Validates** the plan — no dangling feature `dependsOn`, every approved feature has
     acceptance criteria, every feature's `touches` resolve to architecture nodes, the
     architecture `dependsOn` graph is acyclic.
  2. Flips approved features `approved → planned`.
  3. **Materializes the brief** into the repo (§7).
  4. Sets `control/pipeline.phase = 'building'`.
- Now the existing pipeline wakes and decomposes/builds against a frozen, coherent plan.

## 7. Handoff + inheritance (the part that makes agents coherent)

Two channels carry the plan into execution:

1. **Cross-feature-aware decomposition.** `planFeature`/the Strategist is changed to load the
   **whole brief** (vision + all approved features + architecture + ordering) as context, not
   just one feature. Per-feature runs stay (parallelizable), but each respects cross-feature
   `dependsOn` (mapped into step `dependsOn`) and the architecture graph. **Shared nodes are
   built once**: the first feature that needs a `planned` node builds it; later features
   depend on that step instead of rebuilding. This is what turns isolated fragments into one
   app.

2. **Inherited brief for every agent.** On lock, the brief is written to a committed
   `PROJECT_BRIEF.md` (vision + feature map + architecture). Because we already set
   `settingSources: ['project']`, that file loads into **every** Builder/Designer/Tester/
   Auditor automatically — so they all see the vision, their feature's place in it, and the
   architecture they must fit. The thin handoff is gone.

## 8. Re-entry / live revision

Re-opening the studio while `phase = building` loads the current plan **plus running state**.
The Reconciler keeps `architecture` truthful to the code (`status: 'exists'`), so the studio
designs against reality. New/changed intent produces **amend** features and `kind: 'amend'`
steps; a re-lock re-materializes the brief and appends to the build. The plan is a living
document, not a one-shot.

## 9. How existing roles fold in

| Role | Before | After |
|---|---|---|
| Vision doc | static, hand-edited | authored in the studio |
| Architect | separate agent, disconnected | the studio's co-designer persona |
| Strategist | per-feature, context-starved | post-gate decomposer with the full brief |
| Optimizer | proposes features straight into the pipeline | proposes into the **draft** backlog for human review |
| Reconciler | architecture-graph truth | unchanged; now feeds studio re-entry |

## 10. Build order (implementing the studio)

1. **Schemas + rules + indexes** — vision ext, feature ext, architecture node, planning
   session, control. Each browser-read collection gets its rule + index in the same change.
2. **The phase gate** — `control/pipeline`, guard `dispatchPendingSteps` + `onFeaturePlanned`
   on `phase === 'building'`. Cheap, and immediately makes "plan before build" real.
3. **`/api/plan`** — the Opus chat loop with tools + prompt caching + transcript persistence.
4. **Planning view** — chat + the three live panels, full loading/error/ready states.
5. **Start build** — validation, feature flip, `PROJECT_BRIEF.md` materialization, phase flip.
6. **Brief-aware decomposition** — Strategist loads the brief; cross-feature deps → step
   deps; shared-node dedup. Brief inheritance via project context.
7. **Re-entry + amend**, Optimizer → backlog, Reconciler → studio on re-entry.

Each step builds and type-checks on its own and lands through the now-durable integration
path, so this can ship incrementally without a flag day.

## 11. Decisions for the human

1. **Brief form** — live Firestore truth during planning **and** a frozen `PROJECT_BRIEF.md`
   on lock (recommended), or live-only?
2. **Decomposition** — per-feature Strategist runs with the brief (recommended, parallel) or a
   single whole-plan run?
3. **Architecture authorship** — studio authors `planned` intent, Reconciler reconciles to
   `exists` from code (recommended), or auto-derive only?
4. **Human ordering depth** — expose ordering at the feature + architecture level
   (recommended) or also let you pin individual step order?
