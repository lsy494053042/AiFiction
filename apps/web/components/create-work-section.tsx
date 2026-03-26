import { createWorkAction } from "../app/workbench-actions";

/**
 * 首页快速创建入口。
 * 默认只要求最少必填信息，其他配置收进折叠区，减少首次录入负担。
 */
export function CreateWorkSection() {
  return (
    <section className="content-card" id="quick-create">
      <div className="section-heading">
        <p>Quick Create</p>
        <h2>先建作品壳，再让系统慢慢接手维护</h2>
      </div>
      <p className="panel-copy">
        首页只保留最少必填项。受众、约束、商业卖点这些信息可以等作品建立后再慢慢补。
      </p>

      <form action={createWorkAction} className="editor-form-grid compact-form-grid">
        <label className="field-block field-block-wide">
          <span>作品标题</span>
          <input name="title" placeholder="例如：长夜取火" required />
        </label>
        <label className="field-block">
          <span>主类型</span>
          <input name="genre" placeholder="玄幻 / 都市 / 仙侠" required />
        </label>
        <label className="field-block">
          <span>目标平台</span>
          <input name="targetPlatform" placeholder="起点中文网" required />
        </label>
        <label className="field-block field-block-wide">
          <span>一句话卖点</span>
          <textarea name="tagline" rows={2} placeholder="一句话说明这本书真正的核心钩子" required />
        </label>

        <div className="field-block-wide">
          <details className="manual-details quick-create-details">
            <summary>补充高级信息</summary>
            <div className="quick-create-advanced-grid">
              <label className="field-block">
                <span>手动 slug</span>
                <input name="slug" placeholder="可不填，系统会自动生成" />
              </label>
              <label className="field-block">
                <span>副类型</span>
                <input name="subgenre" placeholder="群像成长 / 系统流 / 种田流" />
              </label>
              <label className="field-block">
                <span>目标字数</span>
                <input name="targetWordCount" type="number" min={1000} defaultValue={1200000} />
              </label>
              <label className="field-block">
                <span>日更目标</span>
                <input name="dailyWordTarget" type="number" min={0} defaultValue={4000} />
              </label>
              <label className="field-block field-block-wide">
                <span>更新节奏</span>
                <input name="updateCadence" defaultValue="日更" />
              </label>
              <label className="field-block field-block-wide">
                <span>目标读者</span>
                <textarea name="targetAudience" rows={2} placeholder="一行一个，或用逗号分隔" />
              </label>
              <label className="field-block field-block-wide">
                <span>商业卖点</span>
                <textarea name="commercialHooks" rows={2} placeholder="一行一个，例如升级体系、势力博弈、边境求生" />
              </label>
              <label className="field-block field-block-wide">
                <span>硬约束</span>
                <textarea name="hardConstraints" rows={2} placeholder="一行一个，例如主角不能无代价跨阶" />
              </label>
              <label className="field-block field-block-wide">
                <span>内容边界提示</span>
                <textarea name="contentWarnings" rows={2} placeholder="一行一个，例如黑暗世界观、战争描写" />
              </label>
            </div>
          </details>
        </div>

        <div className="form-action-row field-block-wide">
          <button type="submit">创建作品并进入详情页</button>
        </div>
      </form>
    </section>
  );
}