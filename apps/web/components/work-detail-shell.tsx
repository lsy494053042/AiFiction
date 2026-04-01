import Link from "next/link";

import type {
  WorkProtocolSummary,
  WorkbenchDocumentWorkspace,
  WorkbenchProjectSnapshot,
  WorkbenchReviewBundleSummary,
} from "@aifiction/data";

import styles from "./work-detail-shell.module.css";

interface WorkDetailShellProps {
  snapshot: WorkbenchProjectSnapshot;
  protocolSummary: WorkProtocolSummary | null;
  chapterWorkspace: WorkbenchDocumentWorkspace | null;
  outlineWorkspace: WorkbenchDocumentWorkspace | null;
  activeView?: string;
  selectedDocumentKey?: string;
}

type RouteView = "overview" | "manuscript" | "outline" | "characters" | "settings" | "issues";
type UiView = "overview" | "workspace" | "characters" | "issues";

type SettingSection = {
  id: string;
  label: string;
  blocks: Array<{ title: string; text?: string; list?: string[] }>;
};

type ContentItem = {
  key: string;
  title: string;
  meta: string;
  href: string;
};

const stageLabels: Record<string, string> = {
  planning: "规划中",
  drafting: "写作中",
  revising: "修订中",
  serializing: "连载中",
  completed: "已完结",
  archived: "已归档",
};

const issueToneLabels: Record<string, string> = {
  "factual-conflict": "前后写法对不上",
  "information-gap": "这里的信息还不够",
  "format-blocker": "文档还需要整理",
  "confidence-review": "系统现在还拿不准",
  none: "目前没有明显问题",
};

const actionLabels: Record<string, string> = {
  "review-extraction-preview": "先核对系统抓到的重点是不是对的",
  "inspect-source-text": "先回看原文，看是不是写得太含糊",
  "retry-after-more-content": "可以先继续往后写，等信息更完整再判断",
  "review-summary-preview": "先看系统整理出来的摘要再决定",
  "confirm-relationship-change": "先把人物关系变化拍板下来",
  "confirm-timeline-change": "先确认时间顺序有没有写反",
};

function getRouteView(value?: string): RouteView {
  if (value === "overview" || value === "outline" || value === "characters" || value === "settings" || value === "issues") {
    return value;
  }
  return "manuscript";
}

function getUiView(view: RouteView): UiView {
  if (view === "overview") return "overview";
  if (view === "characters") return "characters";
  if (view === "issues") return "issues";
  return "workspace";
}

function getViewHref(workSlug: string, view: RouteView, document?: string): string {
  const slug = encodeURIComponent(workSlug);
  return document ? `/works/${slug}/${view}?document=${encodeURIComponent(document)}` : `/works/${slug}/${view}`;
}

function getWorkspaceHref(workSlug: string, document?: string): string {
  return getViewHref(workSlug, "manuscript", document);
}

function getStageLabel(stage?: string): string {
  return stage ? stageLabels[stage] ?? stage : "未设置";
}

function toShortPath(value?: string): string {
  if (!value) return "当前内容";
  const parts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-2).join(" / ") || value;
}

function toFileName(value?: string): string {
  if (!value) return "当前文档";
  const parts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.at(-1) || value;
}

function getSourceKindLabel(path?: string): string {
  const normalized = (path ?? "").replace(/\\/g, "/");
  if (normalized.includes("/00-设定/")) return "设定";
  if (normalized.includes("/01-大纲/")) return "大纲";
  if (normalized.includes("/02-正文/")) return "正文";
  return "文档";
}

function humanizeActionLabel(action: string): string {
  return actionLabels[action] ?? action;
}

function buildSettingSections(snapshot: WorkbenchProjectSnapshot, protocolSummary: WorkProtocolSummary | null): SettingSection[] {
  const currentVolume = snapshot.volumes.find((volume) => volume.order === protocolSummary?.activeVolume) ?? snapshot.volumes[0];

  return [
    {
      id: "positioning",
      label: "作品定位",
      blocks: [
        { title: "题材与平台", text: `${snapshot.work.genre}${snapshot.work.subgenre ? ` / ${snapshot.work.subgenre}` : ""} / ${snapshot.work.targetPlatform}` },
        { title: "一句话卖点", text: snapshot.work.tagline },
      ],
    },
    {
      id: "constraints",
      label: "硬约束",
      blocks: [
        { title: "必须守住的边界", list: snapshot.work.hardConstraints },
        { title: "读者预期", list: snapshot.work.targetAudience },
      ],
    },
    {
      id: "volume",
      label: "当前卷重点",
      blocks: [
        { title: "卷目标", text: currentVolume?.goal ?? "暂未填写卷目标。" },
        { title: "主冲突", text: currentVolume?.mainConflict ?? "暂未填写主冲突。" },
        { title: "这卷必须交代的信息", list: currentVolume?.mustDeliverInfo ?? [] },
      ],
    },
  ];
}

function getSelectedKey(
  routeView: RouteView,
  selectedDocumentKey: string | undefined,
  settingSections: SettingSection[],
  outlineWorkspace: WorkbenchDocumentWorkspace | null,
  chapterWorkspace: WorkbenchDocumentWorkspace | null,
): string | undefined {
  if (selectedDocumentKey) return selectedDocumentKey;
  if (routeView === "outline") return outlineWorkspace?.selectedDocumentId ? `outline:${outlineWorkspace.selectedDocumentId}` : undefined;
  if (routeView === "settings") return settingSections[0] ? `setting:${settingSections[0].id}` : undefined;
  return chapterWorkspace?.selectedDocumentId ? `chapter:${chapterWorkspace.selectedDocumentId}` : undefined;
}

function getPriorityBundles(snapshot: WorkbenchProjectSnapshot): WorkbenchReviewBundleSummary[] {
  return [...snapshot.pendingConflictBundles, ...snapshot.pendingReviewBundles.filter((item) => item.blockingLevel !== "none")];
}

function renderOverview(snapshot: WorkbenchProjectSnapshot, protocolSummary: WorkProtocolSummary | null) {
  const latestChapter = snapshot.latestChapter ?? snapshot.chapters.at(-1);
  const currentVolume = snapshot.volumes.find((volume) => volume.order === protocolSummary?.activeVolume) ?? snapshot.volumes[0];
  const pendingCount = snapshot.pendingConflictBundles.length + snapshot.followUpQueue.formalReviewTasks.length;
  const recentChapters = [...snapshot.chapters].slice(-4).reverse();

  return (
    <section className={styles.overviewGrid}>
      <article className={styles.panel}>
        <p className={styles.sectionLabel}>当前方向</p>
        <h2 className={styles.sectionTitle}>{protocolSummary?.currentFocusLabel ?? "继续推进这本书"}</h2>
        <p className={styles.sectionCopy}>{protocolSummary?.currentFocusGoal ?? snapshot.work.tagline}</p>

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}><span className={styles.metricLabel}>状态</span><strong className={styles.metricValue}>{getStageLabel(protocolSummary?.activeStage ?? snapshot.work.status)}</strong></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>卷 / 章</span><strong className={styles.metricValue}>{`${protocolSummary?.activeVolume ?? "-"} / ${protocolSummary?.activeChapter ?? "-"}`}</strong></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>角色</span><strong className={styles.metricValue}>{snapshot.stats.characterCount}</strong></article>
          <article className={styles.metricCard}><span className={styles.metricLabel}>待处理</span><strong className={styles.metricValue}>{pendingCount}</strong></article>
        </div>
      </article>

      <article className={styles.panel}>
        <p className={styles.sectionLabel}>卷与最近章节</p>
        <h2 className={styles.sectionTitle}>{currentVolume?.title ?? "当前卷"}</h2>
        <div className={styles.infoList}>
          <section className={styles.infoItem}><strong className={styles.infoTitle}>卷目标</strong><p className={styles.infoText}>{currentVolume?.goal ?? snapshot.work.tagline}</p></section>
          {recentChapters.map((chapter) => (
            <section className={styles.infoItem} key={chapter.id}><strong className={styles.infoTitle}>{`第 ${chapter.order} 章 · ${chapter.title}`}</strong><p className={styles.infoText}>{chapter.summary}</p></section>
          ))}
          {latestChapter ? <section className={styles.infoItem}><strong className={styles.infoTitle}>最近更新</strong><p className={styles.infoText}>{latestChapter.title}</p></section> : null}
        </div>
      </article>
    </section>
  );
}

function renderWorkspace(
  snapshot: WorkbenchProjectSnapshot,
  protocolSummary: WorkProtocolSummary | null,
  chapterWorkspace: WorkbenchDocumentWorkspace | null,
  outlineWorkspace: WorkbenchDocumentWorkspace | null,
  routeView: RouteView,
  selectedDocumentKey?: string,
) {
  const settingSections = buildSettingSections(snapshot, protocolSummary);
  const selectedKey = getSelectedKey(routeView, selectedDocumentKey, settingSections, outlineWorkspace, chapterWorkspace);

  const settingItems: ContentItem[] = settingSections.map((section) => ({ key: `setting:${section.id}`, title: section.label, meta: "长期规则", href: getWorkspaceHref(snapshot.work.slug, `setting:${section.id}`) }));
  const outlineItems: ContentItem[] = (outlineWorkspace?.items ?? []).map((item) => ({ key: `outline:${item.id}`, title: item.title, meta: item.subtitle, href: getWorkspaceHref(snapshot.work.slug, `outline:${item.id}`) }));
  const chapterItems: ContentItem[] = (chapterWorkspace?.items ?? []).map((item) => ({ key: `chapter:${item.id}`, title: item.title, meta: item.subtitle, href: getWorkspaceHref(snapshot.work.slug, `chapter:${item.id}`) }));

  const selectedSetting = selectedKey?.startsWith("setting:") ? settingSections.find((section) => section.id === selectedKey.replace("setting:", "")) : undefined;
  const selectedOutline = selectedKey?.startsWith("outline:") && outlineWorkspace ? outlineWorkspace.items.find((item) => item.id === selectedKey.replace("outline:", "")) : undefined;
  const selectedChapter = selectedKey?.startsWith("chapter:") && chapterWorkspace ? chapterWorkspace.items.find((item) => item.id === selectedKey.replace("chapter:", "")) : undefined;

  const sourceLabel = selectedSetting ? `00-设定 / ${selectedSetting.label}` : selectedOutline ? `01-大纲 / ${toShortPath(outlineWorkspace?.selectedRelativePath)}` : `02-正文 / ${toShortPath(chapterWorkspace?.selectedRelativePath)}`;
  const title = selectedSetting?.label ?? selectedOutline?.title ?? selectedChapter?.title ?? "当前内容";

  return (
    <section className={styles.workspaceGrid}>
      <aside className={`${styles.panel} ${styles.treePanel}`.trim()}>
        <div className={styles.treeHeader}>
          <p className={styles.sectionLabel}>目录树</p>
          <strong className={styles.treeRoot}>{`books / ${snapshot.work.title}`}</strong>
          <p className={styles.infoText}>目录直接映射书稿，只保留阅读，不在这里编辑。</p>
        </div>

        <div className={styles.treeGroup}>
          <div className={styles.treeGroupHead}><strong className={styles.treeGroupTitle}>00-设定</strong><span className={styles.treeCount}>{settingItems.length}</span></div>
          <div className={styles.treeList}>{settingItems.map((item) => <Link key={item.key} className={`${styles.treeItem} ${item.key === selectedKey ? styles.treeItemActive : ""}`.trim()} href={item.href}><span className={styles.treeItemTitle}>{item.title}</span><span className={styles.treeItemMeta}>{item.meta}</span></Link>)}</div>
        </div>

        <div className={styles.treeGroup}>
          <div className={styles.treeGroupHead}><strong className={styles.treeGroupTitle}>01-大纲</strong><span className={styles.treeCount}>{outlineItems.length}</span></div>
          <div className={styles.treeList}>{outlineItems.map((item) => <Link key={item.key} className={`${styles.treeItem} ${item.key === selectedKey ? styles.treeItemActive : ""}`.trim()} href={item.href}><span className={styles.treeItemTitle}>{item.title}</span><span className={styles.treeItemMeta}>{item.meta}</span></Link>)}</div>
        </div>

        <div className={styles.treeGroup}>
          <div className={styles.treeGroupHead}><strong className={styles.treeGroupTitle}>02-正文</strong><span className={styles.treeCount}>{chapterItems.length}</span></div>
          <div className={styles.treeList}>{chapterItems.map((item) => <Link key={item.key} className={`${styles.treeItem} ${item.key === selectedKey ? styles.treeItemActive : ""}`.trim()} href={item.href}><span className={styles.treeItemTitle}>{item.title}</span><span className={styles.treeItemMeta}>{item.meta}</span></Link>)}</div>
        </div>
      </aside>

      <article className={`${styles.panel} ${styles.readerPanel}`.trim()}>
        <div className={styles.readerHead}>
          <p className={styles.sectionLabel}>工作区</p>
          <p className={styles.readerSource}>{sourceLabel}</p>
          <h2 className={styles.readerTitle}>{title}</h2>
        </div>

        <div className={styles.readerStage}>
          {selectedSetting ? (
            <div className={styles.readerRich}>
              {selectedSetting.blocks.map((block) => (
                <section className={styles.infoItem} key={`${selectedSetting.id}-${block.title}`}>
                  <strong className={styles.infoTitle}>{block.title}</strong>
                  {block.text ? <p className={styles.infoText}>{block.text}</p> : null}
                  {block.list?.length ? <div className={styles.infoList}>{block.list.map((item) => <p className={styles.infoText} key={item}>{item}</p>)}</div> : null}
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.readerScroll}>
              <article className={styles.readerArticle}><pre>{selectedOutline ? outlineWorkspace?.selectedContent : chapterWorkspace?.selectedContent}</pre></article>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function renderCharacters(snapshot: WorkbenchProjectSnapshot) {
  const relationHighlights = [...snapshot.graph.edges].sort((left, right) => right.tensionLevel - left.tensionLevel).slice(0, 4);

  return (
    <section className={styles.overviewGrid}>
      <article className={styles.panel}>
        <p className={styles.sectionLabel}>角色</p>
        <h2 className={styles.sectionTitle}>当前核心人物</h2>
        <div className={styles.characterGrid}>
          {snapshot.characters.map((character) => (
            <article className={styles.characterCard} key={character.id}>
              <div className={styles.avatar}>{character.name.slice(0, 1)}</div>
              <div className={styles.characterText}>
                <strong className={styles.infoTitle}>{character.name}</strong>
                <p className={styles.infoText}>{`${character.role} / ${character.archetype}`}</p>
                <p className={styles.infoText}>{character.publicIdentity}</p>
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className={styles.panel}>
        <p className={styles.sectionLabel}>关系热度</p>
        <h2 className={styles.sectionTitle}>最近最可能引爆剧情的关系</h2>
        <div className={styles.infoList}>
          {relationHighlights.length ? relationHighlights.map((edge) => <section className={styles.infoItem} key={`${edge.sourceCharacterId}-${edge.targetCharacterId}-${edge.publicLabel}`}><strong className={styles.infoTitle}>{`${edge.sourceCharacterName} → ${edge.targetCharacterName}`}</strong><p className={styles.infoText}>{edge.publicLabel}</p>{edge.privateLabel ? <p className={styles.infoText}>{`暗线：${edge.privateLabel}`}</p> : null}</section>) : <p className={styles.emptyText}>当前还没有显著的关系变化。</p>}
        </div>
      </article>
    </section>
  );
}

function renderIssues(snapshot: WorkbenchProjectSnapshot) {
  const bundles = getPriorityBundles(snapshot);
  const selectedBundle = bundles[0];
  const selectedFormalTask = snapshot.followUpQueue.formalReviewTasks[0];
  const selectedWatchChapter = snapshot.followUpQueue.watchChapters[0];

  if (!bundles.length && !selectedFormalTask && !selectedWatchChapter) {
    return <section className={styles.panel}><p className={styles.emptyText}>当前没有需要你拍板的例外。</p></section>;
  }

  return (
    <section className={styles.issueGrid}>
      <article className={`${styles.panel} ${styles.issueList}`.trim()}>
        <div>
          <p className={styles.sectionLabel}>待处理列表</p>
          <h2 className={styles.sectionTitle}>需要你拍板的例外</h2>
        </div>

        <div className={styles.infoList}>
          {bundles.map((bundle, index) => (
            <article className={`${styles.issueCard} ${index === 0 ? styles.issueCardActive : ""}`.trim()} key={bundle.id}>
              <div className={styles.issueCardTop}><span className={styles.issueSource}>{`${getSourceKindLabel(bundle.sourcePath)} · ${toFileName(bundle.sourcePath)}`}</span><span className={styles.issueTone}>{issueToneLabels[bundle.riskNature] ?? bundle.riskNature}</span></div>
              <strong className={styles.infoTitle}>{bundle.summary}</strong>
              <p className={styles.infoText}>{bundle.riskReasons[0] ?? "系统在这里还是拿不太准。"}</p>
            </article>
          ))}
        </div>
      </article>

      <article className={`${styles.panel} ${styles.issueDetail}`.trim()}>
        {selectedBundle ? (
          <>
            <div>
              <p className={styles.sectionLabel}>{`${getSourceKindLabel(selectedBundle.sourcePath)} / ${toFileName(selectedBundle.sourcePath)}`}</p>
              <h2 className={styles.sectionTitle}>{selectedBundle.summary}</h2>
            </div>

            <div className={styles.compareGrid}>
              <section className={styles.compareCard}><span className={styles.compareLabel}>原文里已经写出来的内容</span><p className={styles.infoText}>{selectedBundle.latestEvidenceQuote ?? "暂时还没有抓到更直接的证据。"}</p></section>
              <section className={`${styles.compareCard} ${styles.compareWarn}`.trim()}><span className={styles.compareLabel}>系统担心的地方</span><p className={styles.infoText}>{selectedBundle.riskReasons.join("；") || "当前只识别到这里还要你再看一眼。"}</p></section>
            </div>

            <section className={styles.infoItem}>
              <strong className={styles.infoTitle}>建议怎么处理</strong>
              <div className={styles.infoList}>
                {selectedBundle.recommendedActions.length ? selectedBundle.recommendedActions.map((action) => <p className={styles.infoText} key={action}>{humanizeActionLabel(action)}</p>) : <p className={styles.infoText}>先回看原文，再决定是不是要改设定。</p>}
              </div>
            </section>

            {selectedFormalTask ? <section className={styles.infoItem}><strong className={styles.infoTitle}>正式复核</strong><p className={styles.infoText}>{`${selectedFormalTask.label} / ${selectedFormalTask.nextAction}`}</p></section> : null}
            {selectedWatchChapter ? <section className={styles.infoItem}><strong className={styles.infoTitle}>建议回看</strong><p className={styles.infoText}>{`${selectedWatchChapter.label} / ${selectedWatchChapter.recommendedAction}`}</p></section> : null}
          </>
        ) : <p className={styles.emptyText}>当前没有可展示的待处理详情。</p>}
      </article>
    </section>
  );
}

export function WorkDetailShell({ snapshot, protocolSummary, chapterWorkspace, outlineWorkspace, activeView, selectedDocumentKey }: WorkDetailShellProps) {
  const routeView = getRouteView(activeView);
  const view = getUiView(routeView);
  const latestChapter = snapshot.latestChapter ?? snapshot.chapters.at(-1);
  const stageLabel = getStageLabel(protocolSummary?.activeStage ?? snapshot.work.status);
  const pendingCount = snapshot.pendingConflictBundles.length + snapshot.followUpQueue.formalReviewTasks.length;

  return (
    <main className={styles.shell}>
      <div className={styles.topbar}>
        <div className={styles.topbarMeta}>
          <Link className={styles.backLink} href="/">返回书架</Link>
          <span className={styles.stagePill}>{stageLabel}</span>
        </div>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>{snapshot.work.title}</h1>
          <p className={styles.pageMeta}>{snapshot.work.genre}{snapshot.work.subgenre ? ` / ${snapshot.work.subgenre}` : ""}{` / ${snapshot.work.targetPlatform}`}{latestChapter ? ` / 最近章节 ${latestChapter.title}` : ""}</p>
        </div>
        <nav className={styles.tabRail}>
          <Link className={`${styles.tabLink} ${view === "overview" ? styles.tabLinkActive : ""}`.trim()} href={getViewHref(snapshot.work.slug, "overview")}>总览</Link>
          <Link className={`${styles.tabLink} ${view === "workspace" ? styles.tabLinkActive : ""}`.trim()} href={getViewHref(snapshot.work.slug, "manuscript")}>工作区</Link>
          <Link className={`${styles.tabLink} ${view === "characters" ? styles.tabLinkActive : ""}`.trim()} href={getViewHref(snapshot.work.slug, "characters")}>角色与关系</Link>
          <Link className={`${styles.tabLink} ${view === "issues" ? styles.tabLinkActive : ""}`.trim()} href={getViewHref(snapshot.work.slug, "issues")}>{pendingCount ? `待处理 ${pendingCount}` : "待处理"}</Link>
        </nav>
      </div>

      {view === "overview" ? renderOverview(snapshot, protocolSummary) : null}
      {view === "workspace" ? renderWorkspace(snapshot, protocolSummary, chapterWorkspace, outlineWorkspace, routeView, selectedDocumentKey) : null}
      {view === "characters" ? renderCharacters(snapshot) : null}
      {view === "issues" ? renderIssues(snapshot) : null}
    </main>
  );
}
