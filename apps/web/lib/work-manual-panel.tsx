import type { WorkbenchProjectSnapshot } from "@aifiction/data";

import {
  createChapterAction,
  createCharacterAction,
  createVolumeAction,
  updateWorkAction,
} from "../app/workbench-actions";

interface WorkManualPanelProps {
  snapshot: WorkbenchProjectSnapshot;
}

function toTextareaValue(values: string[]): string {
  return values.join("\n");
}

export function WorkManualPanel({ snapshot }: WorkManualPanelProps) {
  const { work, volumes } = snapshot;

  return (
    <article className="content-card">
      <div className="section-heading">
        <p>手工兜底</p>
        <h2>高级手工维护</h2>
      </div>
      <p className="panel-copy">
        这里保留手工修正入口，但它只作为兜底。后续主流程会越来越依赖本地目录同步和审查队列，而不是大量手填。
      </p>

      <details className="manual-details">
        <summary>编辑作品配置</summary>
        <form action={updateWorkAction} className="editor-form-grid compact-form-grid nested-form-grid">
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
            <textarea name="targetAudience" rows={2} defaultValue={toTextareaValue(work.targetAudience)} />
          </label>
          <label className="field-block field-block-wide">
            <span>商业卖点</span>
            <textarea name="commercialHooks" rows={2} defaultValue={toTextareaValue(work.commercialHooks)} />
          </label>
          <label className="field-block field-block-wide">
            <span>硬约束</span>
            <textarea name="hardConstraints" rows={2} defaultValue={toTextareaValue(work.hardConstraints)} />
          </label>
          <label className="field-block field-block-wide">
            <span>内容边界提示</span>
            <textarea name="contentWarnings" rows={2} defaultValue={toTextareaValue(work.contentWarnings)} />
          </label>
          <div className="form-action-row field-block-wide">
            <button type="submit">保存作品配置</button>
          </div>
        </form>
      </details>

      <details className="manual-details">
        <summary>手动新增分卷</summary>
        <form action={createVolumeAction} className="editor-form-grid compact-form-grid nested-form-grid">
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
            <textarea name="mustDeliverInfo" rows={2} placeholder="一行一个" />
          </label>
          <label className="field-block field-block-wide">
            <span>重点角色 ID</span>
            <textarea name="keyCharacters" rows={2} placeholder="一行一个" />
          </label>
          <div className="form-action-row field-block-wide">
            <button type="submit">创建分卷</button>
          </div>
        </form>
      </details>

      <details className="manual-details">
        <summary>手动新增角色</summary>
        <form action={createCharacterAction} className="editor-form-grid compact-form-grid nested-form-grid">
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
      </details>

      <details className="manual-details">
        <summary>手动新增章节卡</summary>
        {volumes.length ? (
          <form action={createChapterAction} className="editor-form-grid compact-form-grid nested-form-grid">
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
              <span>待回收旧线索</span>
              <textarea name="requiredCallbacks" rows={2} placeholder="一行一个" />
            </label>
            <label className="field-block">
              <span>重点角色 ID</span>
              <textarea name="keyCharacters" rows={2} placeholder="一行一个" />
            </label>
            <div className="form-action-row field-block-wide">
              <button type="submit">创建章节卡</button>
            </div>
          </form>
        ) : (
          <div className="empty-state compact-state">
            <strong>请先创建至少一个分卷。</strong>
            <p>章节卡必须挂在分卷下，这样后续自动维护才能把卷内节奏和章节推进串起来。</p>
          </div>
        )}
      </details>
    </article>
  );
}