---
name: "aifiction-doc-sync"
description: "Use when working in f:\AiFiction and any meaningful project change affects how the system is used, designed, or planned. Trigger after feature delivery, schema changes, workflow changes, repository/provider refactors, command changes, milestone updates, or whenever the operations manual, design overview, and project progress docs may have gone stale."
---

# AiFiction Doc Sync

## Core goal
- Keep the three core project docs aligned with the real state of the repo.
- Prevent future threads from losing track of current usage, architecture, and milestone status.
- Treat doc sync as part of finishing work, not as optional cleanup.

## Fixed doc set
- `docs/operations/workbench-operations-manual.md`
- `docs/architecture/system-design.md`
- `docs/project/project-progress.md`

`README.md` is the repo entry document and should be updated when links, positioning, or high-level usage wording changes.

## Default workflow
1. Read the current versions of the three core docs.
2. Compare them with the code, schema, commands, workflow, and milestone changes made in the current task.
3. Update each affected doc before closing the task.
4. Even when only one doc obviously changed, quickly review the other two for stale statements.
5. If the repo entry description changes, update `README.md` in the same task.

## Update rules by document

### Operations manual
Update when:
- A new command becomes part of normal usage
- A current command stops working or is replaced
- A feature becomes user-usable
- Web, Worker, database, or local startup behavior changes

Keep it focused on:
- What can be used now
- How to run it
- What is still unavailable

### Design document
Update when:
- Layer boundaries change
- A new module or pattern is introduced
- Repository, provider, worker, or workflow responsibilities move
- Database strategy or extension strategy changes
- Automatic maintenance, review gates, or agent strategy changes

Keep it focused on:
- Current architecture
- Current design patterns
- Why the structure is the way it is
- Which extension points are intentionally reserved

### Project progress
Update when:
- A milestone finishes
- The next stage changes
- Priorities shift
- A major risk appears or is resolved

Keep it focused on:
- Current goal
- Current stage
- Completed work
- Next step
- Risks and constraints

## Writing rules
- Write in Chinese unless there is a strong reason not to.
- Prefer concrete current-state wording over aspirational wording.
- Use exact file paths and actual implemented status.
- Do not claim a feature is available unless it is truly runnable in the repo.
- Add or refresh the "最后更新" date when the doc materially changes.

## Scope rule
- Do not re-expand the repo into many long-lived high-level docs.
- Prefer merging strategic or roadmap content back into the three core docs.
- Only create a new long-lived top-level doc when the three core docs and `README.md` truly cannot absorb the topic without becoming unreadable.
