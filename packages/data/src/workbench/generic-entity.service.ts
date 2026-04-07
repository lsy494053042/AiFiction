import { type SqliteClient, getSqliteClient } from "../client";
import { SqliteGenericEntityRepository } from "../repositories/v2/generic-entity.repository";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";

export interface GenericEntityWorkbenchBundle {
  entity: Awaited<ReturnType<SqliteGenericEntityRepository["getEntityById"]>>;
  edges: Awaited<ReturnType<SqliteGenericEntityRepository["listEntityEdges"]>>;
  panelValues: Awaited<ReturnType<SqliteGenericEntityRepository["listEntityPanelValues"]>>;
  tags: Awaited<ReturnType<SqliteGenericEntityRepository["listEntityTags"]>>;
}

export interface GenericTaskWorkbenchBundle {
  template: Awaited<ReturnType<SqliteGenericEntityRepository["getTaskTemplate"]>>;
  requirements: Awaited<ReturnType<SqliteGenericEntityRepository["listTaskRequirements"]>>;
  assignments: Awaited<ReturnType<SqliteGenericEntityRepository["listTaskAssignments"]>>;
  matches: Awaited<ReturnType<SqliteGenericEntityRepository["listTaskMatches"]>>;
}

export interface GenericTagTaxonomyProjection {
  taxonomyId: string;
  taxonomyKey: string;
  label: string;
  description?: string;
  taggedEntityCount: number;
  totalTagCount: number;
  topTags: Array<{
    tagCode: string;
    tagLabel: string;
    count: number;
  }>;
}

export interface GenericTaskProjection {
  taskTemplateId: string;
  templateKey: string;
  label: string;
  taskType: string;
  description?: string;
  requirementCount: number;
  assignmentCount: number;
  matchCount: number;
  topMatches: Array<{
    entityId: string;
    matchScore: number;
    matchLabel?: string;
  }>;
}

export class GenericEntityWorkbenchService {
  private readonly repository: SqliteGenericEntityRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.repository = new SqliteGenericEntityRepository(client);
  }

  async listEntities(projectId: string, entityType?: string) {
    await ensureSqliteV2Bootstrap(this.client);
    return this.repository.listEntities(projectId, entityType);
  }

  async getEntityBundle(entityId: string): Promise<GenericEntityWorkbenchBundle | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const entity = await this.repository.getEntityById(entityId);
    if (!entity) {
      return null;
    }

    const [edges, panelValues, tags] = await Promise.all([
      this.repository.listEntityEdges(entityId),
      this.repository.listEntityPanelValues(entityId),
      this.repository.listEntityTags(entityId),
    ]);

    return {
      entity,
      edges,
      panelValues,
      tags,
    };
  }

  async getTaskBundle(taskTemplateId: string): Promise<GenericTaskWorkbenchBundle | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const template = await this.repository.getTaskTemplate(taskTemplateId);
    if (!template) {
      return null;
    }

    const [requirements, assignments, matches] = await Promise.all([
      this.repository.listTaskRequirements(taskTemplateId),
      this.repository.listTaskAssignments(taskTemplateId),
      this.repository.listTaskMatches(taskTemplateId),
    ]);

    return {
      template,
      requirements,
      assignments,
      matches,
    };
  }

  async listTaskTemplates(projectId: string) {
    await ensureSqliteV2Bootstrap(this.client);
    return this.repository.listTaskTemplates(projectId);
  }

  async listTagTaxonomyProjections(projectId: string): Promise<GenericTagTaxonomyProjection[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const [taxonomies, tags] = await Promise.all([
      this.repository.listTagTaxonomies(projectId),
      this.repository.listProjectEntityTags(projectId),
    ]);

    return taxonomies.map((taxonomy) => {
      const scopedTags = tags.filter((tag) => tag.taxonomyId === taxonomy.id);
      const entityIds = new Set(scopedTags.map((tag) => tag.entityId));
      const topTags = Array.from(
        scopedTags.reduce<Map<string, { tagCode: string; tagLabel: string; count: number }>>((map, tag) => {
          const existing = map.get(tag.tagCode);
          if (existing) {
            existing.count += 1;
            return map;
          }

          map.set(tag.tagCode, {
            tagCode: tag.tagCode,
            tagLabel: tag.tagLabel,
            count: 1,
          });
          return map;
        }, new Map()).values(),
      )
        .sort((left, right) => right.count - left.count || left.tagLabel.localeCompare(right.tagLabel))
        .slice(0, 5);

      return {
        taxonomyId: taxonomy.id,
        taxonomyKey: taxonomy.taxonomyKey,
        label: taxonomy.label,
        description: taxonomy.description ?? undefined,
        taggedEntityCount: entityIds.size,
        totalTagCount: scopedTags.length,
        topTags,
      };
    });
  }

  async listTaskProjections(projectId: string): Promise<GenericTaskProjection[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const templates = await this.repository.listTaskTemplates(projectId);
    return Promise.all(
      templates.map(async (template) => {
        const bundle = await this.getTaskBundle(template.id);
        const topMatches = [...(bundle?.matches ?? [])]
          .sort((left, right) => right.matchScore - left.matchScore)
          .slice(0, 3)
          .map((match) => ({
            entityId: match.entityId,
            matchScore: match.matchScore,
            matchLabel: match.matchLabel ?? undefined,
          }));

        return {
          taskTemplateId: template.id,
          templateKey: template.templateKey,
          label: template.label,
          taskType: template.taskType,
          description: template.description ?? undefined,
          requirementCount: bundle?.requirements.length ?? 0,
          assignmentCount: bundle?.assignments.length ?? 0,
          matchCount: bundle?.matches.length ?? 0,
          topMatches,
        };
      }),
    );
  }
}
