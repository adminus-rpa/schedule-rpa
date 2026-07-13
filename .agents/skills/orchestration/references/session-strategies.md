# Session Strategies

Choose the smallest workspace model that protects the work without creating unnecessary setup, runtime, or merge overhead.

## Default: Shared Workspace, Controlled Mutation

Use the existing checkout/current branch when the work is small, sequential, tightly coupled, or depends on local setup that would be expensive to recreate.

Good default shape:

```
[lead]        plans, reviews, integrates, reports
[implementer] mutates files; one active mutator at a time
[reviewer]    read-only review or test investigation
[researcher]  read-only docs/log/source lookup
```

Rules:

- Keep one mutating worker active unless file ownership is explicitly non-overlapping.
- Mark workers as read-only or mutating when the harness supports it.
- Tell read-only workers not to edit files or run destructive commands.
- Let the lead synthesize findings and decide what lands.

## Read-Only Satellites

Parallel sessions are low-risk when they do not write files:

- Research docs, APIs, or prior sessions
- Inspect logs, CI output, or browser behavior
- Review a diff for security, accessibility, tests, or maintainability
- Compare options and return a recommendation

This preserves lead context without creating merge work.

## Worktrees and Other Isolation

Use a separate worktree, clone, container, VM, or preview environment when the task is genuinely independent and isolation is cheaper than coordination.

Good fits:

- Large independent feature areas with clear file ownership
- Risky experiments that may be discarded
- PR review or repro against another branch
- Parallel implementation when each worker has its own runtime state

Poor fits:

- Tiny fixes or one-file edits
- Sequential tasks with no parallelism benefit
- Devcontainer projects that assume one checkout
- Repos with expensive installs, missing ignored files, shared databases, or hardcoded ports
- Work where conflicts will only move to a later merge step

## Worktree Preflight

Before creating one, state the plan:

1. Base branch and target branch/patch path
2. How dependencies, generated files, and ignored config are made available
3. How ports, databases, queues, and local services are isolated
4. Who integrates and validates the result
5. Cleanup command and branch retention plan

If the preflight is fuzzy, use shared cwd with controlled mutation instead.

## Communication Between Sessions

Prefer mailbox/task/artifact primitives when your harness provides them. Otherwise use short handoff files, commits, patches, or issue comments.

Every handoff should include:

- Files touched or inspected
- Decisions made
- Validation run and result
- Blockers or risks
- Whether the worker mutated files

## Context Switching

When moving between workspaces:

1. Name terminals/sessions after their role or branch.
2. Confirm `pwd`, branch, and `git status` before editing.
3. Avoid hopping between workspaces mid-task unless the handoff is explicit.
