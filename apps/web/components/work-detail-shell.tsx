import type { ReactNode } from "react";
import Link from "next/link";

import type {
  WorkbenchAttentionChapterSummary,
  WorkbenchProjectSnapshot,
  WorkbenchReviewBundleSummary,
  WorkbenchReviewStats,
} from "@aifiction/data";

import { RelationshipGraphPanel } from "./relationship-graph-panel";
import { WorkManualPanel } from "../lib/work-manual-panel";
import { updateFollowUpTaskAction } from "../lib/sync-actions";
import { WorkSyncPanel } from "../lib/work-sync-panel";

interface WorkDetailShellProps {
  snapshot: WorkbenchProjectSnapshot;
  activeView?: string;
  graphFocusCharacterId?: string;
  graphSourceType?: string;
  reviewTraceDocumentId?: string;
  reviewTracePath?: string;
}

type WorkDetailView = "overview" | "reviews" | "story" | "graph" | "manual";

const detailViewOrder: WorkDetailView[] = ["overview", "reviews", "story", "graph", "manual"];
const detailViewLabelMap: Record<WorkDetailView, string> = {
  overview: "\u603b\u89c8",
  reviews: "\u5f85\u5904\u7406",
  story: "\u5267\u60c5\u8d44\u4ea7",
  graph: "\u5173\u7cfb\u56fe\u8c31",
  manual: "\u9ad8\u7ea7\u7ef4\u62a4",
};
const detailViewCopyMap: Record<WorkDetailView, string> = {
  overview: "\u5148\u770b\u540c\u6b65\u72b6\u6001\u3001\u5f53\u524d\u8d44\u4ea7\u548c\u4e0b\u4e00\u6b65\u5efa\u8bae\uff0c\u518d\u51b3\u5b9a\u662f\u5426\u8fdb\u5165\u66f4\u6df1\u7684\u7ef4\u62a4\u9875\u9762\u3002",
  reviews: "\u8fd9\u91cc\u53ea\u5904\u7406\u4ecd\u7136\u9700\u8981\u4f60\u5224\u65ad\u7684\u53d8\u66f4\u5305\u3002\u4f4e\u98ce\u9669\u9879\u5e94\u8be5\u5c3d\u91cf\u6279\u91cf\u6e05\u6389\u3002",
  story: "\u67e5\u770b\u5f53\u524d\u5206\u5377\u3001\u7ae0\u8282\u3001\u89d2\u8272\u548c\u7ed3\u6784\u5316\u5267\u60c5\u8d44\u4ea7\uff0c\u786e\u8ba4\u5b83\u4eec\u4ecd\u7136\u8d34\u5408\u6b63\u6587\u3002",
  graph: "\u628a\u89d2\u8272\u7f51\u7edc\u3001\u5173\u7cfb\u4e8b\u5b9e\u548c\u6765\u6e90\u8bc1\u636e\u5355\u72ec\u62c9\u51fa\u6765\u770b\uff0c\u907f\u514d\u5b83\u4eec\u7ee7\u7eed\u6324\u5728\u957f\u9875\u9762\u91cc\u3002",
  manual: "\u624b\u5de5\u5165\u53e3\u53ea\u4f5c\u4e3a\u515c\u5e95\u3002\u53ea\u6709\u81ea\u52a8\u7ef4\u62a4\u660e\u663e\u4e0d\u5bf9\u65f6\uff0c\u624d\u5efa\u8bae\u8fdb\u5165\u8fd9\u91cc\u3002",
};
const blockingLevelLabelMap: Record<string, string> = {
  none: "信息提醒",
  review: "需要复核",
  conflict: "存在冲突",
};
const riskNatureLabelMap: Record<string, string> = {
  none: "无明显风险",
  "information-gap": "信息缺口",
  "confidence-review": "置信度复核",
  "format-blocker": "格式阻塞",
  "factual-conflict": "事实冲突",
};
const formalReviewOutcomeLabelMap: Record<string, string> = {
  consistent: "\u590d\u6838\u901a\u8fc7",
  "needs-revision": "\u9700\u8981\u4fee\u8ba2",
  "needs-rescan": "\u9700\u8981\u91cd\u8dd1\u62bd\u53d6",
  deferred: "\u672c\u8f6e\u8df3\u8fc7",
};

function normalizeDetailView(value?: string): WorkDetailView {
  if (value && detailViewOrder.includes(value as WorkDetailView)) {
    return value as WorkDetailView;
  }
  return "overview";
}

interface GraphViewFilters {
  focusCharacterId?: string;
  sourceType?: string;
}

function getViewHref(workSlug: string, view: WorkDetailView, graphFilters?: GraphViewFilters): string {
  const encodedSlug = encodeURIComponent(workSlug);
  const params = new URLSearchParams();

  if (view !== "overview") {
    params.set("view", view);
  }

  if (view === "graph") {
    if (graphFilters?.focusCharacterId) {
      params.set("focusCharacter", graphFilters.focusCharacterId);
    }

    if (graphFilters?.sourceType) {
      params.set("sourceType", graphFilters.sourceType);
    }
  }

  const query = params.toString();
  return query ? `/works/${encodedSlug}?${query}` : `/works/${encodedSlug}`;
}

function getFocusState(
  workSlug: string,
  fileSourceCount: number,
  reviewStats: WorkbenchReviewStats,
  formalReviewChapterCount: number,
) {
  if (reviewStats.conflictBundleCount > 0) {
    return {
      title: "先处理冲突包",
      description: `当前还有 ${reviewStats.conflictBundleCount} 个冲突包，它们会直接影响既有事实层，优先级最高。`,
      href: getViewHref(workSlug, "reviews"),
      cta: "打开冲突处理",
    };
  }

  if (reviewStats.reviewBundleCount > 0) {
    return {
      title: "先清理需要复核的变更包",
      description: `当前还有 ${reviewStats.reviewBundleCount} 个变更包需要你快速过一遍证据和预览。`,
      href: getViewHref(workSlug, "reviews"),
      cta: "打开待处理",
    };
  }

  if (reviewStats.autoApprovableBundleCount > 0) {
    return {
      title: "先清理可自动接收的低风险包",
      description: `当前有 ${reviewStats.autoApprovableBundleCount} 个低风险包可以交给系统自动处理。`,
      href: getViewHref(workSlug, "reviews"),
      cta: "处理低风险包",
    };
  }

  if (formalReviewChapterCount > 0) {
    return {
      title: "先处理正式复核章节",
      description: `当前还有 ${formalReviewChapterCount} 个后续章节被抬升为正式复核，建议在清理完当前包后优先回看这些章节的连续性。`,
      href: getViewHref(workSlug, "reviews"),
      cta: "打开正式复核章节",
    };
  }

  if (fileSourceCount > 0) {
    return {
      title: "检查剧情资产是否贴合当前正文",
      description: "目录已经绑定完成，下一步最有价值的是快速确认角色、关系、伏笔和时间线是否仍然合理。",
      href: getViewHref(workSlug, "story"),
      cta: "查看剧情资产",
    };
  }

  return {
    title: "先绑定本地目录",
    description: "只有把作品和本地小说目录绑定之后，系统才能开始同步、抽取、审查和自动维护。",
    href: getViewHref(workSlug, "reviews"),
    cta: "绑定目录",
  };
}

function renderAssetSection(title: string, eyebrow: string, count: number, items: Array<ReactNode>, emptyText: string) {
  return (
    <section className="overview-block">
      <div className="overview-head">
        <div>
          <p className="eyebrow guide-eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className="status-badge">{count}</span>
      </div>
      {items.length ? (
        <ul className="compact-asset-list">{items}</ul>
      ) : (
        <div className="empty-state compact-state">
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  );
}

function renderStoryOverview(snapshot: WorkbenchProjectSnapshot) {
  const volumePreview = snapshot.volumes.slice(0, 4);
  const characterPreview = snapshot.characters.slice(0, 5);
  const chapterPreview = [...snapshot.chapters].slice(-5).reverse();

  return (
    <article className="content-card">
      <div className="section-heading">
        <p>资产</p>
        <h2>结构化剧情快照</h2>
      </div>
      <p className="panel-copy">
        这里主要用于检查当前的结构化资产是否仍然贴合正文。默认先看，不建议把这里当成重手工录入后台。
      </p>
      <div className="overview-stack">
        {renderAssetSection(
          "分卷",
          "分卷",
          snapshot.volumes.length,
          volumePreview.map((volume) => (
            <li key={volume.id}>
              <strong>{`卷 ${volume.order} / ${volume.title}`}</strong>
              <p>{volume.goal}</p>
              <p className="asset-meta">主冲突：{volume.mainConflict}</p>
            </li>
          )),
          "当前还没有分卷资产。",
        )}
        {renderAssetSection(
          "角色",
          "角色",
          snapshot.characters.length,
          characterPreview.map((character) => (
            <li key={character.id}>
              <strong>{character.name}</strong>
              <p>{`${character.role} / ${character.archetype}`}</p>
              <p className="asset-meta">{character.publicIdentity}</p>
            </li>
          )),
          "当前还没有稳定的角色资产。",
        )}
        {renderAssetSection(
          "章节",
          "章节",
          snapshot.chapters.length,
          chapterPreview.map((chapter) => (
            <li key={chapter.id}>
              <strong>{`第 ${chapter.order} 章 / ${chapter.title}`}</strong>
              <p>{chapter.summary}</p>
              <p className="asset-meta">章节目标：{chapter.chapterGoal}</p>
            </li>
          )),
          "当前还没有章节卡。",
        )}
      </div>
    </article>
  );
}

function renderRelationPreview(snapshot: WorkbenchProjectSnapshot) {
  const relationPreview = snapshot.graph.edges.slice(0, 8);

  return (
    <article className="content-card">
      <div className="section-heading">
        <p>关系</p>
        <h2>关系预览</h2>
      </div>
      <p className="panel-copy">关系图谱完整落地前，这里先用于查看当前关系事实和最近证据。</p>
      <ul className="asset-list relation-preview-list">
        {relationPreview.length ? relationPreview.map((edge) => (
          <li key={`${edge.sourceCharacterId}:${edge.targetCharacterId}:${edge.publicLabel}`}>
            <strong>{edge.sourceCharacterName} -&gt; {edge.targetCharacterName}</strong>
            <p>{edge.publicLabel}{edge.privateLabel ? ` / ${edge.privateLabel}` : ""}</p>
            <p className="asset-meta">{`信任 ${edge.trustLevel} / 紧张 ${edge.tensionLevel}`}</p>
            {edge.latestSourcePath ? (
              <p className="asset-meta relation-source-meta">
                {`来源 ${edge.latestSourcePath}`}
                {edge.sourceRefCount > 1 ? ` / 引用 ${edge.sourceRefCount}` : ""}
              </p>
            ) : null}
            {edge.latestEvidenceQuote ? <p className="evidence-quote">{edge.latestEvidenceQuote}</p> : null}
          </li>
        )) : <li className="empty-inline">当前还没有结构化关系事实。</li>}
      </ul>
    </article>
  );
}

function renderRiskBundle(bundle: WorkbenchReviewBundleSummary) {
  return (
    <li key={bundle.id}>
      <strong>{bundle.title}</strong>
      <p>{bundle.summary}</p>
      <p className="asset-meta">
        {`风险 ${blockingLevelLabelMap[bundle.blockingLevel] ?? bundle.blockingLevel}`}
        {` / 性质 ${riskNatureLabelMap[bundle.riskNature] ?? bundle.riskNature}`}
        {` / 中风险 ${bundle.mediumSeverityCount}`}
        {` / 高风险 ${bundle.highSeverityCount}`}
        {bundle.sourceRefCount > 0 ? ` / 引用 ${bundle.sourceRefCount}` : ""}
      </p>
      <p className="asset-meta">{bundle.actionPlan.primaryAction}</p>
      {bundle.actionPlan.steps.length ? (
        <ul className="risk-reason-list compact-risk-list">
          {bundle.actionPlan.steps.slice(0, 3).map((step) => (
            <li key={`${bundle.id}:plan:${step}`} className="risk-reason-item">{step}</li>
          ))}
        </ul>
      ) : null}
      {bundle.riskReasons.length ? (
        <ul className="risk-reason-list compact-risk-list">
          {bundle.riskReasons.map((reason) => (
            <li key={`${bundle.id}:${reason}`} className="risk-reason-item">{reason}</li>
          ))}
        </ul>
      ) : null}
      {bundle.latestEvidenceQuote ? <p className="evidence-quote">{bundle.latestEvidenceQuote}</p> : null}
    </li>
  );
}

function renderAttentionChapterGroup(
  title: string,
  chapters: WorkbenchAttentionChapterSummary[],
  emptyText: string,
) {
  return (
    <section className="attention-group-card">
      <div className="overview-head">
        <h4>{title}</h4>
        <span className="status-badge">{chapters.length}</span>
      </div>
      {chapters.length ? (
        <ul className="asset-list trace-list">
          {chapters.map((chapter) => (
            <li key={chapter.chapterId}>
              <strong>{chapter.label}</strong>
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
        <div className="empty-state compact-state">
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  );
}

function renderAttentionChapters(attentionChapters: WorkbenchAttentionChapterSummary[]) {
  const formalReviewChapters = attentionChapters.filter((chapter) => chapter.followUpMode === "formal-review");
  const watchChapters = attentionChapters.filter((chapter) => chapter.followUpMode === "watch");

  return (
    <section className="trace-section">
      <div className="overview-head">
        <h3>后续章节动作分流</h3>
        <span className="status-badge">{attentionChapters.length}</span>
      </div>
      <div className="stat-chip-row compact-chip-row">
        <span className="stat-chip">正式复核 {formalReviewChapters.length}</span>
        <span className="stat-chip">提醒回看 {watchChapters.length}</span>
      </div>
      <div className="attention-chapter-grid">
        {renderAttentionChapterGroup("正式复核章节", formalReviewChapters, "当前没有需要正式复核的后续章节。")}
        {renderAttentionChapterGroup("提醒回看章节", watchChapters, "当前没有仅需提醒回看的后续章节。")}
      </div>
    </section>
  );
}

function renderFormalReviewQueue(
  workId: string,
  workSlug: string,
  currentView: WorkDetailView,
  followUpQueue: WorkbenchProjectSnapshot["followUpQueue"],
) {
  const tasks = followUpQueue.formalReviewTasks;
  const recentResolvedTasks = followUpQueue.recentResolvedTasks;

  return (
    <article className="content-card">
      <div className="section-heading">
        <p>{"\u540e\u7eed\u5904\u7406"}</p>
        <h2>{"\u6b63\u5f0f\u590d\u6838\u961f\u5217"}</h2>
      </div>
      <p className="panel-copy">{"\u8fd9\u91cc\u53ea\u4fdd\u7559\u88ab\u7cfb\u7edf\u62ac\u5347\u4e3a\u6b63\u5f0f\u590d\u6838\u7684\u540e\u7eed\u7ae0\u8282\u4efb\u52a1\u3002\u4efb\u52a1\u5904\u7406\u5b8c\u540e\uff0c\u4f1a\u4fdd\u7559\u7ed3\u679c\u548c\u5904\u7406\u6458\u8981\uff0c\u65b9\u4fbf\u540e\u7eed\u56de\u770b\u3002"}</p>
      <div className="stat-chip-row compact-chip-row">
        <span className="stat-chip">{"\u6b63\u5f0f\u590d\u6838"} {tasks.length}</span>
        <span className="stat-chip">{"\u6700\u8fd1\u5df2\u5904\u7406"} {recentResolvedTasks.length}</span>
        {followUpQueue.highestPriorityTask ? <span className="stat-chip">{"\u6700\u9ad8\u4f18\u5148\u7ea7"} {followUpQueue.highestPriorityTask.label}</span> : null}
      </div>
      {tasks.length ? (
        <ul className="compact-asset-list attention-chapter-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.label}</strong>
              <div className="stat-chip-row compact-chip-row">
                <span className="stat-chip">{task.priority === "high" ? "\u9ad8\u4f18\u5148\u7ea7" : "\u5e38\u89c4\u4f18\u5148\u7ea7"}</span>
                <span className="stat-chip">{"\u7ae0\u8282\u7ea7\u6b63\u5f0f\u590d\u6838"}</span>
              </div>
              <p className="asset-meta">{task.summary}</p>
              <p className="asset-meta">{task.nextAction}</p>
              <form action={updateFollowUpTaskAction} className="review-action-form follow-up-task-form">
                <input type="hidden" name="workSlug" value={workSlug} />
                <input type="hidden" name="workId" value={workId} />
                <input type="hidden" name="chapterId" value={task.chapterId} />
                <input type="hidden" name="taskKind" value={task.taskKind} />
                <input type="hidden" name="taskFingerprint" value={task.taskFingerprint} />
                <input type="hidden" name="returnView" value={currentView} />
                <label className="field-block field-block-wide review-note-field">
                  <span>{"\u5904\u7406\u7ed3\u679c\u6458\u8981"}</span>
                  <input name="outcomeSummary" placeholder={"\u4f8b\u5982\uff1a\u4eba\u7269\u52a8\u673a\u6210\u7acb\uff0c\u4e0d\u9700\u8981\u989d\u5916\u8c03\u6574\u3002"} />
                </label>
                <label className="field-block field-block-wide review-note-field">
                  <span>{"\u5904\u7406\u5907\u6ce8"}</span>
                  <input name="decisionNote" placeholder={"\u8865\u5145\u8bf4\u660e\uff0c\u65b9\u4fbf\u540e\u7eed\u56de\u770b\u3002"} />
                </label>
                <div className="review-action-row follow-up-action-row">
                  <button type="submit" name="taskResult" value="completed:consistent">{"\u590d\u6838\u901a\u8fc7"}</button>
                  <button type="submit" name="taskResult" value="completed:needs-revision" className="ghost-button">{"\u6807\u8bb0\u9700\u4fee\u8ba2"}</button>
                  <button type="submit" name="taskResult" value="completed:needs-rescan" className="ghost-button">{"\u6807\u8bb0\u91cd\u8dd1\u62bd\u53d6"}</button>
                  <button type="submit" name="taskResult" value="dismissed:deferred" className="ghost-button">{"\u672c\u8f6e\u8df3\u8fc7"}</button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state compact-state">
          <p>{"\u5f53\u524d\u6ca1\u6709\u88ab\u62ac\u5347\u4e3a\u6b63\u5f0f\u590d\u6838\u7684\u540e\u7eed\u7ae0\u8282\u3002"}</p>
        </div>
      )}
      {recentResolvedTasks.length ? (
        <section className="follow-up-history-section">
          <div className="overview-head">
            <h3>{"\u6700\u8fd1\u5904\u7406\u7ed3\u679c"}</h3>
            <span className="status-badge">{recentResolvedTasks.length}</span>
          </div>
          <ul className="compact-asset-list follow-up-history-list">
            {recentResolvedTasks.map((task) => (
              <li key={task.id + ":resolved"}>
                <strong>{task.label}</strong>
                <div className="stat-chip-row compact-chip-row">
                  <span className="stat-chip">{formalReviewOutcomeLabelMap[task.taskOutcome ?? "deferred"] ?? task.taskOutcome ?? "\u672c\u8f6e\u8df3\u8fc7"}</span>
                  <span className="stat-chip">{task.taskStatus === "completed" ? "\u5df2\u5b8c\u6210" : "\u5df2\u8df3\u8fc7"}</span>
                </div>
                <p className="asset-meta">{task.outcomeSummary ?? task.decisionNote ?? task.nextAction}</p>
                {task.decidedAt ? <p className="asset-meta">{"\u5904\u7406\u65f6\u95f4\uff1a"}{task.decidedAt}</p> : null}
                <form action={updateFollowUpTaskAction} className="inline-action-form">
                  <input type="hidden" name="workSlug" value={workSlug} />
                  <input type="hidden" name="workId" value={workId} />
                  <input type="hidden" name="chapterId" value={task.chapterId} />
                  <input type="hidden" name="taskKind" value={task.taskKind} />
                  <input type="hidden" name="taskFingerprint" value={task.taskFingerprint} />
                  <input type="hidden" name="returnView" value={currentView} />
                  <button type="submit" name="taskResult" value="pending">{"\u91cd\u65b0\u6253\u5f00"}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
function renderSourceTracePanel(
  workSlug: string,
  recentSourceRefs: WorkbenchProjectSnapshot["recentSourceRefs"],
  pendingConflictBundles: WorkbenchProjectSnapshot["pendingConflictBundles"],
  attentionChapters: WorkbenchAttentionChapterSummary[],
) {
  return (
    <article className="content-card">
      <div className="section-heading">
        <p>追踪</p>
        <h2>来源与冲突追踪</h2>
      </div>
      <div className="trace-stack">
        {renderAttentionChapters(attentionChapters)}
        <section className="trace-section">
          <div className="overview-head">
            <h3>需要优先关注的冲突包</h3>
            <Link className="ghost-link" href={`/works/${encodeURIComponent(workSlug)}?view=reviews`}>
              打开待处理
            </Link>
          </div>
          <ul className="asset-list trace-list">
            {pendingConflictBundles.length ? pendingConflictBundles.map((bundle) => renderRiskBundle(bundle)) : (
              <li className="empty-inline">当前没有需要优先处理的冲突包。</li>
            )}
          </ul>
        </section>
        <section className="trace-section">
          <div className="overview-head">
            <h3>最近来源引用</h3>
            <span className="status-badge">{recentSourceRefs.length}</span>
          </div>
          <ul className="asset-list trace-list">
            {recentSourceRefs.length ? recentSourceRefs.map((sourceRef) => (
              <li key={sourceRef.id}>
                <strong>{sourceRef.assetType}</strong>
                <p className="asset-meta">
                  {sourceRef.sourcePath ?? sourceRef.locator}
                  {sourceRef.documentKind ? ` / ${sourceRef.documentKind}` : ""}
                  {sourceRef.referenceKind ? ` / ${sourceRef.referenceKind}` : ""}
                </p>
                {sourceRef.evidenceQuote ? <p className="evidence-quote">{sourceRef.evidenceQuote}</p> : null}
              </li>
            )) : <li className="empty-inline">当前还没有来源引用。</li>}
          </ul>
        </section>
      </div>
    </article>
  );
}

function renderDetailView(currentView: WorkDetailView, snapshot: WorkbenchProjectSnapshot, graphFilters: GraphViewFilters, reviewTraceFilters: { documentId?: string; path?: string }) {
  const { work, fileSources, pendingReviewBundles, pendingConflictBundles, recentSourceRefs, attentionChapters, reviewStats, followUpQueue } = snapshot;
  const formalReviewChapterCount = followUpQueue.formalReviewTasks.length;
  const focusState = getFocusState(work.slug, fileSources.length, reviewStats, formalReviewChapterCount);

  if (currentView === "overview") {
    return (
      <section className="detail-view-grid">
        <div className="detail-stack">
          <article className="content-card detail-summary-card">
            <div className="section-heading">
              <p>焦点</p>
              <h2>当前最该处理什么</h2>
            </div>
            <p className="panel-copy">{focusState.description}</p>
            <div className="detail-summary-list">
              <div className="detail-summary-item">
                <span className="detail-summary-key">变更包</span>
                <strong className="detail-summary-value">{reviewStats.bundleCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">需要复核</span>
                <strong className="detail-summary-value">{reviewStats.reviewBundleCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">冲突包</span>
                <strong className="detail-summary-value">{reviewStats.conflictBundleCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">正式复核章节</span>
                <strong className="detail-summary-value">{reviewStats.formalReviewChapterCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">提醒回看章节</span>
                <strong className="detail-summary-value">{reviewStats.watchChapterCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">自动接收</span>
                <strong className="detail-summary-value">{reviewStats.autoApprovableBundleCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">下一步</span>
                <Link className="detail-primary-link" href={focusState.href}>{focusState.cta}</Link>
              </div>
            </div>
          </article>
        </div>
        <div className="detail-stack">
          {renderFormalReviewQueue(work.id, work.slug, currentView, followUpQueue)}
          {renderStoryOverview(snapshot)}
          {renderRelationPreview(snapshot)}
          {renderSourceTracePanel(work.slug, recentSourceRefs, pendingConflictBundles, attentionChapters)}
        </div>
      </section>
    );
  }

  if (currentView === "reviews") {
    return (
      <section className="detail-view-grid detail-view-grid-single">
        <WorkSyncPanel
          workId={work.id}
          workSlug={work.slug}
          fileSources={fileSources}
          pendingReviewBundles={pendingReviewBundles}
          attentionChapters={attentionChapters}
          activeTraceDocumentId={reviewTraceFilters.documentId}
          activeTracePath={reviewTraceFilters.path}
          reviewStats={reviewStats}
        />
      </section>
    );
  }

  if (currentView === "story") {
    return (
      <section className="detail-view-grid">
        <div className="detail-stack">{renderStoryOverview(snapshot)}</div>
        <div className="detail-stack">
          {renderFormalReviewQueue(work.id, work.slug, currentView, followUpQueue)}
          {renderRelationPreview(snapshot)}
          {renderSourceTracePanel(work.slug, recentSourceRefs, pendingConflictBundles, attentionChapters)}
        </div>
      </section>
    );
  }

  if (currentView === "graph") {
    return (
      <RelationshipGraphPanel
        snapshot={snapshot}
        workSlug={work.slug}
        activeCharacterId={graphFilters.focusCharacterId}
        activeSourceType={graphFilters.sourceType}
      />
    );
  }

  return (
    <section className="detail-view-grid">
      <div className="detail-stack"><WorkManualPanel snapshot={snapshot} /></div>
      <div className="detail-stack">{renderStoryOverview(snapshot)}</div>
    </section>
  );
}

export function WorkDetailShell({ snapshot, activeView, graphFocusCharacterId, graphSourceType, reviewTraceDocumentId, reviewTracePath }: WorkDetailShellProps) {
  const { work, stats, fileSources, reviewStats, attentionChapters, followUpQueue } = snapshot;
  const currentView = normalizeDetailView(activeView);
  const graphViewFilters: GraphViewFilters = {
    focusCharacterId: graphFocusCharacterId || undefined,
    sourceType: graphSourceType || undefined,
  };
  const formalReviewChapterCount = followUpQueue.formalReviewTasks.length;
  const focusState = getFocusState(work.slug, fileSources.length, reviewStats, formalReviewChapterCount);

  return (
    <main className="page-shell detail-shell">
      <section className="hero-panel detail-hero">
        <div className="hero-actions">
          <Link className="ghost-link" href="/">返回书架</Link>
        </div>
        <div className="detail-hero-grid">
          <div className="detail-hero-copy-block">
            <p className="eyebrow">作品详情</p>
            <h1>{work.title}</h1>
            <p className="hero-copy">{detailViewCopyMap[currentView]}</p>
          </div>
          <article className="detail-focus-card">
            <p className="eyebrow">下一步</p>
            <h2>{focusState.title}</h2>
            <p>{focusState.description}</p>
            <Link className="detail-primary-link" href={focusState.href}>{focusState.cta}</Link>
          </article>
        </div>
        <div className="detail-stat-grid">
          <article className="detail-stat-card"><span>目录源</span><strong>{stats.sourceCount}</strong></article>
          <article className="detail-stat-card"><span>变更包</span><strong>{reviewStats.bundleCount}</strong></article>
          <article className="detail-stat-card"><span>需要复核</span><strong>{reviewStats.reviewBundleCount}</strong></article>
          <article className="detail-stat-card"><span>冲突包</span><strong>{reviewStats.conflictBundleCount}</strong></article>
          <article className="detail-stat-card"><span>正式复核章节</span><strong>{reviewStats.formalReviewChapterCount}</strong></article>
          <article className="detail-stat-card"><span>提醒回看章节</span><strong>{reviewStats.watchChapterCount}</strong></article>
          <article className="detail-stat-card"><span>自动接收</span><strong>{reviewStats.autoApprovableBundleCount}</strong></article>
        </div>
      </section>

      <nav className="detail-nav" aria-label="作品详情导航">
        {detailViewOrder.map((view) => {
          const isActive = view === currentView;
          return (
            <Link
              key={view}
              className={isActive ? "detail-nav-link is-active" : "detail-nav-link"}
              href={getViewHref(work.slug, view, view === "graph" ? graphViewFilters : undefined)}
            >
              <span>{detailViewLabelMap[view]}</span>
              {view === "reviews" && reviewStats.bundleCount > 0 ? (
                <span className="detail-nav-badge">{reviewStats.bundleCount}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {renderDetailView(currentView, snapshot, graphViewFilters, { documentId: reviewTraceDocumentId, path: reviewTracePath })}
    </main>
  );
}