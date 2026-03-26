import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getSqliteClient, resolveWorkspaceRoot } from "./client";
import { SqliteProjectCatalogRepository, SqliteSyncSourceRepository, SqliteSyncWorkflowRepository } from "./repositories/v2";
import { NovelProjectSyncService } from "./sync";
import { SyncReviewQueueService } from "./sync/review-queue.service";
import { ensureSqliteV2Bootstrap } from "./v2/bootstrap";
import { foreshadowsV2Table, sourceDocumentsV2Table, timelineEventsV2Table } from "./v2";

async function main() {
  const client = getSqliteClient();
  const databasePath = await ensureSqliteV2Bootstrap(client);
  const projectRepository = new SqliteProjectCatalogRepository(client);
  const syncSourceRepository = new SqliteSyncSourceRepository(client);
  const syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
  const syncService = new NovelProjectSyncService(client);
  const reviewService = new SyncReviewQueueService(client);

  const project = await projectRepository.getProjectBySlug("demo-work-v2");
  if (!project) {
    throw new Error("Please run npm run db:v2-smoke before db:sync-smoke.");
  }

  const workspaceRoot = resolveWorkspaceRoot();
  const rootPath = path.join(workspaceRoot, "storage", "sync-smoke", project.slug);
  const chapterPath = path.join(rootPath, "chapters");
  const outlinePath = path.join(rootPath, "outline");

  fs.rmSync(rootPath, { recursive: true, force: true });
  fs.mkdirSync(chapterPath, { recursive: true });
  fs.mkdirSync(outlinePath, { recursive: true });

  const chapterFilePath = path.join(chapterPath, "0001-fire-gap.md");
  const outlineFilePath = path.join(outlinePath, "volume-1.md");

  fs.writeFileSync(
    chapterFilePath,
    "# Fire Gap\n\nAt dawn, Gu Wen had just set down the brazier when the forbidden vault alarm went off. Shen Yan blocked the alley entrance and warned him not to move yet.",
    "utf8",
  );
  fs.writeFileSync(
    outlineFilePath,
    "# Volume One\n\n- The lead is forced into the situation\n- Shen Yan intervenes for the first time\n- The first vault mark is planted as a clue",
    "utf8",
  );

  const fileSource = await syncService.bindProjectFileSource({
    projectId: project.id,
    sourceKey: "sync-smoke",
    label: "Sync Smoke Source",
    rootPath,
    chapterPath,
    outlinePath,
  });

  const firstScan = await syncService.scanFileSource(fileSource.id, "smoke-initial");

  fs.writeFileSync(
    chapterFilePath,
    "# Fire Gap\n\nAt dawn, Gu Wen had just set down the brazier when the forbidden vault alarm went off. Shen Yan blocked the alley entrance and warned him not to move yet. Gu Wen suspected Shen Yan knew too much, but still followed him into the side passage. A scorched mark on the ground looked like a clue someone had left behind.",
    "utf8",
  );

  const secondScan = await syncService.scanFileSource(fileSource.id, "smoke-modified");
  const fileSources = await syncService.listProjectFileSources(project.id);
  const reviewQueue = await syncService.listProjectReviewQueue(project.id);
  const sourceDocuments = await syncSourceRepository.listSourceDocuments(fileSource.id);
  const assetUpdates = await syncWorkflowRepository.listAssetUpdates({ projectId: project.id });
  const summarizedDocuments = sourceDocuments.filter((document) => Boolean(document.currentArtifactId)).length;
  const updateTypeCounts = assetUpdates.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.assetType] = (accumulator[item.assetType] ?? 0) + 1;
    return accumulator;
  }, {});

  const pendingExtractionReview = reviewQueue.find(
    (item) => item.reviewKind === "extraction-preview-validation" && item.sourceDocumentId,
  );

  let writebackSummary: Record<string, unknown> | null = null;
  let foreshadowCountBefore = 0;
  let foreshadowCountAfter = 0;
  let timelineCountBefore = 0;
  let timelineCountAfter = 0;
  let mappedScopeType = "N/A";
  let mappedScopeId = "N/A";
  let sourceDocumentSyncStatus = "N/A";

  if (pendingExtractionReview?.sourceDocumentId) {
    const beforeForeshadows = await client.db
      .select({ id: foreshadowsV2Table.id })
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.projectId, project.id));
    const beforeTimelineEvents = await client.db
      .select({ id: timelineEventsV2Table.id })
      .from(timelineEventsV2Table)
      .where(eq(timelineEventsV2Table.projectId, project.id));

    const reviewResult = await reviewService.decideReviewItem({
      reviewId: pendingExtractionReview.id,
      decision: "approved",
    });

    const afterForeshadows = await client.db
      .select({ id: foreshadowsV2Table.id })
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.projectId, project.id));
    const afterTimelineEvents = await client.db
      .select({ id: timelineEventsV2Table.id })
      .from(timelineEventsV2Table)
      .where(eq(timelineEventsV2Table.projectId, project.id));
    const mappedSourceDocument = await client.db
      .select()
      .from(sourceDocumentsV2Table)
      .where(eq(sourceDocumentsV2Table.id, pendingExtractionReview.sourceDocumentId))
      .limit(1);

    writebackSummary = reviewResult.writebackSummary ?? null;
    foreshadowCountBefore = beforeForeshadows.length;
    foreshadowCountAfter = afterForeshadows.length;
    timelineCountBefore = beforeTimelineEvents.length;
    timelineCountAfter = afterTimelineEvents.length;
    mappedScopeType = mappedSourceDocument[0]?.mappedScopeType ?? "N/A";
    mappedScopeId = mappedSourceDocument[0]?.mappedScopeId ?? "N/A";
    sourceDocumentSyncStatus = reviewResult.sourceDocumentSyncStatus ?? "N/A";
  }

  console.log(`[AiFiction Data] SQLite path: ${databasePath}`);
  console.log(`[AiFiction Data] Sync file sources: ${fileSources.length}`);
  console.log(`[AiFiction Data] Initial scan => scanned=${firstScan.scannedCount}, changed=${firstScan.changedCount}, created=${firstScan.createdCount}`);
  console.log(`[AiFiction Data] Modified scan => scanned=${secondScan.scannedCount}, changed=${secondScan.changedCount}, modified=${secondScan.modifiedCount}`);
  console.log(`[AiFiction Data] Source documents with current artifact: ${summarizedDocuments}`);
  console.log(`[AiFiction Data] Asset update count: ${assetUpdates.length}`);
  console.log(`[AiFiction Data] Asset update types: ${JSON.stringify(updateTypeCounts)}`);
  console.log(`[AiFiction Data] Review queue size: ${reviewQueue.length}`);
  console.log(`[AiFiction Data] Latest review summary: ${reviewQueue[0]?.summary ?? "N/A"}`);
  console.log(`[AiFiction Data] Bound root: ${fileSource.rootPath}`);
  console.log(`[AiFiction Data] Writeback summary: ${JSON.stringify(writebackSummary ?? {})}`);
  console.log(`[AiFiction Data] Foreshadows => before=${foreshadowCountBefore}, after=${foreshadowCountAfter}`);
  console.log(`[AiFiction Data] Timeline events => before=${timelineCountBefore}, after=${timelineCountAfter}`);
  console.log(`[AiFiction Data] Source mapping => type=${mappedScopeType}, id=${mappedScopeId}`);
  console.log(`[AiFiction Data] Source sync status => ${sourceDocumentSyncStatus}`);
}

main().catch((error) => {
  console.error("[AiFiction Data] Sync smoke failed.");
  console.error(error);
  process.exitCode = 1;
});