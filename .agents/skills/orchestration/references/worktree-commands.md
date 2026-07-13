# Worktree Commands

Git worktrees are an isolation tool, not the default orchestration plan. Use them when the workspace preflight is clear and the integration cost is justified.

## Before Creating a Worktree

Check:

- `git status --short` in the main checkout
- base branch and target branch
- whether ignored files, `.env`, dependencies, generated files, ports, and databases need setup
- who will merge or cherry-pick the result
- cleanup path after review

## Create Worktrees

```bash
# Create from current branch
git worktree add ../repo-name-suffix

# Create from specific branch
git worktree add ../repo-review main

# Create with new branch
git worktree add -b feature-x ../repo-feature main

# Create detached (throwaway experiment)
git worktree add --detach ../repo-experiment HEAD
```

## List and Inspect

```bash
# List all worktrees
git worktree list

# Verbose output with branch info
git worktree list --porcelain
```

Inside the worktree, verify before editing:

```bash
pwd
git status --short
git branch --show-current
```

## Setup Reminder

Worktrees do not copy ignored project state. Depending on the repo, you may need to recreate or link:

- `.env` or secret loading setup
- `node_modules`, virtualenvs, build output, generated code
- local databases, queues, object storage, or service containers
- port assignments and preview URLs

If this setup is more work than the task, use the shared checkout with one mutating worker instead.

## Lock/Unlock

Prevent accidental removal:

```bash
# Lock a worktree
git worktree lock ../repo-important

# Unlock when done
git worktree unlock ../repo-important

# Lock with reason
git worktree lock --reason "Long-running refactor" ../repo-refactor
```

## Move Worktrees

```bash
# Relocate worktree directory
git worktree move ../old-path ../new-path
```

## Repair

Fix broken worktree references:

```bash
# Repair all worktrees
git worktree repair

# Repair specific path
git worktree repair ../broken-worktree
```

## Common Patterns

### Isolated Feature Work

```bash
git worktree add -b feature-a ../repo-feature-a main
```

### Quick PR Review

```bash
git worktree add ../repo-pr-123 origin/pr-branch
# Review, then remove
git worktree remove ../repo-pr-123
```

### Experimental Work

```bash
git worktree add --detach ../repo-experiment HEAD
# Experiment freely
# Discard or cherry-pick results
git worktree remove --force ../repo-experiment
```
