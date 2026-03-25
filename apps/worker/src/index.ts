import { randomUUID } from "node:crypto";

import {
  ChapterWorkflowService,
  PreviewTextGenerationProvider,
  defaultPipelineStages,
} from "@aifiction/core";
import { NovelProjectRepository, getSqliteClient } from "@aifiction/data";

import { createDemoChapterJob } from "./pipeline-runner";

async function main() {
  const repository = new NovelProjectRepository();
  const databasePath = await repository.initialize();

  const demoJob = createDemoChapterJob();
  await repository.upsertChapterMemoryBundle(demoJob);

  const storedBundle = await repository.getChapterMemoryBundleBySlug(
    demoJob.work.slug,
    demoJob.chapter.id,
  );
  if (!storedBundle) {
    throw new Error("Failed to rebuild the chapter memory bundle from SQLite.");
  }

  const workflow = new ChapterWorkflowService(new PreviewTextGenerationProvider());
  const draftExecution = await workflow.runDraft(storedBundle);
  const reviewExecution = await workflow.runContinuityCheck(
    storedBundle,
    draftExecution.generation.content,
  );

  const now = new Date().toISOString();

  await repository.recordPipelineRun({
    id: randomUUID(),
    workId: storedBundle.work.id,
    chapterId: storedBundle.chapter.id,
    stage: draftExecution.promptBundle.stage,
    promptVersion: draftExecution.promptBundle.promptVersion,
    model: draftExecution.generation.model,
    success: true,
    inputSummary: storedBundle.chapter.summary,
    outputSummary: draftExecution.generation.content.slice(0, 120),
    estimatedTokenCost: draftExecution.generation.usage?.totalTokens ?? 0,
    startedAt: now,
    finishedAt: now,
  });

  await repository.recordPipelineRun({
    id: randomUUID(),
    workId: storedBundle.work.id,
    chapterId: storedBundle.chapter.id,
    stage: reviewExecution.promptBundle.stage,
    promptVersion: reviewExecution.promptBundle.promptVersion,
    model: reviewExecution.generation.model,
    success: true,
    inputSummary: draftExecution.generation.content.slice(0, 120),
    outputSummary: reviewExecution.generation.content.slice(0, 120),
    estimatedTokenCost: reviewExecution.generation.usage?.totalTokens ?? 0,
    startedAt: now,
    finishedAt: now,
  });

  const works = await repository.listWorks();

  console.log(`[AiFiction Worker] SQLite path: ${databasePath}`);
  console.log(`[AiFiction Worker] Current open connection path: ${getSqliteClient().databasePath}`);
  console.log("[AiFiction Worker] 当前流水线阶段：");
  for (const stage of defaultPipelineStages) {
    console.log(`- ${stage.label}（人工复核=${stage.requiresHumanReview ? "是" : "否"}）`);
  }

  console.log(`\n[AiFiction Worker] 当前数据库作品数：${works.length}`);
  console.log(`[AiFiction Worker] 当前作品：${storedBundle.work.title}`);
  console.log(`\n[Draft Preview] Provider=${draftExecution.generation.provider}`);
  console.log(draftExecution.generation.content);
  console.log(`\n[Continuity Preview] Provider=${reviewExecution.generation.provider}`);
  console.log(reviewExecution.generation.content);
}

main().catch((error) => {
  console.error("[AiFiction Worker] Execution failed.");
  console.error(error);
  process.exitCode = 1;
});