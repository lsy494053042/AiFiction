import type { ReactNode } from "react";
import Link from "next/link";

import type { WorkbenchProjectSnapshot, WorkbenchReviewBundleSummary } from "@aifiction/data";

import { WorkManualPanel } from "../lib/work-manual-panel";
import { WorkSyncPanel } from "../lib/work-sync-panel";

interface WorkDetailShellProps {
  snapshot: WorkbenchProjectSnapshot;
  activeView?: string;
}

type WorkDetailView = "overview" | "reviews" | "story" | "manual";

const detailViewOrder: WorkDetailView[] = ["overview", "reviews", "story", "manual"];
const detailViewLabelMap: Record<WorkDetailView, string> = {
  overview: "总览",
  reviews: "待处理",
  story: "剧情资产",
  manual: "高级维护",
};
const detailViewCopyMap: Record<WorkDetailView, string> = {
  overview: "先看同步状态、当前资产和下一步建议，再决定是否需要进入手工维护。",
  reviews: "这里只处理仍然需要决策的变更。低风险项应尽量批量清掉。",
  story: "查看当前分卷、章节、角色、关系事实，以及最近的来源引用。",
  manual: "手工操作只作为兜底。只有自动维护明显不对时再进入这里。",
};
const blockingLevelLabelMap: Record<string, string> = { none: "信息", review: "需要审查", conflict: "冲突" };
const riskNatureLabelMap: Record<string, string> = {
  none: "无风险",
  "information-gap": "信息缺口",
  "confidence-review": "置信度复核",
  "format-blocker": "格式阻塞",
  "factual-conflict": "事实冲突",
};

function normalizeDetailView(value?: string): WorkDetailView {
  if (value && detailViewOrder.includes(value as WorkDetailView)) return value as WorkDetailView;
  return "overview";
}

function getViewHref(workSlug: string, view: WorkDetailView): string {
  const encodedSlug = encodeURIComponent(workSlug);
  return view === "overview" ? `/works/${encodedSlug}` : `/works/${encodedSlug}?view=${view}`;
}

function getFocusState(workSlug: string, fileSourceCount: number, pendingReviewCount: number) {
  if (pendingReviewCount > 0) {
    return {
      title: "先清理待处理变更包",
      description: `当前还有 ${pendingReviewCount} 条待处理审查项，先处理完再动手维护资产。`,
      href: getViewHref(workSlug, "reviews"),
      cta: "打开待处理",
    };
  }
  if (fileSourceCount > 0) {
    return {
      title: "检查剧情资产",
      description: "本地目录已经绑定，下一步最有价值的是确认结构化资产是否仍然贴合剧情。",
      href: getViewHref(workSlug, "story"),
      cta: "查看剧情资产",
    };
  }
  return {
    title: "先绑定本地目录",
    description: "只有把作品和本地小说目录绑定后，自动同步才能开始工作。",
    href: getViewHref(workSlug, "reviews"),
    cta: "绑定目录",
  };
}

function renderAssetSection(title: string, eyebrow: string, count: number, items: Array<ReactNode>, emptyText: string) {
  return (
    <section className="overview-block">
      <div className="overview-head">
        <div><p className="eyebrow guide-eyebrow">{eyebrow}</p><h3>{title}</h3></div>
        <span className="status-badge">{count}</span>
      </div>
      {items.length ? <ul className="compact-asset-list">{items}</ul> : <div className="empty-state compact-state"><p>{emptyText}</p></div>}
    </section>
  );
}

function renderStoryOverview(snapshot: WorkbenchProjectSnapshot) {
  const volumePreview = snapshot.volumes.slice(0, 4);
  const characterPreview = snapshot.characters.slice(0, 5);
  const chapterPreview = [...snapshot.chapters].slice(-5).reverse();

  return (
    <article className="content-card">
      <div className="section-heading"><p>资产</p><h2>结构化剧情快照</h2></div>
      <p className="panel-copy">这里主要用于检查当前结构化资产是否仍然合理。只有自动维护明显出错时，才建议手动修改。</p>
      <div className="overview-stack">
        {renderAssetSection(
          "分卷",
          "分卷",
          snapshot.volumes.length,
          volumePreview.map((volume) => (
            <li key={volume.id}><strong>{`卷 ${volume.order} · ${volume.title}`}</strong><p>{volume.goal}</p><p className="asset-meta">主冲突：{volume.mainConflict}</p></li>
          )),
          "当前还没有分卷资产。",
        )}
        {renderAssetSection(
          "角色",
          "角色",
          snapshot.characters.length,
          characterPreview.map((character) => (
            <li key={character.id}><strong>{character.name}</strong><p>{`${character.role} / ${character.archetype}`}</p><p className="asset-meta">{character.publicIdentity}</p></li>
          )),
          "当前还没有稳定的角色资产。",
        )}
        {renderAssetSection(
          "章节",
          "章节",
          snapshot.chapters.length,
          chapterPreview.map((chapter) => (
            <li key={chapter.id}><strong>{`章 ${chapter.order} · ${chapter.title}`}</strong><p>{chapter.summary}</p><p className="asset-meta">目标：{chapter.chapterGoal}</p></li>
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
      <div className="section-heading"><p>关系</p><h2>关系预览</h2></div>
      <p className="panel-copy">在完整关系图谱落地前，这里先用来查看当前关系事实和最近证据。</p>
      <ul className="asset-list relation-preview-list">
        {relationPreview.length ? relationPreview.map((edge) => (
          <li key={`${edge.sourceCharacterId}:${edge.targetCharacterId}:${edge.publicLabel}`}>
            <strong>{edge.sourceCharacterName} -&gt; {edge.targetCharacterName}</strong>
            <p>{edge.publicLabel}{edge.privateLabel ? ` / ${edge.privateLabel}` : ""}</p>
            <p className="asset-meta">{`信任 ${edge.trustLevel} / 紧张 ${edge.tensionLevel}`}</p>
            {edge.latestSourcePath ? <p className="asset-meta relation-source-meta">{`来源 ${edge.latestSourcePath}`}{edge.sourceRefCount > 1 ? ` / 引用 ${edge.sourceRefCount}` : ""}</p> : null}
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
      <p className="asset-meta">{`风险 ${blockingLevelLabelMap[bundle.blockingLevel] ?? bundle.blockingLevel}`}{` / 性质 ${riskNatureLabelMap[bundle.riskNature] ?? bundle.riskNature}`}{` / 中风险 ${bundle.mediumSeverityCount}`}{` / 高风险 ${bundle.highSeverityCount}`}{bundle.sourceRefCount > 0 ? ` / 引用 ${bundle.sourceRefCount}` : ""}</p>
      {bundle.riskCategories.length ? <p className="asset-meta">{bundle.riskCategories.join(" / ")}</p> : null}
      {bundle.recommendedActions.length ? <p className="asset-meta">{bundle.recommendedActions.join(" / ")}</p> : null}
      {bundle.riskReasons.length ? <ul className="risk-reason-list compact-risk-list">{bundle.riskReasons.map((reason) => <li key={`${bundle.id}:${reason}`} className="risk-reason-item">{reason}</li>)}</ul> : null}
      {bundle.latestEvidenceQuote ? <p className="evidence-quote">{bundle.latestEvidenceQuote}</p> : null}
    </li>
  );
}

function renderSourceTracePanel(workSlug: string, recentSourceRefs: WorkbenchProjectSnapshot["recentSourceRefs"], pendingConflictBundles: WorkbenchProjectSnapshot["pendingConflictBundles"]) {
  return (
    <article className="content-card">
      <div className="section-heading"><p>追踪</p><h2>来源追踪</h2></div>
      <div className="trace-stack">
        <section className="trace-section">
          <div className="overview-head"><h3>待关注风险</h3><Link className="ghost-link" href={`/works/${encodeURIComponent(workSlug)}?view=reviews`}>打开待处理</Link></div>
          <ul className="asset-list trace-list">{pendingConflictBundles.length ? pendingConflictBundles.map((bundle) => renderRiskBundle(bundle)) : <li className="empty-inline">当前没有待处理或冲突变更包。</li>}</ul>
        </section>
        <section className="trace-section">
          <div className="overview-head"><h3>最近来源引用</h3><span className="status-badge">{recentSourceRefs.length}</span></div>
          <ul className="asset-list trace-list">
            {recentSourceRefs.length ? recentSourceRefs.map((sourceRef) => (
              <li key={sourceRef.id}>
                <strong>{sourceRef.assetType}</strong>
                <p className="asset-meta">{sourceRef.sourcePath ?? sourceRef.locator}{sourceRef.documentKind ? ` / ${sourceRef.documentKind}` : ""}{sourceRef.referenceKind ? ` / ${sourceRef.referenceKind}` : ""}</p>
                {sourceRef.evidenceQuote ? <p className="evidence-quote">{sourceRef.evidenceQuote}</p> : null}
              </li>
            )) : <li className="empty-inline">当前还没有来源引用。</li>}
          </ul>
        </section>
      </div>
    </article>
  );
}

function renderDetailView(currentView: WorkDetailView, snapshot: WorkbenchProjectSnapshot) {
  const { work, fileSources, pendingReviewBundles, pendingConflictBundles, recentSourceRefs, reviewStats } = snapshot;
  const focusState = getFocusState(work.slug, fileSources.length, pendingReviewBundles.length);

  if (currentView === "overview") {
    return (
      <section className="detail-view-grid">
        <div className="detail-stack">
          <article className="content-card detail-summary-card">
            <div className="section-heading"><p>焦点</p><h2>当前最该处理什么</h2></div>
            <p className="panel-copy">{focusState.description}</p>
            <div className="detail-summary-list">
              <div className="detail-summary-item"><span className="detail-summary-key">目录源</span><strong className="detail-summary-value">{fileSources.length}</strong></div>
              <div className="detail-summary-item"><span className="detail-summary-key">待处理</span><strong className="detail-summary-value">{reviewStats.pendingCount}</strong></div>
              <div className="detail-summary-item"><span className="detail-summary-key">风险包</span><strong className="detail-summary-value">{pendingConflictBundles.length}</strong></div>
              <div className="detail-summary-item"><span className="detail-summary-key">下一步</span><Link className="detail-primary-link" href={focusState.href}>{focusState.cta}</Link></div>
            </div>
          </article>
        </div>
        <div className="detail-stack">{renderStoryOverview(snapshot)}{renderRelationPreview(snapshot)}{renderSourceTracePanel(work.slug, recentSourceRefs, pendingConflictBundles)}</div>
      </section>
    );
  }

  if (currentView === "reviews") {
    return <section className="detail-view-grid detail-view-grid-single"><WorkSyncPanel workId={work.id} workSlug={work.slug} fileSources={fileSources} pendingReviewBundles={pendingReviewBundles} reviewStats={reviewStats} /></section>;
  }
  if (currentView === "story") {
    return <section className="detail-view-grid"><div className="detail-stack">{renderStoryOverview(snapshot)}</div><div className="detail-stack">{renderRelationPreview(snapshot)}{renderSourceTracePanel(work.slug, recentSourceRefs, pendingConflictBundles)}</div></section>;
  }
  return <section className="detail-view-grid"><div className="detail-stack"><WorkManualPanel snapshot={snapshot} /></div><div className="detail-stack">{renderStoryOverview(snapshot)}</div></section>;
}

export function WorkDetailShell({ snapshot, activeView }: WorkDetailShellProps) {
  const { work, stats, fileSources, pendingReviewBundles, reviewStats, pendingConflictBundles } = snapshot;
  const currentView = normalizeDetailView(activeView);
  const focusState = getFocusState(work.slug, fileSources.length, pendingReviewBundles.length);

  return (
    <main className="page-shell detail-shell">
      <section className="hero-panel detail-hero">
        <div className="hero-actions"><Link className="ghost-link" href="/">返回书架</Link></div>
        <div className="detail-hero-grid">
          <div className="detail-hero-copy-block"><p className="eyebrow">作品详情</p><h1>{work.title}</h1><p className="hero-copy">{detailViewCopyMap[currentView]}</p></div>
          <article className="detail-focus-card"><p className="eyebrow">下一步</p><h2>{focusState.title}</h2><p>{focusState.description}</p><Link className="detail-primary-link" href={focusState.href}>{focusState.cta}</Link></article>
        </div>
        <div className="detail-stat-grid">
          <article className="detail-stat-card"><span>目录源</span><strong>{stats.sourceCount}</strong></article>
          <article className="detail-stat-card"><span>待处理</span><strong>{stats.pendingReviewCount}</strong></article>
          <article className="detail-stat-card"><span>章节</span><strong>{stats.chapterCount}</strong></article>
          <article className="detail-stat-card"><span>关系</span><strong>{stats.relationCount}</strong></article>
          <article className="detail-stat-card"><span>风险包</span><strong>{pendingConflictBundles.length}</strong></article>
          <article className="detail-stat-card"><span>可自动通过</span><strong>{reviewStats.autoApprovableBundleCount}</strong></article>
        </div>
      </section>

      <nav className="detail-nav" aria-label="作品详情导航">
        {detailViewOrder.map((view) => {
          const isActive = view === currentView;
          return (
            <Link key={view} className={isActive ? "detail-nav-link is-active" : "detail-nav-link"} href={getViewHref(work.slug, view)}>
              <span>{detailViewLabelMap[view]}</span>
              {view === "reviews" && reviewStats.bundleCount > 0 ? <span className="detail-nav-badge">{reviewStats.bundleCount}</span> : null}
            </Link>
          );
        })}
      </nav>

      {renderDetailView(currentView, snapshot)}
    </main>
  );
}