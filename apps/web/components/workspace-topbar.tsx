import Link from "next/link";

interface WorkspaceTopbarProps {
  projectCount: number;
  sourceCount: number;
  pendingReviewCount: number;
  focusHref: string;
  focusLabel: string;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

// Top navigation for the bookshelf homepage.
export function WorkspaceTopbar({
  projectCount,
  sourceCount,
  pendingReviewCount,
  focusHref,
  focusLabel,
}: WorkspaceTopbarProps) {
  return (
    <section className="content-card workspace-topbar">
      <div className="workspace-brand-block">
        <p className="workspace-brand-mark">AiFiction</p>
        <div>
          <strong className="workspace-brand-title">{"小说控制台"}</strong>
          <p className="workspace-brand-copy">{"本地正文驱动，自动维护优先，人工只做判断。"}</p>
        </div>
      </div>

      <nav className="workspace-nav" aria-label={"首页导航"}>
        <a href="#bookshelf">{"书架"}</a>
        <a href="#quick-create">{"新建作品"}</a>
        <a href="#workspace-guide">{"帮助"}</a>
      </nav>

      <div className="workspace-topbar-side">
        <div className="workspace-mini-stats" aria-label={"顶部摘要统计"}>
          <span>{`作品 ${formatCount(projectCount)}`}</span>
          <span>{`目录源 ${formatCount(sourceCount)}`}</span>
          <span>{`待处理 ${formatCount(pendingReviewCount)}`}</span>
        </div>
        <Link className="action-link workspace-primary-link" href={focusHref}>
          {focusLabel}
        </Link>
      </div>
    </section>
  );
}
