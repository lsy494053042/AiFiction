import { and, asc, eq } from "drizzle-orm";

import type { JsonObject } from "../../foundation/base-columns";
import type { RepositoryWriteContext } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import {
  entitiesV2Table,
  entityAliasesV2Table,
  entityEdgesV2Table,
  entityPanelValuesV2Table,
  entityStateEventsV2Table,
  entityTagsV2Table,
  entityTaskMatchesV2Table,
  panelFieldsV2Table,
  panelTemplatesV2Table,
  tagTaxonomiesV2Table,
  taskAssignmentsV2Table,
  taskRequirementsV2Table,
  taskTemplatesV2Table,
} from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

export interface GenericEntityInput {
  id: string;
  projectId: string;
  entityType: string;
  canonicalName: string;
  displayName: string;
  summary?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface GenericEntityAliasInput {
  alias: string;
  aliasType: string;
  sortOrder: number;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface GenericEntityEdgeInput {
  targetEntityId: string;
  edgeType: string;
  publicLabel: string;
  privateLabel?: string;
  directionality: string;
  weight: number;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface PanelTemplateInput {
  id: string;
  ownerKey: string;
  projectId?: string;
  scope: string;
  templateKey: string;
  label: string;
  appliesToEntityType: string;
  description?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface PanelFieldInput {
  fieldKey: string;
  label: string;
  valueType: string;
  cardinality: string;
  sortOrder: number;
  displayGroup?: string;
  isSearchable: boolean;
  isFilterable: boolean;
  isTimelineTracked: boolean;
  defaultValueJson?: unknown;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface EntityPanelValueInput {
  fieldId: string;
  valueText?: string;
  valueInteger?: number;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueJson?: unknown;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface EntityStateEventInput {
  id?: string;
  projectId: string;
  entityId: string;
  fieldId?: string;
  chapterId?: string;
  eventType: string;
  reason?: string;
  oldValueJson?: unknown;
  newValueJson?: unknown;
  sourceArtifactId?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface TagTaxonomyInput {
  id: string;
  ownerKey: string;
  projectId?: string;
  scope: string;
  taxonomyKey: string;
  label: string;
  description?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface EntityTagInput {
  tagCode: string;
  tagLabel: string;
  weight: number;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface TaskTemplateInput {
  id: string;
  ownerKey: string;
  projectId?: string;
  scope: string;
  templateKey: string;
  label: string;
  taskType: string;
  description?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface TaskRequirementInput {
  requirementKey: string;
  requirementType: string;
  targetKey: string;
  expectedText?: string;
  expectedNumber?: number;
  weight: number;
  sortOrder: number;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface TaskAssignmentInput {
  id?: string;
  projectId: string;
  taskTemplateId: string;
  entityId: string;
  assignmentStatus: string;
  rationale?: string;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

export interface EntityTaskMatchInput {
  id?: string;
  projectId: string;
  taskTemplateId: string;
  entityId: string;
  matchScore: number;
  matchLabel?: string;
  reasonsJson: unknown;
  metaJson?: JsonObject;
  extraJson?: JsonObject;
}

function buildAliasId(entityId: string, sortOrder: number): string {
  return `${entityId}:alias:${sortOrder}`;
}

function buildEdgeId(sourceEntityId: string, edgeType: string, targetEntityId: string, index: number): string {
  return `${sourceEntityId}:edge:${edgeType}:${targetEntityId}:${index + 1}`;
}

function buildPanelFieldId(templateId: string, fieldKey: string): string {
  return `${templateId}:field:${fieldKey}`;
}

function buildPanelValueId(entityId: string, fieldId: string): string {
  return `${entityId}:panel:${fieldId}`;
}

function buildStateEventId(entityId: string, eventType: string, fieldId?: string): string {
  return `${entityId}:state-event:${eventType}:${fieldId ?? "none"}:${Date.now()}`;
}

function buildEntityTagId(entityId: string, taxonomyId: string, tagCode: string): string {
  return `${entityId}:tag:${taxonomyId}:${tagCode}`;
}

function buildTaskRequirementId(taskTemplateId: string, requirementKey: string): string {
  return `${taskTemplateId}:requirement:${requirementKey}`;
}

function buildTaskAssignmentId(taskTemplateId: string, entityId: string): string {
  return `${taskTemplateId}:assignment:${entityId}`;
}

function buildTaskMatchId(taskTemplateId: string, entityId: string): string {
  return `${taskTemplateId}:match:${entityId}`;
}

export class SqliteGenericEntityRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async saveEntity(input: GenericEntityInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existing] = await this.client.db
      .select({ createdAt: entitiesV2Table.createdAt, version: entitiesV2Table.version })
      .from(entitiesV2Table)
      .where(eq(entitiesV2Table.id, input.id))
      .limit(1);

    await this.client.db
      .insert(entitiesV2Table)
      .values({
        id: input.id,
        projectId: input.projectId,
        entityType: input.entityType,
        canonicalName: input.canonicalName,
        displayName: input.displayName,
        summary: input.summary ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            actorId: context?.actorId ?? null,
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: entitiesV2Table.id,
        set: {
          projectId: input.projectId,
          entityType: input.entityType,
          canonicalName: input.canonicalName,
          displayName: input.displayName,
          summary: input.summary ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              actorId: context?.actorId ?? null,
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async replaceEntityAliases(
    entityId: string,
    aliases: GenericEntityAliasInput[],
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx.delete(entityAliasesV2Table).where(eq(entityAliasesV2Table.entityId, entityId));

      if (!aliases.length) {
        return;
      }

      await tx.insert(entityAliasesV2Table).values(
        aliases.map((alias) => ({
          id: buildAliasId(entityId, alias.sortOrder),
          entityId,
          alias: alias.alias,
          aliasType: alias.aliasType,
          sortOrder: alias.sortOrder,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...alias.metaJson,
            },
            extraJson: alias.extraJson ?? {},
          }),
        })),
      );
    });
  }

  async replaceEntityEdges(
    projectId: string,
    sourceEntityId: string,
    edges: GenericEntityEdgeInput[],
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx.delete(entityEdgesV2Table).where(eq(entityEdgesV2Table.sourceEntityId, sourceEntityId));

      if (!edges.length) {
        return;
      }

      await tx.insert(entityEdgesV2Table).values(
        edges.map((edge, index) => ({
          id: buildEdgeId(sourceEntityId, edge.edgeType, edge.targetEntityId, index),
          projectId,
          sourceEntityId,
          targetEntityId: edge.targetEntityId,
          edgeType: edge.edgeType,
          publicLabel: edge.publicLabel,
          privateLabel: edge.privateLabel ?? null,
          directionality: edge.directionality,
          weight: edge.weight,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...edge.metaJson,
            },
            extraJson: edge.extraJson ?? {},
          }),
        })),
      );
    });
  }

  async savePanelTemplate(input: PanelTemplateInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existing] = await this.client.db
      .select({ createdAt: panelTemplatesV2Table.createdAt, version: panelTemplatesV2Table.version })
      .from(panelTemplatesV2Table)
      .where(eq(panelTemplatesV2Table.id, input.id))
      .limit(1);

    await this.client.db
      .insert(panelTemplatesV2Table)
      .values({
        id: input.id,
        ownerKey: input.ownerKey,
        projectId: input.projectId ?? null,
        scope: input.scope,
        templateKey: input.templateKey,
        label: input.label,
        appliesToEntityType: input.appliesToEntityType,
        description: input.description ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: panelTemplatesV2Table.id,
        set: {
          ownerKey: input.ownerKey,
          projectId: input.projectId ?? null,
          scope: input.scope,
          templateKey: input.templateKey,
          label: input.label,
          appliesToEntityType: input.appliesToEntityType,
          description: input.description ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async replacePanelFields(
    templateId: string,
    fields: PanelFieldInput[],
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx.delete(panelFieldsV2Table).where(eq(panelFieldsV2Table.templateId, templateId));

      if (!fields.length) {
        return;
      }

      await tx.insert(panelFieldsV2Table).values(
        fields.map((field) => ({
          id: buildPanelFieldId(templateId, field.fieldKey),
          templateId,
          fieldKey: field.fieldKey,
          label: field.label,
          valueType: field.valueType,
          cardinality: field.cardinality,
          displayGroup: field.displayGroup ?? null,
          isSearchable: field.isSearchable,
          isFilterable: field.isFilterable,
          isTimelineTracked: field.isTimelineTracked,
          defaultValueJson: field.defaultValueJson ?? null,
          sortOrder: field.sortOrder,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...field.metaJson,
            },
            extraJson: field.extraJson ?? {},
          }),
        })),
      );
    });
  }

  async replaceEntityPanelValues(
    projectId: string,
    entityId: string,
    templateId: string,
    values: EntityPanelValueInput[],
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx
        .delete(entityPanelValuesV2Table)
        .where(and(eq(entityPanelValuesV2Table.entityId, entityId), eq(entityPanelValuesV2Table.templateId, templateId)));

      if (!values.length) {
        return;
      }

      await tx.insert(entityPanelValuesV2Table).values(
        values.map((value) => ({
          id: buildPanelValueId(entityId, value.fieldId),
          projectId,
          entityId,
          templateId,
          fieldId: value.fieldId,
          valueText: value.valueText ?? null,
          valueInteger: value.valueInteger ?? null,
          valueNumber: value.valueNumber ?? null,
          valueBoolean: value.valueBoolean ?? null,
          valueJson: value.valueJson ?? null,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...value.metaJson,
            },
            extraJson: value.extraJson ?? {},
          }),
        })),
      );
    });
  }

  async saveEntityStateEvent(input: EntityStateEventInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const eventId = input.id ?? buildStateEventId(input.entityId, input.eventType, input.fieldId);

    const [existing] = await this.client.db
      .select({ createdAt: entityStateEventsV2Table.createdAt, version: entityStateEventsV2Table.version })
      .from(entityStateEventsV2Table)
      .where(eq(entityStateEventsV2Table.id, eventId))
      .limit(1);

    await this.client.db
      .insert(entityStateEventsV2Table)
      .values({
        id: eventId,
        projectId: input.projectId,
        entityId: input.entityId,
        fieldId: input.fieldId ?? null,
        chapterId: input.chapterId ?? null,
        eventType: input.eventType,
        reason: input.reason ?? null,
        oldValueJson: input.oldValueJson ?? null,
        newValueJson: input.newValueJson ?? null,
        sourceArtifactId: input.sourceArtifactId ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: entityStateEventsV2Table.id,
        set: {
          projectId: input.projectId,
          entityId: input.entityId,
          fieldId: input.fieldId ?? null,
          chapterId: input.chapterId ?? null,
          eventType: input.eventType,
          reason: input.reason ?? null,
          oldValueJson: input.oldValueJson ?? null,
          newValueJson: input.newValueJson ?? null,
          sourceArtifactId: input.sourceArtifactId ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async saveTagTaxonomy(input: TagTaxonomyInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existing] = await this.client.db
      .select({ createdAt: tagTaxonomiesV2Table.createdAt, version: tagTaxonomiesV2Table.version })
      .from(tagTaxonomiesV2Table)
      .where(eq(tagTaxonomiesV2Table.id, input.id))
      .limit(1);

    await this.client.db
      .insert(tagTaxonomiesV2Table)
      .values({
        id: input.id,
        ownerKey: input.ownerKey,
        projectId: input.projectId ?? null,
        scope: input.scope,
        taxonomyKey: input.taxonomyKey,
        label: input.label,
        description: input.description ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: tagTaxonomiesV2Table.id,
        set: {
          ownerKey: input.ownerKey,
          projectId: input.projectId ?? null,
          scope: input.scope,
          taxonomyKey: input.taxonomyKey,
          label: input.label,
          description: input.description ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async replaceEntityTags(
    projectId: string,
    entityId: string,
    taxonomyId: string,
    tags: EntityTagInput[],
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx
        .delete(entityTagsV2Table)
        .where(and(eq(entityTagsV2Table.entityId, entityId), eq(entityTagsV2Table.taxonomyId, taxonomyId)));

      if (!tags.length) {
        return;
      }

      await tx.insert(entityTagsV2Table).values(
        tags.map((tag) => ({
          id: buildEntityTagId(entityId, taxonomyId, tag.tagCode),
          projectId,
          entityId,
          taxonomyId,
          tagCode: tag.tagCode,
          tagLabel: tag.tagLabel,
          weight: tag.weight,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...tag.metaJson,
            },
            extraJson: tag.extraJson ?? {},
          }),
        })),
      );
    });
  }

  async saveTaskTemplate(input: TaskTemplateInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existing] = await this.client.db
      .select({ createdAt: taskTemplatesV2Table.createdAt, version: taskTemplatesV2Table.version })
      .from(taskTemplatesV2Table)
      .where(eq(taskTemplatesV2Table.id, input.id))
      .limit(1);

    await this.client.db
      .insert(taskTemplatesV2Table)
      .values({
        id: input.id,
        ownerKey: input.ownerKey,
        projectId: input.projectId ?? null,
        scope: input.scope,
        templateKey: input.templateKey,
        label: input.label,
        taskType: input.taskType,
        description: input.description ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: taskTemplatesV2Table.id,
        set: {
          ownerKey: input.ownerKey,
          projectId: input.projectId ?? null,
          scope: input.scope,
          templateKey: input.templateKey,
          label: input.label,
          taskType: input.taskType,
          description: input.description ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async replaceTaskRequirements(
    taskTemplateId: string,
    requirements: TaskRequirementInput[],
    context?: RepositoryWriteContext,
  ): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    await this.client.db.transaction(async (tx) => {
      await tx.delete(taskRequirementsV2Table).where(eq(taskRequirementsV2Table.taskTemplateId, taskTemplateId));

      if (!requirements.length) {
        return;
      }

      await tx.insert(taskRequirementsV2Table).values(
        requirements.map((requirement) => ({
          id: buildTaskRequirementId(taskTemplateId, requirement.requirementKey),
          taskTemplateId,
          requirementKey: requirement.requirementKey,
          requirementType: requirement.requirementType,
          targetKey: requirement.targetKey,
          expectedText: requirement.expectedText ?? null,
          expectedNumber: requirement.expectedNumber ?? null,
          weight: requirement.weight,
          sortOrder: requirement.sortOrder,
          ...buildLifecycleValues({
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...requirement.metaJson,
            },
            extraJson: requirement.extraJson ?? {},
          }),
        })),
      );
    });
  }

  async saveTaskAssignment(input: TaskAssignmentInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const assignmentId = input.id ?? buildTaskAssignmentId(input.taskTemplateId, input.entityId);
    const timestamp = nowIsoString();
    const [existing] = await this.client.db
      .select({ createdAt: taskAssignmentsV2Table.createdAt, version: taskAssignmentsV2Table.version })
      .from(taskAssignmentsV2Table)
      .where(eq(taskAssignmentsV2Table.id, assignmentId))
      .limit(1);

    await this.client.db
      .insert(taskAssignmentsV2Table)
      .values({
        id: assignmentId,
        projectId: input.projectId,
        taskTemplateId: input.taskTemplateId,
        entityId: input.entityId,
        assignmentStatus: input.assignmentStatus,
        rationale: input.rationale ?? null,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: taskAssignmentsV2Table.id,
        set: {
          projectId: input.projectId,
          taskTemplateId: input.taskTemplateId,
          entityId: input.entityId,
          assignmentStatus: input.assignmentStatus,
          rationale: input.rationale ?? null,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async saveEntityTaskMatch(input: EntityTaskMatchInput, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const matchId = input.id ?? buildTaskMatchId(input.taskTemplateId, input.entityId);
    const timestamp = nowIsoString();
    const [existing] = await this.client.db
      .select({ createdAt: entityTaskMatchesV2Table.createdAt, version: entityTaskMatchesV2Table.version })
      .from(entityTaskMatchesV2Table)
      .where(eq(entityTaskMatchesV2Table.id, matchId))
      .limit(1);

    await this.client.db
      .insert(entityTaskMatchesV2Table)
      .values({
        id: matchId,
        projectId: input.projectId,
        taskTemplateId: input.taskTemplateId,
        entityId: input.entityId,
        matchScore: input.matchScore,
        matchLabel: input.matchLabel ?? null,
        reasonsJson: input.reasonsJson,
        ...buildLifecycleValues({
          existing,
          status: "active",
          timestamp,
          metaJson: {
            source: context?.source ?? "generic-entity",
            ...input.metaJson,
          },
          extraJson: input.extraJson ?? {},
        }),
      })
      .onConflictDoUpdate({
        target: entityTaskMatchesV2Table.id,
        set: {
          projectId: input.projectId,
          taskTemplateId: input.taskTemplateId,
          entityId: input.entityId,
          matchScore: input.matchScore,
          matchLabel: input.matchLabel ?? null,
          reasonsJson: input.reasonsJson,
          ...buildLifecycleValues({
            existing,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "generic-entity",
              ...input.metaJson,
            },
            extraJson: input.extraJson ?? {},
          }),
        },
      });
  }

  async listEntities(projectId: string, entityType?: string) {
    await ensureSqliteV2Bootstrap(this.client);

    const whereClause = entityType
      ? and(eq(entitiesV2Table.projectId, projectId), eq(entitiesV2Table.entityType, entityType))
      : eq(entitiesV2Table.projectId, projectId);

    return this.client.db.select().from(entitiesV2Table).where(whereClause).orderBy(asc(entitiesV2Table.displayName));
  }

  async getEntityById(entityId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    const [entity] = await this.client.db
      .select()
      .from(entitiesV2Table)
      .where(eq(entitiesV2Table.id, entityId))
      .limit(1);

    return entity ?? null;
  }

  async listEntityEdges(entityId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(entityEdgesV2Table)
      .where(eq(entityEdgesV2Table.sourceEntityId, entityId))
      .orderBy(asc(entityEdgesV2Table.edgeType), asc(entityEdgesV2Table.targetEntityId));
  }

  async listPanelFields(templateId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(panelFieldsV2Table)
      .where(eq(panelFieldsV2Table.templateId, templateId))
      .orderBy(asc(panelFieldsV2Table.sortOrder), asc(panelFieldsV2Table.fieldKey));
  }

  async getTaskTemplate(taskTemplateId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    const [template] = await this.client.db
      .select()
      .from(taskTemplatesV2Table)
      .where(eq(taskTemplatesV2Table.id, taskTemplateId))
      .limit(1);

    return template ?? null;
  }

  async listTaskTemplates(projectId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(taskTemplatesV2Table)
      .where(eq(taskTemplatesV2Table.projectId, projectId))
      .orderBy(asc(taskTemplatesV2Table.label));
  }

  async listTaskRequirements(taskTemplateId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(taskRequirementsV2Table)
      .where(eq(taskRequirementsV2Table.taskTemplateId, taskTemplateId))
      .orderBy(asc(taskRequirementsV2Table.sortOrder), asc(taskRequirementsV2Table.requirementKey));
  }

  async listEntityPanelValues(entityId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(entityPanelValuesV2Table)
      .where(eq(entityPanelValuesV2Table.entityId, entityId))
      .orderBy(asc(entityPanelValuesV2Table.templateId), asc(entityPanelValuesV2Table.fieldId));
  }

  async listEntityTags(entityId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(entityTagsV2Table)
      .where(eq(entityTagsV2Table.entityId, entityId))
      .orderBy(asc(entityTagsV2Table.taxonomyId), asc(entityTagsV2Table.tagCode));
  }

  async listTagTaxonomies(projectId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(tagTaxonomiesV2Table)
      .where(eq(tagTaxonomiesV2Table.projectId, projectId))
      .orderBy(asc(tagTaxonomiesV2Table.label));
  }

  async listProjectEntityTags(projectId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(entityTagsV2Table)
      .where(eq(entityTagsV2Table.projectId, projectId))
      .orderBy(asc(entityTagsV2Table.taxonomyId), asc(entityTagsV2Table.tagLabel));
  }

  async listTaskMatches(taskTemplateId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(entityTaskMatchesV2Table)
      .where(eq(entityTaskMatchesV2Table.taskTemplateId, taskTemplateId))
      .orderBy(asc(entityTaskMatchesV2Table.matchScore));
  }

  async listTaskAssignments(taskTemplateId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(taskAssignmentsV2Table)
      .where(eq(taskAssignmentsV2Table.taskTemplateId, taskTemplateId))
      .orderBy(asc(taskAssignmentsV2Table.entityId));
  }

  async listProjectTaskAssignments(projectId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(taskAssignmentsV2Table)
      .where(eq(taskAssignmentsV2Table.projectId, projectId))
      .orderBy(asc(taskAssignmentsV2Table.taskTemplateId), asc(taskAssignmentsV2Table.entityId));
  }

  async listProjectTaskMatches(projectId: string) {
    await ensureSqliteV2Bootstrap(this.client);

    return this.client.db
      .select()
      .from(entityTaskMatchesV2Table)
      .where(eq(entityTaskMatchesV2Table.projectId, projectId))
      .orderBy(asc(entityTaskMatchesV2Table.taskTemplateId), asc(entityTaskMatchesV2Table.matchScore));
  }
}
