import { type SqliteClient, getSqliteClient } from "../client";
import {
  type SyncReviewQueueRecord,
  SqliteSyncSourceRepository,
  SqliteSyncWorkflowRepository,
} from "../repositories/v2";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { assessReviewRisk } from "./review-risk";
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

export interface AutoApproveReviewItemsResult {
  approvedReviewIds: string[];
  skippedReviewIds: string[];
}

/**
 * 瀹℃煡闃熷垪鏈嶅姟銆? * 璐熻矗鎶娾€滈€氳繃 / 椹冲洖鈥濆姩浣滅湡姝ｅ啓鍥炲鏌ラ」銆佸缓璁洿鏂板拰婧愭枃妗ｇ姸鎬併€? */
export class SyncReviewQueueService {
  private readonly approvedExtractionWritebackService: ApprovedExtractionWritebackService;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.approvedExtractionWritebackService = new ApprovedExtractionWritebackService(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
  }

  async autoApproveReviewItems(input: { reviewIds: string[]; decisionNote?: string }): Promise<AutoApproveReviewItemsResult> {
    await ensureSqliteV2Bootstrap(this.client);

    const approvedReviewIds: string[] = [];
    const skippedReviewIds: string[] = [];

    for (const reviewId of input.reviewIds) {
      const review = await this.syncWorkflowRepository.getReviewItemById(reviewId);
      if (!review || review.status !== "pending") {
        skippedReviewIds.push(reviewId);
        continue;
      }

      const riskAssessment = assessReviewRisk({
        reviewKind: review.reviewKind,
        severity: review.severity,
        detailJson: review.detailJson,
      });

      if (!riskAssessment.isAutoApprovable) {
        skippedReviewIds.push(reviewId);
        continue;
      }

      await this.decideReviewItem({
        reviewId,
        decision: "approved",
        decisionNote: input.decisionNote,
      });
      approvedReviewIds.push(reviewId);
    }

    return {
      approvedReviewIds,
      skippedReviewIds,
    };
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
   * 鏍规嵁鍚屼竴婧愭枃妗ｄ笅鐨勫鏌ョ粨鏋滐紝鍥炲啓婧愭枃妗ｅ悓姝ョ姸鎬併€?   * 瑙勫垯寰堢畝鍗曪細鍙杩樻湁 pending 灏变繚鎸?review_pending锛涙湁 rejected 灏辨爣璁?review_rejected锛涘惁鍒欒涓?synced銆?   */
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