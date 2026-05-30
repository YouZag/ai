# funday.io — Product Brief

This is the product every agent serves. Read it before any step and trace every change back to the Prime Directive. If a step conflicts with a principle below, the principle wins — flag it instead of building it. Features are capabilities; the planning agent owns decomposition into steps.

## Prime Directive
Create the most real-world joy for the most people. When joy and short-term revenue conflict, **joy wins**. We earn when joy happens, not before.

## What funday.io is
Turn open time into a real, doable "Funday" — grounded in real places nearby — and live it. Built on the spirit of Sunday Funday. The loop:
**Uncover** (find something real to do) → **Create** (make it actually happen) → **Share** (one person's good day seeds the next).

## Operating principles (hard constraints — review gates, not aspirations)
1. **Joy, not screen time.** Success = the person left to do the thing. Never optimize session length, opens, or streaks. No FOMO, guilt, or comparison feeds.
2. **Real or it doesn't count.** Every place/event surfaced must be a real, currently-existing, nearby anchor. A hallucinated anchor is a **release-blocking bug**.
3. **Everyone.** Free + solo is first-class, never a fallback. Low-data/offline-friendly. Must work in rural and small towns, not just big cities — verify coverage, don't assume.
4. **Spark, don't dictate.** Hand over a doable idea and step back; the person owns it.
5. **Privacy is not for sale.** No data sales, ever. Personalization must never become surveillance.
6. **We earn when joy happens.** Monetize on completed experiences (commission), a premium planning tier, and clearly-labeled sponsored Fundays. No ad feeds.

## Success metric
The **Joy Ledger**: completed real-world Fundays and remembered joy — never engagement. This defines success; every feature optimizes against it. Build a thin version early.

## Feature backlog (epics — the planning agent decomposes these)
Build order: **F1 → thin F9 → F4 → F2 → F7/F8 → F5/F6 → F3 → F11 → F10/F12 woven throughout.** F10 (Access) and F12 (Safety) are constraints on every feature, not phases.

**Uncover**
- **F1 — "Right Now" Funday Generator** ⭐ *first; detailed below.* From a person's live constraints, generate a real, doable Funday they can start almost immediately.
- **F2 — Serendipity Discovery.** Map/browse the hidden, local, unexpected nearby. Surface the weird and small, not the most-monetizable sameness.
- **F3 — Context Engine.** Learn patterns (mood, rhythm, did vs. ignored) to sharpen Uncover. Privacy-respecting; powers F1/F2 without surveillance.

**Create**
- **F4 — Funday Builder.** Turn an idea into an actionable plan (sequence, timing, what to bring, getting there, weather/daylight) before the impulse fades.
- **F5 — People & Coordination.** Invite/RSVP/coordinate shared Fundays. Lightweight logistics, not a chat app.
- **F6 — Booking & Real-World Bridge.** Connect to venues/hosts/classes/events; reservations where relevant. Primary monetization rail (commission on completion).

**Share**
- **F7 — Templates & Stories.** A completed Funday becomes a reusable template and an optional shareable memory.
- **F8 — Funday Library.** Discover what others actually did nearby. A library of doable things, never an engagement feed.

**Cross-cutting (features, not afterthoughts)**
- **F9 — Joy Ledger.** The measurement backbone (completions + remembered joy). Thin version ships with F1.
- **F10 — Access Guarantees.** Free-tier joy, accessibility, low-data/offline, rural coverage as hard constraints.
- **F11 — Monetization Rails.** Commission-on-completion (via F6), premium planning tier, labeled sponsored Fundays.
- **F12 — Trust & Safety.** Reporting, sensible defaults for meeting strangers, location-sharing controls.

## First feature — F1: "Right Now" Funday Generator
**Magic moment:** a person with open time and no plan tells us their situation in under a minute and gets a real, specific, doable Funday nearby they can start almost immediately. They tap "I'm doing it," go live it, optionally mark "it happened." This is the demo and the whole thesis — nail it before anything else.

**Why first:** no supply-side dependency; delivers value to one user immediately; the free + solo path alone delights; if it feels like magic, the company is real.

**User flow (v1):** Open → "What's your situation?" (taps, not typing) → generate 3 grounded candidates → choose (or "something else" to regenerate) → "here's how to start" (first step, where, ~how long) → optional one-tap "it happened" → Joy Ledger.

**Inputs (~5 quick choices; sensible defaults so one tap works):** time available · mood/energy · company (solo / one / group / open) · budget (free / cheap / treat) · location (current or set manually; privacy-respected).

**Each candidate:** a title with personality · a one-line joy pitch · a **real nearby anchor** (grounded against real data) · practical reality (rough duration, cost, what to bring, how to begin). Genuinely doable now — no aspirational filler.

**In scope v1:** constraint intake, grounded generation of 3 candidates, regenerate, "how to start" view, one-tap "it happened."
**Out of v1 (don't let it creep in):** booking (F6), group invites (F5), social feed (F8), deep personalization (F3), sponsored (F11).

**Definition of done (acceptance):**
1. A first-time user goes from open → a grounded, doable, real Funday in **under 60 seconds**, including a **free + solo** path.
2. **Every** surfaced anchor is a real, currently-existing nearby place/event — no hallucinations.
3. "It happened" records a completion event to the Joy Ledger.
4. It feels like magic, not a search results page — voice and specificity carry it.
5. Honors every principle (joy-not-screen; everyone incl. low-data/rural; spark-don't-dictate; no streaks/FOMO).

## Architecture backbone (direction; the planning agent sequences it)
- **schema:** `Funday` (concept + grounded anchor + plan), `JoyEvent` (generated → chosen → happened), `Constraints` (the intake set).
- **service:** **Generation** (Anthropic API turns constraints + local context into Funday concepts with voice — zero hand-authored content per city) → **Grounding** (check each concept against a real places/events source; drop what can't be grounded — never fake an anchor) → **Assembly** (3 candidates + regenerate) → **Joy Ledger** (persist events).
- **component:** constraint intake (+ defaults), location capture + privacy controls, candidate view, "how to start" view, "it happened" capture.

Pattern: **generate concepts → ground each to a real nearby anchor → assemble the doable plan.** Where grounding fails, drop the concept rather than fake it.

## For the planning agent
Decompose F1 around: (1) intake UI + defaults; (2) location + privacy; (3) generation service; (4) grounding service; (5) assembly + regenerate; (6) "how to start" view; (7) thin Joy Ledger + "it happened"; (8) access constraints (free path, low-data, rural) as acceptance across all. You own sequencing and the step breakdown. Build F1 so well that someone with a free afternoon and twenty dollars walks out the door grinning.
