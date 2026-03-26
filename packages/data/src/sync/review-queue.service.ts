import { type SqliteClient, getSqliteClient } from "../client";
import {
  type SyncReviewQueueRecord,
  SqliteSyncSourceRepository,
  SqliteSyncWorkflowRepository,
} from "../repositories/v2";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { ApprovedExtractionWritebackService } from "./approved-extraction-writeback.service";

export interface DecideReviewItemInput {
  reviewId: string;
  decision: "approved" | "rejected";
  decisionNote?: string;
}

export interface DecideReviewItemResult {
  review: SyncReviewQueueRecord;
  sourceDocumentSyncStatus?: string;
  writebackSummary?: {
    candidateBundleCount: number;
    charactersCreated: number;
    relationshipsUpserted: number;
    foreshadowsUpserted: number;
    timelineEventsUpserted: number;
    sourceChaptersCreated: number;
  };
}

/**
 * 审查队列服务。
 * 负责把“通过 / 驳回”动作真正写回审查项、建议更新和源文档状态。
 */
export class SyncReviewQueueService {
  private readonly approvedExtractionWritebackService: ApprovedExtractionWritebackService;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.approvedExtractionWritebackService = new ApprovedExtractionWritebackService(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
  }

  async decideReviewItem(input: DecideReviewItemInput): Promise<DecideReviewItemResult> {
    await ensureSqliteV2Bootstrap(this.client);

    const review = await this.syncWorkflowRepository.getReviewItemById(input.reviewId);
    if (!review) {
      throw new Error("Review item was not found.");
    }
    if (review.status !== "pending") {
      throw new Error("Only pending review items can be decided.");
    }

    const decidedAt = new Date().toISOString();
    const decisionNote = input.decisionNote?.trim() || undefined;

    if (review.assetUpdateId) {
      const assetUpdate = await this.syncWorkflowRepository.getAssetUpdateById(review.assetUpdateId);
      if (assetUpdate) {
        await this.syncWorkflowRepository.saveAssetUpdate({
          id: assetUpdate.id,
          projectId: assetUpdate.projectId,
          syncRunId: assetUpdate.syncRunId,
          sourceDocumentId: assetUpdate.sourceDocumentId,
          assetType: assetUpdate.assetType,
          assetId: assetUpdate.assetId,
          updateKind: assetUpdate.updateKind,
          confidenceLevel: assetUpdate.confidenceLevel,
          proposedPayloadJson: assetUpdate.proposedPayloadJson,
          appliedStatus: input.decision === "approved" ? "applied" : "rejected",
          appliedAt: input.decision === "approved" ? decidedAt : undefined,
        });
      }
    }

    let writebackSummary: DecideReviewItemResult["writebackSummary"];
    if (review.reviewKind === "extraction-preview-validation" && review.sourceDocumentId) {
      writebackSummary = await this.approvedExtractionWritebackService.syncApprovedExtraction({
        projectId: review.projectId,
        sourceDocumentId: review.sourceDocumentId,
        decidedAt,
        decision: input.decision,
      });
    }

    await this.syncWorkflowRepository.enqueueReviewItem({
      id: review.id,
      projectId: review.projectId,
      syncRunId: review.syncRunId,
      sourceDocumentId: review.sourceDocumentId,
      assetUpdateId: review.assetUpdateId,
      sourceType: review.sourceType,
      sourceId: review.sourceId,
      reviewKind: review.reviewKind,
      severity: review.severity,
      status: input.decision,
      summary: review.summary,
      detailJson: review.detailJson,
      decisionNote,
      decidedAt,
    });

    const updatedReview = await this.syncWorkflowRepository.getReviewItemById(review.id);
    if (!updatedReview) {
      throw new Error("Review item was updated but could not be reloaded.");
    }

    const sourceDocumentSyncStatus = review.sourceDocumentId
      ? await this.syncSourceDocumentStatus(review.projectId, review.sourceDocumentId)
      : undefined;

    return {
      review: updatedReview,
      sourceDocumentSyncStatus,
      writebackSummary,
    };
  }

  /**
   * 根据同一源文档下的审查结果，回写源文档同步状态。
   * 规则很简单：只要还有 pending 就保持 review_pending；有 rejected 就标记 review_rejected；否则视为 synced。
   */
  private async syncSourceDocumentStatus(projectId: string, sourceDocumentId: string): Promise<string | undefined> {
    const sourceDocument = await this.findSourceDocument(projectId, sourceDocumentId);
    if (!sourceDocument) {
      return undefined;
    }

    const reviewItems = await this.syncWorkflowRepository.listReviewQueue(projectId);
    const relatedReviews = reviewItems.filter((item) => item.sourceDocumentId === sourceDocumentId);

    const nextSyncStatus = relatedReviews.some((item) => item.status === "pending")
      ? "review_pending"
      : relatedReviews.some((item) => item.status === "rejected")
        ? "review_rejected"
        : "synced";

    await this.syncSourceRepository.saveSourceDocument({
      ...sourceDocument,
      syncStatus: nextSyncStatus,
    });

    return nextSyncStatus;
  }

  private async findSourceDocument(projectId: string, sourceDocumentId: string) {
    const fileSources = await this.syncSourceRepository.listFileSources(projectId);
    for (const fileSource of fileSources) {
      const sourceDocuments = await this.syncSourceRepository.listSourceDocuments(fileSource.id);
      const matchedDocument = sourceDocuments.find((sourceDocument) => sourceDocument.id === sourceDocumentId);
      if (matchedDocument) {
        return matchedDocument;
      }
    }

    return null;
  }
}