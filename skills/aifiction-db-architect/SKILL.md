---
name: "aifiction-db-architect"
description: "Use when designing, reviewing, or changing the AiFiction data model, migrations, repository boundaries, indexing strategy, artifact/version storage, prompt registry tables, or extension-field policy. Trigger for schema redesign, table splitting, SQLite/PostgreSQL migration planning, repository refactors, and any request about keeping the novel pipeline database extensible, maintainable, and future-proof."
---

# AiFiction DB Architect

## Core goal
- Protect the project from early database decisions that would force large rewrites later.
- Prefer stable domain boundaries over quick but brittle table additions.
- Keep the current demo runnable while building the next-generation structure in parallel.

## Default design rules
- Put high-frequency filter/sort/join fields into explicit columns.
- Use `meta_json` for system metadata and `extra_json` for experimental or user-defined extensions.
- Split obvious growth structures into child tables instead of keeping them forever in JSON.
- Route long-form content and revisions through an artifact/version layer.
- Keep repository interfaces narrower than the raw schema.
- Record workflow execution at both run level and step level.

## When to create a column
- The field is used in filtering, sorting, grouping, status checks, or joins.
- The field is semantically stable and likely to survive future iterations.
- The field appears in business rules or workflow branching.

## When to use a child table
- The structure is one-to-many or many-to-many.
- Items need independent lifecycle, sorting, versioning, or querying.
- The data is expected to grow significantly over time.

Common AiFiction examples:
- character aliases
- character relationships
- chapter scenes
- foreshadow links
- pipeline run steps
- prompt template versions

## When to use `meta_json` or `extra_json`
- The shape is not stable yet.
- The field is low-frequency and not central to querying.
- The team wants to preserve exploratory data without locking it into formal columns.

Do not hide core business fields inside JSON just because it is faster in the short term.

## Repository policy
- Avoid one giant repository that writes the entire book package forever.
- Prefer smaller repositories by responsibility: project catalog, narrative assets, artifacts, memory snapshots, pipeline runs, prompt registry.
- Let workflows depend on repository contracts, not concrete tables.

## Migration policy
- Keep V1 and V2 side by side when needed.
- Do not force an all-at-once cutover while the product is still finding its shape.
- Preserve export and backup paths before risky schema transitions.

## Validation checklist
- Can the structure support new workflow stages without table surgery?
- Can prompt versions be audited later?
- Can artifacts be versioned without adding more content tables?
- Can agent execution be stored as step-level records?
- Can future PostgreSQL migration happen mostly inside `packages/data`?
- Are comments and field meanings obvious enough for later maintenance?