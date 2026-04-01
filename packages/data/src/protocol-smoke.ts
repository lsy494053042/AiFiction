import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { resolveWorkspaceRoot } from "./client";
import { WorkspaceProtocolService, type WorkspaceProtocol } from "./protocol";

function resolveSmokeSlug(): string {
  const workspaceFilePath = path.join(resolveWorkspaceRoot(), "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error("workspace.yml 不存在，无法确定协议 smoke 要使用的作品。");
  }

  const raw = fs.readFileSync(workspaceFilePath, "utf8");
  const workspace = YAML.parse(raw) as WorkspaceProtocol | undefined;
  const slug = workspace?.active_book_id ?? workspace?.default_book_id ?? workspace?.book_index?.[0]?.book_id;

  if (!slug) {
    throw new Error("workspace.yml 里没有 active/default 作品，无法运行协议 smoke。");
  }

  return slug;
}

async function main() {
  const service = new WorkspaceProtocolService();
  const slug = resolveSmokeSlug();

  const bootstrapped = await service.bootstrapWorkProtocolBySlug(slug);
  if (!bootstrapped) {
    throw new Error(`Unable to bootstrap protocol for ${slug}.`);
  }

  const writingPack = await service.generateWritingPackBySlug(slug);
  const riskPack = await service.generateRiskInvestigationPackBySlug(slug);
  const summary = await service.getWorkProtocolSummaryBySlug(slug);

  console.log(`[AiFiction Protocol] Slug: ${slug}`);
  console.log(`[AiFiction Protocol] Status: ${summary?.protocolStatus ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Workspace file: ${summary?.workspaceFilePath ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Book file: ${summary?.bookFilePath ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Context pack dir: ${summary?.contextPackDirectoryPath ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Writing pack: ${writingPack.displayPath}`);
  console.log(`[AiFiction Protocol] Risk pack: ${riskPack.displayPath}`);
}

main().catch((error) => {
  console.error("[AiFiction Protocol] Smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
