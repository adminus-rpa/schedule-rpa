# Reference: AI-Ready Deep Module Architecture

Sources synthesized from:

- `Your codebase is NOT ready for AI (here's how to fix it)`
- `How To De-Slop A Codebase Ruined By AI (with one skill)`

## Core thesis

AI does not just follow prompts; it follows the shape of the codebase. If the filesystem, public interfaces, tests, and module boundaries do not expose a clear map, each agent session enters like a new starter with no memory and has to rediscover everything.

Bad architecture makes AI worse by causing:

1. **Slow feedback** — the agent cannot quickly know whether a change worked.
2. **Poor discoverability** — the agent cannot find the right module, interface, or tests.
3. **Human cognitive burnout** — the human has to supervise scattered changes and hold hidden relationships in mind.
4. **Accelerated entropy** — cheap changes compound into a ball of mud.

Good architecture for humans is good architecture for AI: clear modules, simple interfaces, strong tests, explicit seams, and progressive disclosure of complexity.

## Glossary

### Module

A coherent unit of behavior in the application: an auth subsystem, video editor service, thumbnail feature, logger, pricing rules, policy lifecycle, claim workflow, etc.

A module is not necessarily one file. It is the unit callers should think in.

### Interface

Everything a caller must know to use the module correctly:

- exported functions/classes/types;
- lifecycle expectations;
- invariants;
- documentation;
- error semantics;
- ordering rules;
- required dependencies.

The interface is the part humans should apply taste to. It is also the part agents should find first.

### Implementation

The hidden machinery behind the interface. Implementation can be larger, messy during migration, or heavily delegated to AI as long as the public behavior is constrained by tests.

### Deep module

A module with a simple interface hiding substantial implementation. Deep modules maximize behavior per unit of caller knowledge.

Signs of depth:

- callers import one obvious entry point;
- types/docs explain the module without reading internals;
- tests lock down behavior at the boundary;
- changes and bugs concentrate inside the module;
- agents can use it without opening every internal file.

### Shallow module

A module with a complex interface and little hidden behavior. Callers must know too much: ordering, internal types, file layout, side effects, and cross-module coordination.

Signs of shallowness:

- many tiny modules with arbitrary imports;
- tests mostly cover extracted pure helpers;
- real behavior depends on caller choreography;
- related changes span many files;
- public API is almost as complex as implementation.

### Seam

The boundary where a module's interface lives. Seams are where tests, mocks, fakes, adapters, and alternative implementations attach.

Good seams are explicit. Bad seams are implicit agreements scattered across call sites.

### Adapter

A concrete implementation that satisfies a seam: real clock vs fake clock, real payment API vs test fake, production repository vs in-memory repository, vendor SDK adapter vs domain port.

### Locality

Related rules, changes, and bugs concentrate in one place. High locality means when a rule changes, you know where it lives.

### Leverage

Capability gained per unit of interface learned. High leverage means callers and agents learn a small API and get substantial behavior.

### Gray-box module

An AI-friendly deep module whose internals can be inspected when needed, but normally do not need to be. Humans review the boundary and tests; agents can implement inside the box.

### Progressive disclosure

The interface/docs should tell agents what the module does before they inspect implementation. Complexity is revealed only when needed.

## Candidate discovery rubric

Look for candidates that score high on at least two of these dimensions.

### 1. Discoverability friction

Ask:

- Would a new starter know where this concept lives?
- Is the public interface obvious from the filesystem?
- Does the agent have to grep through many files before understanding the concept?
- Are docs/types close to the module boundary?

Common fix: create a service/domain folder with an explicit entry point and local README.

### 2. Feedback-loop friction

Ask:

- Is there an obvious test command for this module?
- Do tests validate behavior at the seam?
- Can an agent know quickly whether its change preserved the invariant?

Common fix: move tests from tiny internals to boundary behavior.

### 3. Cognitive-load friction

Ask:

- Does the human have to remember hidden relationships between many files?
- Are changes spread across many unrelated-looking modules?
- Could this be represented as one of “seven or eight lumps of stuff” instead?

Common fix: deepen around a product/domain concept.

### 4. Duplicate-rule friction

Ask:

- Does the same rule exist in frontend/backend, client/server, validation/UI, or multiple features?
- Can the two copies drift?
- Is there a single seam where agreement is tested?

Common fix: centralize the rule behind one module/interface.

Examples: ordering rules, permissions, date math, pricing, state transitions, validation, eligibility, normalization, serialization.

### 5. Arbitrary-import friction

Ask:

- Can any file import any other file?
- Are internals imported from outside the conceptual module?
- Would an import-boundary rule make the architecture clearer?

Common fix: expose an index/public API and restrict deep imports.

### 6. Bad-test-shape friction

Ask:

- Were pure functions extracted only to make testing easy?
- Do tests miss the integration seam where bugs actually happen?
- Are mocks attached at accidental rather than architectural boundaries?

Common fix: define the real seam and test through it.

## Candidate presentation format

Use this format before proposing solutions:

```markdown
## Candidate N: [concept]

**Modules involved**

- `path/a` — [role]
- `path/b` — [role]

**Why this is AI friction**
[Discoverability / feedback / cognitive load / arbitrary imports]

**Deepening move**
[What behavior could move behind one interface]

**Locality gain**
[What changes/bugs concentrate here]

**Leverage gain**
[What callers/agents no longer need to know]

**Seam/test impact**
[Boundary tests, fake/adapters, feedback command]

**Confidence / risk**
[High/medium/low + main risk]
```

End with: “Which candidate should we grill?”

## Grilling questions

After the user picks a candidate, ask only questions that affect the boundary. Avoid trivia.

### Ownership

- What concept should this module own completely?
- What should stay outside as a dependency?
- Which current files become implementation details?

### Interface

- What is the smallest useful public API?
- What is the most common caller path?
- What caller knowledge should disappear?
- What types/docs need to sit at the boundary?

### Invariants

- What rule must never drift again?
- What ordering/state/validation constraint should be tested at the seam?
- What errors should the interface expose vs hide?

### Dependencies

- Which dependencies are same-process and owned by us?
- Which dependencies cross process/team boundaries?
- Which need ports/adapters/fakes?

### Migration

- Can the new module delegate to old code first?
- Which caller should migrate first?
- What compatibility layer reduces risk?
- What dead code can be deleted after migration?

If the user asks the agent to decide, provide recommended answers and rationale.

## Interface design prompts

When using subagents or generating alternatives, assign different design constraints.

### Minimal interface

Design the smallest possible interface: 1-3 entry points, optimized for hiding complexity and preventing caller choreography.

### Common-caller interface

Design the interface that makes the dominant use case trivial, even if rarer cases need escape hatches.

### Ports-and-adapters interface

Design around explicit ports for dependencies that cross process, team, vendor, time, randomness, filesystem, or network boundaries.

### Migration-first interface

Design an interface that can wrap existing code immediately, migrate callers incrementally, then delete old internals later.

Each design should include:

1. Interface signature.
2. Example call site.
3. Hidden implementation details.
4. Dependencies/adapters.
5. Boundary tests.
6. Trade-offs.

## Dependency categories

Classify dependencies so the seam is realistic.

### 1. Same-process, same-team

Dependencies between modules owned by the same team, running in the same process. Easiest to consolidate.

**Strategy:** merge/deepen directly; use local boundary tests.

### 2. Same-process, different-team

Dependencies crossing team ownership but still in-process.

**Strategy:** propose shared interface; coordinate ownership; avoid unilateral breakage.

### 3. Cross-process, same-team

Network boundaries you control.

**Strategy:** deepen behind a facade/client; you can reshape both sides over time.

### 4. Cross-process, different-team

Network/vendor boundary you do not control.

**Strategy:** ports & adapters; own your side of the interface; fake the port in tests.

| Category | Consolidation strategy             | Interface ownership                     |
| -------- | ---------------------------------- | --------------------------------------- |
| 1        | Merge modules directly             | Full control                            |
| 2        | Shared interface with coordination | Negotiated                              |
| 3        | Facade/client boundary             | Full control over your side and service |
| 4        | Ports & adapters                   | Your side only                          |

## What good output looks like

A good architecture pass produces one of:

- a rejected candidate with clear rationale;
- a focused refactor plan;
- a proposed deep module interface;
- a seam/adapters/test plan;
- a GitHub issue or PRD for an implementation agent;
- a small implemented slice when explicitly requested.

It should not produce a vague “clean up architecture” recommendation.

## Refactor RFC / issue template

Use this when turning a candidate into an implementation ticket.

````markdown
## Summary

[1-2 sentence description of the module-deepening refactor and why it matters for AI-readiness/testability.]

## Current State

### Modules involved

- `path/to/module-a` — [what it owns today]
- `path/to/module-b` — [what it owns today]

### Friction evidence

- Discoverability: [what is hard for a new starter/agent to find]
- Feedback: [what tests/commands are missing or misleading]
- Cognitive load: [what relationships humans must remember]
- Drift risk: [duplicated/parallel rules, if any]

### Dependency category

[1/2/3/4 from the dependency categories]

## Proposed Deep Module

### Ownership

[What this module owns after the refactor]

### Public interface

```[language]
[Interface/types/functions]
```
````

### Example usage

```[language]
[Most common caller path]
```

### What becomes implementation detail

- [Old files/rules/caller choreography hidden behind the interface]

### Dependencies / adapters

- [Injected deps, ports, fakes, external services]

## Tests / Feedback Loop

### Boundary tests to add

- [Behavior/invariant tested through the public interface]

### Tests to replace or delete

- [Internal/helper tests that become redundant]

### Validation command

```bash
[command]
```

## Migration Plan

1. [ ] Create the new module/interface.
2. [ ] Implement by delegating to existing code where possible.
3. [ ] Add boundary tests around current behavior.
4. [ ] Migrate one low-risk caller.
5. [ ] Migrate remaining callers.
6. [ ] Remove deep imports/old duplicated rules.
7. [ ] Add docs/import-boundary guard if needed.

## Risks / Trade-offs

- [Risk]
- [Mitigation]
- [What we intentionally are not solving]

## Definition of Done

- [ ] Callers use the public interface, not internals.
- [ ] Core invariants are tested at the seam.
- [ ] Agent/new-starter path is documented.
- [ ] Old duplicate/shallow code is removed or explicitly deprecated.

```

## Anti-patterns

Avoid these while using the skill:

- Treating the skill as an AFK cleanup bot.
- Designing interfaces before grounding in concrete call sites.
- Measuring architecture only by file count or function size.
- Extracting pure helpers just to make tests easy while ignoring real seams.
- Creating many tiny “clean” modules that increase caller knowledge.
- Letting agents freely change public boundaries without human taste review.
- Producing broad rewrite plans with no first migration slice.

## Quick checklist

Before handing work to an implementation agent, confirm:

- [ ] The module boundary is named and visible in the filesystem.
- [ ] The public interface is small and documented.
- [ ] The implementation hides meaningful behavior.
- [ ] Callers no longer need duplicated/choreographed knowledge.
- [ ] Tests hit the seam, not only internals.
- [ ] External dependencies have adapters/fakes where useful.
- [ ] Migration can happen incrementally.
```
