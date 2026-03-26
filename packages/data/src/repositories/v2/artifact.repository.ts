import { and, desc, eq, inArray } from "drizzle-orm";

import type { DraftArtifact } from "@aifiction/schemas";

import type { ArtifactRepository, RepositoryWriteContext } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { artifactsV2Table, artifactVersionsV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

export interface SaveTextArtifactVersionInput {
  projectId: string;
  scopeType: string;
  scopeId: string;
  artifactKey: string;
  artifactKind?: string;
  contentFormat: string;
  contentText?: string;
  contentJson?: Record<string, unknown> | null;
  summary?: string;
  versionNumber?: number;
  sourceRunStepId?: string;
  createdAt?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface TextArtifactVersionRecord {
  artifactId: string;
  artifactVersionId: string;
  versionNumber: number;
  versionLabel: string;
  projectId: string;
  scopeType: string;
  scopeId: string;
  artifactKey: string;
  artifactKind: string;
}

function buildArtifactId(input: {
  projectId: string;
  scopeType: string;
  scopeId: string;
  artifactKey: string;
}): string {
  return `${input.projectId}:${input.scopeType}:${input.scopeId}:artifact:${input.artifactKey}`;
}

function buildArtifactVersionId(artifactId: string, versionNumber: number): string {
  return `${artifactId}:version:${versionNumber}`;
}

function parseVersionNumber(versionLabel: string): number {
  const matched = versionLabel.match(/^v(\d+)$/i);
  return matched ? Number(matched[1]) : 0;
}

/**
 * SQLite 下的 V2 产物仓储。
 * 统一承载正文、摘要、抽取报告、审校报告等版本化文本产物。
 */
export class SqliteArtifactRepository implements ArtifactRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  /**
   * 保存通用文本产物版本。
   * 后续同步摘要、结构化抽取预览、审校报告都走这里。
   */
  async saveTextArtifactVersion(
    input: SaveTextArtifactVersionInput,
    context?: RepositoryWriteContext,
  ): Promise<TextArtifactVersionRecord> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = input.createdAt ?? nowIsoString();
    const artifactId = buildArtifactId({
      projectId: input.projectId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      artifactKey: input.artifactKey,
    });
    const artifactKind = input.artifactKind ?? input.artifactKey;

    const [existingArtifact] = await this.client.db
      .select({ createdAt: artifactsV2Table.createdAt, version: artifactsV2Table.version })
      .from(artifactsV2Table)
      .where(eq(artifactsV2Table.id, artifactId))
      .limit(1);

    const existingVersions = await this.client.db
      .select({ versionLabel: artifactVersionsV2Table.versionLabel })
      .from(artifactVersionsV2Table)
      .where(eq(artifactVersionsV2Table.artifactId, artifactId));

    const nextVersionNumber =
      input.versionNumber ??
      existingVersions.reduce((maxValue, versionRow) => Math.max(maxValue, parseVersionNumber(versionRow.versionLabel)), 0) + 1;
    const versionLabel = `v${nextVersionNumber}`;
    const versionId = buildArtifactVersionId(artifactId, nextVersionNumber);

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
          projectId: input.projectId,
          artifactKey: input.artifactKey,
          artifactKind,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
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
            projectId: input.projectId,
            artifactKey: input.artifactKey,
            artifactKind,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
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
          versionLabel,
          parentVersionId: nextVersionNumber > 1 ? buildArtifactVersionId(artifactId, nextVersionNumber - 1) : null,
          contentFormat: input.contentFormat,
          contentText: input.contentText ?? null,
          contentJson: input.contentJson ?? null,
          sourceRunStepId: input.sourceRunStepId ?? null,
          ...buildLifecycleValues({
            existing: existingVersion,
            status: input.status ?? "stored",
            timestamp,
            metaJson: {
              source: context?.source ?? "artifact-repository",
              actorId: context?.actorId ?? null,
            },
            extraJson: {
              summary: input.summary ?? "",
              ...input.metadata,
            },
          }),
        })
        .onConflictDoUpdate({
          target: artifactVersionsV2Table.id,
          set: {
            artifactId,
            versionLabel,
            parentVersionId: nextVersionNumber > 1 ? buildArtifactVersionId(artifactId, nextVersionNumber - 1) : null,
            contentFormat: input.contentFormat,
            contentText: input.contentText ?? null,
            contentJson: input.contentJson ?? null,
            sourceRunStepId: input.sourceRunStepId ?? null,
            ...buildLifecycleValues({
              existing: existingVersion,
              status: input.status ?? "stored",
              timestamp,
              metaJson: {
                source: context?.source ?? "artifact-repository",
                actorId: context?.actorId ?? null,
              },
              extraJson: {
                summary: input.summary ?? "",
                ...input.metadata,
              },
            }),
          },
        });
    });

    return {
      artifactId,
      artifactVersionId: versionId,
      versionNumber: nextVersionNumber,
      versionLabel,
      projectId: input.projectId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      artifactKey: input.artifactKey,
      artifactKind,
    };
  }

  async saveArtifactVersion(artifact: DraftArtifact, context?: RepositoryWriteContext): Promise<void> {
    await this.saveTextArtifactVersion(
      {
        projectId: artifact.workId,
        scopeType: "chapter",
        scopeId: artifact.chapterId,
        artifactKey: artifact.stage,
        artifactKind: artifact.stage,
        contentFormat: "text/markdown",
        contentText: artifact.content,
        summary: artifact.summary,
        versionNumber: artifact.version,
        createdAt: artifact.createdAt,
        metadata: {
          promptVersion: artifact.promptVersion,
          model: artifact.model,
          stage: artifact.stage,
          workId: artifact.workId,
          chapterId: artifact.chapterId,
          versionNumber: artifact.version,
        },
      },
      context,
    );
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
      const extraJson = (versionRow.extraJson ?? {}) as Record<string, unknown>;

      return {
        id: versionRow.id,
        workId: String(extraJson.workId ?? artifactRow?.projectId ?? ""),
        chapterId: String(extraJson.chapterId ?? artifactRow?.scopeId ?? ""),
        stage: String(extraJson.stage ?? artifactRow?.artifactKind ?? "draft") as DraftArtifact["stage"],
        version: Number(extraJson.versionNumber ?? parseVersionNumber(versionRow.versionLabel) ?? 1),
        content: versionRow.contentText ?? "",
        summary: String(extraJson.summary ?? ""),
        promptVersion: String(extraJson.promptVersion ?? "unknown"),
        model: String(extraJson.model ?? "unknown"),
        createdAt: versionRow.createdAt,
      };
    });
  }
}