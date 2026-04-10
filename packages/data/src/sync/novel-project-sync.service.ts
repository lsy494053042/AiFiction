import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { type SqliteClient, getSqliteClient, resolveWorkspaceRoot } from "../client";
import {
  ensureWorkspaceAifictionPluginsRegistered,
  type LegacySourceDocumentFieldKey,
  getAifictionPluginRegistry,
} from "../plugins";
import {
  SqliteArtifactRepository,
  SqliteGenericEntityRepository,
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
  type SourceDocumentAnalysis,
} from "./document-analysis";
import {
  extractSourceDocumentPreview,
  formatExtractionPreviewArtifact,
  type SourceDocumentExtractionPreview,
} from "./document-extraction";
import {
  extractRegisteredSourceDocumentSemantics,
  type SourceDocumentSemanticExtraction,
} from "./source-document-semantics";
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
  registeredDocument?: RegisteredSourceDocument;
}

interface RegisteredSourceDocument {
  docKind: string;
  templateKey?: string;
  relativePath: string;
  scope?: string;
  isSourceOfTruth?: boolean;
  priority?: number;
  syncPolicy?: string;
}

interface BookSyncProtocolFile {
  source_of_truth?: {
    project_brief?: string;
    world_settings?: string;
    character_settings?: string;
    master_outline?: string;
    active_volume_outline?: string;
    documents?: Array<{
      doc_kind?: string;
      template_key?: string;
      relative_path?: string;
      scope?: string;
      is_source_of_truth?: boolean;
      priority?: number;
      sync_policy?: string;
    }>;
  };
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
  registeredDocument?: RegisteredSourceDocument;
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

const sourceDocumentPanelTemplateId = "system:source-document-analysis";
const sourceDocumentKindTaxonomyId = "system:taxonomy:source-document-kind";
const sourceDocumentScopeTaxonomyId = "system:taxonomy:source-document-scope";
const sourceSemanticPanelTemplateId = "system:source-document-semantics";
const sourceSemanticGroupTaxonomyId = "system:taxonomy:source-semantic-group";
const sourceSemanticConfidenceTaxonomyId = "system:taxonomy:source-semantic-confidence";

/**
 * 小说目录同步服务。
 * 当前先完成“绑定目录 -> 扫描文件 -> 摘要预览 -> 结构化抽取预览 -> 审查入队”的首版链路。
 */
export class NovelProjectSyncService {
  private readonly artifactRepository: SqliteArtifactRepository;
  private readonly genericEntityRepository: SqliteGenericEntityRepository;
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;
  private readonly reviewQueueService: SyncReviewQueueService;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.artifactRepository = new SqliteArtifactRepository(client);
    this.genericEntityRepository = new SqliteGenericEntityRepository(client);
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

  async listRepairableRegisteredDocumentPaths(fileSourceId: string): Promise<string[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const fileSource = await this.syncSourceRepository.getFileSourceById(fileSourceId);
    if (!fileSource) {
      throw new Error("File source was not found.");
    }

    const scanPolicy = this.normalizeScanPolicy(fileSource.scanPolicyJson as Partial<NormalizedScanPolicy>);
    const collectedFiles = this.collectTrackedFiles(fileSource, scanPolicy);
    const existingDocuments = await this.syncSourceRepository.listSourceDocuments(fileSource.id);
    const existingByPath = new Map(existingDocuments.map((document) => [document.relativePath, document]));
    const repairablePaths: string[] = [];

    for (const file of collectedFiles) {
      if (!file.registeredDocument) {
        continue;
      }

      const sourceDocument = existingByPath.get(file.relativePath);
      if (!sourceDocument) {
        continue;
      }

      const needsRepair = await this.needsRegisteredDocumentProjectionRepair(fileSource.projectId, sourceDocument.id);
      if (needsRepair) {
        repairablePaths.push(file.relativePath);
      }
    }

    return repairablePaths;
  }

  async repairRegisteredDocumentProjectionByPath(fileSourceId: string, relativePath: string): Promise<boolean> {
    await ensureSqliteV2Bootstrap(this.client);

    const fileSource = await this.syncSourceRepository.getFileSourceById(fileSourceId);
    if (!fileSource) {
      throw new Error("File source was not found.");
    }

    const normalizedRelativePath = relativePath.replace(/\\/g, "/").trim();
    const registeredDocumentsByPath = this.loadRegisteredSourceDocuments(fileSource.rootPath);
    const registeredDocument = registeredDocumentsByPath.get(normalizedRelativePath);
    if (!registeredDocument) {
      return false;
    }

    const existingDocuments = await this.syncSourceRepository.listSourceDocuments(fileSource.id);
    const sourceDocument = existingDocuments.find((document) => document.relativePath === normalizedRelativePath);
    if (!sourceDocument) {
      return false;
    }

    const needsRepair = await this.needsRegisteredDocumentProjectionRepair(fileSource.projectId, sourceDocument.id);
    if (!needsRepair) {
      return false;
    }

    const absolutePath = path.join(fileSource.rootPath, normalizedRelativePath);
    if (!fs.existsSync(absolutePath)) {
      return false;
    }

    return this.refreshRegisteredDocumentProjection({
      fileSource,
      sourceDocument,
      registeredDocument,
      absolutePath,
      fileBuffer: fs.readFileSync(absolutePath),
    });
  }

  async repairRegisteredDocumentProjections(fileSourceId: string): Promise<number> {
    await ensureSqliteV2Bootstrap(this.client);

    const repairablePaths = await this.listRepairableRegisteredDocumentPaths(fileSourceId);
    let repairedCount = 0;

    for (const relativePath of repairablePaths) {
      const repaired = await this.repairRegisteredDocumentProjectionByPath(fileSourceId, relativePath);
      if (repaired) {
        repairedCount += 1;
      }
    }

    return repairedCount;
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
        const sourceDocumentId = existingDocument?.id ?? this.buildSourceDocumentId(fileSource.id, file.relativePath);
        let changeKind = !existingDocument
          ? "created"
          : existingDocument.checksum !== checksum
            ? "modified"
            : "unchanged";
        const needsSemanticBackfill = changeKind === "unchanged" && file.registeredDocument
          ? await this.needsRegisteredDocumentSemanticProjection(fileSource.projectId, sourceDocumentId)
          : false;
        if (needsSemanticBackfill) {
          changeKind = "modified";
        }

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
          id: sourceDocumentId,
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
            registeredDocument: file.registeredDocument,
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

    const documentEntityId = input.registeredDocument
      ? await this.persistSourceDocumentEntityProjection({
          projectId: input.fileSource.projectId,
          sourceDocument: input.sourceDocument,
          registeredDocument: input.registeredDocument,
          analysis,
          extractionPreview,
          sourceArtifactVersionId: summaryArtifact.artifactVersionId,
        })
      : undefined;
    const semanticExtraction = input.registeredDocument
      ? extractRegisteredSourceDocumentSemantics({
          relativePath: input.sourceDocument.relativePath,
          documentKind: input.sourceDocument.documentKind,
          templateKey: input.registeredDocument.templateKey,
          scope: input.registeredDocument.scope,
          textContent: loadedContent.textContent,
          analysis,
        })
      : undefined;
    if (documentEntityId && semanticExtraction) {
      await this.persistRegisteredDocumentSemantics({
        projectId: input.fileSource.projectId,
        sourceDocument: input.sourceDocument,
        registeredDocument: input.registeredDocument!,
        documentEntityId,
        semanticExtraction,
        sourceArtifactVersionId: summaryArtifact.artifactVersionId,
      });
    }

    const shouldGenerateExtractionPreview = this.shouldGenerateExtractionPreview(input.sourceDocument.documentKind);

    if (!shouldGenerateExtractionPreview) {
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

      await this.syncSourceRepository.saveSourceDocument({
        ...input.sourceDocument,
        mappedScopeType: documentEntityId ? "entity" : input.sourceDocument.documentKind,
        mappedScopeId: documentEntityId ?? input.sourceDocument.id,
        currentArtifactId: summaryArtifact.artifactId,
        syncStatus: "review_pending",
      });

      await this.syncWorkflowRepository.saveSyncRunItem({
        id: input.runItemId,
        syncRunId: input.runId,
        sourceDocumentId: input.sourceDocument.id,
        changeKind: input.changeKind,
        processingStatus: "review_pending",
        generatedArtifactId: summaryArtifact.artifactId,
        generatedArtifactVersionId: summaryArtifact.artifactVersionId,
        summary: `${input.sourceDocument.relativePath} => summary and document projection generated`,
      });

      return {
        processingStatus: "review_pending",
        generatedArtifactId: summaryArtifact.artifactId,
        generatedArtifactVersionId: summaryArtifact.artifactVersionId,
      };
    }

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
      mappedScopeType: documentEntityId ? "entity" : input.sourceDocument.documentKind,
      mappedScopeId: documentEntityId ?? input.sourceDocument.id,
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

  private async persistSourceDocumentEntityProjection(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    registeredDocument: RegisteredSourceDocument;
    analysis: SourceDocumentAnalysis;
    extractionPreview: SourceDocumentExtractionPreview;
    sourceArtifactVersionId: string;
  }): Promise<string> {
    await this.ensureSourceDocumentProjectionTemplates();

    const entityId = `${input.sourceDocument.id}:entity`;
    await this.genericEntityRepository.saveEntity(
      {
        id: entityId,
        projectId: input.projectId,
        entityType: "source-document",
        canonicalName: this.slugify(input.sourceDocument.relativePath),
        displayName: input.analysis.title,
        summary: input.analysis.summary,
        metaJson: {
          documentKind: input.sourceDocument.documentKind,
          sourceDocumentId: input.sourceDocument.id,
        },
        extraJson: {
          relativePath: input.sourceDocument.relativePath,
          templateKey: input.registeredDocument.templateKey ?? null,
          scope: input.registeredDocument.scope ?? null,
        },
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    await this.genericEntityRepository.replaceEntityPanelValues(
      input.projectId,
      entityId,
      sourceDocumentPanelTemplateId,
      this.buildSourceDocumentPanelValues(input),
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    await this.ensureSourceDocumentTagTaxonomies(input.projectId);
    await this.genericEntityRepository.replaceEntityTags(
      input.projectId,
      entityId,
      sourceDocumentKindTaxonomyId,
      [
        {
          tagCode: input.registeredDocument.docKind,
          tagLabel: input.registeredDocument.docKind,
          weight: 100,
        },
      ],
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    if (input.registeredDocument.scope) {
      await this.genericEntityRepository.replaceEntityTags(
        input.projectId,
        entityId,
        sourceDocumentScopeTaxonomyId,
        [
          {
            tagCode: input.registeredDocument.scope,
            tagLabel: input.registeredDocument.scope,
            weight: 100,
          },
        ],
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );
    }

    await this.genericEntityRepository.saveEntityStateEvent(
      {
        projectId: input.projectId,
        entityId,
        eventType: "source-document-analysis-upserted",
        reason: `Projection refreshed from ${input.sourceDocument.relativePath}.`,
        newValueJson: {
          title: input.analysis.title,
          summary: input.analysis.summary,
          documentKind: input.sourceDocument.documentKind,
          templateKey: input.registeredDocument.templateKey,
          scope: input.registeredDocument.scope,
          confidenceLevel: input.analysis.confidenceLevel,
        },
        sourceArtifactId: sourceDocumentPanelTemplateId,
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    await this.syncWorkflowRepository.saveSourceRef({
      id: `${entityId}:projection`,
      projectId: input.projectId,
      assetType: "generic-entity",
      assetId: entityId,
      sourceDocumentId: input.sourceDocument.id,
      artifactVersionId: input.sourceArtifactVersionId,
      referenceKind: "document-entity-projection",
      locator: `${input.sourceDocument.relativePath}#document-entity`,
      evidenceQuote: input.analysis.summary,
    });

    return entityId;
  }

  private buildSourceDocumentPanelValues(input: {
    sourceDocument: SyncSourceDocumentRecord;
    registeredDocument: RegisteredSourceDocument;
    analysis: SourceDocumentAnalysis;
    extractionPreview: SourceDocumentExtractionPreview;
  }) {
    const buildFieldId = (fieldKey: string) => `${sourceDocumentPanelTemplateId}:field:${fieldKey}`;

    return [
      { fieldId: buildFieldId("relative_path"), valueText: input.sourceDocument.relativePath },
      { fieldId: buildFieldId("doc_kind"), valueText: input.registeredDocument.docKind },
      { fieldId: buildFieldId("template_key"), valueText: input.registeredDocument.templateKey },
      { fieldId: buildFieldId("scope"), valueText: input.registeredDocument.scope },
      { fieldId: buildFieldId("is_source_of_truth"), valueBoolean: input.registeredDocument.isSourceOfTruth ?? true },
      { fieldId: buildFieldId("priority"), valueInteger: input.registeredDocument.priority },
      { fieldId: buildFieldId("title"), valueText: input.analysis.title },
      { fieldId: buildFieldId("summary"), valueText: input.analysis.summary },
      { fieldId: buildFieldId("heading_trail"), valueJson: input.analysis.headingTrail },
      { fieldId: buildFieldId("candidate_names"), valueJson: input.analysis.candidateNames },
      { fieldId: buildFieldId("review_hints"), valueJson: input.analysis.reviewHints },
      { fieldId: buildFieldId("confidence_level"), valueText: input.analysis.confidenceLevel },
      { fieldId: buildFieldId("paragraph_count"), valueInteger: input.analysis.paragraphCount },
      { fieldId: buildFieldId("line_count"), valueInteger: input.analysis.lineCount },
      { fieldId: buildFieldId("character_count"), valueInteger: input.analysis.characterCount },
      { fieldId: buildFieldId("character_candidate_count"), valueInteger: input.extractionPreview.characters.length },
      { fieldId: buildFieldId("relationship_candidate_count"), valueInteger: input.extractionPreview.relationships.length },
      { fieldId: buildFieldId("foreshadow_candidate_count"), valueInteger: input.extractionPreview.foreshadows.length },
      { fieldId: buildFieldId("timeline_candidate_count"), valueInteger: input.extractionPreview.timelineEvents.length },
    ].filter(
      (value) =>
        value.valueText !== undefined ||
        value.valueInteger !== undefined ||
        value.valueJson !== undefined,
    );
  }

  private async ensureSourceDocumentProjectionTemplates(): Promise<void> {
    await this.genericEntityRepository.savePanelTemplate(
      {
        id: sourceDocumentPanelTemplateId,
        ownerKey: "system:source-document",
        scope: "global",
        templateKey: "source-document-analysis",
        label: "Source Document Analysis",
        appliesToEntityType: "source-document",
        description: "Projection of registered source documents into the generic entity layer.",
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    await this.genericEntityRepository.replacePanelFields(
      sourceDocumentPanelTemplateId,
      [
        { fieldKey: "relative_path", label: "Relative Path", valueType: "text", cardinality: "single", sortOrder: 1, displayGroup: "identity", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "doc_kind", label: "Doc Kind", valueType: "text", cardinality: "single", sortOrder: 2, displayGroup: "identity", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "template_key", label: "Template Key", valueType: "text", cardinality: "single", sortOrder: 3, displayGroup: "identity", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "scope", label: "Scope", valueType: "text", cardinality: "single", sortOrder: 4, displayGroup: "identity", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "is_source_of_truth", label: "Is Source Of Truth", valueType: "boolean", cardinality: "single", sortOrder: 5, displayGroup: "identity", isSearchable: false, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "priority", label: "Priority", valueType: "integer", cardinality: "single", sortOrder: 6, displayGroup: "identity", isSearchable: false, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "title", label: "Title", valueType: "text", cardinality: "single", sortOrder: 10, displayGroup: "analysis", isSearchable: true, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "summary", label: "Summary", valueType: "text", cardinality: "single", sortOrder: 11, displayGroup: "analysis", isSearchable: true, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "heading_trail", label: "Heading Trail", valueType: "json", cardinality: "single", sortOrder: 12, displayGroup: "analysis", isSearchable: false, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "candidate_names", label: "Candidate Names", valueType: "json", cardinality: "single", sortOrder: 13, displayGroup: "analysis", isSearchable: false, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "review_hints", label: "Review Hints", valueType: "json", cardinality: "single", sortOrder: 14, displayGroup: "analysis", isSearchable: false, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "confidence_level", label: "Confidence Level", valueType: "text", cardinality: "single", sortOrder: 15, displayGroup: "analysis", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "paragraph_count", label: "Paragraph Count", valueType: "integer", cardinality: "single", sortOrder: 16, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "line_count", label: "Line Count", valueType: "integer", cardinality: "single", sortOrder: 17, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "character_count", label: "Character Count", valueType: "integer", cardinality: "single", sortOrder: 18, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "character_candidate_count", label: "Character Candidate Count", valueType: "integer", cardinality: "single", sortOrder: 19, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "relationship_candidate_count", label: "Relationship Candidate Count", valueType: "integer", cardinality: "single", sortOrder: 20, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "foreshadow_candidate_count", label: "Foreshadow Candidate Count", valueType: "integer", cardinality: "single", sortOrder: 21, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "timeline_candidate_count", label: "Timeline Candidate Count", valueType: "integer", cardinality: "single", sortOrder: 22, displayGroup: "metrics", isSearchable: false, isFilterable: true, isTimelineTracked: true },
      ],
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );
  }

  private async ensureSourceDocumentTagTaxonomies(projectId: string): Promise<void> {
    await this.genericEntityRepository.saveTagTaxonomy(
      {
        id: sourceDocumentKindTaxonomyId,
        ownerKey: "system:source-document",
        scope: "global",
        taxonomyKey: "source-document-kind",
        label: "Source Document Kind",
        description: "Classification for registered source documents.",
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    await this.genericEntityRepository.saveTagTaxonomy(
      {
        id: sourceDocumentScopeTaxonomyId,
        ownerKey: "system:source-document",
        projectId,
        scope: "project",
        taxonomyKey: "source-document-scope",
        label: "Source Document Scope",
        description: "Project-specific scope tags for source documents.",
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );
  }

  private async persistRegisteredDocumentSemantics(input: {
    projectId: string;
    sourceDocument: SyncSourceDocumentRecord;
    registeredDocument: RegisteredSourceDocument;
    documentEntityId: string;
    semanticExtraction: SourceDocumentSemanticExtraction;
    sourceArtifactVersionId: string;
  }): Promise<string[]> {
    await this.ensureSourceSemanticProjectionTemplates(input.projectId);

    const semanticEntityPrefix = `${input.sourceDocument.id}:semantic:`;
    const semanticEntities = input.semanticExtraction.entities;
    const semanticEntityIds = semanticEntities.map((entity) => `${semanticEntityPrefix}${entity.semanticKey}`);

    await this.genericEntityRepository.deleteEntitiesByPrefix({
      projectId: input.projectId,
      idPrefix: semanticEntityPrefix,
      keepEntityIds: semanticEntityIds,
    });
    await this.syncWorkflowRepository.deleteSourceRefs({
      projectId: input.projectId,
      assetType: "generic-entity",
      assetIdPrefix: semanticEntityPrefix,
      sourceDocumentId: input.sourceDocument.id,
      referenceKind: "semantic-entity-projection",
    });
    await this.ensureSourceSemanticTaxonomies(input.projectId);

    const semanticEntityIdByKey = new Map<string, string>();
    for (const entity of semanticEntities) {
      const entityId = `${semanticEntityPrefix}${entity.semanticKey}`;
      semanticEntityIdByKey.set(entity.semanticKey, entityId);

      await this.genericEntityRepository.saveEntity(
        {
          id: entityId,
          projectId: input.projectId,
          entityType: entity.entityType,
          canonicalName: entity.canonicalName,
          displayName: entity.displayName,
          summary: entity.summary,
          metaJson: {
            sourceDocumentId: input.sourceDocument.id,
            documentEntityId: input.documentEntityId,
            extractorKey: input.semanticExtraction.extractorKey,
          },
          extraJson: {
            relativePath: input.sourceDocument.relativePath,
            templateKey: input.registeredDocument.templateKey ?? null,
            semanticKey: entity.semanticKey,
            semanticGroup: entity.semanticGroup,
          },
        },
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );

      await this.genericEntityRepository.replaceEntityPanelValues(
        input.projectId,
        entityId,
        sourceSemanticPanelTemplateId,
        this.buildSourceSemanticPanelValues({
          sourceDocument: input.sourceDocument,
          registeredDocument: input.registeredDocument,
          entity,
          semanticExtraction: input.semanticExtraction,
        }),
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );

      await this.genericEntityRepository.replaceEntityTags(
        input.projectId,
        entityId,
        sourceSemanticGroupTaxonomyId,
        [
          {
            tagCode: entity.semanticGroup,
            tagLabel: entity.semanticGroup,
            weight: 100,
          },
        ],
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );
      await this.genericEntityRepository.replaceEntityTags(
        input.projectId,
        entityId,
        sourceSemanticConfidenceTaxonomyId,
        [
          {
            tagCode: entity.confidenceLevel,
            tagLabel: entity.confidenceLevel,
            weight: entity.confidenceLevel === "medium" ? 100 : 60,
          },
        ],
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );

      await this.genericEntityRepository.saveEntityStateEvent(
        {
          projectId: input.projectId,
          entityId,
          eventType: "source-document-semantic-upserted",
          reason: `Semantic entity refreshed from ${input.sourceDocument.relativePath}.`,
          newValueJson: {
            semanticKey: entity.semanticKey,
            entityType: entity.entityType,
            semanticGroup: entity.semanticGroup,
            confidenceLevel: entity.confidenceLevel,
            extractionMode: entity.extractionMode,
            extractorKey: input.semanticExtraction.extractorKey,
          },
          sourceArtifactId: sourceSemanticPanelTemplateId,
        },
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );

      await this.syncWorkflowRepository.saveSourceRef({
        id: `${entityId}:source-ref`,
        projectId: input.projectId,
        assetType: "generic-entity",
        assetId: entityId,
        sourceDocumentId: input.sourceDocument.id,
        artifactVersionId: input.sourceArtifactVersionId,
        referenceKind: "semantic-entity-projection",
        locator: `${input.sourceDocument.relativePath}#semantic:${entity.semanticKey}`,
        evidenceQuote: entity.evidenceExcerpt ?? entity.summary,
      });
    }

    await this.genericEntityRepository.replaceEntityEdges(
      input.projectId,
      input.documentEntityId,
      semanticEntities.map((entity) => ({
        targetEntityId: semanticEntityIdByKey.get(entity.semanticKey)!,
        edgeType: "documents_semantic",
        publicLabel: "documents semantic",
        directionality: "directed",
        weight: 100,
        metaJson: {
          semanticGroup: entity.semanticGroup,
        },
      })),
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    for (const entity of semanticEntities) {
      const sourceEntityId = semanticEntityIdByKey.get(entity.semanticKey)!;
      const edges = (entity.edges ?? [])
        .map((edge) => {
          const targetEntityId = semanticEntityIdByKey.get(edge.targetSemanticKey);
          if (!targetEntityId) {
            return undefined;
          }
          return {
            targetEntityId,
            edgeType: edge.edgeType,
            publicLabel: edge.publicLabel,
            directionality: edge.directionality ?? "directed",
            weight: edge.weight ?? 100,
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge));

      await this.genericEntityRepository.replaceEntityEdges(
        input.projectId,
        sourceEntityId,
        edges,
        {
          source: "project-sync",
          actorId: "novel-project-sync",
        },
      );
    }

    return semanticEntityIds;
  }

  private buildSourceSemanticPanelValues(input: {
    sourceDocument: SyncSourceDocumentRecord;
    registeredDocument: RegisteredSourceDocument;
    entity: SourceDocumentSemanticExtraction["entities"][number];
    semanticExtraction: SourceDocumentSemanticExtraction;
  }) {
    const buildFieldId = (fieldKey: string) => `${sourceSemanticPanelTemplateId}:field:${fieldKey}`;

    return [
      { fieldId: buildFieldId("relative_path"), valueText: input.sourceDocument.relativePath },
      { fieldId: buildFieldId("source_document_id"), valueText: input.sourceDocument.id },
      { fieldId: buildFieldId("doc_kind"), valueText: input.sourceDocument.documentKind },
      { fieldId: buildFieldId("template_key"), valueText: input.registeredDocument.templateKey },
      { fieldId: buildFieldId("scope"), valueText: input.registeredDocument.scope },
      { fieldId: buildFieldId("extractor_key"), valueText: input.semanticExtraction.extractorKey },
      { fieldId: buildFieldId("semantic_key"), valueText: input.entity.semanticKey },
      { fieldId: buildFieldId("semantic_group"), valueText: input.entity.semanticGroup },
      { fieldId: buildFieldId("section_title"), valueText: input.entity.sectionTitle },
      { fieldId: buildFieldId("section_level"), valueInteger: input.entity.sectionLevel },
      { fieldId: buildFieldId("confidence_level"), valueText: input.entity.confidenceLevel },
      { fieldId: buildFieldId("extraction_mode"), valueText: input.entity.extractionMode },
      { fieldId: buildFieldId("evidence_excerpt"), valueText: input.entity.evidenceExcerpt },
      { fieldId: buildFieldId("list_items"), valueJson: input.entity.listItems },
      { fieldId: buildFieldId("keywords"), valueJson: input.entity.keywords },
      { fieldId: buildFieldId("review_hints"), valueJson: input.entity.semanticKey === "root" ? input.semanticExtraction.reviewHints : undefined },
    ].filter(
      (value) =>
        value.valueText !== undefined ||
        value.valueInteger !== undefined ||
        value.valueJson !== undefined,
    );
  }

  private async ensureSourceSemanticProjectionTemplates(projectId: string): Promise<void> {
    await this.genericEntityRepository.savePanelTemplate(
      {
        id: sourceSemanticPanelTemplateId,
        ownerKey: "system:source-semantic",
        projectId,
        scope: "project",
        templateKey: "source-document-semantics",
        label: "Source Document Semantics",
        appliesToEntityType: "*",
        description: "Semantic entities projected from registered source documents.",
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );

    await this.genericEntityRepository.replacePanelFields(
      sourceSemanticPanelTemplateId,
      [
        { fieldKey: "relative_path", label: "Relative Path", valueType: "text", cardinality: "single", sortOrder: 1, displayGroup: "source", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "source_document_id", label: "Source Document Id", valueType: "text", cardinality: "single", sortOrder: 2, displayGroup: "source", isSearchable: false, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "doc_kind", label: "Doc Kind", valueType: "text", cardinality: "single", sortOrder: 3, displayGroup: "source", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "template_key", label: "Template Key", valueType: "text", cardinality: "single", sortOrder: 4, displayGroup: "source", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "scope", label: "Scope", valueType: "text", cardinality: "single", sortOrder: 5, displayGroup: "source", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "extractor_key", label: "Extractor Key", valueType: "text", cardinality: "single", sortOrder: 6, displayGroup: "source", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "semantic_key", label: "Semantic Key", valueType: "text", cardinality: "single", sortOrder: 10, displayGroup: "identity", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "semantic_group", label: "Semantic Group", valueType: "text", cardinality: "single", sortOrder: 11, displayGroup: "identity", isSearchable: true, isFilterable: true, isTimelineTracked: false },
        { fieldKey: "section_title", label: "Section Title", valueType: "text", cardinality: "single", sortOrder: 12, displayGroup: "identity", isSearchable: true, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "section_level", label: "Section Level", valueType: "integer", cardinality: "single", sortOrder: 13, displayGroup: "identity", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "confidence_level", label: "Confidence Level", valueType: "text", cardinality: "single", sortOrder: 14, displayGroup: "analysis", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "extraction_mode", label: "Extraction Mode", valueType: "text", cardinality: "single", sortOrder: 15, displayGroup: "analysis", isSearchable: false, isFilterable: true, isTimelineTracked: true },
        { fieldKey: "evidence_excerpt", label: "Evidence Excerpt", valueType: "text", cardinality: "single", sortOrder: 16, displayGroup: "analysis", isSearchable: true, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "list_items", label: "List Items", valueType: "json", cardinality: "single", sortOrder: 17, displayGroup: "analysis", isSearchable: false, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "keywords", label: "Keywords", valueType: "json", cardinality: "single", sortOrder: 18, displayGroup: "analysis", isSearchable: false, isFilterable: false, isTimelineTracked: true },
        { fieldKey: "review_hints", label: "Review Hints", valueType: "json", cardinality: "single", sortOrder: 19, displayGroup: "analysis", isSearchable: false, isFilterable: false, isTimelineTracked: true },
      ],
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );
  }

  private async ensureSourceSemanticTaxonomies(projectId: string): Promise<void> {
    await this.genericEntityRepository.saveTagTaxonomy(
      {
        id: sourceSemanticGroupTaxonomyId,
        ownerKey: "system:source-semantic",
        projectId,
        scope: "project",
        taxonomyKey: "source-semantic-group",
        label: "Source Semantic Group",
        description: "Semantic grouping for entities extracted from source documents.",
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );
    await this.genericEntityRepository.saveTagTaxonomy(
      {
        id: sourceSemanticConfidenceTaxonomyId,
        ownerKey: "system:source-semantic",
        projectId,
        scope: "project",
        taxonomyKey: "source-semantic-confidence",
        label: "Source Semantic Confidence",
        description: "Confidence tag for source-document semantic entities.",
      },
      {
        source: "project-sync",
        actorId: "novel-project-sync",
      },
    );
  }

  private shouldGenerateExtractionPreview(documentKind: string): boolean {
    return documentKind === "chapter" || documentKind === "outline" || documentKind.startsWith("outline-");
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

  private async needsRegisteredDocumentSemanticProjection(
    projectId: string,
    sourceDocumentId: string,
  ): Promise<boolean> {
    const sourceRefs = await this.syncWorkflowRepository.listSourceRefs({
      projectId,
      sourceDocumentId,
      assetType: "generic-entity",
      limit: 200,
    });

    const semanticRefs = sourceRefs.filter((sourceRef) => sourceRef.referenceKind === "semantic-entity-projection");
    if (!semanticRefs.length) {
      return true;
    }

    for (const semanticRef of semanticRefs.slice(0, 5)) {
      const panelValues = await this.genericEntityRepository.listEntityPanelValues(semanticRef.assetId);
      if (panelValues.some((panelValue) => panelValue.templateId === sourceSemanticPanelTemplateId)) {
        return false;
      }
    }

    return true;
  }

  private async needsRegisteredDocumentProjectionRepair(
    projectId: string,
    sourceDocumentId: string,
  ): Promise<boolean> {
    const documentEntityPanelValues = await this.genericEntityRepository.listEntityPanelValues(`${sourceDocumentId}:entity`);
    const hasDocumentProjectionPanelValues = documentEntityPanelValues.some(
      (panelValue) => panelValue.templateId === sourceDocumentPanelTemplateId,
    );
    if (!hasDocumentProjectionPanelValues) {
      return true;
    }

    return this.needsRegisteredDocumentSemanticProjection(projectId, sourceDocumentId);
  }

  private async refreshRegisteredDocumentProjection(input: {
    fileSource: SyncFileSourceRecord;
    sourceDocument: SyncSourceDocumentRecord;
    registeredDocument: RegisteredSourceDocument;
    absolutePath: string;
    fileBuffer: Buffer;
  }): Promise<boolean> {
    const loadedContent = loadSourceDocumentText(input.absolutePath, input.fileBuffer);
    if (!loadedContent.textContent) {
      return false;
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
          repairMode: "registered-document-projection",
        },
      },
      {
        source: "project-sync",
        reason: "registered-document-projection-repair",
      },
    );

    const documentEntityId = await this.persistSourceDocumentEntityProjection({
      projectId: input.fileSource.projectId,
      sourceDocument: input.sourceDocument,
      registeredDocument: input.registeredDocument,
      analysis,
      extractionPreview,
      sourceArtifactVersionId: summaryArtifact.artifactVersionId,
    });
    const semanticExtraction = extractRegisteredSourceDocumentSemantics({
      relativePath: input.sourceDocument.relativePath,
      documentKind: input.sourceDocument.documentKind,
      templateKey: input.registeredDocument.templateKey,
      scope: input.registeredDocument.scope,
      textContent: loadedContent.textContent,
      analysis,
    });

    await this.persistRegisteredDocumentSemantics({
      projectId: input.fileSource.projectId,
      sourceDocument: input.sourceDocument,
      registeredDocument: input.registeredDocument,
      documentEntityId,
      semanticExtraction,
      sourceArtifactVersionId: summaryArtifact.artifactVersionId,
    });

    await this.syncSourceRepository.saveSourceDocument({
      ...input.sourceDocument,
      mappedScopeType: "entity",
      mappedScopeId: documentEntityId,
      currentArtifactId: summaryArtifact.artifactId,
      syncStatus: "review_pending",
    });

    return true;
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
    const registeredDocumentsByPath = this.loadRegisteredSourceDocuments(fileSource.rootPath);
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
        registeredDocumentsByPath,
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
    if (!roots.length || !roots.some((root) => this.normalizePath(root.absolutePath) === this.normalizePath(fileSource.rootPath))) {
      roots.push({ absolutePath: fileSource.rootPath, documentKind: "workspace-document" });
    }

    return roots;
  }

  private walkDirectory(
    currentDirectory: string,
    documentKind: string,
    rootPath: string,
    registeredDocumentsByPath: Map<string, RegisteredSourceDocument>,
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

        this.walkDirectory(
          path.join(currentDirectory, entry.name),
          documentKind,
          rootPath,
          registeredDocumentsByPath,
          scanPolicy,
          seenAbsolutePaths,
          files,
        );
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

      const relativePath = path.relative(rootPath, absolutePath).replace(/\\/g, "/");
      const registeredDocument = registeredDocumentsByPath.get(relativePath);

      files.push({
        absolutePath,
        relativePath,
        documentKind: registeredDocument?.docKind ?? documentKind,
        registeredDocument,
      });
    }
  }

  private loadRegisteredSourceDocuments(rootPath: string): Map<string, RegisteredSourceDocument> {
    const bookFilePath = this.findNearestBookProtocolPath(rootPath);
    if (!bookFilePath || !fs.existsSync(bookFilePath)) {
      return new Map();
    }

    try {
      const raw = fs.readFileSync(bookFilePath, "utf8").replace(/^\uFEFF/, "");
      const book = YAML.parse(raw) as BookSyncProtocolFile | undefined;
      const sourceOfTruth = book?.source_of_truth;
      if (!sourceOfTruth) {
        return new Map();
      }

      const documents = this.normalizeRegisteredSourceDocuments(sourceOfTruth);
      return new Map(documents.map((document) => [document.relativePath, document]));
    } catch {
      return new Map();
    }
  }

  private normalizeRegisteredSourceDocuments(
    sourceOfTruth: NonNullable<BookSyncProtocolFile["source_of_truth"]>,
  ): RegisteredSourceDocument[] {
    ensureWorkspaceAifictionPluginsRegistered(resolveWorkspaceRoot());
    const documents: RegisteredSourceDocument[] = [];
    const pushDocument = (document: RegisteredSourceDocument | undefined) => {
      if (!document) {
        return;
      }
      if (documents.some((existing) => existing.relativePath === document.relativePath || existing.docKind === document.docKind)) {
        return;
      }
      documents.push(document);
    };

    for (const definition of getAifictionPluginRegistry().listSourceDocumentDefinitions()) {
      const legacyRelativePath = definition.legacyFieldKey
        ? this.readSourceOfTruthLegacyPath(sourceOfTruth, definition.legacyFieldKey)
        : undefined;
      pushDocument(this.normalizeRegisteredSourceDocument({
        docKind: definition.docKind,
        templateKey: definition.templateKey,
        relativePath: legacyRelativePath,
        scope: definition.scope,
        isSourceOfTruth: definition.isSourceOfTruthDefault ?? true,
        priority: definition.priority,
        syncPolicy: definition.defaultSyncPolicy ?? "manual",
      }));
    }

    for (const document of sourceOfTruth.documents ?? []) {
      pushDocument(
        this.normalizeRegisteredSourceDocument({
          docKind: document.doc_kind,
          templateKey: document.template_key,
          relativePath: document.relative_path,
          scope: document.scope,
          isSourceOfTruth: document.is_source_of_truth,
          priority: document.priority,
          syncPolicy: document.sync_policy,
        }),
      );
    }

    return documents.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  }

  private readSourceOfTruthLegacyPath(
    sourceOfTruth: NonNullable<BookSyncProtocolFile["source_of_truth"]>,
    fieldKey: LegacySourceDocumentFieldKey,
  ): string | undefined {
    const value = sourceOfTruth[fieldKey];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private normalizeRegisteredSourceDocument(
    document: Partial<RegisteredSourceDocument> | undefined,
  ): RegisteredSourceDocument | undefined {
    if (!document?.docKind || !document.relativePath) {
      return undefined;
    }

    return {
      docKind: document.docKind.trim(),
      templateKey: document.templateKey?.trim() || undefined,
      relativePath: document.relativePath.replace(/\\/g, "/").trim(),
      scope: document.scope?.trim() || undefined,
      isSourceOfTruth: document.isSourceOfTruth ?? true,
      priority: typeof document.priority === "number" ? document.priority : undefined,
      syncPolicy: document.syncPolicy?.trim() || "manual",
    };
  }

  private findNearestBookProtocolPath(startDirectory: string): string | undefined {
    let currentDirectory = path.resolve(startDirectory);

    for (let depth = 0; depth < 4; depth += 1) {
      const candidate = path.join(currentDirectory, "book.yml");
      if (fs.existsSync(candidate)) {
        return candidate;
      }

      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) {
        break;
      }
      currentDirectory = parentDirectory;
    }

    return undefined;
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

  private normalizePath(targetPath: string): string {
    return path.normalize(targetPath).toLowerCase();
  }
}
