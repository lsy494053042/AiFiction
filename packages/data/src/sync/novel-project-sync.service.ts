import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { type SqliteClient, getSqliteClient, resolveWorkspaceRoot } from "../client";
import {
  SqliteArtifactRepository,
  SqliteProjectCatalogRepository,
  SqliteSyncSourceRepository,
  type SyncFileSourceRecord,
  type SyncSourceDocumentRecord,
  SqliteSyncWorkflowRepository,
  type SyncReviewQueueRecord,
} from "../repositories/v2";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import {
  analyzeSourceDocumentText,
  formatSourceSummaryArtifact,
  loadSourceDocumentText,
} from "./document-analysis";
import {
  extractSourceDocumentPreview,
  formatExtractionPreviewArtifact,
  type SourceDocumentExtractionPreview,
} from "./document-extraction";
import { SyncReviewQueueService, type AutoRouteProjectReviewItemsResult } from "./review-queue.service";

export interface BindProjectFileSourceInput {
  projectId: string;
  sourceKey?: string;
  label?: string;
  sourceKind?: string;
  rootPath: string;
  chapterPath?: string;
  outlinePath?: string;
  exportPath?: string;
  scanPolicy?: {
    includeExtensions?: string[];
    excludeDirectories?: string[];
  };
}

export interface FileSourceAutoRouteSummary {
  scannedReviewCount: number;
  approvedReviewCount: number;
  remainingReviewCount: number;
  conflictReviewCount: number;
  informationGapReviewCount: number;
  confidenceReviewCount: number;
  formatBlockerReviewCount: number;
  factualConflictReviewCount: number;
}

export interface FileSourceScanSummary {
  runId: string;
  fileSource: SyncFileSourceRecord;
  scannedCount: number;
  changedCount: number;
  createdCount: number;
  modifiedCount: number;
  missingCount: number;
  unchangedCount: number;
  autoRoute: FileSourceAutoRouteSummary;
}

interface CollectedFile {
  absolutePath: string;
  relativePath: string;
  documentKind: string;
}

interface NormalizedScanPolicy {
  includeExtensions: string[];
  excludeDirectories: string[];
}

interface ChangedDocumentProcessingInput {
  runId: string;
  runItemId: string;
  fileSource: SyncFileSourceRecord;
  sourceDocument: SyncSourceDocumentRecord;
  absolutePath: string;
  fileBuffer: Buffer;
  changeKind: string;
}

interface ChangedDocumentProcessingResult {
  processingStatus: string;
  generatedArtifactId?: string;
  generatedArtifactVersionId?: string;
}

interface ChangedRunItemSummary {
  syncRunId: string;
  runItemId: string;
  sourceDocumentId: string;
  relativePath: string;
  changeKind: string;
  generatedArtifactId?: string;
  generatedArtifactVersionId?: string;
}

const defaultScanPolicy: NormalizedScanPolicy = {
  includeExtensions: [".md", ".txt", ".docx"],
  excludeDirectories: [".git", ".next", "dist", "node_modules"],
};

/**
 * 小说目录同步服务。
 * 当前先完成“绑定目录 -> 扫描文件 -> 摘要预览 -> 结构化抽取预览 -> 审查入队”的首版链路。
 */
export class NovelProjectSyncService {
  private readonly artifactRepository: SqliteArtifactRepository;
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;
  private readonly reviewQueueService: SyncReviewQueueService;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.artifactRepository = new SqliteArtifactRepository(client);
    this.projectCatalogRepository = new SqliteProjectCatalogRepository(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
    this.reviewQueueService = new SyncReviewQueueService(client);
  }

  async bindProjectFileSource(input: BindProjectFileSourceInput): Promise<SyncFileSourceRecord> {
    await ensureSqliteV2Bootstrap(this.client);

    const project = await this.findProjectById(input.projectId);
    if (!project) {
      throw new Error("Project was not found for file source binding.");
    }

    const sourceKey = this.slugify(input.sourceKey?.trim() || "local-source");
    const rootPath = this.resolveManagedPath(input.rootPath);
    const fileSource: SyncFileSourceRecord = {
      id: this.buildFileSourceId(input.projectId, sourceKey),
      projectId: input.projectId,
      sourceKey,
      label: input.label?.trim() || `${project.title} Local Source`,
      sourceKind: input.sourceKind?.trim() || "local-directory",
      rootPath,
      chapterPath: this.resolveChildPath(rootPath, input.chapterPath),
      outlinePath: this.resolveChildPath(rootPath, input.outlinePath),
      exportPath: this.resolveChildPath(rootPath, input.exportPath),
      scanPolicyJson: { ...this.normalizeScanPolicy(input.scanPolicy) },
      isActive: true,
      lastScannedAt: undefined,
      status: "active",
    };

    await this.syncSourceRepository.saveFileSource(fileSource);
    return fileSource;
  }

  async listProjectFileSources(projectId: string): Promise<SyncFileSourceRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);
    return this.syncSourceRepository.listFileSources(projectId);
  }

  async listProjectReviewQueue(projectId: string, status?: string): Promise<SyncReviewQueueRecord[]> {
    await ensureSqliteV2Bootstrap(this.client);
    return this.syncWorkflowRepository.listReviewQueue(projectId, status);
  }

  async scanFileSource(fileSourceId: string, triggerMode = "manual"): Promise<FileSourceScanSummary> {
    await ensureSqliteV2Bootstrap(this.client);

    const fileSource = await this.syncSourceRepository.getFileSourceById(fileSourceId);
    if (!fileSource) {
      throw new Error("File source was not found.");
    }

    const existingDocuments = await this.syncSourceRepository.listSourceDocuments(fileSource.id);
    const existingByPath = new Map(existingDocuments.map((document) => [document.relativePath, document]));
    const scanPolicy = this.normalizeScanPolicy(fileSource.scanPolicyJson as Partial<NormalizedScanPolicy>);
    const collectedFiles = this.collectTrackedFiles(fileSource, scanPolicy);
    const scannedAt = new Date().toISOString();
    const runId = await this.syncWorkflowRepository.startSyncRun({
      projectId: fileSource.projectId,
      fileSourceId: fileSource.id,
      runKind: "file-source-scan",
      triggerMode,
    });

    let scannedCount = 0;
    let changedCount = 0;
    let createdCount = 0;
    let modifiedCount = 0;
    let missingCount = 0;
    let unchangedCount = 0;
    let autoRoute = this.createEmptyAutoRouteSummary();
    const changedRunItems: ChangedRunItemSummary[] = [];

    try {
      const seenRelativePaths = new Set<string>();

      for (const file of collectedFiles) {
        scannedCount += 1;
        seenRelativePaths.add(file.relativePath);

        const fileBuffer = fs.readFileSync(file.absolutePath);
        const checksum = createHash("sha1").update(fileBuffer).digest("hex");
        const fileStat = fs.statSync(file.absolutePath);
        const existingDocument = existingByPath.get(file.relativePath);
        const changeKind = !existingDocument
          ? "created"
          : existingDocument.checksum !== checksum
            ? "modified"
            : "unchanged";

        if (changeKind === "created") {
          createdCount += 1;
          changedCount += 1;
        } else if (changeKind === "modified") {
          modifiedCount += 1;
          changedCount += 1;
        } else {
          unchangedCount += 1;
        }

        const documentRecord: SyncSourceDocumentRecord = {
          id: existingDocument?.id ?? this.buildSourceDocumentId(fileSource.id, file.relativePath),
          projectId: fileSource.projectId,
          fileSourceId: fileSource.id,
          relativePath: file.relativePath,
          documentKind: file.documentKind,
          checksum,
          fileSizeBytes: fileStat.size,
          lastModifiedAt: fileStat.mtime.toISOString(),
          syncStatus: changeKind === "unchanged" ? existingDocument?.syncStatus ?? "synced" : "pending",
          mappedScopeType: existingDocument?.mappedScopeType,
          mappedScopeId: existingDocument?.mappedScopeId,
          currentArtifactId: existingDocument?.currentArtifactId,
          status: "active",
        };

        await this.syncSourceRepository.saveSourceDocument(documentRecord);

        if (changeKind !== "unchanged") {
          const runItemId = await this.syncWorkflowRepository.saveSyncRunItem({
            syncRunId: runId,
            sourceDocumentId: documentRecord.id,
            changeKind,
            processingStatus: "detected",
            summary: `${file.relativePath} => ${changeKind}`,
          });

          const processingResult = await this.processChangedDocument({
            runId,
            runItemId,
            fileSource,
            sourceDocument: documentRecord,
            absolutePath: file.absolutePath,
            fileBuffer,
            changeKind,
          });

          changedRunItems.push({
            syncRunId: runId,
            runItemId,
            sourceDocumentId: documentRecord.id,
            relativePath: documentRecord.relativePath,
            changeKind,
            generatedArtifactId: processingResult.generatedArtifactId,
            generatedArtifactVersionId: processingResult.generatedArtifactVersionId,
          });
        }
      }

      for (const existingDocument of existingDocuments) {
        if (seenRelativePaths.has(existingDocument.relativePath)) {
          continue;
        }

        missingCount += 1;
        changedCount += 1;

        await this.syncSourceRepository.saveSourceDocument({
          ...existingDocument,
          syncStatus: "missing",
          status: "missing",
        });

        await this.syncWorkflowRepository.saveSyncRunItem({
          syncRunId: runId,
          sourceDocumentId: existingDocument.id,
          changeKind: "deleted",
          processingStatus: "detected",
          summary: `${existingDocument.relativePath} => deleted`,
        });
      }

      if (changedRunItems.length > 0) {
        const autoRouteResult = await this.reviewQueueService.autoRouteProjectReviewItems({
          projectId: fileSource.projectId,
          sourceDocumentIds: changedRunItems.map((item) => item.sourceDocumentId),
          syncRunId: runId,
          decisionNote: "System auto-approved low-risk review items after sync.",
        });
        autoRoute = this.toAutoRouteSummary(autoRouteResult);

        for (const changedRunItem of changedRunItems) {
          await this.refreshChangedRunItemStatus(changedRunItem);
        }
      }

      await this.syncSourceRepository.saveFileSource({
        ...fileSource,
        lastScannedAt: scannedAt,
      });

      await this.syncWorkflowRepository.finishSyncRun({
        runId,
        runStatus: "completed",
        scannedCount,
        changedCount,
      });

      return {
        runId,
        fileSource: {
          ...fileSource,
          lastScannedAt: scannedAt,
        },
        scannedCount,
        changedCount,
        createdCount,
        modifiedCount,
        missingCount,
        unchangedCount,
        autoRoute,
      };
    } catch (error) {
      await this.syncWorkflowRepository.finishSyncRun({
        runId,
        runStatus: "failed",
        scannedCount,
        changedCount,
        errorSummary: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 扫描后处理。
   * 当前先生成摘要 artifact、结构化预览 artifact，并把建议更新写入审查链。
   */
  private async processChangedDocument(input: ChangedDocumentProcessingInput): Promise<ChangedDocumentProcessingResult> {
    const loadedContent = loadSourceDocumentText(input.absolutePath, input.fileBuffer);

    if (!loadedContent.textContent) {
      return this.handleUnsupportedDocument(input, loadedContent.unsupportedReason ?? "Unsupported format");
    }

    const analysis = analyzeSourceDocumentText({
      relativePath: input.sourceDocument.relativePath,
      documentKind: input.sourceDocument.documentKind,
      textContent: loadedContent.textContent,
    });
    const extractionPreview = extractSourceDocumentPreview({
      textContent: loadedContent.textContent,
      analysis,
    });

    const summaryArtifact = await this.artifactRepository.saveTextArtifactVersion(
      {
        projectId: input.fileSource.projectId,
        scopeType: "source-document",
        scopeId: input.sourceDocument.id,
        artifactKey: "source-summary",
        artifactKind: `${input.sourceDocument.documentKind}-summary`,
        contentFormat: "text/markdown",
        contentText: formatSourceSummaryArtifact({
          relativePath: input.sourceDocument.relativePath,
          documentKind: input.sourceDocument.documentKind,
          analysis,
        }),
        summary: analysis.summary,
        metadata: {
          relativePath: input.sourceDocument.relativePath,
          documentKind: input.sourceDocument.documentKind,
          title: analysis.title,
          headingTrail: analysis.headingTrail,
          candidateNames: analysis.candidateNames,
          paragraphCount: analysis.paragraphCount,
          lineCount: analysis.lineCount,
          characterCount: analysis.characterCount,
          originalFormat: loadedContent.originalFormat ?? "unknown",
        },
      },
      {
        source: "project-sync",
        reason: "scan-summary-preview",
      },
    );

    const summaryAssetUpdateId = await this.syncWorkflowRepository.saveAssetUpdate({
      projectId: input.fileSource.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetType: "source-document-analysis",
      assetId: input.sourceDocument.id,
      updateKind: input.changeKind,
      confidenceLevel: analysis.confidenceLevel,
      proposedPayloadJson: {
        relativePath: input.sourceDocument.relativePath,
        documentKind: input.sourceDocument.documentKind,
        title: analysis.title,
        summary: analysis.summary,
        headingTrail: analysis.headingTrail,
        candidateNames: analysis.candidateNames,
        paragraphCount: analysis.paragraphCount,
        lineCount: analysis.lineCount,
        characterCount: analysis.characterCount,
        reviewHints: analysis.reviewHints,
      },
      appliedStatus: "review_pending",
    });

    const extractionConfidence = this.deriveConfidenceLevel([
      ...extractionPreview.characters.map((item) => item.confidenceLevel),
      ...extractionPreview.relationships.map((item) => item.confidenceLevel),
      ...extractionPreview.foreshadows.map((item) => item.confidenceLevel),
      ...extractionPreview.timelineEvents.map((item) => item.confidenceLevel),
    ], extractionPreview.reviewHints.length);

    const extractionArtifact = await this.artifactRepository.saveTextArtifactVersion(
      {
        projectId: input.fileSource.projectId,
        scopeType: "source-document",
        scopeId: input.sourceDocument.id,
        artifactKey: "source-extraction-preview",
        artifactKind: `${input.sourceDocument.documentKind}-extraction-preview`,
        contentFormat: "application/json",
        contentText: formatExtractionPreviewArtifact(extractionPreview),
        contentJson: {
          relativePath: input.sourceDocument.relativePath,
          documentKind: input.sourceDocument.documentKind,
          title: analysis.title,
          summary: analysis.summary,
          preview: extractionPreview,
        },
        summary: `Extraction preview for ${input.sourceDocument.relativePath}`,
        metadata: {
          relativePath: input.sourceDocument.relativePath,
          documentKind: input.sourceDocument.documentKind,
          previewKind: "heuristic-structured-extraction",
          characterCandidateCount: extractionPreview.characters.length,
          relationshipCandidateCount: extractionPreview.relationships.length,
          foreshadowCandidateCount: extractionPreview.foreshadows.length,
          timelineCandidateCount: extractionPreview.timelineEvents.length,
        },
      },
      {
        source: "project-sync",
        reason: "scan-extraction-preview",
      },
    );

    const extractionAssetUpdateId = await this.syncWorkflowRepository.saveAssetUpdate({
      projectId: input.fileSource.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetType: "source-document-extraction-preview",
      assetId: input.sourceDocument.id,
      updateKind: input.changeKind,
      confidenceLevel: extractionConfidence,
      proposedPayloadJson: {
        relativePath: input.sourceDocument.relativePath,
        documentKind: input.sourceDocument.documentKind,
        preview: extractionPreview,
      },
      appliedStatus: "review_pending",
    });

    await this.persistCandidateBundles({
      runId: input.runId,
      sourceDocument: input.sourceDocument,
      projectId: input.fileSource.projectId,
      changeKind: input.changeKind,
      extractionPreview,
      extractionArtifactVersionId: extractionArtifact.artifactVersionId,
    });

    await this.syncWorkflowRepository.saveSourceRef({
      projectId: input.fileSource.projectId,
      assetType: "source-document-analysis",
      assetId: input.sourceDocument.id,
      sourceDocumentId: input.sourceDocument.id,
      artifactVersionId: summaryArtifact.artifactVersionId,
      referenceKind: "summary-artifact",
      locator: `${input.sourceDocument.relativePath}#summary`,
      evidenceQuote: analysis.summary,
    });

    await this.syncWorkflowRepository.saveSourceRef({
      projectId: input.fileSource.projectId,
      assetType: "source-document-extraction-preview",
      assetId: input.sourceDocument.id,
      sourceDocumentId: input.sourceDocument.id,
      artifactVersionId: extractionArtifact.artifactVersionId,
      referenceKind: "extraction-artifact",
      locator: `${input.sourceDocument.relativePath}#extraction-preview`,
      evidenceQuote: analysis.summary,
    });

    await this.syncWorkflowRepository.enqueueReviewItem({
      projectId: input.fileSource.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetUpdateId: summaryAssetUpdateId,
      sourceType: "source-document",
      sourceId: input.sourceDocument.id,
      reviewKind: "summary-validation",
      severity: analysis.confidenceLevel === "low" ? "medium" : "low",
      status: "pending",
      summary: `Review generated summary for ${input.sourceDocument.relativePath}`,
      detailJson: {
        title: analysis.title,
        summary: analysis.summary,
        candidateNames: analysis.candidateNames,
        reviewHints: analysis.reviewHints,
      },
    });

    await this.syncWorkflowRepository.enqueueReviewItem({
      projectId: input.fileSource.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetUpdateId: extractionAssetUpdateId,
      sourceType: "source-document",
      sourceId: input.sourceDocument.id,
      reviewKind: "extraction-preview-validation",
      severity: extractionConfidence === "low" ? "medium" : "low",
      status: "pending",
      summary: `Review extraction preview for ${input.sourceDocument.relativePath}`,
      detailJson: {
        characterCandidateCount: extractionPreview.characters.length,
        relationshipCandidateCount: extractionPreview.relationships.length,
        foreshadowCandidateCount: extractionPreview.foreshadows.length,
        timelineCandidateCount: extractionPreview.timelineEvents.length,
        reviewHints: extractionPreview.reviewHints,
      },
    });

    await this.syncSourceRepository.saveSourceDocument({
      ...input.sourceDocument,
      mappedScopeType: input.sourceDocument.documentKind,
      mappedScopeId: input.sourceDocument.id,
      currentArtifactId: extractionArtifact.artifactId,
      syncStatus: "review_pending",
    });

    await this.syncWorkflowRepository.saveSyncRunItem({
      id: input.runItemId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      changeKind: input.changeKind,
      processingStatus: "review_pending",
      generatedArtifactId: extractionArtifact.artifactId,
      generatedArtifactVersionId: extractionArtifact.artifactVersionId,
      summary: `${input.sourceDocument.relativePath} => summary and extraction preview generated`,
    });

    return {
      processingStatus: "review_pending",
      generatedArtifactId: extractionArtifact.artifactId,
      generatedArtifactVersionId: extractionArtifact.artifactVersionId,
    };
  }

  /**
   * 暂不支持自动解析的源文件先进入人工审查。
   */
  private async handleUnsupportedDocument(
    input: ChangedDocumentProcessingInput,
    unsupportedReason: string,
  ): Promise<ChangedDocumentProcessingResult> {
    const assetUpdateId = await this.syncWorkflowRepository.saveAssetUpdate({
      projectId: input.fileSource.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetType: "source-document-analysis",
      assetId: input.sourceDocument.id,
      updateKind: "unsupported-format",
      confidenceLevel: "low",
      proposedPayloadJson: {
        relativePath: input.sourceDocument.relativePath,
        documentKind: input.sourceDocument.documentKind,
        unsupportedReason,
      },
      appliedStatus: "review_pending",
    });

    await this.syncWorkflowRepository.enqueueReviewItem({
      projectId: input.fileSource.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetUpdateId,
      sourceType: "source-document",
      sourceId: input.sourceDocument.id,
      reviewKind: "unsupported-source-format",
      severity: "medium",
      status: "pending",
      summary: `Review unsupported source: ${input.sourceDocument.relativePath}`,
      detailJson: {
        relativePath: input.sourceDocument.relativePath,
        unsupportedReason,
      },
    });

    await this.syncSourceRepository.saveSourceDocument({
      ...input.sourceDocument,
      mappedScopeType: input.sourceDocument.documentKind,
      mappedScopeId: input.sourceDocument.id,
      syncStatus: "review_pending",
    });

    await this.syncWorkflowRepository.saveSyncRunItem({
      id: input.runItemId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      changeKind: input.changeKind,
      processingStatus: "review_pending",
      summary: `${input.sourceDocument.relativePath} => manual review required`,
      errorMessage: unsupportedReason,
    });

    return {
      processingStatus: "review_pending",
    };
  }

  /**
   * 保存角色、关系、伏笔、时间线候选 bundle。
   * 当前先作为建议更新落库，真正的结构化回写放到下一阶段。
   */
  private async persistCandidateBundles(input: {
    runId: string;
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    changeKind: string;
    extractionPreview: SourceDocumentExtractionPreview;
    extractionArtifactVersionId: string;
  }) {
    await this.saveCandidateBundle({
      projectId: input.projectId,
      runId: input.runId,
      sourceDocument: input.sourceDocument,
      changeKind: input.changeKind,
      assetType: "character-candidate-bundle",
      payload: {
        candidates: input.extractionPreview.characters,
      },
      confidenceLevel: this.deriveConfidenceLevel(input.extractionPreview.characters.map((item) => item.confidenceLevel)),
      artifactVersionId: input.extractionArtifactVersionId,
      locatorSuffix: "characters",
      evidenceQuote: input.extractionPreview.characters[0]?.evidence[0],
    });

    await this.saveCandidateBundle({
      projectId: input.projectId,
      runId: input.runId,
      sourceDocument: input.sourceDocument,
      changeKind: input.changeKind,
      assetType: "relationship-candidate-bundle",
      payload: {
        candidates: input.extractionPreview.relationships,
      },
      confidenceLevel: this.deriveConfidenceLevel(input.extractionPreview.relationships.map((item) => item.confidenceLevel)),
      artifactVersionId: input.extractionArtifactVersionId,
      locatorSuffix: "relationships",
      evidenceQuote: input.extractionPreview.relationships[0]?.evidence,
    });

    await this.saveCandidateBundle({
      projectId: input.projectId,
      runId: input.runId,
      sourceDocument: input.sourceDocument,
      changeKind: input.changeKind,
      assetType: "foreshadow-candidate-bundle",
      payload: {
        candidates: input.extractionPreview.foreshadows,
      },
      confidenceLevel: this.deriveConfidenceLevel(input.extractionPreview.foreshadows.map((item) => item.confidenceLevel)),
      artifactVersionId: input.extractionArtifactVersionId,
      locatorSuffix: "foreshadows",
      evidenceQuote: input.extractionPreview.foreshadows[0]?.evidence,
    });

    await this.saveCandidateBundle({
      projectId: input.projectId,
      runId: input.runId,
      sourceDocument: input.sourceDocument,
      changeKind: input.changeKind,
      assetType: "timeline-candidate-bundle",
      payload: {
        candidates: input.extractionPreview.timelineEvents,
      },
      confidenceLevel: this.deriveConfidenceLevel(input.extractionPreview.timelineEvents.map((item) => item.confidenceLevel)),
      artifactVersionId: input.extractionArtifactVersionId,
      locatorSuffix: "timeline",
      evidenceQuote: input.extractionPreview.timelineEvents[0]?.evidence,
    });
  }

  private async saveCandidateBundle(input: {
    projectId: string;
    runId: string;
    sourceDocument: SyncSourceDocumentRecord;
    changeKind: string;
    assetType: string;
    payload: Record<string, unknown>;
    confidenceLevel: "low" | "medium";
    artifactVersionId: string;
    locatorSuffix: string;
    evidenceQuote?: string;
  }) {
    const candidates = Array.isArray(input.payload.candidates) ? input.payload.candidates : [];
    if (!candidates.length) {
      return;
    }

    await this.syncWorkflowRepository.saveAssetUpdate({
      projectId: input.projectId,
      syncRunId: input.runId,
      sourceDocumentId: input.sourceDocument.id,
      assetType: input.assetType,
      assetId: input.sourceDocument.id,
      updateKind: input.changeKind,
      confidenceLevel: input.confidenceLevel,
      proposedPayloadJson: {
        relativePath: input.sourceDocument.relativePath,
        documentKind: input.sourceDocument.documentKind,
        ...input.payload,
      },
      appliedStatus: "review_pending",
    });

    await this.syncWorkflowRepository.saveSourceRef({
      projectId: input.projectId,
      assetType: input.assetType,
      assetId: input.sourceDocument.id,
      sourceDocumentId: input.sourceDocument.id,
      artifactVersionId: input.artifactVersionId,
      referenceKind: "candidate-bundle",
      locator: `${input.sourceDocument.relativePath}#${input.locatorSuffix}`,
      evidenceQuote: input.evidenceQuote,
    });
  }

  private createEmptyAutoRouteSummary(): FileSourceAutoRouteSummary {
    return {
      scannedReviewCount: 0,
      approvedReviewCount: 0,
      remainingReviewCount: 0,
      conflictReviewCount: 0,
      informationGapReviewCount: 0,
      confidenceReviewCount: 0,
      formatBlockerReviewCount: 0,
      factualConflictReviewCount: 0,
    };
  }

  private toAutoRouteSummary(result?: AutoRouteProjectReviewItemsResult): FileSourceAutoRouteSummary {
    if (!result) {
      return this.createEmptyAutoRouteSummary();
    }

    return {
      scannedReviewCount: result.scannedReviewCount,
      approvedReviewCount: result.approvedReviewIds.length,
      remainingReviewCount: result.reviewReviewIds.length + result.conflictReviewIds.length,
      conflictReviewCount: result.conflictReviewIds.length,
      informationGapReviewCount: result.informationGapReviewIds.length,
      confidenceReviewCount: result.confidenceReviewIds.length,
      formatBlockerReviewCount: result.formatBlockerReviewIds.length,
      factualConflictReviewCount: result.factualConflictReviewIds.length,
    };
  }

  private async refreshChangedRunItemStatus(input: ChangedRunItemSummary): Promise<void> {
    const sourceDocument = await this.syncSourceRepository.getSourceDocumentById(input.sourceDocumentId);
    const processingStatus = sourceDocument?.syncStatus === "synced"
      ? "auto_applied"
      : sourceDocument?.syncStatus === "review_rejected"
        ? "review_rejected"
        : "review_pending";

    const summary = processingStatus === "auto_applied"
      ? `${input.relativePath} => low-risk changes auto-applied`
      : processingStatus === "review_rejected"
        ? `${input.relativePath} => review rejected during sync`
        : `${input.relativePath} => awaiting review`;

    await this.syncWorkflowRepository.saveSyncRunItem({
      id: input.runItemId,
      syncRunId: input.syncRunId,
      sourceDocumentId: input.sourceDocumentId,
      changeKind: input.changeKind,
      processingStatus,
      generatedArtifactId: input.generatedArtifactId,
      generatedArtifactVersionId: input.generatedArtifactVersionId,
      summary,
    });
  }

  private deriveConfidenceLevel(
    values: Array<"low" | "medium">,
    extraRiskCount = 0,
  ): "low" | "medium" {
    if (!values.length) {
      return "low";
    }

    if (extraRiskCount > 0) {
      return "low";
    }

    return values.some((value) => value === "low") ? "low" : "medium";
  }

  private async findProjectById(projectId: string) {
    const works = await this.projectCatalogRepository.listProjects({ limit: 200 });
    return works.find((work) => work.id === projectId) ?? null;
  }

  private buildFileSourceId(projectId: string, sourceKey: string): string {
    return `${projectId}:file-source:${sourceKey}`;
  }

  private buildSourceDocumentId(fileSourceId: string, relativePath: string): string {
    const pathDigest = createHash("sha1").update(relativePath).digest("hex");
    return `${fileSourceId}:document:${pathDigest}`;
  }

  private normalizeScanPolicy(input?: Partial<NormalizedScanPolicy>): NormalizedScanPolicy {
    const includeExtensions = (input?.includeExtensions ?? defaultScanPolicy.includeExtensions)
      .map((extension) => extension.trim().toLowerCase())
      .filter(Boolean);
    const excludeDirectories = (input?.excludeDirectories ?? defaultScanPolicy.excludeDirectories)
      .map((directory) => directory.trim())
      .filter(Boolean);

    return {
      includeExtensions: includeExtensions.length ? includeExtensions : [...defaultScanPolicy.includeExtensions],
      excludeDirectories: excludeDirectories.length ? excludeDirectories : [...defaultScanPolicy.excludeDirectories],
    };
  }

  private collectTrackedFiles(
    fileSource: SyncFileSourceRecord,
    scanPolicy: NormalizedScanPolicy,
  ): CollectedFile[] {
    const roots = this.resolveScanRoots(fileSource);
    const seenAbsolutePaths = new Set<string>();
    const files: CollectedFile[] = [];

    for (const scanRoot of roots) {
      if (!fs.existsSync(scanRoot.absolutePath)) {
        continue;
      }

      this.walkDirectory(
        scanRoot.absolutePath,
        scanRoot.documentKind,
        fileSource.rootPath,
        scanPolicy,
        seenAbsolutePaths,
        files,
      );
    }

    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "zh-CN"));
  }

  private resolveScanRoots(fileSource: SyncFileSourceRecord): Array<{ absolutePath: string; documentKind: string }> {
    const roots: Array<{ absolutePath: string; documentKind: string }> = [];

    if (fileSource.chapterPath) {
      roots.push({ absolutePath: fileSource.chapterPath, documentKind: "chapter" });
    }
    if (fileSource.outlinePath) {
      roots.push({ absolutePath: fileSource.outlinePath, documentKind: "outline" });
    }
    if (fileSource.exportPath) {
      roots.push({ absolutePath: fileSource.exportPath, documentKind: "export" });
    }
    if (!roots.length) {
      roots.push({ absolutePath: fileSource.rootPath, documentKind: "workspace-document" });
    }

    return roots;
  }

  private walkDirectory(
    currentDirectory: string,
    documentKind: string,
    rootPath: string,
    scanPolicy: NormalizedScanPolicy,
    seenAbsolutePaths: Set<string>,
    files: CollectedFile[],
  ) {
    const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (scanPolicy.excludeDirectories.includes(entry.name)) {
          continue;
        }

        this.walkDirectory(path.join(currentDirectory, entry.name), documentKind, rootPath, scanPolicy, seenAbsolutePaths, files);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!scanPolicy.includeExtensions.includes(extension)) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      if (seenAbsolutePaths.has(absolutePath)) {
        continue;
      }
      seenAbsolutePaths.add(absolutePath);

      files.push({
        absolutePath,
        relativePath: path.relative(rootPath, absolutePath).replace(/\\/g, "/"),
        documentKind,
      });
    }
  }

  private resolveManagedPath(rawPath: string): string {
    const normalizedPath = rawPath.trim();
    if (!normalizedPath) {
      throw new Error("File source root path cannot be empty.");
    }

    return path.isAbsolute(normalizedPath)
      ? path.resolve(normalizedPath)
      : path.resolve(resolveWorkspaceRoot(), normalizedPath);
  }

  private resolveChildPath(rootPath: string, childPath?: string): string | undefined {
    if (!childPath?.trim()) {
      return undefined;
    }

    return path.isAbsolute(childPath) ? path.resolve(childPath) : path.resolve(rootPath, childPath);
  }

  private slugify(value: string): string {
    return value
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
}