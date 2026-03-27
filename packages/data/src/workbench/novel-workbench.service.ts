import { asc, eq } from "drizzle-orm";

import type {
  ChapterCard,
  CharacterCard,
  ForeshadowLedgerItem,
  VolumeOutline,
  WorkProfile,
} from "@aifiction/schemas";

import type { RepositoryPageRequest } from "../contracts/repository-contracts";
import { type SqliteClient, getSqliteClient } from "../client";
import { SqliteNarrativeAssetRepository } from "../repositories/v2/narrative-asset.repository";
import { SqliteProjectCatalogRepository } from "../repositories/v2/project-catalog.repository";
import { readStringArray } from "../repositories/v2/repository-base";
import {
  type SyncAssetUpdateRecord,
  type SyncFileSourceRecord,
  type SyncReviewQueueRecord,
  type SyncSourceRefRecord,
  SqliteSyncSourceRepository,
  SqliteSyncWorkflowRepository,
} from "../repositories/v2";
import { assessReviewRisk } from "../sync/review-risk";
import { ensureSqliteV2Bootstrap } from "../v2/bootstrap";
import { foreshadowsV2Table, novelProjectsV2Table, volumesV2Table } from "../v2";
import {
  buildReviewBundleImpactSummary,
  type WorkbenchImpactSummary,
  type WorkbenchSourceDocumentContext,
} from "./impact-analysis";

export interface WorkbenchProjectStats {
  volumeCount: number;
  chapterCount: number;
  characterCount: number;
  foreshadowCount: number;
  relationCount: number;
  sourceCount: number;
  pendingReviewCount: number;
}

export interface WorkbenchProjectSummary {
  work: WorkProfile;
  stats: WorkbenchProjectStats;
  latestChapterTitle?: string;
  updatedAt: string;
}

export interface WorkbenchCharacterGraphNode {
  characterId: string;
  name: string;
  role: string;
  archetype: string;
}

export interface WorkbenchCharacterGraphEdge {
  sourceCharacterId: string;
  sourceCharacterName: string;
  targetCharacterId: string;
  targetCharacterName: string;
  publicLabel: string;
  privateLabel?: string;
  trustLevel: number;
  tensionLevel: number;
  sourceRefCount: number;
  latestSourcePath?: string;
  latestEvidenceQuote?: string;
}

export interface WorkbenchCharacterGraph {
  nodes: WorkbenchCharacterGraphNode[];
  edges: WorkbenchCharacterGraphEdge[];
}

export interface WorkbenchFileSourceSummary {
  id: string;
  label: string;
  sourceKind: string;
  rootPath: string;
  chapterPath?: string;
  outlinePath?: string;
  exportPath?: string;
  status: string;
  lastScannedAt?: string;
  documentCount: number;
  pendingDocumentCount: number;
  missingDocumentCount: number;
  reviewPendingCount: number;
  latestDocumentPath?: string;
}

export interface WorkbenchReviewItemSummary {
  id: string;
  syncRunId?: string;
  reviewKind: string;
  severity: string;
  status: string;
  summary: string;
  sourceType: string;
  sourceId?: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  detailJson: Record<string, unknown>;
}

export interface WorkbenchReviewBundleSummary {
  id: string;
  title: string;
  summary: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  syncRunId?: string;
  severity: string;
  blockingLevel: "none" | "review" | "conflict";
  pendingItemCount: number;
  lowSeverityCount: number;
  mediumSeverityCount: number;
  highSeverityCount: number;
  characterCandidateCount: number;
  relationshipCandidateCount: number;
  foreshadowCandidateCount: number;
  timelineCandidateCount: number;
  reviewHintCount: number;
  reviewKinds: string[];
  riskNature: string;
  riskCategories: string[];
  riskReasons: string[];
  recommendedActions: string[];
  autoApprovalReasons: string[];
  sourceRefCount: number;
  latestReferenceKind?: string;
  latestEvidenceQuote?: string;
  impactSummary?: WorkbenchImpactSummary;
  isAutoApprovable: boolean;
  items: WorkbenchReviewItemSummary[];
}

export interface WorkbenchReviewStats {
  bundleCount: number;
  autoApprovableBundleCount: number;
  pendingCount: number;
  lowSeverityCount: number;
  mediumSeverityCount: number;
  highSeverityCount: number;
}

export interface WorkbenchSourceRefSummary {
  id: string;
  assetType: string;
  assetId: string;
  referenceKind: string;
  locator: string;
  sourceDocumentId?: string;
  sourcePath?: string;
  documentKind?: string;
  evidenceQuote?: string;
  updatedAt: string;
}

interface WorkbenchSourceDocumentIndex extends WorkbenchSourceDocumentContext {
  syncStatus: string;
  lastModifiedAt: string;
}

export interface WorkbenchProjectSnapshot {
  work: WorkProfile;
  stats: WorkbenchProjectStats;
  volumes: VolumeOutline[];
  characters: CharacterCard[];
  chapters: ChapterCard[];
  graph: WorkbenchCharacterGraph;
  latestChapter?: ChapterCard;
  fileSources: WorkbenchFileSourceSummary[];
  pendingReviewBundles: WorkbenchReviewBundleSummary[];
  pendingConflictBundles: WorkbenchReviewBundleSummary[];
  recentSourceRefs: WorkbenchSourceRefSummary[];
  pendingReviews: WorkbenchReviewItemSummary[];
  reviewStats: WorkbenchReviewStats;
}

export class NovelWorkbenchService {
  private readonly projectCatalogRepository: SqliteProjectCatalogRepository;
  private readonly narrativeAssetRepository: SqliteNarrativeAssetRepository;
  private readonly syncSourceRepository: SqliteSyncSourceRepository;
  private readonly syncWorkflowRepository: SqliteSyncWorkflowRepository;

  constructor(private readonly client: SqliteClient = getSqliteClient()) {
    this.projectCatalogRepository = new SqliteProjectCatalogRepository(client);
    this.narrativeAssetRepository = new SqliteNarrativeAssetRepository(client);
    this.syncSourceRepository = new SqliteSyncSourceRepository(client);
    this.syncWorkflowRepository = new SqliteSyncWorkflowRepository(client);
  }

  async listProjectSummaries(page?: RepositoryPageRequest): Promise<WorkbenchProjectSummary[]> {
    await ensureSqliteV2Bootstrap(this.client);

    const works = await this.projectCatalogRepository.listProjects(page);
    if (!works.length) {
      return [];
    }

    const projectRows = await this.client.db
      .select({ id: novelProjectsV2Table.id, updatedAt: novelProjectsV2Table.updatedAt })
      .from(novelProjectsV2Table);
    const updatedAtByProjectId = new Map(projectRows.map((projectRow) => [projectRow.id, projectRow.updatedAt]));

    return Promise.all(
      works.map(async (work) => {
        const snapshot = await this.getProjectSnapshotBySlug(work.slug);
        return {
          work,
          stats: snapshot?.stats ?? this.createEmptyStats(),
          latestChapterTitle: snapshot?.latestChapter?.title,
          updatedAt: updatedAtByProjectId.get(work.id) ?? new Date(0).toISOString(),
        };
      }),
    );
  }

  async getProjectSnapshotBySlug(slug: string): Promise<WorkbenchProjectSnapshot | null> {
    await ensureSqliteV2Bootstrap(this.client);

    const work = await this.projectCatalogRepository.getProjectBySlug(slug);
    if (!work) {
      return null;
    }

    const [characters, chapters, volumes, foreshadows, fileSources, reviewRows, sourceRefs, assetUpdates] = await Promise.all([
      this.narrativeAssetRepository.listCharacters(work.id),
      this.narrativeAssetRepository.listChapters(work.id),
      this.listVolumes(work.id),
      this.listForeshadows(work.id),
      this.syncSourceRepository.listFileSources(work.id),
      this.syncWorkflowRepository.listReviewQueue(work.id, "pending"),
      this.syncWorkflowRepository.listSourceRefs({ projectId: work.id }),
      this.syncWorkflowRepository.listAssetUpdates({ projectId: work.id }),
    ]);

    const sourceDocumentsByFileSource = new Map<string, WorkbenchSourceDocumentIndex[]>();
    const sourceDocumentById = new Map<string, WorkbenchSourceDocumentIndex>();

    for (const fileSource of fileSources) {
      const sourceDocuments = this.sortSourceDocuments(await this.syncSourceRepository.listSourceDocuments(fileSource.id));
      sourceDocumentsByFileSource.set(fileSource.id, sourceDocuments);

      for (const sourceDocument of sourceDocuments) {
        sourceDocumentById.set(sourceDocument.id, sourceDocument);
      }
    }

    const relationSourceRefs = this.createSourceRefIndex(
      sourceRefs.filter((sourceRef) => sourceRef.assetType === "character-relationship"),
    );
    const sourceRefsByDocumentId = this.createSourceDocumentSourceRefIndex(sourceRefs);
    const assetUpdatesByDocumentId = this.createAssetUpdateIndex(assetUpdates);
    const graph = this.buildCharacterGraph(characters, relationSourceRefs, sourceDocumentById);
    const pendingReviews = reviewRows.map((review) => this.createReviewSummary(review, sourceDocumentById));
    const pendingReviewBundles = this.createReviewBundles({
      reviews: pendingReviews,
      sourceRefsByDocumentId,
      assetUpdatesByDocumentId,
      sourceDocumentById,
      characters,
      chapters,
      volumes,
      foreshadows,
    });
    const pendingConflictBundles = this.createPendingConflictBundles(pendingReviewBundles);
    const recentSourceRefs = sourceRefs.slice(0, 10).map((sourceRef) => this.createSourceRefSummary(sourceRef, sourceDocumentById));
    const reviewStats = this.createReviewStats(
      reviewRows,
      pendingReviewBundles.length,
      pendingReviewBundles.filter((bundle) => bundle.isAutoApprovable).length,
    );
    const fileSourceSummaries = fileSources.map((fileSource) =>
      this.createFileSourceSummary(fileSource, sourceDocumentsByFileSource.get(fileSource.id) ?? [], reviewRows),
    );

    return {
      work,
      stats: {
        volumeCount: volumes.length,
        chapterCount: chapters.length,
        characterCount: characters.length,
        foreshadowCount: foreshadows.length,
        relationCount: graph.edges.length,
        sourceCount: fileSourceSummaries.length,
        pendingReviewCount: reviewRows.length,
      },
      volumes,
      characters,
      chapters,
      graph,
      latestChapter: chapters.at(-1),
      fileSources: fileSourceSummaries,
      pendingReviewBundles,
      pendingConflictBundles,
      recentSourceRefs,
      pendingReviews,
      reviewStats,
    };
  }

  private async listVolumes(projectId: string): Promise<VolumeOutline[]> {
    const volumeRows = await this.client.db
      .select()
      .from(volumesV2Table)
      .where(eq(volumesV2Table.projectId, projectId))
      .orderBy(asc(volumesV2Table.sortOrder));

    return volumeRows.map((volumeRow) => {
      const extraJson = (volumeRow.extraJson ?? {}) as Record<string, unknown>;
      return {
        id: volumeRow.id,
        workId: volumeRow.projectId,
        order: volumeRow.sortOrder,
        title: volumeRow.title,
        goal: volumeRow.phaseGoal,
        mainConflict: volumeRow.mainConflict,
        entryHook: String(extraJson.entryHook ?? "Pending opening hook"),
        climax: String(extraJson.climax ?? "Pending climax beat"),
        payoff: String(extraJson.payoff ?? "Pending payoff beat"),
        mustDeliverInfo: readStringArray(extraJson.mustDeliverInfo),
        keyCharacters: readStringArray(extraJson.keyCharacters),
        plannedChapterCount: volumeRow.plannedChapterCount,
      };
    });
  }

  private async listForeshadows(projectId: string): Promise<ForeshadowLedgerItem[]> {
    const foreshadowRows = await this.client.db
      .select()
      .from(foreshadowsV2Table)
      .where(eq(foreshadowsV2Table.projectId, projectId))
      .orderBy(asc(foreshadowsV2Table.createdAt));

    return foreshadowRows.map((foreshadowRow) => ({
      id: foreshadowRow.id,
      workId: foreshadowRow.projectId,
      seedChapterId: foreshadowRow.seedChapterId,
      description: foreshadowRow.description,
      narrativePurpose: foreshadowRow.narrativePurpose,
      expectedPayoffVolumeId: undefined,
      expectedPayoffChapterId: foreshadowRow.expectedPayoffChapterId ?? undefined,
      actualPayoffChapterId: foreshadowRow.actualPayoffChapterId ?? undefined,
      status: foreshadowRow.payoffStatus as ForeshadowLedgerItem["status"],
    }));
  }

  private buildCharacterGraph(
    characters: CharacterCard[],
    relationSourceRefs: Map<string, SyncSourceRefRecord[]>,
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>,
  ): WorkbenchCharacterGraph {
    const nodes: WorkbenchCharacterGraphNode[] = characters.map((character) => ({
      characterId: character.id,
      name: character.name,
      role: character.role,
      archetype: character.archetype,
    }));

    const characterNameById = new Map(characters.map((character) => [character.id, character.name]));
    const edges: WorkbenchCharacterGraphEdge[] = [];

    for (const character of characters) {
      for (const relationship of character.relationships) {
        const relationAssetId = `${character.id}:${relationship.targetCharacterId}:${relationship.publicLabel}`;
        const relationRefRows = relationSourceRefs.get(relationAssetId) ?? [];
        const latestRelationRef = relationRefRows[0];
        const latestRelationDocument = latestRelationRef?.sourceDocumentId
          ? sourceDocumentById.get(latestRelationRef.sourceDocumentId)
          : undefined;

        edges.push({
          sourceCharacterId: character.id,
          sourceCharacterName: character.name,
          targetCharacterId: relationship.targetCharacterId,
          targetCharacterName: characterNameById.get(relationship.targetCharacterId) ?? relationship.targetCharacterId,
          publicLabel: relationship.publicLabel,
          privateLabel: relationship.privateLabel,
          trustLevel: relationship.trustLevel,
          tensionLevel: relationship.tensionLevel,
          sourceRefCount: relationRefRows.length,
          latestSourcePath: latestRelationDocument?.relativePath,
          latestEvidenceQuote: latestRelationRef?.evidenceQuote,
        });
      }
    }

    return { nodes, edges };
  }

  private sortSourceDocuments(
    documents: Array<{
      id: string;
      relativePath: string;
      documentKind: string;
      syncStatus: string;
      lastModifiedAt: string;
      mappedScopeType?: string;
      mappedScopeId?: string;
    }>,
  ): WorkbenchSourceDocumentIndex[] {
    return [...documents]
      .sort((left, right) => right.lastModifiedAt.localeCompare(left.lastModifiedAt, "zh-CN"))
      .map((document) => ({
        id: document.id,
        relativePath: document.relativePath,
        documentKind: document.documentKind,
        syncStatus: document.syncStatus,
        lastModifiedAt: document.lastModifiedAt,
        mappedScopeType: document.mappedScopeType,
        mappedScopeId: document.mappedScopeId,
      }));
  }

  private createFileSourceSummary(
    fileSource: SyncFileSourceRecord,
    sourceDocuments: WorkbenchSourceDocumentIndex[],
    reviewRows: SyncReviewQueueRecord[],
  ): WorkbenchFileSourceSummary {
    const sourceDocumentIdSet = new Set(sourceDocuments.map((document) => document.id));
    const reviewPendingCount = reviewRows.filter(
      (review) => review.sourceDocumentId && sourceDocumentIdSet.has(review.sourceDocumentId),
    ).length;
    const latestDocumentPath = sourceDocuments[0]?.relativePath;

    return {
      id: fileSource.id,
      label: fileSource.label,
      sourceKind: fileSource.sourceKind,
      rootPath: fileSource.rootPath,
      chapterPath: fileSource.chapterPath,
      outlinePath: fileSource.outlinePath,
      exportPath: fileSource.exportPath,
      status: fileSource.status,
      lastScannedAt: fileSource.lastScannedAt,
      documentCount: sourceDocuments.length,
      pendingDocumentCount: sourceDocuments.filter((document) =>
        document.syncStatus === "pending" || document.syncStatus === "review_pending",
      ).length,
      missingDocumentCount: sourceDocuments.filter((document) => document.syncStatus === "missing").length,
      reviewPendingCount,
      latestDocumentPath,
    };
  }

  private createReviewSummary(
    review: SyncReviewQueueRecord,
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>,
  ): WorkbenchReviewItemSummary {
    const sourceDocument = review.sourceDocumentId ? sourceDocumentById.get(review.sourceDocumentId) : undefined;

    return {
      id: review.id,
      syncRunId: review.syncRunId,
      reviewKind: review.reviewKind,
      severity: review.severity,
      status: review.status,
      summary: review.summary,
      sourceType: review.sourceType,
      sourceId: review.sourceId,
      sourceDocumentId: review.sourceDocumentId,
      sourcePath: sourceDocument?.relativePath,
      documentKind: sourceDocument?.documentKind,
      detailJson: review.detailJson,
    };
  }

  private createReviewBundles(input: {
    reviews: WorkbenchReviewItemSummary[];
    sourceRefsByDocumentId: Map<string, SyncSourceRefRecord[]>;
    assetUpdatesByDocumentId: Map<string, SyncAssetUpdateRecord[]>;
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>;
    characters: CharacterCard[];
    chapters: ChapterCard[];
    volumes: VolumeOutline[];
    foreshadows: ForeshadowLedgerItem[];
  }): WorkbenchReviewBundleSummary[] {
    const bundleMap = new Map<string, WorkbenchReviewBundleSummary>();

    for (const review of input.reviews) {
      const bundleId = this.buildReviewBundleId(review);
      const existingBundle = bundleMap.get(bundleId);
      const reviewHints = Array.isArray(review.detailJson.reviewHints) ? review.detailJson.reviewHints.length : 0;
      const sourceRefRows = review.sourceDocumentId ? (input.sourceRefsByDocumentId.get(review.sourceDocumentId) ?? []) : [];
      const latestSourceRef = sourceRefRows[0];
      const riskAssessment = assessReviewRisk({
        reviewKind: review.reviewKind,
        severity: review.severity,
        detailJson: review.detailJson,
      });
      const impactSummary = review.sourceDocumentId
        ? buildReviewBundleImpactSummary({
            sourceDocument: input.sourceDocumentById.get(review.sourceDocumentId),
            assetUpdates: input.assetUpdatesByDocumentId.get(review.sourceDocumentId) ?? [],
            characters: input.characters,
            chapters: input.chapters,
            volumes: input.volumes,
            foreshadows: input.foreshadows,
          })
        : undefined;

      if (!existingBundle) {
        bundleMap.set(bundleId, {
          id: bundleId,
          title: review.sourcePath ?? `Source ${this.buildSyncRunLabel(review.syncRunId)}`,
          summary: this.buildReviewBundleSummary(review, 1),
          sourceDocumentId: review.sourceDocumentId,
          sourcePath: review.sourcePath,
          documentKind: review.documentKind,
          syncRunId: review.syncRunId,
          severity: review.severity,
          blockingLevel: riskAssessment.blockingLevel,
          pendingItemCount: 1,
          lowSeverityCount: review.severity === "low" ? 1 : 0,
          mediumSeverityCount: review.severity === "medium" ? 1 : 0,
          highSeverityCount: review.severity === "high" ? 1 : 0,
          characterCandidateCount: this.readNumericSignal(review.detailJson, "characterCandidateCount"),
          relationshipCandidateCount: this.readNumericSignal(review.detailJson, "relationshipCandidateCount"),
          foreshadowCandidateCount: this.readNumericSignal(review.detailJson, "foreshadowCandidateCount"),
          timelineCandidateCount: this.readNumericSignal(review.detailJson, "timelineCandidateCount"),
          reviewHintCount: reviewHints,
          reviewKinds: [review.reviewKind],
          riskNature: riskAssessment.nature,
          riskCategories: riskAssessment.categories,
          riskReasons: riskAssessment.reasons,
          recommendedActions: riskAssessment.recommendedActions,
          autoApprovalReasons: riskAssessment.autoApprovalReasons,
          sourceRefCount: sourceRefRows.length,
          latestReferenceKind: latestSourceRef?.referenceKind,
          latestEvidenceQuote: latestSourceRef?.evidenceQuote,
          impactSummary,
          isAutoApprovable: false,
          items: [review],
        });
        continue;
      }

      existingBundle.items.push(review);
      existingBundle.pendingItemCount += 1;
      existingBundle.lowSeverityCount += review.severity === "low" ? 1 : 0;
      existingBundle.mediumSeverityCount += review.severity === "medium" ? 1 : 0;
      existingBundle.highSeverityCount += review.severity === "high" ? 1 : 0;
      existingBundle.characterCandidateCount += this.readNumericSignal(review.detailJson, "characterCandidateCount");
      existingBundle.relationshipCandidateCount += this.readNumericSignal(review.detailJson, "relationshipCandidateCount");
      existingBundle.foreshadowCandidateCount += this.readNumericSignal(review.detailJson, "foreshadowCandidateCount");
      existingBundle.timelineCandidateCount += this.readNumericSignal(review.detailJson, "timelineCandidateCount");
      existingBundle.reviewHintCount += reviewHints;
      existingBundle.riskCategories = this.mergeUniqueStrings(existingBundle.riskCategories, riskAssessment.categories);
      existingBundle.riskReasons = this.mergeUniqueStrings(existingBundle.riskReasons, riskAssessment.reasons);
      existingBundle.recommendedActions = this.mergeUniqueStrings(existingBundle.recommendedActions, riskAssessment.recommendedActions);
      existingBundle.autoApprovalReasons = this.mergeUniqueStrings(existingBundle.autoApprovalReasons, riskAssessment.autoApprovalReasons);
      existingBundle.sourceRefCount = Math.max(existingBundle.sourceRefCount, sourceRefRows.length);
      existingBundle.latestReferenceKind ??= latestSourceRef?.referenceKind;
      existingBundle.latestEvidenceQuote ??= latestSourceRef?.evidenceQuote;
      existingBundle.impactSummary ??= impactSummary;
      if (!existingBundle.reviewKinds.includes(review.reviewKind)) {
        existingBundle.reviewKinds.push(review.reviewKind);
      }
      if (this.getSeverityRank(review.severity) > this.getSeverityRank(existingBundle.severity)) {
        existingBundle.severity = review.severity;
      }
      if (this.getBlockingLevelRank(riskAssessment.blockingLevel) > this.getBlockingLevelRank(existingBundle.blockingLevel)) {
        existingBundle.blockingLevel = riskAssessment.blockingLevel;
      }
      if (this.getRiskNatureRank(riskAssessment.nature) > this.getRiskNatureRank(existingBundle.riskNature)) {
        existingBundle.riskNature = riskAssessment.nature;
      }
      existingBundle.summary = this.buildReviewBundleSummary(review, existingBundle.pendingItemCount);
    }

    return [...bundleMap.values()]
      .map((bundle) => ({
        ...bundle,
        isAutoApprovable: this.isReviewBundleAutoApprovable(bundle),
      }))
      .sort((left, right) => {
        const severityDelta = this.getSeverityRank(right.severity) - this.getSeverityRank(left.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return right.pendingItemCount - left.pendingItemCount;
      });
  }

  private createPendingConflictBundles(
    bundles: WorkbenchReviewBundleSummary[],
  ): WorkbenchReviewBundleSummary[] {
    return bundles
      .filter((bundle) => bundle.blockingLevel !== "none")
      .sort((left, right) => {
        const blockingDelta = this.getBlockingLevelRank(right.blockingLevel) - this.getBlockingLevelRank(left.blockingLevel);
        if (blockingDelta !== 0) {
          return blockingDelta;
        }
        return this.getSeverityRank(right.severity) - this.getSeverityRank(left.severity);
      })
      .slice(0, 6);
  }

  private createSourceRefSummary(
    sourceRef: SyncSourceRefRecord,
    sourceDocumentById: Map<string, WorkbenchSourceDocumentIndex>,
  ): WorkbenchSourceRefSummary {
    const sourceDocument = sourceRef.sourceDocumentId ? sourceDocumentById.get(sourceRef.sourceDocumentId) : undefined;

    return {
      id: sourceRef.id,
      assetType: sourceRef.assetType,
      assetId: sourceRef.assetId,
      referenceKind: sourceRef.referenceKind,
      locator: sourceRef.locator,
      sourceDocumentId: sourceRef.sourceDocumentId,
      sourcePath: sourceDocument?.relativePath,
      documentKind: sourceDocument?.documentKind,
      evidenceQuote: sourceRef.evidenceQuote,
      updatedAt: sourceRef.updatedAt,
    };
  }

  private createSourceRefIndex(sourceRefs: SyncSourceRefRecord[]): Map<string, SyncSourceRefRecord[]> {
    const index = new Map<string, SyncSourceRefRecord[]>();

    for (const sourceRef of sourceRefs) {
      const bucket = index.get(sourceRef.assetId);
      if (bucket) {
        bucket.push(sourceRef);
      } else {
        index.set(sourceRef.assetId, [sourceRef]);
      }
    }

    return index;
  }

  private createSourceDocumentSourceRefIndex(sourceRefs: SyncSourceRefRecord[]): Map<string, SyncSourceRefRecord[]> {
    const index = new Map<string, SyncSourceRefRecord[]>();

    for (const sourceRef of sourceRefs) {
      if (!sourceRef.sourceDocumentId) {
        continue;
      }

      const bucket = index.get(sourceRef.sourceDocumentId);
      if (bucket) {
        bucket.push(sourceRef);
      } else {
        index.set(sourceRef.sourceDocumentId, [sourceRef]);
      }
    }

    return index;
  }

  private createAssetUpdateIndex(assetUpdates: SyncAssetUpdateRecord[]): Map<string, SyncAssetUpdateRecord[]> {
    const index = new Map<string, SyncAssetUpdateRecord[]>();

    for (const assetUpdate of assetUpdates) {
      if (!assetUpdate.sourceDocumentId) {
        continue;
      }

      const bucket = index.get(assetUpdate.sourceDocumentId);
      if (bucket) {
        bucket.push(assetUpdate);
      } else {
        index.set(assetUpdate.sourceDocumentId, [assetUpdate]);
      }
    }

    return index;
  }

  private createReviewStats(
    reviews: SyncReviewQueueRecord[],
    bundleCount: number,
    autoApprovableBundleCount: number,
  ): WorkbenchReviewStats {
    return {
      bundleCount,
      autoApprovableBundleCount,
      pendingCount: reviews.length,
      lowSeverityCount: reviews.filter((review) => review.severity === "low").length,
      mediumSeverityCount: reviews.filter((review) => review.severity === "medium").length,
      highSeverityCount: reviews.filter((review) => review.severity === "high").length,
    };
  }

  private buildReviewBundleId(review: WorkbenchReviewItemSummary): string {
    if (review.sourceDocumentId) {
      return `source-document:${review.sourceDocumentId}`;
    }
    if (review.syncRunId) {
      return `sync-run:${review.syncRunId}:${review.sourceType}:${review.sourceId ?? review.reviewKind}`;
    }
    return `fallback:${review.sourceType}:${review.sourceId ?? review.reviewKind}`;
  }

  private buildReviewBundleSummary(review: WorkbenchReviewItemSummary, pendingItemCount: number): string {
    const originLabel = review.documentKind ?? review.reviewKind;
    return `${pendingItemCount} review items / ${originLabel}`;
  }

  private buildSyncRunLabel(syncRunId?: string): string {
    return syncRunId ? syncRunId.slice(0, 8) : "pending";
  }

  private readNumericSignal(detailJson: Record<string, unknown>, field: string): number {
    const value = detailJson[field];
    return typeof value === "number" ? value : 0;
  }

  private isReviewBundleAutoApprovable(bundle: WorkbenchReviewBundleSummary): boolean {
    return (
      bundle.blockingLevel === "none" &&
      bundle.mediumSeverityCount === 0 &&
      bundle.highSeverityCount === 0 &&
      bundle.reviewHintCount === 0 &&
      bundle.riskCategories.length === 0 &&
      bundle.autoApprovalReasons.length > 0
    );
  }

  private getSeverityRank(severity: string): number {
    switch (severity) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }

  private getBlockingLevelRank(level: "none" | "review" | "conflict"): number {
    switch (level) {
      case "conflict":
        return 2;
      case "review":
        return 1;
      default:
        return 0;
    }
  }

  private getRiskNatureRank(nature: string): number {
    switch (nature) {
      case "factual-conflict":
        return 4;
      case "format-blocker":
        return 3;
      case "information-gap":
        return 2;
      case "confidence-review":
        return 1;
      default:
        return 0;
    }
  }

  private mergeUniqueStrings(base: string[], additions: string[]): string[] {
    const merged = new Set(base);
    for (const item of additions) {
      if (item.trim()) {
        merged.add(item.trim());
      }
    }
    return [...merged];
  }

  private createEmptyStats(): WorkbenchProjectStats {
    return {
      volumeCount: 0,
      chapterCount: 0,
      characterCount: 0,
      foreshadowCount: 0,
      relationCount: 0,
      sourceCount: 0,
      pendingReviewCount: 0,
    };
  }
}
