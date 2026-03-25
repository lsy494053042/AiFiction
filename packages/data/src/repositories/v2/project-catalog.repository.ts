import { and, desc, eq, lt } from "drizzle-orm";

import type { WorkProfile } from "@aifiction/schemas";

import type {
  ProjectCatalogRepository,
  RepositoryPageRequest,
  RepositoryWriteContext,
} from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { novelProjectsV2Table, projectProfilesV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString, readStringArray } from "./repository-base";

const primaryProfileKey = "primary";
const defaultOwnerMode = "personal";

function buildProjectProfileId(projectId: string, profileKey = primaryProfileKey): string {
  return `${projectId}:profile:${profileKey}`;
}

function mapWorkStatusToWorkflowPhase(status: WorkProfile["status"]): string {
  switch (status) {
    case "planning":
      return "planning";
    case "serializing":
      return "drafting";
    case "completed":
      return "completed";
    case "archived":
      return "archived";
    default:
      return "planning";
  }
}

/**
 * SQLite 下的 V2 项目目录仓储。
 * 负责把作品级入口信息落到 novel_projects_v2 / project_profiles_v2。
 */
export class SqliteProjectCatalogRepository implements ProjectCatalogRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async listProjects(page?: RepositoryPageRequest): Promise<WorkProfile[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const query = this.client.db.select().from(novelProjectsV2Table);
    const projectRows = page?.cursor
      ? await query
          .where(lt(novelProjectsV2Table.updatedAt, page.cursor))
          .orderBy(desc(novelProjectsV2Table.updatedAt))
          .limit(page.limit)
      : await query.orderBy(desc(novelProjectsV2Table.updatedAt)).limit(page?.limit ?? 50);

    if (!projectRows.length) {
      return [];
    }

    const profiles = await this.client.db
      .select()
      .from(projectProfilesV2Table)
      .orderBy(desc(projectProfilesV2Table.updatedAt));

    const profileByProjectId = new Map<string, typeof projectProfilesV2Table.$inferSelect>();
    for (const profile of profiles) {
      if (!profileByProjectId.has(profile.projectId)) {
        profileByProjectId.set(profile.projectId, profile);
      }
    }

    return projectRows.map((projectRow) => this.mapWorkProfile(projectRow, profileByProjectId.get(projectRow.id)));
  }

  async getProjectBySlug(slug: string): Promise<WorkProfile | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const projectRows = await this.client.db
      .select()
      .from(novelProjectsV2Table)
      .where(eq(novelProjectsV2Table.slug, slug))
      .limit(1);
    const projectRow = projectRows[0];

    if (!projectRow) {
      return null;
    }

    const profileRows = await this.client.db
      .select()
      .from(projectProfilesV2Table)
      .where(eq(projectProfilesV2Table.projectId, projectRow.id))
      .orderBy(desc(projectProfilesV2Table.updatedAt))
      .limit(1);

    return this.mapWorkProfile(projectRow, profileRows[0]);
  }

  async saveProject(project: WorkProfile, context?: RepositoryWriteContext): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const profileId = buildProjectProfileId(project.id);

    const [existingProject] = await this.client.db
      .select({ createdAt: novelProjectsV2Table.createdAt, version: novelProjectsV2Table.version })
      .from(novelProjectsV2Table)
      .where(eq(novelProjectsV2Table.id, project.id))
      .limit(1);

    const [existingProfile] = await this.client.db
      .select({ createdAt: projectProfilesV2Table.createdAt, version: projectProfilesV2Table.version })
      .from(projectProfilesV2Table)
      .where(and(eq(projectProfilesV2Table.projectId, project.id), eq(projectProfilesV2Table.profileKey, primaryProfileKey)))
      .limit(1);

    await this.client.db.transaction(async (tx) => {
      await tx
        .insert(novelProjectsV2Table)
        .values({
          id: project.id,
          slug: project.slug,
          title: project.title,
          subtitle: null,
          ownerMode: defaultOwnerMode,
          workflowPhase: mapWorkStatusToWorkflowPhase(project.status),
          primaryGenre: project.genre,
          secondaryGenre: project.subgenre ?? null,
          activeProfileId: profileId,
          activeGuardrailProfileId: null,
          activeOutlineArtifactId: null,
          summary: project.tagline,
          ...buildLifecycleValues({
            existing: existingProject,
            status: project.status,
            timestamp,
            metaJson: {
              source: context?.source ?? "project-catalog",
              actorId: context?.actorId ?? null,
            },
            extraJson: {},
          }),
        })
        .onConflictDoUpdate({
          target: novelProjectsV2Table.id,
          set: {
            slug: project.slug,
            title: project.title,
            subtitle: null,
            ownerMode: defaultOwnerMode,
            workflowPhase: mapWorkStatusToWorkflowPhase(project.status),
            primaryGenre: project.genre,
            secondaryGenre: project.subgenre ?? null,
            activeProfileId: profileId,
            activeGuardrailProfileId: null,
            activeOutlineArtifactId: null,
            summary: project.tagline,
            ...buildLifecycleValues({
              existing: existingProject,
              status: project.status,
              timestamp,
              metaJson: {
                source: context?.source ?? "project-catalog",
                actorId: context?.actorId ?? null,
              },
              extraJson: {},
            }),
          },
        });

      await tx
        .insert(projectProfilesV2Table)
        .values({
          id: profileId,
          projectId: project.id,
          profileKey: primaryProfileKey,
          label: "默认项目配置",
          targetPlatform: project.targetPlatform,
          targetAudience: project.targetAudience,
          targetWordCount: project.targetWordCount,
          dailyWordTarget: project.dailyWordTarget,
          updateCadence: project.updateCadence,
          commercializationHooks: project.commercialHooks,
          promiseSummary: project.tagline,
          riskNotes: project.contentWarnings,
          ...buildLifecycleValues({
            existing: existingProfile,
            status: "active",
            timestamp,
            metaJson: {
              source: context?.source ?? "project-catalog",
              reason: context?.reason ?? null,
            },
            extraJson: {
              hardConstraints: project.hardConstraints,
            },
          }),
        })
        .onConflictDoUpdate({
          target: projectProfilesV2Table.id,
          set: {
            projectId: project.id,
            profileKey: primaryProfileKey,
            label: "默认项目配置",
            targetPlatform: project.targetPlatform,
            targetAudience: project.targetAudience,
            targetWordCount: project.targetWordCount,
            dailyWordTarget: project.dailyWordTarget,
            updateCadence: project.updateCadence,
            commercializationHooks: project.commercialHooks,
            promiseSummary: project.tagline,
            riskNotes: project.contentWarnings,
            ...buildLifecycleValues({
              existing: existingProfile,
              status: "active",
              timestamp,
              metaJson: {
                source: context?.source ?? "project-catalog",
                reason: context?.reason ?? null,
              },
              extraJson: {
                hardConstraints: project.hardConstraints,
              },
            }),
          },
        });
    });
  }

  private mapWorkProfile(
    projectRow: typeof novelProjectsV2Table.$inferSelect,
    profileRow?: typeof projectProfilesV2Table.$inferSelect,
  ): WorkProfile {
    const profileExtra = (profileRow?.extraJson ?? {}) as Record<string, unknown>;

    return {
      id: projectRow.id,
      slug: projectRow.slug,
      title: projectRow.title,
      tagline: projectRow.summary ?? profileRow?.promiseSummary ?? "待补作品卖点",
      genre: projectRow.primaryGenre,
      subgenre: projectRow.secondaryGenre ?? undefined,
      targetPlatform: profileRow?.targetPlatform ?? "未配置",
      targetAudience: profileRow?.targetAudience ?? [],
      targetWordCount: profileRow?.targetWordCount ?? 100000,
      dailyWordTarget: profileRow?.dailyWordTarget ?? 0,
      updateCadence: profileRow?.updateCadence ?? "未配置",
      commercialHooks: profileRow?.commercializationHooks ?? [],
      hardConstraints: readStringArray(profileExtra.hardConstraints),
      contentWarnings: profileRow?.riskNotes ?? [],
      status: projectRow.status as WorkProfile["status"],
    };
  }
}
