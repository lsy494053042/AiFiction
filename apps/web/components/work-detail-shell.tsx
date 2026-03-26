import Link from "next/link";

import type { WorkbenchProjectSnapshot } from "@aifiction/data";

import { updateChapterAction, updateCharacterAction, updateVolumeAction } from "../app/workbench-actions";
import { WorkManualPanel } from "../lib/work-manual-panel";
import { WorkSyncPanel } from "../lib/work-sync-panel";

interface WorkDetailShellProps {
  snapshot: WorkbenchProjectSnapshot;
}

function toTextareaValue(values: string[]): string {
  return values.join("\n");
}

/**
 * 作品详情工作台。
 * 默认优先展示自动维护状态和资产概览，逐条编辑收进折叠区，降低首屏负担。
 */
export function WorkDetailShell({ snapshot }: WorkDetailShellProps) {
  const { work, stats, volumes, characters, chapters, graph, fileSources, pendingReviews, reviewStats } = snapshot;
  const volumePreview = volumes.slice(0, 4);
  const characterPreview = characters.slice(0, 5);
  const chapterPreview = [...chapters].slice(-5).reverse();
  const relationPreview = graph.edges.slice(0, 8);

  return (
    <main className="page-shell detail-shell">
      <section className="hero-panel detail-hero">
        <div className="hero-actions">
          <Link className="ghost-link" href="/">
            返回首页
          </Link>
        </div>
        <p className="eyebrow">Work Detail</p>
        <h1>{work.title}</h1>
        <p className="hero-copy">
          默认先看目录同步、待审查和当前资产概览。需要修正时再展开逐条编辑，不再把所有表单直接摊满页面。
        </p>
        <div className="stat-chip-row detail-stat-row">
          <span className="stat-chip">角色 {stats.characterCount}</span>
          <span className="stat-chip">分卷 {stats.volumeCount}</span>
          <span className="stat-chip">章节 {stats.chapterCount}</span>
          <span className="stat-chip">关系 {stats.relationCount}</span>
          <span className="stat-chip">目录源 {stats.sourceCount}</span>
          <span className="stat-chip">待审查 {stats.pendingReviewCount}</span>
        </div>
      </section>

      <section className="detail-grid">
        <div className="detail-stack">
          <WorkSyncPanel
            workId={work.id}
            workSlug={work.slug}
            fileSources={fileSources}
            pendingReviews={pendingReviews}
            reviewStats={reviewStats}
          />

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
        </div>

        <div className="detail-stack">
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

          <WorkManualPanel snapshot={snapshot} />
        </div>
      </section>
    </main>
  );
}