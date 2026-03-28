import Link from "next/link";
import type {
  WorkbenchAttentionChapterSummary,
  WorkbenchFileSourceSummary,
  WorkbenchImpactSummary,
  WorkbenchReviewBundleSummary,
  WorkbenchReviewItemSummary,
  WorkbenchReviewStats,
} from "@aifiction/data";

import {
  autoRouteProjectReviewsAction,
  bindWorkSourceAction,
  decideReviewAction,
  decideReviewBundleAction,
  rescanWorkSourceAction,
} from "./sync-actions";

interface WorkSyncPanelProps {
  workId: string;
  workSlug: string;
  fileSources: WorkbenchFileSourceSummary[];
  pendingReviewBundles: WorkbenchReviewBundleSummary[];
  attentionChapters: WorkbenchAttentionChapterSummary[];
  activeTraceDocumentId?: string;
  activeTracePath?: string;
  reviewStats: WorkbenchReviewStats;
}

const reviewKindLabelMap: Record<string, string> = {
  "summary-validation": "摘要预览复核",
  "extraction-preview-validation": "抽取预览复核",
  "unsupported-source-format": "源文件格式不受支持",
};

const severityLabelMap: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const blockingLevelLabelMap: Record<string, string> = {
  none: "信息提醒",
  review: "需要复核",
  conflict: "存在冲突",
};

const riskCategoryLabelMap: Record<string, string> = {
  "summary-low-confidence": "摘要置信度偏低",
  "extraction-low-confidence": "抽取置信度偏低",
  "missing-character-candidates": "角色候选不足",
  "missing-relationship-signal": "关系信号不足",
  "missing-foreshadow-signal": "伏笔信号不足",
  "missing-timeline-signal": "时间线信号不足",
  "unsupported-source-format": "源文件格式不受支持",
  "high-severity-review": "高风险审查项",
};

const riskNatureLabelMap: Record<string, string> = {
  none: "无明显风险",
  "information-gap": "信息缺口",
  "confidence-review": "置信度复核",
  "format-blocker": "格式阻塞",
  "factual-conflict": "事实冲突",
};

const actionLaneLabelMap: Record<string, string> = {
  auto: "自动接收",
  review: "人工复核",
  conflict: "冲突处理",
};

const actionStrategyLabelMap: Record<string, string> = {
  "auto-apply": "自动写回",
  "review-source-evidence": "先核对证据",
  "wait-for-more-context": "等待更多上下文",
  "convert-source-format": "先处理文件格式",
  "resolve-factual-conflict": "先解决事实冲突",
};

const laneSectionMetaMap = {
  conflict: {
    title: "冲突包",
    copy: "这些包会影响现有事实层，必须先核对原文和既有资产，再决定是否写回。",
    emptyText: "当前没有需要优先处理的冲突包。",
  },
  review: {
    title: "需要复核",
    copy: "这些包没有明显事实冲突，但系统还不够确定，适合快速过一遍证据和预览。",
    emptyText: "当前没有需要你手动复核的变更包。",
  },
  auto: {
    title: "可自动接收",
    copy: "这些包已经满足低风险规则，通常只需要统一自动处理，不必逐项点开。",
    emptyText: "当前没有可自动接收的低风险变更包。",
  },
} as const;

function formatReviewSignals(detailJson: Record<string, unknown>): string {
  const signals: string[] = [];
  const pairs: Array<[string, string]> = [
    ["characterCandidateCount", "角色候选"],
    ["relationshipCandidateCount", "关系候选"],
    ["foreshadowCandidateCount", "伏笔候选"],
    ["timelineCandidateCount", "时间线候选"],
  ];

  for (const [key, label] of pairs) {
    const value = detailJson[key];
    if (typeof value === "number" && value > 0) {
      signals.push(`${label} ${value}`);
    }
  }

  const reviewHints = detailJson.reviewHints;
  if (Array.isArray(reviewHints) && reviewHints.length) {
    signals.push(`审查提示 ${reviewHints.length}`);
  }

  return signals.join(" / ");
}

function formatBundleSignals(bundle: WorkbenchReviewBundleSummary): string {
  const signals: string[] = [];
  const pairs: Array<[number, string]> = [
    [bundle.characterCandidateCount, "角色候选"],
    [bundle.relationshipCandidateCount, "关系候选"],
    [bundle.foreshadowCandidateCount, "伏笔候选"],
    [bundle.timelineCandidateCount, "时间线候选"],
  ];

  for (const [value, label] of pairs) {
    if (value > 0) {
      signals.push(`${label} ${value}`);
    }
  }

  if (bundle.reviewHintCount > 0) {
    signals.push(`审查提示 ${bundle.reviewHintCount}`);
  }

  return signals.join(" / ");
}

function formatBundleKinds(bundle: WorkbenchReviewBundleSummary): string {
  return bundle.reviewKinds.map((item) => reviewKindLabelMap[item] ?? item).join(" / ");
}

function formatRiskCategories(bundle: WorkbenchReviewBundleSummary): string {
  return bundle.riskCategories.map((item) => riskCategoryLabelMap[item] ?? item).join(" / ");
}

function renderPathLine(label: string, value?: string) {
  if (!value) {
    return null;
  }

  return (
    <div className="path-line">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function buildReviewTraceHref(workSlug: string, input: { sourceDocumentId?: string; sourcePath?: string }) {
  const params = new URLSearchParams();
  params.set("view", "reviews");
  if (input.sourceDocumentId) params.set("traceDocumentId", input.sourceDocumentId);
  if (input.sourcePath) params.set("tracePath", input.sourcePath);
  return `/works/${encodeURIComponent(workSlug)}?${params.toString()}`;
}

function renderTraceBanner(workSlug: string, sourceDocumentId?: string, sourcePath?: string, bundleCount = 0) {
  if (!sourceDocumentId && !sourcePath) return null;
  return (
    <section className="review-trace-banner">
      <div className="review-lane-section-head">
        <div>
          <p className="eyebrow guide-eyebrow">{"\u6765\u6e90\u8ffd\u8e2a"}</p>
          <h3>{"\u5df2\u6309\u6765\u6e90\u8fc7\u6ee4\u5f53\u524d\u53d8\u66f4"}</h3>
        </div>
        <span className="status-badge">{bundleCount}</span>
      </div>
      {sourcePath ? <p className="asset-meta">{"\u5f53\u524d\u7ae0\u8282\uff1a"}{sourcePath}</p> : null}
      {sourceDocumentId ? <p className="asset-meta">{"\u6765\u6e90 ID\uff1a"}{sourceDocumentId}</p> : null}
      <div className="graph-filter-summary">
        <Link className="ghost-link" href={`/works/${encodeURIComponent(workSlug)}?view=reviews`}>{"\u6e05\u9664\u6765\u6e90\u7b5b\u9009"}</Link>
      </div>
    </section>
  );
}

function renderImpactSummary(impactSummary?: WorkbenchImpactSummary) {
  if (!impactSummary) {
    return null;
  }

  return (
    <div className="review-impact-block compact-impact-block">
      <div className="review-bundle-section-head">
        <p className="asset-meta review-bundle-meta">改动影响</p>
        <span className="status-badge">影响分析</span>
      </div>
      <p className="asset-meta review-bundle-meta">{impactSummary.summary}</p>
      <div className="stat-chip-row compact-chip-row">
        <span className="stat-chip">既有角色 {impactSummary.affectedCharacterCount}</span>
        <span className="stat-chip">新角色候选 {impactSummary.newCharacterCount}</span>
        <span className="stat-chip">关系影响 {impactSummary.affectedRelationshipCount}</span>
        <span className="stat-chip">伏笔影响 {impactSummary.affectedForeshadowCount}</span>
        <span className="stat-chip">建议复核章节 {impactSummary.downstreamChapterCount}</span>
      </div>
      {impactSummary.topEntries.length ? (
        <ul className="compact-asset-list impact-entry-list">
          {impactSummary.topEntries.map((entry) => (
            <li key={`${entry.type}:${entry.id ?? entry.label}:${entry.reason}`}>
              <strong>{entry.label}</strong>
              <p className="asset-meta">{entry.reason}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function renderActionPlan(bundle: WorkbenchReviewBundleSummary) {
  return (
    <div className="review-impact-block compact-impact-block">
      <div className="review-bundle-section-head">
        <p className="asset-meta review-bundle-meta">处理建议</p>
        <span className="status-badge">{actionLaneLabelMap[bundle.actionPlan.lane] ?? bundle.actionPlan.lane}</span>
      </div>
      <p className="review-signal">{bundle.actionPlan.title}</p>
      <p className="asset-meta review-bundle-meta">处理策略：{actionStrategyLabelMap[bundle.actionPlan.strategy] ?? bundle.actionPlan.strategy}</p>
      <p className="asset-meta review-bundle-meta">{bundle.actionPlan.primaryAction}</p>
      {bundle.actionPlan.steps.length ? (
        <ul className="risk-reason-list compact-risk-list">
          {bundle.actionPlan.steps.map((step) => (
            <li key={`${bundle.id}:step:${step}`} className="risk-reason-item">{step}</li>
          ))}
        </ul>
      ) : null}
      {bundle.actionPlan.systemActions.length ? (
        <>
          <p className="asset-meta review-bundle-meta">系统后续动作</p>
          <ul className="risk-reason-list compact-risk-list">
            {bundle.actionPlan.systemActions.map((action) => (
              <li key={`${bundle.id}:system:${action}`} className="risk-reason-item">{action}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function renderReviewItem(workSlug: string, review: WorkbenchReviewItemSummary) {
  const signals = formatReviewSignals(review.detailJson);

  return (
    <li key={review.id} className="review-subitem">
      <div className="review-head">
        <strong>{review.summary}</strong>
        <span className={`review-severity severity-${review.severity}`}>
          {severityLabelMap[review.severity] ?? review.severity}
        </span>
      </div>
      <p className="asset-meta">
        {reviewKindLabelMap[review.reviewKind] ?? review.reviewKind}
        {review.documentKind ? ` / ${review.documentKind}` : ""}
      </p>
      {signals ? <p className="review-signal">{signals}</p> : null}
      <form action={decideReviewAction} className="review-action-form review-action-form-compact">
        <input type="hidden" name="workSlug" value={workSlug} />
        <input type="hidden" name="reviewId" value={review.id} />
        <label className="field-block field-block-wide review-note-field">
          <span>处理备注</span>
          <input name="decisionNote" placeholder="可填写处理原因，方便后续回看。" />
        </label>
        <div className="review-action-row">
          <button type="submit" name="decision" value="approved">通过</button>
          <button type="submit" name="decision" value="rejected" className="ghost-button">驳回</button>
        </div>
      </form>
    </li>
  );
}

function renderBundleCard(workSlug: string, bundle: WorkbenchReviewBundleSummary) {
  const bundleSignals = formatBundleSignals(bundle);
  const approveLabel = bundle.actionPlan.lane === "auto" ? "确认自动写回" : "整包通过";

  return (
    <li key={bundle.id} className={`review-bundle-card lane-${bundle.actionPlan.lane}`}>
      <div className="review-head review-bundle-head">
        <div className="review-copy-block">
          <strong>{bundle.title}</strong>
          <p className="asset-meta">{bundle.summary}</p>
        </div>
        <div className="review-bundle-side">
          <span className="status-badge">{actionLaneLabelMap[bundle.actionPlan.lane] ?? bundle.actionPlan.lane}</span>
          {bundle.blockingLevel !== "none" ? (
            <span className={`status-badge risk-badge risk-${bundle.blockingLevel}`}>
              {blockingLevelLabelMap[bundle.blockingLevel] ?? bundle.blockingLevel}
            </span>
          ) : null}
          <span className={`review-severity severity-${bundle.severity}`}>
            {severityLabelMap[bundle.severity] ?? bundle.severity}
          </span>
        </div>
      </div>

      <div className="stat-chip-row compact-chip-row">
        <span className="stat-chip">条目 {bundle.pendingItemCount}</span>
        <span className="stat-chip">低风险 {bundle.lowSeverityCount}</span>
        <span className="stat-chip">中风险 {bundle.mediumSeverityCount}</span>
        <span className="stat-chip">高风险 {bundle.highSeverityCount}</span>
      </div>

      <p className="asset-meta review-bundle-meta">
        {formatBundleKinds(bundle)}
        {bundle.documentKind ? ` / ${bundle.documentKind}` : ""}
      </p>
      {bundleSignals ? <p className="review-signal">{bundleSignals}</p> : null}
      <p className="asset-meta review-bundle-meta">风险性质：{riskNatureLabelMap[bundle.riskNature] ?? bundle.riskNature}</p>
      {bundle.riskCategories.length ? <p className="asset-meta review-bundle-meta">{formatRiskCategories(bundle)}</p> : null}
      {bundle.sourceRefCount > 0 ? (
        <p className="asset-meta review-bundle-meta">
          来源引用 {bundle.sourceRefCount}
          {bundle.latestReferenceKind ? ` / ${bundle.latestReferenceKind}` : ""}
        </p>
      ) : null}

      {renderActionPlan(bundle)}

      {bundle.autoApprovalReasons.length ? (
        <>
          <p className="asset-meta review-bundle-meta">自动接收依据</p>
          <ul className="risk-reason-list compact-risk-list review-auto-reason-list">
            {bundle.autoApprovalReasons.map((reason) => (
              <li key={`${bundle.id}:auto:${reason}`} className="risk-reason-item">{reason}</li>
            ))}
          </ul>
        </>
      ) : null}

      {bundle.riskReasons.length ? (
        <>
          <p className="asset-meta review-bundle-meta">风险原因</p>
          <ul className="risk-reason-list compact-risk-list">
            {bundle.riskReasons.map((reason) => (
              <li key={`${bundle.id}:${reason}`} className="risk-reason-item">{reason}</li>
            ))}
          </ul>
        </>
      ) : null}

      {bundle.latestEvidenceQuote ? <p className="evidence-quote">{bundle.latestEvidenceQuote}</p> : null}
      {bundle.sourceDocumentId || bundle.sourcePath ? (
        <div className="review-trace-link-row">
          <Link className="ghost-link" href={buildReviewTraceHref(workSlug, { sourceDocumentId: bundle.sourceDocumentId, sourcePath: bundle.sourcePath })}>
            {"\u67e5\u770b\u540c\u6e90\u53d8\u66f4"}
          </Link>
        </div>
      ) : null}
      {renderImpactSummary(bundle.impactSummary)}

      <form action={decideReviewBundleAction} className="review-action-form">
        <input type="hidden" name="workSlug" value={workSlug} />
        <input type="hidden" name="reviewIds" value={bundle.items.map((item) => item.id).join(",")} />
        <label className="field-block field-block-wide review-note-field">
          <span>处理备注</span>
          <input name="decisionNote" placeholder="可填写为什么通过或驳回，方便后续追踪。" />
        </label>
        <div className="review-action-row">
          <button type="submit" name="decision" value="approved">{approveLabel}</button>
          <button type="submit" name="decision" value="rejected" className="ghost-button">整包驳回</button>
        </div>
      </form>

      <details className="manual-details review-bundle-details">
        <summary>展开查看 {bundle.pendingItemCount} 条底层审查项</summary>
        <ul className="review-sublist">{bundle.items.map((review) => renderReviewItem(workSlug, review))}</ul>
      </details>
    </li>
  );
}

function renderLaneSection(
  workSlug: string,
  lane: "conflict" | "review" | "auto",
  bundles: WorkbenchReviewBundleSummary[],
) {
  const meta = laneSectionMetaMap[lane];

  return (
    <section className={`review-lane-section lane-${lane}`}>
      <div className="review-lane-section-head">
        <div>
          <p className="eyebrow guide-eyebrow">{actionLaneLabelMap[lane]}</p>
          <h3>{meta.title}</h3>
        </div>
        <span className="status-badge">{bundles.length}</span>
      </div>
      <p className="panel-copy lane-hint">{meta.copy}</p>
      {bundles.length ? (
        <ul className="review-list review-bundle-list review-lane-list">
          {bundles.map((bundle) => renderBundleCard(workSlug, bundle))}
        </ul>
      ) : (
        <div className="empty-state compact-state review-section-empty">
          <p>{meta.emptyText}</p>
        </div>
      )}
    </section>
  );
}

function renderAttentionChapterGroup(
  title: string,
  copy: string,
  chapters: WorkbenchAttentionChapterSummary[],
  emptyText: string,
) {
  return (
    <section className="attention-group-card">
      <div className="overview-head">
        <div>
          <h4>{title}</h4>
          <p className="asset-meta">{copy}</p>
        </div>
        <span className="status-badge">{chapters.length}</span>
      </div>
      {chapters.length ? (
        <ul className="compact-asset-list attention-chapter-list">
          {chapters.map((chapter) => (
            <li key={chapter.chapterId}>
              <strong>{chapter.label}</strong>
              <div className="stat-chip-row compact-chip-row">
                <span className="stat-chip">{chapter.followUpMode === "formal-review" ? "正式复核" : "提醒回看"}</span>
                <span className="stat-chip">{chapter.priority === "high" ? "高优先级" : "常规优先级"}</span>
              </div>
              <p className="asset-meta">
                {"触发变更包 " + chapter.triggerBundleCount}
                {" / 复核包 " + chapter.reviewBundleCount}
                {" / 冲突包 " + chapter.conflictBundleCount}
                {" / 来源文档 " + chapter.sourceDocumentCount}
              </p>
              <p className="asset-meta">{chapter.reasonSummary}</p>
              <p className="asset-meta">{chapter.recommendedAction}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state compact-state review-section-empty">
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  );
}

function renderAttentionChapterSection(attentionChapters: WorkbenchAttentionChapterSummary[]) {
  const formalReviewChapters = attentionChapters.filter((chapter) => chapter.followUpMode === "formal-review");
  const watchChapters = attentionChapters.filter((chapter) => chapter.followUpMode === "watch");

  return (
    <section className="review-attention-section">
      <div className="review-lane-section-head">
        <div>
          <p className="eyebrow guide-eyebrow">影响分析</p>
          <h3>后续章节动作分流</h3>
        </div>
        <span className="status-badge">{attentionChapters.length}</span>
      </div>
      <p className="panel-copy lane-hint">系统会把受当前变更包影响的后续章节分成两档：需要正式复核的，和只需提醒回看的。</p>
      <div className="stat-chip-row compact-chip-row">
        <span className="stat-chip">正式复核 {formalReviewChapters.length}</span>
        <span className="stat-chip">提醒回看 {watchChapters.length}</span>
      </div>
      <div className="attention-chapter-grid">
        {renderAttentionChapterGroup(
          "正式复核章节",
          "这些章节已经不只是提示，建议在处理完当前包后进入正式复核。",
          formalReviewChapters,
          "当前没有需要正式复核的后续章节。",
        )}
        {renderAttentionChapterGroup(
          "提醒回看章节",
          "这些章节先保留为回看提醒，处理完当前包后顺手检查即可。",
          watchChapters,
          "当前没有仅需提醒回看的后续章节。",
        )}
      </div>
    </section>
  );
}

export function WorkSyncPanel({
  workId,
  workSlug,
  fileSources,
  pendingReviewBundles,
  attentionChapters,
  activeTraceDocumentId,
  activeTracePath,
  reviewStats,
}: WorkSyncPanelProps) {
  const filteredReviewBundles = pendingReviewBundles.filter((bundle) => {
    if (activeTraceDocumentId && bundle.sourceDocumentId !== activeTraceDocumentId) return false;
    if (activeTracePath && bundle.sourcePath !== activeTracePath) return false;
    return true;
  });
  const conflictBundles = filteredReviewBundles.filter((bundle) => bundle.actionPlan.lane === "conflict");
  const reviewBundles = filteredReviewBundles.filter((bundle) => bundle.actionPlan.lane === "review");
  const autoBundles = filteredReviewBundles.filter((bundle) => bundle.actionPlan.lane === "auto");

  return (
    <>
      <article className="content-card">
        <div className="section-heading">
          <p>自动同步</p>
          <h2>目录源与扫描</h2>
        </div>
        <p className="panel-copy">
          这里负责把本地目录接进系统，并查看最近一次扫描结果。先保证目录绑定稳定，再处理待审查的变更包。
        </p>
        <div className="stat-chip-row">
          <span className="stat-chip">目录源 {fileSources.length}</span>
          <span className="stat-chip">变更包 {reviewStats.bundleCount}</span>
          <span className="stat-chip">自动接收 {reviewStats.autoApprovableBundleCount}</span>
          <span className="stat-chip">需要复核 {reviewStats.reviewBundleCount}</span>
          <span className="stat-chip">冲突 {reviewStats.conflictBundleCount}</span>
        </div>

        {fileSources.length ? (
          <div className="sync-source-stack">
            {fileSources.map((fileSource) => (
              <section className="sync-source-card" key={fileSource.id}>
                <div className="sync-source-head">
                  <strong>{fileSource.label}</strong>
                  <span className="status-badge">{fileSource.status}</span>
                </div>
                <div className="path-block">
                  {renderPathLine("根目录", fileSource.rootPath)}
                  {renderPathLine("章节目录", fileSource.chapterPath)}
                  {renderPathLine("大纲目录", fileSource.outlinePath)}
                  {renderPathLine("导出目录", fileSource.exportPath)}
                </div>
                <div className="stat-chip-row compact-chip-row">
                  <span className="stat-chip">文档 {fileSource.documentCount}</span>
                  <span className="stat-chip">待同步 {fileSource.pendingDocumentCount}</span>
                  <span className="stat-chip">待审查 {fileSource.reviewPendingCount}</span>
                  <span className="stat-chip">缺失 {fileSource.missingDocumentCount}</span>
                </div>
                <p className="asset-meta">
                  最近扫描：{fileSource.lastScannedAt ?? "尚未扫描"}
                  {fileSource.latestDocumentPath ? ` / 最新文件：${fileSource.latestDocumentPath}` : ""}
                </p>
                <form action={rescanWorkSourceAction} className="inline-action-form">
                  <input type="hidden" name="workSlug" value={workSlug} />
                  <input type="hidden" name="fileSourceId" value={fileSource.id} />
                  <button type="submit">重新扫描</button>
                </form>
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-state">
            <strong>当前还没有绑定本地目录。</strong>
            <p>先把作品绑定到本地小说目录，系统才能开始扫描、抽取、审查和自动维护。</p>
          </div>
        )}

        <details className="manual-details" open={!fileSources.length}>
          <summary>{fileSources.length ? "绑定新的目录源" : "先绑定一个本地目录"}</summary>
          <form action={bindWorkSourceAction} className="editor-form-grid compact-form-grid nested-form-grid">
            <input type="hidden" name="workId" value={workId} />
            <input type="hidden" name="workSlug" value={workSlug} />
            <label className="field-block">
              <span>目录源键</span>
              <input name="sourceKey" defaultValue="local-source" />
            </label>
            <label className="field-block">
              <span>显示名称</span>
              <input name="label" placeholder="例如：正文主目录" />
            </label>
            <label className="field-block field-block-wide">
              <span>根目录</span>
              <input name="rootPath" placeholder="例如：D:\小说\长夜取火" required />
            </label>
            <label className="field-block">
              <span>章节目录</span>
              <input name="chapterPath" placeholder="例如：02-正文" />
            </label>
            <label className="field-block">
              <span>大纲目录</span>
              <input name="outlinePath" placeholder="例如：01-大纲" />
            </label>
            <label className="field-block field-block-wide">
              <span>导出目录</span>
              <input name="exportPath" placeholder="例如：03-导出" />
            </label>
            <div className="form-action-row field-block-wide">
              <button type="submit">绑定目录并扫描</button>
            </div>
          </form>
        </details>
      </article>

      <article className="content-card">
        <div className="section-heading">
          <p>待处理</p>
          <h2>变更包</h2>
        </div>
        <p className="panel-copy">
          这里按“本次文件改动带来的变更包”来处理。系统会先自动清理低风险包，剩下的再分成“需要复核”和“存在冲突”两条线。
        </p>

        {renderTraceBanner(workSlug, activeTraceDocumentId, activeTracePath, filteredReviewBundles.length)}

        <div className="review-lane-overview">
          <section className="review-lane-card lane-auto">
            <strong>自动接收</strong>
            <span>{reviewStats.autoApprovableBundleCount}</span>
            <p className="review-lane-copy">低风险、无明显冲突，适合系统直接处理。</p>
          </section>
          <section className="review-lane-card lane-review">
            <strong>需要复核</strong>
            <span>{reviewStats.reviewBundleCount}</span>
            <p className="review-lane-copy">系统还不够确定，但通常看一遍证据就能决定。</p>
          </section>
          <section className="review-lane-card lane-conflict">
            <strong>冲突包</strong>
            <span>{reviewStats.conflictBundleCount}</span>
            <p className="review-lane-copy">会影响既有事实层，必须先澄清冲突来源。</p>
          </section>
        </div>

        <div className="stat-chip-row review-risk-chip-row">
          <span className="stat-chip">信息缺口 {reviewStats.informationGapBundleCount}</span>
          <span className="stat-chip">事实冲突 {reviewStats.factualConflictBundleCount}</span>
          <span className="stat-chip">格式阻塞 {reviewStats.formatBlockerBundleCount}</span>
          <span className="stat-chip">置信度复核 {reviewStats.confidenceReviewBundleCount}</span>
          <span className="stat-chip">正式复核章节 {reviewStats.formalReviewChapterCount}</span>
          <span className="stat-chip">提醒回看章节 {reviewStats.watchChapterCount}</span>
        </div>

        {reviewStats.autoApprovableBundleCount > 0 ? (
          <form action={autoRouteProjectReviewsAction} className="review-bulk-form">
            <input type="hidden" name="workId" value={workId} />
            <input type="hidden" name="workSlug" value={workSlug} />
            <input type="hidden" name="decisionNote" value="系统已自动分流当前待处理项，并自动通过低风险部分。" />
            <button type="submit">自动处理 {reviewStats.autoApprovableBundleCount} 个低风险变更包</button>
          </form>
        ) : null}

        {renderAttentionChapterSection(attentionChapters)}

        {filteredReviewBundles.length ? (
          <div className="review-lane-stack">
            {renderLaneSection(workSlug, "conflict", conflictBundles)}
            {renderLaneSection(workSlug, "review", reviewBundles)}
            {renderLaneSection(workSlug, "auto", autoBundles)}
          </div>
        ) : (
          <div className="empty-state compact-state review-section-empty">
            <strong>当前没有待处理的变更包。</strong>
            <p>你可以继续写作，或者重新扫描目录；系统会在发现新增和改动时自动生成新的变更包。</p>
          </div>
        )}
      </article>
    </>
  );
}