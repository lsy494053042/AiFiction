import type {
  WorkbenchFileSourceSummary,
  WorkbenchReviewItemSummary,
  WorkbenchReviewStats,
} from "@aifiction/data";

import { bindWorkSourceAction, decideReviewAction, rescanWorkSourceAction } from "./sync-actions";

interface WorkSyncPanelProps {
  workId: string;
  workSlug: string;
  fileSources: WorkbenchFileSourceSummary[];
  pendingReviews: WorkbenchReviewItemSummary[];
  reviewStats: WorkbenchReviewStats;
}

const reviewKindLabelMap: Record<string, string> = {
  "summary-validation": "摘要审查",
  "extraction-preview-validation": "抽取审查",
  "unsupported-source-format": "格式审查",
};

const severityLabelMap: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

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
    signals.push(`提示 ${reviewHints.length}`);
  }

  return signals.join(" / ");
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

/**
 * 自动同步面板。
 * 这里把目录绑定、重扫入口和待审查摘要放在一起，页面重心会更接近“查看与判断”。
 */
export function WorkSyncPanel({
  workId,
  workSlug,
  fileSources,
  pendingReviews,
  reviewStats,
}: WorkSyncPanelProps) {
  return (
    <>
      <article className="content-card">
        <div className="section-heading">
          <p>Auto Sync</p>
          <h2>本地目录与自动维护</h2>
        </div>
        <p className="panel-copy">
          正文仍然以本地目录为真相源。工作台负责扫描、抽取、生成待审查项，你主要做判断和修正。
        </p>
        <div className="stat-chip-row">
          <span className="stat-chip">目录源 {fileSources.length}</span>
          <span className="stat-chip">待审查 {reviewStats.pendingCount}</span>
          <span className="stat-chip">中风险 {reviewStats.mediumSeverityCount}</span>
          <span className="stat-chip">高风险 {reviewStats.highSeverityCount}</span>
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
                  {renderPathLine("root", fileSource.rootPath)}
                  {renderPathLine("chapters", fileSource.chapterPath)}
                  {renderPathLine("outline", fileSource.outlinePath)}
                  {renderPathLine("export", fileSource.exportPath)}
                </div>
                <div className="stat-chip-row compact-chip-row">
                  <span className="stat-chip">文档 {fileSource.documentCount}</span>
                  <span className="stat-chip">待复核文件 {fileSource.pendingDocumentCount}</span>
                  <span className="stat-chip">待审查项 {fileSource.reviewPendingCount}</span>
                  <span className="stat-chip">缺失 {fileSource.missingDocumentCount}</span>
                </div>
                <p className="asset-meta">
                  最近扫描：{fileSource.lastScannedAt ?? "尚未扫描"}
                  {fileSource.latestDocumentPath ? ` · 最新文件 ${fileSource.latestDocumentPath}` : ""}
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
            <p>先把作品正文目录绑进来，后面的摘要、抽取和待审查队列才会开始自动增长。</p>
          </div>
        )}

        <details className="manual-details" open={!fileSources.length}>
          <summary>{fileSources.length ? "新增或更新目录绑定" : "绑定第一组本地目录"}</summary>
          <form action={bindWorkSourceAction} className="editor-form-grid compact-form-grid nested-form-grid">
            <input type="hidden" name="workId" value={workId} />
            <input type="hidden" name="workSlug" value={workSlug} />
            <label className="field-block">
              <span>目录标识</span>
              <input name="sourceKey" defaultValue="local-source" />
            </label>
            <label className="field-block">
              <span>显示名称</span>
              <input name="label" placeholder="例如：本地正文目录" />
            </label>
            <label className="field-block field-block-wide">
              <span>作品根目录</span>
              <input name="rootPath" placeholder="例如：F:\\Novels\\长夜取火" required />
            </label>
            <label className="field-block">
              <span>正文子目录</span>
              <input name="chapterPath" placeholder="例如：02-正文" />
            </label>
            <label className="field-block">
              <span>大纲子目录</span>
              <input name="outlinePath" placeholder="例如：01-大纲" />
            </label>
            <label className="field-block field-block-wide">
              <span>导出子目录</span>
              <input name="exportPath" placeholder="例如：03-导出" />
            </label>
            <div className="form-action-row field-block-wide">
              <button type="submit">绑定并扫描</button>
            </div>
          </form>
        </details>
      </article>

      <article className="content-card">
        <div className="section-heading">
          <p>Review Queue</p>
          <h2>自动维护待审查</h2>
        </div>
        {pendingReviews.length ? (
          <ul className="review-list">
            {pendingReviews.map((review) => {
              const signals = formatReviewSignals(review.detailJson);
              return (
                <li key={review.id}>
                  <div className="review-head">
                    <strong>{review.summary}</strong>
                    <span className={`review-severity severity-${review.severity}`}>
                      {severityLabelMap[review.severity] ?? review.severity}
                    </span>
                  </div>
                  <p className="asset-meta">
                    {reviewKindLabelMap[review.reviewKind] ?? review.reviewKind}
                    {review.sourcePath ? ` · ${review.sourcePath}` : ""}
                    {review.documentKind ? ` · ${review.documentKind}` : ""}
                  </p>
                  {signals ? <p className="review-signal">{signals}</p> : null}
                  <form action={decideReviewAction} className="review-action-form">
                    <input type="hidden" name="workSlug" value={workSlug} />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <label className="field-block field-block-wide review-note-field">
                      <span>审查备注</span>
                      <input name="decisionNote" placeholder="可选，记录原因或人工判断" />
                    </label>
                    <div className="review-action-row">
                      <button type="submit" name="decision" value="approved">
                        通过
                      </button>
                      <button type="submit" name="decision" value="rejected" className="ghost-button">
                        驳回
                      </button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-state compact-state">
            <strong>当前还没有待审查项。</strong>
            <p>绑定目录并完成扫描后，这里会优先显示摘要预览和抽取候选的待确认结果。</p>
          </div>
        )}
      </article>
    </>
  );
}