import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import type { PipelineRunRepository } from "../../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../../client";
import { ensureSqliteV2Bootstrap } from "../../v2/bootstrap";
import { pipelineRunsV2Table, pipelineRunStepsV2Table } from "../../v2";
import { buildLifecycleValues, nowIsoString } from "./repository-base";

/**
 * SQLite 下的 V2 运行日志仓储。
 * 顶层 run 和 step 级日志都统一从这里进入，方便后续接真实 workflow 或 agent 图。
 */
export class SqlitePipelineRunRepository implements PipelineRunRepository {
  constructor(private readonly client: SqliteClient = getSqliteClient()) {}

  async startRun(input: {
    projectId: string;
    scopeType: string;
    scopeId: string;
    workflowName: string;
    workflowVersion: string;
  }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const runId = randomUUID();

    await this.client.db.insert(pipelineRunsV2Table).values({
      id: runId,
      projectId: input.projectId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      workflowName: input.workflowName,
      workflowVersion: input.workflowVersion,
      executionMode: "local-worker",
      providerName: null,
      modelName: null,
      estimatedTokenCost: 0,
      startedAt: timestamp,
      finishedAt: null,
      ...buildLifecycleValues({
        status: "running",
        timestamp,
        metaJson: {
          source: "pipeline-run-repository",
        },
        extraJson: {},
      }),
    });

    return runId;
  }

  async appendRunStep(input: {
    runId: string;
    stepKey: string;
    stepType: string;
    status: string;
    inputArtifactId?: string;
    outputArtifactId?: string;
  }): Promise<string> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const stepId = randomUUID();
    const [{ maxSortOrder }] = await this.client.db
      .select({
        maxSortOrder: sql<number>`coalesce(max(${pipelineRunStepsV2Table.sortOrder}), 0)`,
      })
      .from(pipelineRunStepsV2Table)
      .where(eq(pipelineRunStepsV2Table.runId, input.runId));

    await this.client.db.insert(pipelineRunStepsV2Table).values({
      id: stepId,
      runId: input.runId,
      stepKey: input.stepKey,
      stepType: input.stepType,
      providerName: null,
      modelName: null,
      inputArtifactId: input.inputArtifactId ?? null,
      outputArtifactId: input.outputArtifactId ?? null,
      errorCode: null,
      errorMessage: null,
      startedAt: timestamp,
      finishedAt: input.status === "running" ? null : timestamp,
      sortOrder: Number(maxSortOrder ?? 0) + 1,
      ...buildLifecycleValues({
        status: input.status,
        timestamp,
        metaJson: {
          source: "pipeline-run-repository",
        },
        extraJson: {},
      }),
    });

    return stepId;
  }

  async finishRun(runId: string, status: string): Promise<void> {
    await ensureSqliteV2Bootstrap(this.client);

    const timestamp = nowIsoString();
    const [existingRun] = await this.client.db
      .select({ createdAt: pipelineRunsV2Table.createdAt, version: pipelineRunsV2Table.version })
      .from(pipelineRunsV2Table)
      .where(eq(pipelineRunsV2Table.id, runId))
      .limit(1);

    if (!existingRun) {
      return;
    }

    await this.client.db
      .update(pipelineRunsV2Table)
      .set({
        finishedAt: timestamp,
        ...buildLifecycleValues({
          existing: existingRun,
          status,
          timestamp,
          metaJson: {
            source: "pipeline-run-repository",
          },
          extraJson: {},
        }),
      })
      .where(eq(pipelineRunsV2Table.id, runId));
  }
}
