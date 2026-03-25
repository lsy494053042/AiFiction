import Link from "next/link";

import type { WorkbenchProjectSnapshot } from "@aifiction/data";

import {
  createChapterAction,
  createCharacterAction,
  createVolumeAction,
  updateChapterAction,
  updateCharacterAction,
  updateVolumeAction,
  updateWorkAction,
} from "../app/workbench-actions";

interface WorkDetailShellProps {
  snapshot: WorkbenchProjectSnapshot;
}

function toTextareaValue(values: string[]): string {
  return values.join("\n");
}

/**
 * 作品详情工作台。
 * 当前先承接作品、分卷、角色、章节的读取、创建和基础编辑入口，后续再继续细化成独立模块。
 */
export function WorkDetailShell({ snapshot }: WorkDetailShellProps) {
  const { work, stats, volumes, characters, chapters, graph } = snapshot;

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
        <p className="hero-copy">{work.tagline}</p>
        <div className="stat-chip-row detail-stat-row">
          <span className="stat-chip">角色 {stats.characterCount}</span>
          <span className="stat-chip">卷 {stats.volumeCount}</span>
          <span className="stat-chip">章 {stats.chapterCount}</span>
          <span className="stat-chip">关系 {stats.relationCount}</span>
          <span className="stat-chip">伏笔 {stats.foreshadowCount}</span>
        </div>
      </section>

      <section className="detail-grid">
        <div className="detail-stack">
          <article className="content-card">
            <div className="section-heading">
              <p>Work Profile</p>
              <h2>作品控制卡</h2>
            </div>
            <form action={updateWorkAction} className="editor-form-grid compact-form-grid">
              <input type="hidden" name="workId" value={work.id} />
              <input type="hidden" name="previousWorkSlug" value={work.slug} />
              <label className="field-block field-block-wide">
                <span>作品标题</span>
                <input name="title" defaultValue={work.title} required />
              </label>
              <label className="field-block">
                <span>路由标识</span>
                <input name="slug" defaultValue={work.slug} />
              </label>
              <label className="field-block">
                <span>主类型</span>
                <input name="genre" defaultValue={work.genre} required />
              </label>
              <label className="field-block field-block-wide">
                <span>一句话卖点</span>
                <textarea name="tagline" rows={2} defaultValue={work.tagline} required />
              </label>
              <label className="field-block">
                <span>副类型</span>
                <input name="subgenre" defaultValue={work.subgenre ?? ""} />
              </label>
              <label className="field-block">
                <span>目标平台</span>
                <input name="targetPlatform" defaultValue={work.targetPlatform} required />
              </label>
              <label className="field-block">
                <span>目标字数</span>
                <input name="targetWordCount" type="number" min={1} defaultValue={work.targetWordCount} />
              </label>
              <label className="field-block">
                <span>日更字数</span>
                <input name="dailyWordTarget" type="number" min={0} defaultValue={work.dailyWordTarget} />
              </label>
              <label className="field-block field-block-wide">
                <span>更新节奏</span>
                <input name="updateCadence" defaultValue={work.updateCadence} />
              </label>
              <label className="field-block field-block-wide">
                <span>目标读者</span>
                <textarea name="targetAudience" rows={2} defaultValue={toTextareaValue(work.targetAudience)} placeholder="一行一个" />
              </label>
              <label className="field-block field-block-wide">
                <span>商业卖点</span>
                <textarea name="commercialHooks" rows={2} defaultValue={toTextareaValue(work.commercialHooks)} placeholder="一行一个" />
              </label>
              <label className="field-block field-block-wide">
                <span>硬约束</span>
                <textarea name="hardConstraints" rows={2} defaultValue={toTextareaValue(work.hardConstraints)} placeholder="一行一个" />
              </label>
              <label className="field-block field-block-wide">
                <span>内容边界提示</span>
                <textarea name="contentWarnings" rows={2} defaultValue={toTextareaValue(work.contentWarnings)} placeholder="一行一个" />
              </label>
              <div className="form-action-row field-block-wide">
                <button type="submit">保存作品配置</button>
              </div>
            </form>
          </article>

          <article className="content-card">
            <div className="section-heading">
              <p>Volumes</p>
              <h2>分卷与结构节奏</h2>
            </div>
            <ul className="asset-list">
              {volumes.length ? (
                volumes.map((volume) => (
                  <li key={volume.id}>
                    <strong>{`卷 ${volume.order} · ${volume.title}`}</strong>
                    <p>{volume.goal}</p>
                    <p className="asset-meta">主冲突：{volume.mainConflict}</p>
                    <details className="inline-editor">
                      <summary>编辑分卷</summary>
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
                          <textarea name="mustDeliverInfo" rows={2} defaultValue={toTextareaValue(volume.mustDeliverInfo)} placeholder="一行一个" />
                        </label>
                        <label className="field-block field-block-wide">
                          <span>重点角色 ID</span>
                          <textarea name="keyCharacters" rows={2} defaultValue={toTextareaValue(volume.keyCharacters)} placeholder="一行一个" />
                        </label>
                        <div className="form-action-row field-block-wide">
                          <button type="submit">保存分卷</button>
                        </div>
                      </form>
                    </details>
                  </li>
                ))
              ) : (
                <li className="empty-inline">当前还没有分卷，请先创建第一卷。</li>
              )}
            </ul>
          </article>

          <article className="content-card">
            <div className="section-heading">
              <p>Characters</p>
              <h2>角色卡与关系基础</h2>
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
                    <details className="inline-editor">
                      <summary>编辑角色</summary>
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
                          <textarea name="strengths" rows={2} defaultValue={toTextareaValue(character.strengths)} placeholder="一行一个" />
                        </label>
                        <label className="field-block">
                          <span>缺点</span>
                          <textarea name="flaws" rows={2} defaultValue={toTextareaValue(character.flaws)} placeholder="一行一个" />
                        </label>
                        <label className="field-block">
                          <span>秘密</span>
                          <textarea name="secrets" rows={2} defaultValue={toTextareaValue(character.secrets)} placeholder="一行一个" />
                        </label>
                        <label className="field-block">
                          <span>说话习惯</span>
                          <textarea name="speechStyle" rows={2} defaultValue={toTextareaValue(character.speechStyle)} placeholder="一行一个" />
                        </label>
                        <div className="form-action-row field-block-wide">
                          <button type="submit">保存角色</button>
                        </div>
                      </form>
                    </details>
                  </li>
                ))
              ) : (
                <li className="empty-inline">当前还没有角色，请先建立主角和核心配角。</li>
              )}
            </ul>
          </article>

          <article className="content-card">
            <div className="section-heading">
              <p>Chapters</p>
              <h2>章节卡入口</h2>
            </div>
            <ul className="asset-list">
              {chapters.length ? (
                chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <strong>{`第 ${chapter.order} 章 · ${chapter.title}`}</strong>
                    <p>{chapter.summary}</p>
                    <p className="asset-meta">目标：{chapter.chapterGoal}</p>
                    <details className="inline-editor">
                      <summary>编辑章节卡</summary>
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
                          <textarea name="newInfo" rows={2} defaultValue={toTextareaValue(chapter.newInfo)} placeholder="一行一个" />
                        </label>
                        <label className="field-block">
                          <span>伏笔种子</span>
                          <textarea name="foreshadowSeeds" rows={2} defaultValue={toTextareaValue(chapter.foreshadowSeeds)} placeholder="一行一个" />
                        </label>
                        <label className="field-block">
                          <span>需要回收的旧线索</span>
                          <textarea name="requiredCallbacks" rows={2} defaultValue={toTextareaValue(chapter.requiredCallbacks)} placeholder="一行一个" />
                        </label>
                        <label className="field-block">
                          <span>重点角色 ID</span>
                          <textarea name="keyCharacters" rows={2} defaultValue={toTextareaValue(chapter.keyCharacters)} placeholder="一行一个" />
                        </label>
                        <div className="form-action-row field-block-wide">
                          <button type="submit">保存章节卡</button>
                        </div>
                      </form>
                    </details>
                  </li>
                ))
              ) : (
                <li className="empty-inline">当前还没有章节，请先建立分卷后再补章节卡。</li>
              )}
            </ul>
          </article>

          <article className="content-card">
            <div className="section-heading">
              <p>Graph</p>
              <h2>关系图谱预览</h2>
            </div>
            <ul className="asset-list relation-preview-list">
              {graph.edges.length ? (
                graph.edges.map((edge) => (
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
                <li className="empty-inline">角色关系还没有结构化录入，后续这里会升级成完整图谱页。</li>
              )}
            </ul>
          </article>
        </div>

        <div className="detail-stack">
          <article className="content-card">
            <div className="section-heading">
              <p>Create Volume</p>
              <h2>新增分卷</h2>
            </div>
            <form action={createVolumeAction} className="editor-form-grid compact-form-grid">
              <input type="hidden" name="workId" value={work.id} />
              <input type="hidden" name="workSlug" value={work.slug} />
              <label className="field-block field-block-wide">
                <span>分卷标题</span>
                <input name="title" placeholder="例如：边火初燃" required />
              </label>
              <label className="field-block field-block-wide">
                <span>阶段目标</span>
                <textarea name="goal" rows={2} required />
              </label>
              <label className="field-block field-block-wide">
                <span>主冲突</span>
                <textarea name="mainConflict" rows={2} required />
              </label>
              <label className="field-block">
                <span>入卷钩子</span>
                <input name="entryHook" />
              </label>
              <label className="field-block">
                <span>卷高潮</span>
                <input name="climax" />
              </label>
              <label className="field-block field-block-wide">
                <span>兑现点</span>
                <input name="payoff" />
              </label>
              <label className="field-block">
                <span>预计章节数</span>
                <input name="plannedChapterCount" type="number" min={1} defaultValue={24} />
              </label>
              <label className="field-block field-block-wide">
                <span>必须交代的信息</span>
                <textarea name="mustDeliverInfo" rows={2} placeholder="一行一个或逗号分隔" />
              </label>
              <label className="field-block field-block-wide">
                <span>重点角色 ID</span>
                <textarea name="keyCharacters" rows={2} placeholder="一行一个" />
              </label>
              <div className="form-action-row field-block-wide">
                <button type="submit">创建分卷</button>
              </div>
            </form>
          </article>

          <article className="content-card">
            <div className="section-heading">
              <p>Create Character</p>
              <h2>新增角色</h2>
            </div>
            <form action={createCharacterAction} className="editor-form-grid compact-form-grid">
              <input type="hidden" name="workId" value={work.id} />
              <input type="hidden" name="workSlug" value={work.slug} />
              <label className="field-block">
                <span>角色名</span>
                <input name="name" required />
              </label>
              <label className="field-block">
                <span>角色定位</span>
                <input name="role" placeholder="主角 / 导师 / 反派" required />
              </label>
              <label className="field-block">
                <span>角色原型</span>
                <input name="archetype" required />
              </label>
              <label className="field-block">
                <span>公开身份</span>
                <input name="publicIdentity" required />
              </label>
              <label className="field-block field-block-wide">
                <span>隐藏身份</span>
                <input name="hiddenIdentity" />
              </label>
              <label className="field-block">
                <span>核心欲望</span>
                <textarea name="coreDesire" rows={2} required />
              </label>
              <label className="field-block">
                <span>核心恐惧</span>
                <textarea name="coreFear" rows={2} required />
              </label>
              <label className="field-block field-block-wide">
                <span>成长弧</span>
                <textarea name="growthArc" rows={2} required />
              </label>
              <label className="field-block">
                <span>优势</span>
                <textarea name="strengths" rows={2} placeholder="一行一个" />
              </label>
              <label className="field-block">
                <span>缺点</span>
                <textarea name="flaws" rows={2} placeholder="一行一个" />
              </label>
              <label className="field-block">
                <span>秘密</span>
                <textarea name="secrets" rows={2} placeholder="一行一个" />
              </label>
              <label className="field-block">
                <span>说话习惯</span>
                <textarea name="speechStyle" rows={2} placeholder="一行一个" />
              </label>
              <div className="form-action-row field-block-wide">
                <button type="submit">创建角色</button>
              </div>
            </form>
          </article>

          <article className="content-card">
            <div className="section-heading">
              <p>Create Chapter</p>
              <h2>新增章节卡</h2>
            </div>
            {volumes.length ? (
              <form action={createChapterAction} className="editor-form-grid compact-form-grid">
                <input type="hidden" name="workId" value={work.id} />
                <input type="hidden" name="workSlug" value={work.slug} />
                <label className="field-block field-block-wide">
                  <span>所属分卷</span>
                  <select name="volumeId" defaultValue={volumes[0]?.id}>
                    {volumes.map((volume) => (
                      <option key={volume.id} value={volume.id}>
                        {`卷 ${volume.order} · ${volume.title}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-block field-block-wide">
                  <span>章节标题</span>
                  <input name="title" required />
                </label>
                <label className="field-block field-block-wide">
                  <span>章节摘要</span>
                  <textarea name="summary" rows={2} required />
                </label>
                <label className="field-block">
                  <span>章节目标</span>
                  <textarea name="chapterGoal" rows={2} required />
                </label>
                <label className="field-block">
                  <span>核心冲突</span>
                  <textarea name="conflict" rows={2} required />
                </label>
                <label className="field-block">
                  <span>进入状态</span>
                  <textarea name="entryState" rows={2} required />
                </label>
                <label className="field-block">
                  <span>离开状态</span>
                  <textarea name="exitState" rows={2} required />
                </label>
                <label className="field-block field-block-wide">
                  <span>结尾钩子</span>
                  <textarea name="endingHook" rows={2} required />
                </label>
                <label className="field-block">
                  <span>新信息</span>
                  <textarea name="newInfo" rows={2} placeholder="一行一个" />
                </label>
                <label className="field-block">
                  <span>伏笔种子</span>
                  <textarea name="foreshadowSeeds" rows={2} placeholder="一行一个" />
                </label>
                <label className="field-block">
                  <span>需要回收的旧线索</span>
                  <textarea name="requiredCallbacks" rows={2} placeholder="一行一个" />
                </label>
                <label className="field-block">
                  <span>重点角色 ID</span>
                  <textarea name="keyCharacters" rows={2} placeholder="一行一个，后续会升级成可选控件" />
                </label>
                <div className="form-action-row field-block-wide">
                  <button type="submit">创建章节卡</button>
                </div>
              </form>
            ) : (
              <div className="empty-state compact-state">
                <strong>请先创建至少一个分卷。</strong>
                <p>章节卡必须挂在分卷下面，这样后续才能稳定做卷级节奏和章节推进。</p>
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}