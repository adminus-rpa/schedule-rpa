# Cleanup

Clean up isolated workspaces deliberately. Worktree removal does not integrate changes, delete every branch, or preserve untracked files for you.

## Before Removing a Worktree

- [ ] Confirm whether the work should be committed, stashed, patched, or discarded
- [ ] Check for untracked files worth saving
- [ ] Record validation and handoff notes
- [ ] Push or preserve branches you want to keep
- [ ] Confirm the lead/integrator has reviewed the result

## Remove Worktrees

```bash
# Remove worktree (fails if uncommitted changes)
git worktree remove ../repo-review

# Force remove (discards changes)
git worktree remove --force ../repo-scratch
```

## Prune Stale References

After manually deleting worktree directories:

```bash
# Clean up stale worktree metadata
git worktree prune

# Dry run first
git worktree prune --dry-run

# Verbose output
git worktree prune -v
```

## Branch Cleanup

Worktree removal does not delete branches:

```bash
# Delete local branch after worktree removal
git branch -d feature-branch

# Force delete if unmerged and intentionally discarded
git branch -D feature-branch
```

Only delete branches after confirming the useful work is merged, cherry-picked, patched, or intentionally abandoned.

## Disk Space Recovery

Worktrees share `.git` but duplicate working files and dependency directories.

```bash
# Check worktree sizes
du -sh ../project-*

# After removal, git gc for full cleanup
git gc --prune=now
```

## Troubleshooting

### "worktree is locked"

```bash
git worktree unlock ../locked-worktree
git worktree remove ../locked-worktree
```

### "not a valid worktree"

Directory deleted manually. Prune metadata:

```bash
git worktree prune
```

### Shared runtime conflicts

Worktrees do not isolate ports, databases, queues, or containers. Stop or rename local services before assuming a git cleanup fixed the environment.
