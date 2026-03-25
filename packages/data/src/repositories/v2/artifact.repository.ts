import { and, desc, eq, inArray } from "drizzle-orm";

import type { DraftArtifact } from "@aifiction/schemas";

import type { ArtifactRepository, RepositoryWriteContext } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { artifactsV2Table, artifactVersionsV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

function buildArtifactId(artifact: Pick<DraftArtifact, "workId" | "chapterId" | "stage">): string {
  return `${artifact.workId}:chapter:${artifact.chapterId}:artifact:${artifact.stage}`;
}

function buildArtifactVersionId(artifactId: string, version: number): string {
  return `${artifactId}:version:${version}`;
}

/**
 * SQLite 下的 V2 产物仓储。
 * 负责正文、改写稿、审校稿等长文本产物的主对象与版本对象落库。
 */
export class SqliteArtifactRepository implements ArtifactRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveArtifactVersion(artifact: DraftArtifact, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const artifactId = buildArtifactId(artifact);
    const versionId = buildArtifactVersionId(artifactId, artifact.version);

    const [existingArtifact] = await this.client.db
      .select({ createdAt: artifactsV2Table.createdAt, version: artifactsV2Table.version })
      .from(artifactsV2Table)
      .where(eq(artifactsV2Table.id, artifactId))
      .limit(1);

    const [existingVersion] = await this.client.db
      .select({ createdAt: artifactVersionsV2Table.createdAt, version: artifactVersionsV2Table.version })
      .from(artifactVersionsV2Table)
      .where(eq(artifactVersionsV2Table.id, versionId))
      .limit(1);

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(artifactsV2Table)
        .values({
          id: artifactId,
          projectId: artifact.workId,
          artifactKey: artifact.stage,
          artifactKind: artifact.stage,
          scopeType: "chapter",
          scopeId: artifact.chapterId,
          currentVersionId: versionId,
          ...buildLifecycleValues({
            existing: existingArtifact,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "artifact-repository",
            },
            extraJson: {},
          }),
        })
        .onConflictDoUpdate({
          target: artifactsV2Table.id,
          set: {
            projectId: artifact.workId,
            artifactKey: artifact.stage,
            artifactKind: artifact.stage,
            scopeType: "chapter",
            scopeId: artifact.chapterId,
            currentVersionId: versionId,
            ...buildLifecycleValues({
              existing: existingArtifact,
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "artifact-repository",
              },
              extraJson: {},
            }),
          },
        });

      await tx
        .insert(artifactVersionsV2Table)
        .values({
          id: versionId,
          artifactId,
          versionLabel: `v${artifact.version}`,
          parentVersionId: artifact.version > 1 ? buildArtifactVersionId(artifactId, artifact.version - 1) : null,
          contentFormat: "text/markdown",
          contentText: artifact.content,
          contentJson: null,
          sourceRunStepId: null,
          ...buildLifecycleValues({
            existing: existingVersion,
            status: "stored",
            timestamp: artifact.createdAt || timestamp,
            metaJson: {
              source: context?.source ?? "artifact-repository",
              actorId: context?.actorId ?? null,
            },
            extraJson: {
              summary: artifact.summary,
              promptVersion: artifact.promptVersion,
              model: artifact.model,
              stage: artifact.stage,
              versionNumber: artifact.version,
              workId: artifact.workId,
              chapterId: artifact.chapterId,
            },
          }),
        })
        .onConflictDoUpdate({
          target: artifactVersionsV2Table.id,
          set: {
            artifactId,
            versionLabel: `v${artifact.version}`,
            parentVersionId: artifact.version > 1 ? buildArtifactVersionId(artifactId, artifact.version - 1) : null,
            contentFormat: "text/markdown",
            contentText: artifact.content,
            contentJson: null,
            sourceRunStepId: null,
            ...buildLifecycleValues({
              existing: existingVersion,
              status: "stored",
              timestamp: artifact.createdAt || timestamp,
              metaJson: {
                source: context?.source ?? "artifact-repository",
                actorId: context?.actorId ?? null,
              },
              extraJson: {
                summary: artifact.summary,
                promptVersion: artifact.promptVersion,
                model: artifact.model,
                stage: artifact.stage,
                versionNumber: artifact.version,
                workId: artifact.workId,
                chapterId: artifact.chapterId,
              },
            }),
          },
        });
    });
  }

  async listArtifactVersions(scopeId: string, artifactKind?: string): Promise<DraftArtifact[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const artifactRows = artifactKind
      ? await this.client.db
          .select()
          .from(artifactsV2Table)
          .where(and(eq(artifactsV2Table.scopeId, scopeId), eq(artifactsV2Table.artifactKind, artifactKind)))
      : await this.client.db.select().from(artifactsV2Table).where(eq(artifactsV2Table.scopeId, scopeId));

    if (!artifactRows.length) {
      return [];
    }

    const artifactIds = artifactRows.map((artifactRow) => artifactRow.id);
    const artifactById = new Map(artifactRows.map((artifactRow) => [artifactRow.id, artifactRow]));

    const versionRows = await this.client.db
      .select()
      .from(artifactVersionsV2Table)
      .where(inArray(artifactVersionsV2Table.artifactId, artifactIds))
      .orderBy(desc(artifactVersionsV2Table.createdAt));

    return versionRows.map((versionRow) => {
      const artifactRow = artifactById.get(versionRow.artifactId);
      const extraJson = versionRow.extraJson as Record<string, unknown>;

      return {
        id: versionRow.id,
        workId: String(extraJson.workId ?? artifactRow?.projectId ?? ""),
        chapterId: String(extraJson.chapterId ?? artifactRow?.scopeId ?? ""),
        stage: String(extraJson.stage ?? artifactRow?.artifactKind ?? "draft") as DraftArtifact["stage"],
        version: Number(extraJson.versionNumber ?? 1),
        content: versionRow.contentText ?? "",
        summary: String(extraJson.summary ?? ""),
        promptVersion: String(extraJson.promptVersion ?? "unknown"),
        model: String(extraJson.model ?? "unknown"),
        createdAt: versionRow.createdAt,
      };
    });
  }
}
