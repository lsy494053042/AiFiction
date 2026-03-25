import { and, asc, eq } from "drizzle-orm";

import type { MemorySnapshotRepository, RepositoryWriteContext } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { entityStateSnapshotsV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

function buildSnapshotId(input: {
  projectId: string;
  entityType: string;
  entityId: string;
  chapterId?: string;
  snapshotLabel: string;
}): string {
  return [
    input.projectId,
    input.entityType,
    input.entityId,
    input.chapterId ?? "global",
    input.snapshotLabel,
  ].join(":snapshot:");
}

/**
 * SQLite 下的 V2 记忆快照仓储。
 * 负责把角色、地点、势力等动态状态从正文中解耦出来独立保存。
 */
export class SqliteMemorySnapshotRepository implements MemorySnapshotRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveEntitySnapshot(
    input: {
      projectId: string;
      entityType: string;
      entityId: string;
      chapterId?: string;
      snapshotLabel: string;
      stateJson: Record<string, unknown>;
    },
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const snapshotId = buildSnapshotId(input);
    const [existingSnapshot] = await this.client.db
      .select({ createdAt: entityStateSnapshotsV2Table.createdAt, version: entityStateSnapshotsV2Table.version })
      .from(entityStateSnapshotsV2Table)
      .where(eq(entityStateSnapshotsV2Table.id, snapshotId))
      .limit(1);

    await this.client.db
      .insert(entityStateSnapshotsV2Table)
      .values({
        id: snapshotId,
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        chapterId: input.chapterId ?? null,
        snapshotLabel: input.snapshotLabel,
        stateJson: input.stateJson,
        sourceArtifactId: null,
        ...buildLifecycleValues({
          existing: existingSnapshot,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "memory-snapshot",
            actorId: context?.actorId ?? null,
          },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: entityStateSnapshotsV2Table.id,
        set: {
          projectId: input.projectId,
          entityType: input.entityType,
          entityId: input.entityId,
          chapterId: input.chapterId ?? null,
          snapshotLabel: input.snapshotLabel,
          stateJson: input.stateJson,
          sourceArtifactId: null,
          ...buildLifecycleValues({
            existing: existingSnapshot,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "memory-snapshot",
              actorId: context?.actorId ?? null,
            },
            extraJson: {},
          }),
        },
      });
  }

  async listEntitySnapshots(input: {
    projectId: string;
    entityType: string;
    entityId: string;
  }): Promise<Array<{
    id: string;
    chapterId?: string;
    snapshotLabel: string;
    stateJson: Record<string, unknown>;
  }>> {
    await ensureSqliteV2Bootstrap(this.client);

    const rows = await this.client.db
      .select()
      .from(entityStateSnapshotsV2Table)
      .where(
        and(
          eq(entityStateSnapshotsV2Table.projectId, input.projectId),
          eq(entityStateSnapshotsV2Table.entityType, input.entityType),
          eq(entityStateSnapshotsV2Table.entityId, input.entityId),
        ),
      )
      .orderBy(asc(entityStateSnapshotsV2Table.createdAt));

    return rows.map((row) => ({
      id: row.id,
      chapterId: row.chapterId ?? undefined,
      snapshotLabel: row.snapshotLabel,
      stateJson: row.stateJson as Record<string, unknown>,
    }));
  }
}
