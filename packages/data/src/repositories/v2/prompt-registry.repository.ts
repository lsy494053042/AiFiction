import { eq } from "drizzle-orm";

import type { PromptRegistryRepository, RepositoryWriteContext } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { promptTemplatesV2Table, promptTemplateVersionsV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

function buildTemplateId(projectId: string | undefined, templateKey: string): string {
  return `${projectId ?? "global"}:prompt-template:${templateKey}`;
}

function buildTemplateVersionId(templateId: string, versionName: string): string {
  return `${templateId}:version:${versionName}`;
}

/**
 * SQLite 下的 V2 Prompt 注册仓储。
 * 负责模板与模板版本的独立沉淀，方便后续回溯 prompt 变更。
 */
export class SqlitePromptRegistryRepository implements PromptRegistryRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveTemplate(
    input: {
      projectId?: string;
      templateKey: string;
      stage: string;
      ownerScope: string;
    },
    context?: RepositoryWriteContext,
  ): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const templateId = buildTemplateId(input.projectId, input.templateKey);
    const [existingTemplate] = await this.client.db
      .select({ createdAt: promptTemplatesV2Table.createdAt, version: promptTemplatesV2Table.version })
      .from(promptTemplatesV2Table)
      .where(eq(promptTemplatesV2Table.id, templateId))
      .limit(1);

    await this.client.db
      .insert(promptTemplatesV2Table)
      .values({
        id: templateId,
        projectId: input.projectId ?? null,
        templateKey: input.templateKey,
        stage: input.stage,
        ownerScope: input.ownerScope,
        currentVersionId: null,
        ...buildLifecycleValues({
          existing: existingTemplate,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "prompt-registry",
          },
          extraJson: {},
        }),
      })
      .onConflictDoUpdate({
        target: promptTemplatesV2Table.id,
        set: {
          projectId: input.projectId ?? null,
          templateKey: input.templateKey,
          stage: input.stage,
          ownerScope: input.ownerScope,
          ...buildLifecycleValues({
            existing: existingTemplate,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "prompt-registry",
            },
            extraJson: {},
          }),
        },
      });

    return templateId;
  }

  async saveTemplateVersion(
    input: {
      templateId: string;
      versionName: string;
      systemPrompt: string;
      userPrompt: string;
      outputContract?: string;
      changeSummary?: string;
    },
    context?: RepositoryWriteContext,
  ): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const versionId = buildTemplateVersionId(input.templateId, input.versionName);
    const [existingVersion] = await this.client.db
      .select({ createdAt: promptTemplateVersionsV2Table.createdAt, version: promptTemplateVersionsV2Table.version })
      .from(promptTemplateVersionsV2Table)
      .where(eq(promptTemplateVersionsV2Table.id, versionId))
      .limit(1);
    const [existingTemplate] = await this.client.db
      .select({ createdAt: promptTemplatesV2Table.createdAt, version: promptTemplatesV2Table.version })
      .from(promptTemplatesV2Table)
      .where(eq(promptTemplatesV2Table.id, input.templateId))
      .limit(1);

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(promptTemplateVersionsV2Table)
        .values({
          id: versionId,
          templateId: input.templateId,
          versionName: input.versionName,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          outputContract: input.outputContract ?? null,
          changeSummary: input.changeSummary ?? null,
          ...buildLifecycleValues({
            existing: existingVersion,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "prompt-registry",
            },
            extraJson: {},
          }),
        })
        .onConflictDoUpdate({
          target: promptTemplateVersionsV2Table.id,
          set: {
            templateId: input.templateId,
            versionName: input.versionName,
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            outputContract: input.outputContract ?? null,
            changeSummary: input.changeSummary ?? null,
            ...buildLifecycleValues({
              existing: existingVersion,
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "prompt-registry",
              },
              extraJson: {},
            }),
          },
        });

      if (existingTemplate) {
        await tx
          .update(promptTemplatesV2Table)
          .set({
            currentVersionId: versionId,
            ...buildLifecycleValues({
              existing: existingTemplate,
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "prompt-registry",
              },
              extraJson: {},
            }),
          })
          .where(eq(promptTemplatesV2Table.id, input.templateId));
      }
    });

    return versionId;
  }
}
