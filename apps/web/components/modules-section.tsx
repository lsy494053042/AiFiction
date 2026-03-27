import { builtModules } from "./home-data";

export function ModulesSection() {
  return (
    <section className="content-card wide-card">
      <div className="section-heading">
        <p>模块</p>
        <h2>仓库里已经落下的模块</h2>
      </div>
      <ul className="module-list">
        {builtModules.map((moduleName) => (
          <li key={moduleName}>{moduleName}</li>
        ))}
      </ul>
    </section>
  );
}