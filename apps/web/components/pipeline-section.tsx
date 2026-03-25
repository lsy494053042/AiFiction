import { pipelineSteps } from "./home-data";

export function PipelineSection() {
  return (
    <article className="content-card">
      <div className="section-heading">
        <p>Pipeline</p>
        <h2>当前建议流程</h2>
      </div>
      <ul className="timeline-list">
        {pipelineSteps.map((step, index) => (
          <li key={step.name}>
            <span className="timeline-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{step.name}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}