import Link from "next/link";

import type { WorkbenchProjectSnapshot } from "@aifiction/data";

import { updateChapterAction, updateCharacterAction, updateVolumeAction } from "../app/workbench-actions";
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
  overview:
    "先看这本书现在的同步状态、资产概形和下一步重点，不再一上来就把所有表单摊满。",
  reviews:
    "这里只集中处理本次同步后的目录扫描和待审查项，把“该你判断的东西”放在一起。",
  story:
    "这个视图只看分卷、角色、章节和关系预览，用来快速判断小说资产是否在正常成形。",
  manual:
    "手工维护只作为兜底入口。当自动同步不够或需要纠错时，再来这个区域修正。",
};

function toTextareaValue(values: string[]): string {
  return values.join("\n");
}

function normalizeDetailView(value?: string): WorkDetailView {
  if (value && detailViewOrder.includes(value as WorkDetailView)) {
    return value as WorkDetailView;
  }

  return "overview";
}

function getViewHref(workSlug: string, view: WorkDetailView): string {
  const encodedSlug = encodeURIComponent(workSlug);
  return view === "overview" ? `/works/${encodedSlug}` : `/works/${encodedSlug}?view=${view}`;
}

function getFocusState(workSlug: string, fileSourceCount: number, pendingReviewCount: number) {
  if (pendingReviewCount > 0) {
    return {
      title: "先处理待审查",
      description: `当前有 ${pendingReviewCount} 项变更等你判断，先把它们清掉，工作台会立刻清爽很多。`,
      href: getViewHref(workSlug, "reviews"),
      cta: "去处理待审查",
    };
  }

  if (fileSourceCount > 0) {
    return {
      title: "查看剧情资产",
      description: "目录已经绑定，可以直接检查分卷、角色、章节和关系是否在正常成形。",
      href: getViewHref(workSlug, "story"),
      cta: "去看剧情资产",
    };
  }

  return {
    title: "先绑定本地目录",
    description: "没有接入正文目录时，后面的扫描、抽取和审查都无法自动跑起来。",
    href: getViewHref(workSlug, "reviews"),
    cta: "去绑定目录",
  };
}

function renderStoryOverview(
  work: WorkbenchProjectSnapshot["work"],
  volumes: WorkbenchProjectSnapshot["volumes"],
  characters: WorkbenchProjectSnapshot["characters"],
  chapters: WorkbenchProjectSnapshot["chapters"],
  volumePreview: WorkbenchProjectSnapshot["volumes"],
  characterPreview: WorkbenchProjectSnapshot["characters"],
  chapterPreview: WorkbenchProjectSnapshot["chapters"],
) {
  return (
          <article className="content-card">
            <div className="section-heading">
              <p>Overview</p>
              <h2>结构化资产概览</h2>
            </div>
            <p className="panel-copy">
              这里先快速确认这本书的卷、角色和章节有没有成形。只有发现不对劲时，再展开下面的逐条修正。
            </p>

            <div className="overview-stack">
              <section className="overview-block">
                <div className="overview-head">
                  <div>
                    <p className="eyebrow guide-eyebrow">Volumes</p>
                    <h3>分卷概览</h3>
                  </div>
                  <span className="status-badge">{volumes.length} 条</span>
                </div>
                {volumePreview.length ? (
                  <ul className="compact-asset-list">
                    {volumePreview.map((volume) => (
                      <li key={volume.id}>
                        <strong>{`卷 ${volume.order} · ${volume.title}`}</strong>
                        <p>{volume.goal}</p>
                        <p className="asset-meta">主冲突：{volume.mainConflict}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state compact-state">
                    <p>当前还没有分卷，后续会优先通过自动维护或补录建立。</p>
                  </div>
                )}
              </section>

              <section className="overview-block">
                <div className="overview-head">
                  <div>
                    <p className="eyebrow guide-eyebrow">Characters</p>
                    <h3>角色概览</h3>
                  </div>
                  <span className="status-badge">{characters.length} 条</span>
                </div>
                {characterPreview.length ? (
                  <ul className="compact-asset-list">
                    {characterPreview.map((character) => (
                      <li key={character.id}>
                        <strong>{character.name}</strong>
                        <p>
                          {character.role} · {character.archetype}
                        </p>
                        <p className="asset-meta">{character.publicIdentity}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state compact-state">
                    <p>当前还没有角色资产，后续会优先从正文抽取候选并进入审查。</p>
                  </div>
                )}
              </section>

              <section className="overview-block">
                <div className="overview-head">
                  <div>
                    <p className="eyebrow guide-eyebrow">Chapters</p>
                    <h3>章节概览</h3>
                  </div>
                  <span className="status-badge">{chapters.length} 条</span>
                </div>
                {chapterPreview.length ? (
                  <ul className="compact-asset-list">
                    {chapterPreview.map((chapter) => (
                      <li key={chapter.id}>
                        <strong>{`第 ${chapter.order} 章 · ${chapter.title}`}</strong>
                        <p>{chapter.summary}</p>
                        <p className="asset-meta">章节目标：{chapter.chapterGoal}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state compact-state">
                    <p>当前还没有章节卡，后续会优先通过目录扫描和抽取结果回推。</p>
                  </div>
                )}
              </section>
            </div>

            <details className="manual-details">
              <summary>展开逐条修正已有资产</summary>
              <div className="editor-stack">
                <section className="editor-card">
                  <div className="overview-head">
                    <h3>分卷逐条修正</h3>
                    <span className="status-badge">{volumes.length} 条</span>
                  </div>
                  <ul className="asset-list">
                    {volumes.length ? (
                      volumes.map((volume) => (
                        <li key={volume.id}>
                          <strong>{`卷 ${volume.order} · ${volume.title}`}</strong>
                          <p>{volume.goal}</p>
                          <p className="asset-meta">主冲突：{volume.mainConflict}</p>
                          <details className="manual-details">
                            <summary>编辑这卷</summary>
                            <form action={updateVolumeAction} className="editor-form-grid compact-form-grid nested-form-grid">
                              <input type="hidden" name="workId" value={work.id} />
                              <input type="hidden" name="workSlug" value={work.slug} />
                              <input type="hidden" name="volumeId" value={volume.id} />
                              <input type="hidden" name="order" value={volume.order} />
                              <label className="field-block field-block-wide">
                                <span>分卷标题</span>
                                <input name="title" defaultValue={volume.title} required />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>阶段目标</span>
                                <textarea name="goal" rows={2} defaultValue={volume.goal} required />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>主冲突</span>
                                <textarea name="mainConflict" rows={2} defaultValue={volume.mainConflict} required />
                              </label>
                              <label className="field-block">
                                <span>入卷钩子</span>
                                <input name="entryHook" defaultValue={volume.entryHook} />
                              </label>
                              <label className="field-block">
                                <span>卷高潮</span>
                                <input name="climax" defaultValue={volume.climax} />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>兑现点</span>
                                <input name="payoff" defaultValue={volume.payoff} />
                              </label>
                              <label className="field-block">
                                <span>预计章节数</span>
                                <input name="plannedChapterCount" type="number" min={1} defaultValue={volume.plannedChapterCount} />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>必须交代的信息</span>
                                <textarea name="mustDeliverInfo" rows={2} defaultValue={toTextareaValue(volume.mustDeliverInfo)} />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>重点角色 ID</span>
                                <textarea name="keyCharacters" rows={2} defaultValue={toTextareaValue(volume.keyCharacters)} />
                              </label>
                              <div className="form-action-row field-block-wide">
                                <button type="submit">保存分卷</button>
                              </div>
                            </form>
                          </details>
                        </li>
                      ))
                    ) : (
                      <li className="empty-inline">当前还没有分卷。</li>
                    )}
                  </ul>
                </section>

                <section className="editor-card">
                  <div className="overview-head">
                    <h3>角色逐条修正</h3>
                    <span className="status-badge">{characters.length} 条</span>
                  </div>
                  <ul className="asset-list">
                    {characters.length ? (
                      characters.map((character) => (
                        <li key={character.id}>
                          <strong>{character.name}</strong>
                          <p>
                            {character.role} · {character.archetype}
                          </p>
                          <p className="asset-meta">{character.publicIdentity}</p>
                          <details className="manual-details">
                            <summary>编辑这个角色</summary>
                            <form action={updateCharacterAction} className="editor-form-grid compact-form-grid nested-form-grid">
                              <input type="hidden" name="workId" value={work.id} />
                              <input type="hidden" name="workSlug" value={work.slug} />
                              <input type="hidden" name="characterId" value={character.id} />
                              <label className="field-block">
                                <span>角色名</span>
                                <input name="name" defaultValue={character.name} required />
                              </label>
                              <label className="field-block">
                                <span>角色定位</span>
                                <input name="role" defaultValue={character.role} required />
                              </label>
                              <label className="field-block">
                                <span>角色原型</span>
                                <input name="archetype" defaultValue={character.archetype} required />
                              </label>
                              <label className="field-block">
                                <span>公开身份</span>
                                <input name="publicIdentity" defaultValue={character.publicIdentity} required />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>隐藏身份</span>
                                <input name="hiddenIdentity" defaultValue={character.hiddenIdentity ?? ""} />
                              </label>
                              <label className="field-block">
                                <span>核心欲望</span>
                                <textarea name="coreDesire" rows={2} defaultValue={character.coreDesire} required />
                              </label>
                              <label className="field-block">
                                <span>核心恐惧</span>
                                <textarea name="coreFear" rows={2} defaultValue={character.coreFear} required />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>成长弧</span>
                                <textarea name="growthArc" rows={2} defaultValue={character.growthArc} required />
                              </label>
                              <label className="field-block">
                                <span>优势</span>
                                <textarea name="strengths" rows={2} defaultValue={toTextareaValue(character.strengths)} />
                              </label>
                              <label className="field-block">
                                <span>缺点</span>
                                <textarea name="flaws" rows={2} defaultValue={toTextareaValue(character.flaws)} />
                              </label>
                              <label className="field-block">
                                <span>秘密</span>
                                <textarea name="secrets" rows={2} defaultValue={toTextareaValue(character.secrets)} />
                              </label>
                              <label className="field-block">
                                <span>说话习惯</span>
                                <textarea name="speechStyle" rows={2} defaultValue={toTextareaValue(character.speechStyle)} />
                              </label>
                              <div className="form-action-row field-block-wide">
                                <button type="submit">保存角色</button>
                              </div>
                            </form>
                          </details>
                        </li>
                      ))
                    ) : (
                      <li className="empty-inline">当前还没有角色记录。</li>
                    )}
                  </ul>
                </section>

                <section className="editor-card">
                  <div className="overview-head">
                    <h3>章节逐条修正</h3>
                    <span className="status-badge">{chapters.length} 条</span>
                  </div>
                  <ul className="asset-list">
                    {chapters.length ? (
                      chapters.map((chapter) => (
                        <li key={chapter.id}>
                          <strong>{`第 ${chapter.order} 章 · ${chapter.title}`}</strong>
                          <p>{chapter.summary}</p>
                          <p className="asset-meta">章节目标：{chapter.chapterGoal}</p>
                          <details className="manual-details">
                            <summary>编辑这一章</summary>
                            <form action={updateChapterAction} className="editor-form-grid compact-form-grid nested-form-grid">
                              <input type="hidden" name="workId" value={work.id} />
                              <input type="hidden" name="workSlug" value={work.slug} />
                              <input type="hidden" name="chapterId" value={chapter.id} />
                              <input type="hidden" name="order" value={chapter.order} />
                              <label className="field-block field-block-wide">
                                <span>所属分卷</span>
                                <select name="volumeId" defaultValue={chapter.volumeId}>
                                  {volumes.map((volume) => (
                                    <option key={volume.id} value={volume.id}>
                                      {`卷 ${volume.order} · ${volume.title}`}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field-block field-block-wide">
                                <span>章节标题</span>
                                <input name="title" defaultValue={chapter.title} required />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>章节摘要</span>
                                <textarea name="summary" rows={2} defaultValue={chapter.summary} required />
                              </label>
                              <label className="field-block">
                                <span>章节目标</span>
                                <textarea name="chapterGoal" rows={2} defaultValue={chapter.chapterGoal} required />
                              </label>
                              <label className="field-block">
                                <span>核心冲突</span>
                                <textarea name="conflict" rows={2} defaultValue={chapter.conflict} required />
                              </label>
                              <label className="field-block">
                                <span>进入状态</span>
                                <textarea name="entryState" rows={2} defaultValue={chapter.entryState} required />
                              </label>
                              <label className="field-block">
                                <span>离开状态</span>
                                <textarea name="exitState" rows={2} defaultValue={chapter.exitState} required />
                              </label>
                              <label className="field-block field-block-wide">
                                <span>结尾钩子</span>
                                <textarea name="endingHook" rows={2} defaultValue={chapter.endingHook} required />
                              </label>
                              <label className="field-block">
                                <span>新信息</span>
                                <textarea name="newInfo" rows={2} defaultValue={toTextareaValue(chapter.newInfo)} />
                              </label>
                              <label className="field-block">
                                <span>伏笔种子</span>
                                <textarea name="foreshadowSeeds" rows={2} defaultValue={toTextareaValue(chapter.foreshadowSeeds)} />
                              </label>
                              <label className="field-block">
                                <span>待回收旧线索</span>
                                <textarea name="requiredCallbacks" rows={2} defaultValue={toTextareaValue(chapter.requiredCallbacks)} />
                              </label>
                              <label className="field-block">
                                <span>重点角色 ID</span>
                                <textarea name="keyCharacters" rows={2} defaultValue={toTextareaValue(chapter.keyCharacters)} />
                              </label>
                              <div className="form-action-row field-block-wide">
                                <button type="submit">保存章节</button>
                              </div>
                            </form>
                          </details>
                        </li>
                      ))
                    ) : (
                      <li className="empty-inline">当前还没有章节卡。</li>
                    )}
                  </ul>
                </section>
              </div>
            </details>
          </article>
  );
}

function renderRelationPreview(relationPreview: WorkbenchProjectSnapshot["graph"]["edges"]) {
  return (
          <article className="content-card">
            <div className="section-heading">
              <p>Graph</p>
              <h2>关系预览</h2>
            </div>
            <p className="panel-copy">先看关系预览是否大体合理，后续再接完整图谱页和来源引用。</p>
            <ul className="asset-list relation-preview-list">
              {relationPreview.length ? (
                relationPreview.map((edge) => (
                  <li key={`${edge.sourceCharacterId}:${edge.targetCharacterId}:${edge.publicLabel}`}>
                    <strong>
                      {edge.sourceCharacterName} → {edge.targetCharacterName}
                    </strong>
                    <p>
                      {edge.publicLabel}
                      {edge.privateLabel ? ` / ${edge.privateLabel}` : ""}
                    </p>
                    <p className="asset-meta">信任 {edge.trustLevel} · 张力 {edge.tensionLevel}</p>
                  </li>
                ))
              ) : (
                <li className="empty-inline">当前还没有结构化关系，后续会优先由正文抽取候选并进入审查。</li>
              )}
            </ul>
          </article>
  );
}

function renderDetailView(currentView: WorkDetailView, snapshot: WorkbenchProjectSnapshot) {
  const { work, fileSources, pendingReviews, reviewStats, volumes, characters, chapters, graph } = snapshot;
  const volumePreview = volumes.slice(0, 4);
  const characterPreview = characters.slice(0, 5);
  const chapterPreview = [...chapters].slice(-5).reverse();
  const relationPreview = graph.edges.slice(0, 8);
  const focusState = getFocusState(work.slug, fileSources.length, pendingReviews.length);

  if (currentView === "overview") {
    return (
      <section className="detail-view-grid">
        <div className="detail-stack">
          <article className="content-card detail-summary-card">
            <div className="section-heading">
              <p>Focus</p>
              <h2>{"现在该看什么"}</h2>
            </div>
            <p className="panel-copy">{focusState.description}</p>
            <div className="detail-summary-list">
              <div className="detail-summary-item">
                <span className="detail-summary-key">{"目录源"}</span>
                <strong className="detail-summary-value">{fileSources.length}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">{"待审查"}</span>
                <strong className="detail-summary-value">{reviewStats.pendingCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">{"中高风险"}</span>
                <strong className="detail-summary-value">{reviewStats.mediumSeverityCount + reviewStats.highSeverityCount}</strong>
              </div>
              <div className="detail-summary-item">
                <span className="detail-summary-key">{"下一步"}</span>
                <Link className="detail-primary-link" href={focusState.href}>
                  {focusState.cta}
                </Link>
              </div>
            </div>
          </article>
        </div>
        <div className="detail-stack">
          {renderStoryOverview(work, volumes, characters, chapters, volumePreview, characterPreview, chapterPreview)}
          {renderRelationPreview(relationPreview)}
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
          pendingReviews={pendingReviews}
          reviewStats={reviewStats}
        />
      </section>
    );
  }

  if (currentView === "story") {
    return (
      <section className="detail-view-grid">
        <div className="detail-stack">
          {renderStoryOverview(work, volumes, characters, chapters, volumePreview, characterPreview, chapterPreview)}
        </div>
        <div className="detail-stack">{renderRelationPreview(relationPreview)}</div>
      </section>
    );
  }

  return (
    <section className="detail-view-grid">
      <div className="detail-stack">
        <WorkManualPanel snapshot={snapshot} />
      </div>
      <div className="detail-stack">
        {renderStoryOverview(work, volumes, characters, chapters, volumePreview, characterPreview, chapterPreview)}
      </div>
    </section>
  );
}

export function WorkDetailShell({ snapshot, activeView }: WorkDetailShellProps) {
  const { work, stats, fileSources, pendingReviews, reviewStats } = snapshot;
  const currentView = normalizeDetailView(activeView);
  const focusState = getFocusState(work.slug, fileSources.length, pendingReviews.length);

  return (
    <main className="page-shell detail-shell">
      <section className="hero-panel detail-hero">
        <div className="hero-actions">
          <Link className="ghost-link" href="/">
            {"返回首页"}
          </Link>
        </div>
        <div className="detail-hero-grid">
          <div className="detail-hero-copy-block">
            <p className="eyebrow">Work Detail</p>
            <h1>{work.title}</h1>
            <p className="hero-copy">{detailViewCopyMap[currentView]}</p>
          </div>
          <article className="detail-focus-card">
            <p className="eyebrow">Next</p>
            <h2>{focusState.title}</h2>
            <p>{focusState.description}</p>
            <Link className="detail-primary-link" href={focusState.href}>
              {focusState.cta}
            </Link>
          </article>
        </div>
        <div className="detail-stat-grid">
          <article className="detail-stat-card">
            <span>{"目录源"}</span>
            <strong>{stats.sourceCount}</strong>
          </article>
          <article className="detail-stat-card">
            <span>{"待审查"}</span>
            <strong>{stats.pendingReviewCount}</strong>
          </article>
          <article className="detail-stat-card">
            <span>{"章节"}</span>
            <strong>{stats.chapterCount}</strong>
          </article>
          <article className="detail-stat-card">
            <span>{"关系"}</span>
            <strong>{stats.relationCount}</strong>
          </article>
        </div>
      </section>

      <nav className="detail-nav" aria-label="work detail navigation">
        {detailViewOrder.map((view) => {
          const isActive = view === currentView;
          return (
            <Link
              key={view}
              className={isActive ? "detail-nav-link is-active" : "detail-nav-link"}
              href={getViewHref(work.slug, view)}
            >
              <span>{detailViewLabelMap[view]}</span>
              {view === "reviews" && reviewStats.pendingCount > 0 ? (
                <span className="detail-nav-badge">{reviewStats.pendingCount}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {renderDetailView(currentView, snapshot)}
    </main>
  );
}
