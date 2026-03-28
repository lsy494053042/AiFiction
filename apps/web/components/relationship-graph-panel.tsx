import Link from "next/link";

import type { WorkbenchProjectSnapshot, WorkbenchSourceRefSummary } from "@aifiction/data";

interface RelationshipGraphPanelProps {
  snapshot: WorkbenchProjectSnapshot;
  workSlug: string;
  activeCharacterId?: string;
  activeSourceType?: string;
}

interface CharacterNodeSummary {
  characterId: string;
  name: string;
  role: string;
  archetype: string;
  relationCount: number;
  incomingCount: number;
  outgoingCount: number;
}

const copy = {
  filterEyebrow: "图谱筛选",
  filterTitle: "按角色和证据收缩图谱",
  filterBody: "先把要核对的角色和来源类型缩到一个局部范围，再去看关系边和证据引用。这样能更快判断这一块网络到底有没有跑偏。",
  clearFilters: "清除筛选",
  allCharacters: "全部角色",
  allSourceTypes: "全部来源类型",
  networkEyebrow: "关系图谱",
  networkTitle: "角色网络",
  networkBody: "这里展示当前已经结构化落库的角色节点和关系覆盖度。重点不是做炫技图，而是快速确认谁是中心人物、谁的关系还太薄、哪些角色已经被稳定跟踪。",
  relationLabel: "关系",
  outgoingLabel: "流出",
  incomingLabel: "流入",
  focusAction: "聚焦角色",
  unfocusAction: "取消聚焦",
  networkEmpty: "当前还没有足够的角色关系事实，等后续抽取和审查积累起来后，这里会逐步成形。",
  edgeEyebrow: "关系事实",
  edgeTitle: "当前关系边",
  edgeBody: "这里按证据量和张力排序，优先把更值得复核的关系事实放到前面。你可以先缩到单个角色，再看局部关系链。",
  referenceLabel: "引用",
  trustLabel: "信任",
  tensionLabel: "张力",
  sourcePrefix: "来源：",
  traceAction: "\u67e5\u770b\u540c\u6e90\u53d8\u66f4",
  edgeEmpty: "当前筛选范围内还没有结构化关系边。",
  sourceEyebrow: "来源证据",
  sourceTitle: "最近引用",
  sourceBody: "这里把最近沉淀下来的来源引用单独拉出来，便于核对某条关系或设定到底来自哪一章、哪一段。",
  sourceTypeLabel: "来源类型",
  documentTypePrefix: "文档类型：",
  sourceEmpty: "当前筛选范围内还没有可展示的来源引用。",
  focusSummaryPrefix: "当前聚焦：",
  sourceSummaryPrefix: "来源过滤：",
} as const;

const sourceTypeLabelMap: Record<string, string> = {
  character: "角色",
  relationship: "关系",
  foreshadow: "伏笔",
  timeline: "时间线",
};

function getSourceTypeLabel(sourceType: string): string {
  return sourceTypeLabelMap[sourceType] ?? sourceType;
}

function createReviewTraceHref(workSlug: string, input: { sourceDocumentId?: string; sourcePath?: string }) {
  const encodedSlug = encodeURIComponent(workSlug);
  const params = new URLSearchParams();
  params.set("view", "reviews");
  if (input.sourceDocumentId) params.set("traceDocumentId", input.sourceDocumentId);
  if (input.sourcePath) params.set("tracePath", input.sourcePath);
  return "/works/" + encodedSlug + "?" + params.toString();
}

function createGraphHref(
  workSlug: string,
  filters: {
    focusCharacterId?: string;
    sourceType?: string;
  },
): string {
  const encodedSlug = encodeURIComponent(workSlug);
  const params = new URLSearchParams();
  params.set("view", "graph");

  if (filters.focusCharacterId) {
    params.set("focusCharacter", filters.focusCharacterId);
  }

  if (filters.sourceType) {
    params.set("sourceType", filters.sourceType);
  }

  return "/works/" + encodedSlug + "?" + params.toString();
}

function buildCharacterNodeSummaries(snapshot: WorkbenchProjectSnapshot): CharacterNodeSummary[] {
  const incomingCountById = new Map<string, number>();
  const outgoingCountById = new Map<string, number>();

  for (const edge of snapshot.graph.edges) {
    outgoingCountById.set(edge.sourceCharacterId, (outgoingCountById.get(edge.sourceCharacterId) ?? 0) + 1);
    incomingCountById.set(edge.targetCharacterId, (incomingCountById.get(edge.targetCharacterId) ?? 0) + 1);
  }

  return snapshot.graph.nodes
    .map((node) => {
      const incomingCount = incomingCountById.get(node.characterId) ?? 0;
      const outgoingCount = outgoingCountById.get(node.characterId) ?? 0;
      return {
        ...node,
        incomingCount,
        outgoingCount,
        relationCount: incomingCount + outgoingCount,
      };
    })
    .sort((left, right) => {
      const relationDelta = right.relationCount - left.relationCount;
      if (relationDelta !== 0) {
        return relationDelta;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
}

function normalizeActiveCharacterId(snapshot: WorkbenchProjectSnapshot, activeCharacterId?: string): string | undefined {
  if (!activeCharacterId) {
    return undefined;
  }

  const knownCharacterIds = new Set(snapshot.graph.nodes.map((node) => node.characterId));
  return knownCharacterIds.has(activeCharacterId) ? activeCharacterId : undefined;
}

function normalizeActiveSourceType(sourceRefs: WorkbenchSourceRefSummary[], activeSourceType?: string): string | undefined {
  if (!activeSourceType) {
    return undefined;
  }

  const knownSourceTypes = new Set(sourceRefs.map((sourceRef) => sourceRef.assetType));
  return knownSourceTypes.has(activeSourceType) ? activeSourceType : undefined;
}

function getFilteredEdges(snapshot: WorkbenchProjectSnapshot, activeCharacterId?: string) {
  return snapshot.graph.edges
    .filter((edge) => {
      if (!activeCharacterId) {
        return true;
      }

      return edge.sourceCharacterId === activeCharacterId || edge.targetCharacterId === activeCharacterId;
    })
    .sort((left, right) => {
      const referenceDelta = right.sourceRefCount - left.sourceRefCount;
      if (referenceDelta !== 0) {
        return referenceDelta;
      }
      return right.tensionLevel - left.tensionLevel;
    });
}

function getVisibleNodes(
  nodeSummaries: CharacterNodeSummary[],
  filteredEdges: WorkbenchProjectSnapshot["graph"]["edges"],
  activeCharacterId?: string,
) {
  if (!activeCharacterId) {
    return nodeSummaries;
  }

  const visibleCharacterIds = new Set<string>([activeCharacterId]);
  for (const edge of filteredEdges) {
    visibleCharacterIds.add(edge.sourceCharacterId);
    visibleCharacterIds.add(edge.targetCharacterId);
  }

  return nodeSummaries.filter((node) => visibleCharacterIds.has(node.characterId));
}

function getFilteredSourceRefs(
  snapshot: WorkbenchProjectSnapshot,
  filteredEdges: WorkbenchProjectSnapshot["graph"]["edges"],
  activeCharacterId?: string,
  activeSourceType?: string,
) {
  const relatedSourcePaths = new Set(
    filteredEdges
      .map((edge) => edge.latestSourcePath)
      .filter((sourcePath): sourcePath is string => Boolean(sourcePath)),
  );

  return [...snapshot.recentSourceRefs]
    .filter((sourceRef) => {
      if (activeSourceType && sourceRef.assetType !== activeSourceType) {
        return false;
      }

      if (activeCharacterId && relatedSourcePaths.size > 0) {
        return Boolean(sourceRef.sourcePath && relatedSourcePaths.has(sourceRef.sourcePath));
      }

      return true;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
}

function getSourceTypeOptions(sourceRefs: WorkbenchSourceRefSummary[]) {
  return [...new Set(sourceRefs.map((sourceRef) => sourceRef.assetType))].sort((left, right) =>
    getSourceTypeLabel(left).localeCompare(getSourceTypeLabel(right), "zh-CN"),
  );
}

function renderFilterPanel(
  workSlug: string,
  nodeSummaries: CharacterNodeSummary[],
  sourceTypeOptions: string[],
  activeCharacterId?: string,
  activeSourceType?: string,
) {
  const activeCharacter = activeCharacterId
    ? nodeSummaries.find((node) => node.characterId === activeCharacterId)
    : undefined;
  const hasFilters = Boolean(activeCharacterId || activeSourceType);

  return (
    <article className="content-card graph-panel-card graph-filter-panel">
      <div className="section-heading">
        <p>{copy.filterEyebrow}</p>
        <h2>{copy.filterTitle}</h2>
      </div>
      <p className="panel-copy">{copy.filterBody}</p>
      <div className="graph-filter-summary">
        {activeCharacter ? <span className="status-badge">{copy.focusSummaryPrefix}{activeCharacter.name}</span> : null}
        {activeSourceType ? <span className="status-badge">{copy.sourceSummaryPrefix}{getSourceTypeLabel(activeSourceType)}</span> : null}
        {hasFilters ? (
          <Link className="ghost-link" href={createGraphHref(workSlug, {})}>
            {copy.clearFilters}
          </Link>
        ) : null}
      </div>
      <section className="graph-filter-section">
        <h3>{copy.networkTitle}</h3>
        <div className="graph-filter-chip-group">
          <Link
            className={activeCharacterId ? "graph-filter-chip" : "graph-filter-chip is-active"}
            href={createGraphHref(workSlug, { sourceType: activeSourceType })}
          >
            {copy.allCharacters}
          </Link>
          {nodeSummaries.map((node) => (
            <Link
              key={node.characterId}
              className={activeCharacterId === node.characterId ? "graph-filter-chip is-active" : "graph-filter-chip"}
              href={createGraphHref(workSlug, {
                focusCharacterId: node.characterId,
                sourceType: activeSourceType,
              })}
            >
              {node.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="graph-filter-section">
        <h3>{copy.sourceTypeLabel}</h3>
        <div className="graph-filter-chip-group">
          <Link
            className={activeSourceType ? "graph-filter-chip" : "graph-filter-chip is-active"}
            href={createGraphHref(workSlug, { focusCharacterId: activeCharacterId })}
          >
            {copy.allSourceTypes}
          </Link>
          {sourceTypeOptions.map((sourceType) => (
            <Link
              key={sourceType}
              className={activeSourceType === sourceType ? "graph-filter-chip is-active" : "graph-filter-chip"}
              href={createGraphHref(workSlug, {
                focusCharacterId: activeCharacterId,
                sourceType,
              })}
            >
              {getSourceTypeLabel(sourceType)}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}

function renderNetworkBoard(
  workSlug: string,
  visibleNodes: CharacterNodeSummary[],
  activeCharacterId?: string,
  activeSourceType?: string,
) {
  return (
    <article className="content-card graph-panel-card">
      <div className="section-heading">
        <p>{copy.networkEyebrow}</p>
        <h2>{copy.networkTitle}</h2>
      </div>
      <p className="panel-copy">{copy.networkBody}</p>
      <div className="graph-node-grid">
        {visibleNodes.length ? (
          visibleNodes.map((node) => {
            const isActive = activeCharacterId === node.characterId;
            return (
              <section key={node.characterId} className={isActive ? "graph-node-card is-focused" : "graph-node-card"}>
                <div className="graph-node-head">
                  <strong>{node.name}</strong>
                  <span className="status-badge">{copy.relationLabel} {node.relationCount}</span>
                </div>
                <p className="asset-meta">{node.role} / {node.archetype}</p>
                <div className="stat-chip-row compact-chip-row">
                  <span className="stat-chip">{copy.outgoingLabel} {node.outgoingCount}</span>
                  <span className="stat-chip">{copy.incomingLabel} {node.incomingCount}</span>
                </div>
                <Link
                  className={isActive ? "graph-filter-chip is-active" : "graph-filter-chip"}
                  href={createGraphHref(workSlug, {
                    focusCharacterId: isActive ? undefined : node.characterId,
                    sourceType: activeSourceType,
                  })}
                >
                  {isActive ? copy.unfocusAction : copy.focusAction}
                </Link>
              </section>
            );
          })
        ) : (
          <div className="empty-state compact-state graph-empty-state">
            <p>{copy.networkEmpty}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function renderEdgeBoard(workSlug: string, filteredEdges: WorkbenchProjectSnapshot["graph"]["edges"]) {
  return (
    <article className="content-card graph-panel-card">
      <div className="section-heading">
        <p>{copy.edgeEyebrow}</p>
        <h2>{copy.edgeTitle}</h2>
      </div>
      <p className="panel-copy">{copy.edgeBody}</p>
      <ul className="asset-list graph-edge-list">
        {filteredEdges.length ? (
          filteredEdges.map((edge) => (
            <li key={edge.sourceCharacterId + ":" + edge.targetCharacterId + ":" + edge.publicLabel}>
              <div className="graph-edge-head">
                <strong>{edge.sourceCharacterName} -&gt; {edge.targetCharacterName}</strong>
                <span className="status-badge">{copy.referenceLabel} {edge.sourceRefCount}</span>
              </div>
              <p>{edge.publicLabel}{edge.privateLabel ? " / " + edge.privateLabel : ""}</p>
              <div className="stat-chip-row compact-chip-row">
                <span className="stat-chip">{copy.trustLabel} {edge.trustLevel}</span>
                <span className="stat-chip">{copy.tensionLabel} {edge.tensionLevel}</span>
              </div>
              {edge.latestSourcePath ? <p className="asset-meta">{copy.sourcePrefix}{edge.latestSourcePath}</p> : null}
              {edge.latestEvidenceQuote ? <p className="evidence-quote">{edge.latestEvidenceQuote}</p> : null}
              {edge.latestSourceDocumentId || edge.latestSourcePath ? (
                <div className="graph-link-row">
                  <Link
                    className="ghost-link"
                    href={createReviewTraceHref(workSlug, { sourceDocumentId: edge.latestSourceDocumentId, sourcePath: edge.latestSourcePath })}
                  >
                    {copy.traceAction}
                  </Link>
                </div>
              ) : null}
            </li>
          ))
        ) : (
          <li className="empty-inline">{copy.edgeEmpty}</li>
        )}
      </ul>
    </article>
  );
}

function renderSourceBoard(workSlug: string, filteredSourceRefs: WorkbenchSourceRefSummary[], activeSourceType?: string) {
  return (
    <article className="content-card graph-panel-card">
      <div className="section-heading">
        <p>{copy.sourceEyebrow}</p>
        <h2>{copy.sourceTitle}</h2>
      </div>
      <p className="panel-copy">{copy.sourceBody}</p>
      {activeSourceType ? <p className="asset-meta graph-filter-note">{copy.sourceSummaryPrefix}{getSourceTypeLabel(activeSourceType)}</p> : null}
      <ul className="asset-list graph-source-list">
        {filteredSourceRefs.length ? (
          filteredSourceRefs.map((sourceRef) => (
            <li key={sourceRef.id}>
              <div className="graph-edge-head">
                <strong>{getSourceTypeLabel(sourceRef.assetType)}</strong>
                <span className="status-badge">{sourceRef.referenceKind}</span>
              </div>
              <p className="asset-meta">{sourceRef.sourcePath ?? sourceRef.locator}</p>
              {sourceRef.documentKind ? <p className="asset-meta">{copy.documentTypePrefix}{sourceRef.documentKind}</p> : null}
              {sourceRef.evidenceQuote ? <p className="evidence-quote">{sourceRef.evidenceQuote}</p> : null}
              {sourceRef.sourceDocumentId || sourceRef.sourcePath ? (
                <div className="graph-link-row">
                  <Link
                    className="ghost-link"
                    href={createReviewTraceHref(workSlug, { sourceDocumentId: sourceRef.sourceDocumentId, sourcePath: sourceRef.sourcePath })}
                  >
                    {copy.traceAction}
                  </Link>
                </div>
              ) : null}
            </li>
          ))
        ) : (
          <li className="empty-inline">{copy.sourceEmpty}</li>
        )}
      </ul>
    </article>
  );
}

export function RelationshipGraphPanel({
  snapshot,
  workSlug,
  activeCharacterId,
  activeSourceType,
}: RelationshipGraphPanelProps) {
  const nodeSummaries = buildCharacterNodeSummaries(snapshot);
  const normalizedCharacterId = normalizeActiveCharacterId(snapshot, activeCharacterId);
  const normalizedSourceType = normalizeActiveSourceType(snapshot.recentSourceRefs, activeSourceType);
  const filteredEdges = getFilteredEdges(snapshot, normalizedCharacterId);
  const visibleNodes = getVisibleNodes(nodeSummaries, filteredEdges, normalizedCharacterId);
  const filteredSourceRefs = getFilteredSourceRefs(
    snapshot,
    filteredEdges,
    normalizedCharacterId,
    normalizedSourceType,
  );
  const sourceTypeOptions = getSourceTypeOptions(snapshot.recentSourceRefs);

  return (
    <section className="detail-view-grid graph-view-grid">
      <div className="detail-stack">
        {renderFilterPanel(workSlug, nodeSummaries, sourceTypeOptions, normalizedCharacterId, normalizedSourceType)}
        {renderNetworkBoard(workSlug, visibleNodes, normalizedCharacterId, normalizedSourceType)}
        {renderEdgeBoard(workSlug, filteredEdges)}
      </div>
      <div className="detail-stack">
        {renderSourceBoard(workSlug, filteredSourceRefs, normalizedSourceType)}
      </div>
    </section>
  );
}
