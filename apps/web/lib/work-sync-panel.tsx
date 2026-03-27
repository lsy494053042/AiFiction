import type {
  WorkbenchFileSourceSummary,
  WorkbenchImpactSummary,
  WorkbenchReviewBundleSummary,
  WorkbenchReviewItemSummary,
  WorkbenchReviewStats,
} from "@aifiction/data";

import {
  autoApproveLowRiskBundlesAction,
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
  reviewStats: WorkbenchReviewStats;
}

const reviewKindLabelMap: Record<string, string> = {
  "summary-validation": "摘要预览",
  "extraction-preview-validation": "抽取预览",
  "unsupported-source-format": "不支持的源文件",
};

const severityLabelMap: Record<string, string> = { low: "低", medium: "中", high: "高" };
const blockingLevelLabelMap: Record<string, string> = { none: "信息", review: "需要审查", conflict: "冲突" };
const riskCategoryLabelMap: Record<string, string> = {
  "summary-low-confidence": "摘要置信度不足",
  "extraction-low-confidence": "抽取置信度不足",
  "missing-character-candidates": "缺少角色候选",
  "missing-relationship-signal": "缺少关系信号",
  "missing-foreshadow-signal": "缺少伏笔信号",
  "missing-timeline-signal": "缺少时间线信号",
  "unsupported-source-format": "源文件格式不支持",
  "high-severity-review": "高风险",
};
const riskNatureLabelMap: Record<string, string> = {
  none: "无风险",
  "information-gap": "信息缺口",
  "confidence-review": "置信度复核",
  "format-blocker": "格式阻塞",
  "factual-conflict": "事实冲突",
};
const recommendedActionLabelMap: Record<string, string> = {
  "auto-approve": "自动通过",
  "review-summary-preview": "复核摘要预览",
  "review-extraction-preview": "复核抽取预览",
  "inspect-source-text": "检查原文",
  "import-supported-format": "导入支持格式",
  "retry-after-more-content": "补充更多内容后重试",
};

function formatReviewSignals(detailJson: Record<string, unknown>): string {
  const signals: string[] = [];
  const pairs: Array<[string, string]> = [
    ["characterCandidateCount", "角色"],
    ["relationshipCandidateCount", "关系"],
    ["foreshadowCandidateCount", "伏笔"],
    ["timelineCandidateCount", "时间线"],
  ];
  for (const [key, label] of pairs) {
    const value = detailJson[key];
    if (typeof value === "number" && value > 0) signals.push(`${label} ${value}`);
  }
  const reviewHints = detailJson.reviewHints;
  if (Array.isArray(reviewHints) && reviewHints.length) signals.push(`提示 ${reviewHints.length}`);
  return signals.join(" / ");
}

function formatBundleSignals(bundle: WorkbenchReviewBundleSummary): string {
  const signals: string[] = [];
  const pairs: Array<[number, string]> = [
    [bundle.characterCandidateCount, "角色"],
    [bundle.relationshipCandidateCount, "关系"],
    [bundle.foreshadowCandidateCount, "伏笔"],
    [bundle.timelineCandidateCount, "时间线"],
  ];
  for (const [value, label] of pairs) {
    if (value > 0) signals.push(`${label} ${value}`);
  }
  if (bundle.reviewHintCount > 0) signals.push(`提示 ${bundle.reviewHintCount}`);
  return signals.join(" / ");
}

function formatBundleKinds(bundle: WorkbenchReviewBundleSummary): string {
  return bundle.reviewKinds.map((item) => reviewKindLabelMap[item] ?? item).join(" / ");
}
function formatRiskCategories(bundle: WorkbenchReviewBundleSummary): string {
  return bundle.riskCategories.map((item) => riskCategoryLabelMap[item] ?? item).join(" / ");
}
function formatRecommendedActions(bundle: WorkbenchReviewBundleSummary): string {
  return bundle.recommendedActions.map((item) => recommendedActionLabelMap[item] ?? item).join(" / ");
}

function renderPathLine(label: string, value?: string) {
  if (!value) return null;
  return (
    <div className="path-line">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function renderImpactSummary(impactSummary?: WorkbenchImpactSummary) {
  if (!impactSummary) return null;
  return (
    <div className="review-impact-block">
      <p className="asset-meta review-bundle-meta">{impactSummary.summary}</p>
      <div className="stat-chip-row compact-chip-row">
        <span className="stat-chip">已有关联角色 {impactSummary.affectedCharacterCount}</span>
        <span className="stat-chip">新角色候选 {impactSummary.newCharacterCount}</span>
        <span className="stat-chip">关系影响 {impactSummary.affectedRelationshipCount}</span>
        <span className="stat-chip">伏笔影响 {impactSummary.affectedForeshadowCount}</span>
        <span className="stat-chip">后续章节 {impactSummary.downstreamChapterCount}</span>
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

function renderReviewItem(workSlug: string, review: WorkbenchReviewItemSummary) {
  const signals = formatReviewSignals(review.detailJson);
  return (
    <li key={review.id} className="review-subitem">
      <div className="review-head">
        <strong>{review.summary}</strong>
        <span className={`review-severity severity-${review.severity}`}>{severityLabelMap[review.severity] ?? review.severity}</span>
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
          <input name="decisionNote" placeholder="可选，给队列留一条备注。" />
        </label>
        <div className="review-action-row">
          <button type="submit" name="decision" value="approved">通过</button>
          <button type="submit" name="decision" value="rejected" className="ghost-button">驳回</button>
        </div>
      </form>
    </li>
  );
}

export function WorkSyncPanel({ workId, workSlug, fileSources, pendingReviewBundles, reviewStats }: WorkSyncPanelProps) {
  const autoApprovableBundles = pendingReviewBundles.filter((bundle) => bundle.isAutoApprovable);
  const autoApprovableReviewIds = autoApprovableBundles.flatMap((bundle) => bundle.items.map((item) => item.id));

  return (
    <>
      <article className="content-card">
        <div className="section-heading"><p>自动同步</p><h2>目录绑定</h2></div>
        <p className="panel-copy">把本地小说目录绑定到作品，文件变化后重新扫描，并在工作台里持续显示同步状态和待处理结果。</p>
        <div className="stat-chip-row">
          <span className="stat-chip">目录源 {fileSources.length}</span>
          <span className="stat-chip">变更包 {reviewStats.bundleCount}</span>
          <span className="stat-chip">可自动通过 {reviewStats.autoApprovableBundleCount}</span>
          <span className="stat-chip">高风险 {reviewStats.highSeverityCount}</span>
        </div>

        {fileSources.length ? (
          <div className="sync-source-stack">
            {fileSources.map((fileSource) => (
              <section className="sync-source-card" key={fileSource.id}>
                <div className="sync-source-head"><strong>{fileSource.label}</strong><span className="status-badge">{fileSource.status}</span></div>
                <div className="path-block">
                  {renderPathLine("根目录", fileSource.rootPath)}
                  {renderPathLine("正文", fileSource.chapterPath)}
                  {renderPathLine("大纲", fileSource.outlinePath)}
                  {renderPathLine("导出", fileSource.exportPath)}
                </div>
                <div className="stat-chip-row compact-chip-row">
                  <span className="stat-chip">文件 {fileSource.documentCount}</span>
                  <span className="stat-chip">待处理文档 {fileSource.pendingDocumentCount}</span>
                  <span className="stat-chip">待审文档 {fileSource.reviewPendingCount}</span>
                  <span className="stat-chip">缺失 {fileSource.missingDocumentCount}</span>
                </div>
                <p className="asset-meta">最近扫描 {fileSource.lastScannedAt ?? "从未"}{fileSource.latestDocumentPath ? ` / 最新 ${fileSource.latestDocumentPath}` : ""}</p>
                <form action={rescanWorkSourceAction} className="inline-action-form">
                  <input type="hidden" name="workSlug" value={workSlug} />
                  <input type="hidden" name="fileSourceId" value={fileSource.id} />
                  <button type="submit">重新扫描</button>
                </form>
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-state"><strong>当前还没有绑定本地目录。</strong><p>只有把作品和本地小说目录绑定后，自动同步才会开始工作。</p></div>
        )}

        <details className="manual-details" open={!fileSources.length}>
          <summary>{fileSources.length ? "绑定新的目录源" : "绑定第一个目录源"}</summary>
          <form action={bindWorkSourceAction} className="editor-form-grid compact-form-grid nested-form-grid">
            <input type="hidden" name="workId" value={workId} />
            <input type="hidden" name="workSlug" value={workSlug} />
            <label className="field-block"><span>目录源标识</span><input name="sourceKey" defaultValue="local-source" /></label>
            <label className="field-block"><span>显示名称</span><input name="label" placeholder="例如：主创作目录" /></label>
            <label className="field-block field-block-wide"><span>根目录</span><input name="rootPath" placeholder="例如：D:\\Novels\\WorkName" required /></label>
            <label className="field-block"><span>正文目录</span><input name="chapterPath" placeholder="例如：02-Chapters" /></label>
            <label className="field-block"><span>大纲目录</span><input name="outlinePath" placeholder="例如：01-Outline" /></label>
            <label className="field-block field-block-wide"><span>导出目录</span><input name="exportPath" placeholder="例如：03-Exports" /></label>
            <div className="form-action-row field-block-wide"><button type="submit">绑定目录</button></div>
          </form>
        </details>
      </article>

      <article className="content-card">
        <div className="section-heading"><p>待处理</p><h2>变更包</h2></div>
        <p className="panel-copy">待处理内容现在按源文件聚合。每个变更包会先展示风险和可能影响，再决定是否通过。</p>
        {autoApprovableReviewIds.length ? (
          <form action={autoApproveLowRiskBundlesAction} className="review-bulk-form">
            <input type="hidden" name="workSlug" value={workSlug} />
            <input type="hidden" name="reviewIds" value={autoApprovableReviewIds.join(",")} />
            <input type="hidden" name="decisionNote" value="系统自动通过低风险变更包。" />
            <button type="submit">自动通过 {autoApprovableBundles.length} 个低风险变更包</button>
          </form>
        ) : null}
        {pendingReviewBundles.length ? (
          <ul className="review-list review-bundle-list">
            {pendingReviewBundles.map((bundle) => {
              const bundleSignals = formatBundleSignals(bundle);
              return (
                <li key={bundle.id} className="review-bundle-card">
                  <div className="review-head review-bundle-head">
                    <div className="review-copy-block"><strong>{bundle.title}</strong><p className="asset-meta">{bundle.summary}</p></div>
                    <div className="review-bundle-side">
                      {bundle.isAutoApprovable ? <span className="status-badge">自动</span> : null}
                      {bundle.blockingLevel !== "none" ? <span className={`status-badge risk-badge risk-${bundle.blockingLevel}`}>{blockingLevelLabelMap[bundle.blockingLevel] ?? bundle.blockingLevel}</span> : null}
                      <span className={`review-severity severity-${bundle.severity}`}>{severityLabelMap[bundle.severity] ?? bundle.severity}</span>
                    </div>
                  </div>

                  <div className="stat-chip-row compact-chip-row">
                    <span className="stat-chip">条目 {bundle.pendingItemCount}</span>
                    <span className="stat-chip">低 {bundle.lowSeverityCount}</span>
                    <span className="stat-chip">中 {bundle.mediumSeverityCount}</span>
                    <span className="stat-chip">高 {bundle.highSeverityCount}</span>
                  </div>

                  <p className="asset-meta review-bundle-meta">{formatBundleKinds(bundle)}{bundle.documentKind ? ` / ${bundle.documentKind}` : ""}</p>
                  {bundleSignals ? <p className="review-signal">{bundleSignals}</p> : null}
                  <p className="asset-meta review-bundle-meta">{`性质 ${riskNatureLabelMap[bundle.riskNature] ?? bundle.riskNature}`}</p>
                  {bundle.riskCategories.length ? <p className="asset-meta review-bundle-meta">{formatRiskCategories(bundle)}</p> : null}
                  {bundle.recommendedActions.length ? <p className="asset-meta review-bundle-meta">{formatRecommendedActions(bundle)}</p> : null}
                  {bundle.isAutoApprovable && bundle.autoApprovalReasons.length ? <p className="asset-meta review-bundle-meta">{bundle.autoApprovalReasons.join(" / ")}</p> : null}
                  {bundle.sourceRefCount > 0 ? <p className="asset-meta review-bundle-meta">{`来源引用 ${bundle.sourceRefCount}`}{bundle.latestReferenceKind ? ` / ${bundle.latestReferenceKind}` : ""}</p> : null}
                  {bundle.riskReasons.length ? <ul className="risk-reason-list">{bundle.riskReasons.map((reason) => <li key={`${bundle.id}:${reason}`} className="risk-reason-item">{reason}</li>)}</ul> : null}
                  {bundle.latestEvidenceQuote ? <p className="evidence-quote">{bundle.latestEvidenceQuote}</p> : null}
                  {renderImpactSummary(bundle.impactSummary)}

                  <form action={decideReviewBundleAction} className="review-action-form">
                    <input type="hidden" name="workSlug" value={workSlug} />
                    <input type="hidden" name="reviewIds" value={bundle.items.map((item) => item.id).join(",")} />
                    <label className="field-block field-block-wide review-note-field"><span>处理备注</span><input name="decisionNote" placeholder="可选，给这个变更包留一条备注。" /></label>
                    <div className="review-action-row">
                      <button type="submit" name="decision" value="approved">整包通过</button>
                      <button type="submit" name="decision" value="rejected" className="ghost-button">整包驳回</button>
                    </div>
                  </form>

                  <details className="manual-details review-bundle-details">
                    <summary>查看 {bundle.pendingItemCount} 条原始项</summary>
                    <ul className="review-sublist">{bundle.items.map((review) => renderReviewItem(workSlug, review))}</ul>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-state compact-state"><strong>当前没有待处理变更包。</strong><p>当前目录源暂时不需要你做审查决策。</p></div>
        )}
      </article>
    </>
  );
}