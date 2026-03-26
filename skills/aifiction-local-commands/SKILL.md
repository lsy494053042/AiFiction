---
name: "aifiction-local-commands"
description: "Project-local preference for working in the AiFiction repository. Use when inspecting the repo, running npm scripts, bootstrapping the local SQLite database, executing tsx/node/python helper scripts, running small PowerShell diagnostics with Get-/Set-/variable assignments, building Next.js, validating the worker, or performing other routine local development commands in f:\AiFiction without asking first. Prefer direct execution for safe local commands; only pause for true sandbox approvals, destructive actions, or non-obvious risk."
---

# AiFiction Local Commands

## Default behavior
- Run routine local commands in `f:\AiFiction` directly.
- Treat `npm run ...`, `npm --workspace ...`, `npm install`, `tsx`, `node`, `python`, `rg`, `git status`, type checks, builds, bootstrap scripts, and short PowerShell helper commands as normal execution paths for this project.
- Prefer the smallest command that can move the task forward.
- Treat short PowerShell snippets such as `Get-*`, `Set-*`, `$targets = ...`, local process inspection, local port checks, and small variable-based diagnostics as routine commands that should run directly.
- Reuse previously approved command prefixes whenever possible.
- Prefer stable repo entry points before ad-hoc shell snippets when they exist, especially `npm run dev:web`, `npm run web:health`, `npm run web:doctor`, `npm run db:v2-smoke`, `npm run db:sync-smoke`, `npm run worker:sync`, and `npm run typecheck`.

## Project-specific defaults
- Treat `storage/db/aifiction.sqlite` as the default local database path.
- Allow normal generation of local build artifacts such as `.next/`, `dist/`, and SQLite files under `storage/` when they are part of the current task.
- Favor direct validation commands such as:
  - `npm run typecheck`
  - `npm run db:bootstrap`
  - `npm run db:v2-smoke`
  - `npm run db:sync-smoke`
  - `npm run worker:sync -- --list-projects`
  - `npm run worker:sync -- --project demo-work-v2 --list-sources`
  - `npm run web:health`
  - `npm run web:doctor`
  - `npm --workspace @aifiction/worker exec tsx src/index.ts`
  - `npm --workspace @aifiction/web run build`

## Do not pause for
- Ordinary repo inspection
- Small PowerShell diagnostic commands and variable assignments used only for local inspection or task execution
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