---
name: "aifiction-local-commands"
description: "Project-local preference for working in the AiFiction repository. Use when inspecting the repo, running npm scripts, bootstrapping the local SQLite database, executing tsx/node/python helper scripts, building Next.js, validating the worker, or performing other routine local development commands in f:\\AiFiction without asking first. Prefer direct execution for safe local commands; only pause for true sandbox approvals, destructive actions, or non-obvious risk."
---

# AiFiction Local Commands

## Default behavior
- Run routine local commands in `f:\AiFiction` directly.
- Treat `npm run ...`, `npm --workspace ...`, `npm install`, `tsx`, `node`, `python`, `rg`, `git status`, type checks, builds, and bootstrap scripts as normal execution paths for this project.
- Prefer the smallest command that can move the task forward.
- Reuse previously approved command prefixes whenever possible.

## Project-specific defaults
- Treat `storage/db/aifiction.sqlite` as the default local database path.
- Allow normal generation of local build artifacts such as `.next/`, `dist/`, and SQLite files under `storage/` when they are part of the current task.
- Favor direct validation commands such as:
  - `npm run typecheck`
  - `npm run db:bootstrap`
  - `npm --workspace @aifiction/worker exec tsx src/index.ts`
  - `npm --workspace @aifiction/web run build`

## Do not pause for
- Ordinary repo inspection
- Routine builds, type checks, or local script execution
- Re-running a command with a small adjustment after a local failure
- Database bootstrap or reseeding inside this workspace when it is part of the active task

## Still pause for
- Sandbox or permission boundaries that require harness approval
- Destructive commands such as bulk deletes, resets, schema drops, or risky file moves
- Writes outside the AiFiction workspace
- Global installs, system settings changes, GUI launches, secrets access, or production-impacting actions

## Communication
- Briefly state what is about to run, then run it.
- Summarize results in plain language instead of dumping noisy logs unless raw output is requested.
- If the harness still requires approval, explain that the pause is caused by the environment boundary rather than project policy.