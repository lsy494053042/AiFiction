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

export interface AutoRouteProjectReviewItemsResult {
  scannedReviewCount: number;
  approvedReviewIds: string[];
  reviewReviewIds: string[];
  conflictReviewIds: string[];
  informationGapReviewIds: string[];
  confidenceReviewIds: string[];
  formatBlockerReviewIds: string[];
  factualConflictReviewIds: string[];
}

export interface UpdateFollowUpTaskStateInput {
  projectId: string;
  chapterId: string;
  taskKind: "formal-review";
  taskFingerprint: string;
  taskStatus: "pending" | "in_review" | "completed" | "dismissed";
  taskOutcome?: "consistent" | "needs-revision" | "needs-rescan" | "deferred";
  outcomeSummary?: string;
  decisionNote?: string;
}

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

  async autoRouteProjectReviewItems(input: {
    projectId: string;
    decisionNote?: string;
    sourceDocumentIds?: string[];
    syncRunId?: string;
  }): Promise<AutoRouteProjectReviewItemsResult> {
    await ensureSqliteV2Bootstrap(this.client);

    const sourceDocumentIdSet = input.sourceDocumentIds?.length
      ? new Set(input.sourceDocumentIds.filter((value) => value.trim().length > 0))
      : undefined;

    const pendingReviews = (await this.syncWorkflowRepository.listReviewQueue(input.projectId, "pending"))
      .filter((review) => !sourceDocumentIdSet || (review.sourceDocumentId ? sourceDocumentIdSet.has(review.sourceDocumentId) : false))
      .filter((review) => !input.syncRunId || review.syncRunId === input.syncRunId);
    const approvedReviewIds: string[] = [];
    const reviewReviewIds: string[] = [];
    const conflictReviewIds: string[] = [];
    const informationGapReviewIds: string[] = [];
    const confidenceReviewIds: string[] = [];
    const formatBlockerReviewIds: string[] = [];
    const factualConflictReviewIds: string[] = [];

    for (const review of pendingReviews) {
      const riskAssessment = assessReviewRisk({
        reviewKind: review.reviewKind,
        severity: review.severity,
        detailJson: review.detailJson,
      });

      if (riskAssessment.isAutoApprovable) {
        await this.decideReviewItem({
          reviewId: review.id,
          decision: "approved",
          decisionNote: input.decisionNote ?? "系统已在自动分流阶段通过低风险审查项。",
        });
        approvedReviewIds.push(review.id);
        continue;
      }

      if (riskAssessment.blockingLevel === "conflict") {
        conflictReviewIds.push(review.id);
      } else {
        reviewReviewIds.push(review.id);
      }

      switch (riskAssessment.nature) {
        case "information-gap":
          informationGapReviewIds.push(review.id);
          break;
        case "confidence-review":
          confidenceReviewIds.push(review.id);
          break;
        case "format-blocker":
          formatBlockerReviewIds.push(review.id);
          break;
        case "factual-conflict":
          factualConflictReviewIds.push(review.id);
          break;
        default:
          break;
      }
    }

    return {
      scannedReviewCount: pendingReviews.length,
      approvedReviewIds,
      reviewReviewIds,
      conflictReviewIds,
      informationGapReviewIds,
      confidenceReviewIds,
      formatBlockerReviewIds,
      factualConflictReviewIds,
    };
  }

  async updateFollowUpTaskState(input: UpdateFollowUpTaskStateInput) {
    await ensureSqliteV2Bootstrap(this.client);

    const decidedAt = input.taskStatus === "pending" ? undefined : new Date().toISOString();
    const decisionNote = input.decisionNote?.trim() || undefined;
    const outcomeSummary = input.outcomeSummary?.trim() || undefined;
    const allowedOutcomes = ["consistent", "needs-revision", "needs-rescan", "deferred"] as const;
    const taskOutcome = input.taskStatus === "completed" || input.taskStatus === "dismissed"
      ? input.taskOutcome
      : undefined;

    if (taskOutcome && !allowedOutcomes.includes(taskOutcome)) {
      throw new Error("不支持的复核结果。");
    }

    await this.syncWorkflowRepository.saveFollowUpTaskState({
      projectId: input.projectId,
      chapterId: input.chapterId,
      taskKind: input.taskKind,
      taskFingerprint: input.taskFingerprint,
      taskStatus: input.taskStatus,
      taskOutcome,
      outcomeSummary,
      decisionNote,
      decidedAt,
    });

    return this.syncWorkflowRepository.getFollowUpTaskState({
      projectId: input.projectId,
      chapterId: input.chapterId,
      taskKind: input.taskKind,
    });
  }

  async decideReviewItem(input: DecideReviewItemInput): Promise<DecideReviewItemResult> {
    await ensureSqliteV2Bootstrap(this.client);

    const review = await this.syncWorkflowRepository.getReviewItemById(input.reviewId);
    if (!review) {
      throw new Error("未找到对应的审查项。");
    }
    if (review.status !== "pending") {
      throw new Error("只有待处理状态的审查项才能做决定。");
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
      throw new Error("审查项已更新，但重新加载失败。");
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