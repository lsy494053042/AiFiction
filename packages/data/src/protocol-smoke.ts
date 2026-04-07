import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { resolveWorkspaceRoot } from "./client";
import { WorkspaceProtocolService, type WorkspaceProtocol } from "./protocol";
import { SqliteKnowledgeMethodRepository } from "./repositories/v2";

function resolveSmokeSlug(): string | undefined {
  const workspaceFilePath = path.join(resolveWorkspaceRoot(), "workspace.yml");
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error("workspace.yml 不存在，无法运行协议 smoke。");
  }

  const raw = fs.readFileSync(workspaceFilePath, "utf8");
  const workspace = YAML.parse(raw) as WorkspaceProtocol | undefined;
  const slug = workspace?.active_book_id ?? workspace?.default_book_id ?? workspace?.book_index?.[0]?.book_id;

  if (!slug) {
    return undefined;
  }

  return slug;
}

async function main() {
  const service = new WorkspaceProtocolService();
  const knowledgeMethodRepository = new SqliteKnowledgeMethodRepository();
  const slug = resolveSmokeSlug();

  if (!slug) {
    console.log("[AiFiction Protocol] No active book configured. Empty workspace smoke passed.");
    return;
  }

  const bootstrapped = await service.bootstrapWorkProtocolBySlug(slug);
  if (!bootstrapped) {
    throw new Error(`Unable to bootstrap protocol for ${slug}.`);
  }

  const initialWritingPack = await service.generateWritingPackBySlug(slug);
  const riskPack = await service.generateRiskInvestigationPackBySlug(slug);
  const batchReview = await service.generateBatchReviewBySlug(slug);
  const knowledgeCandidatesData = JSON.parse(fs.readFileSync(batchReview.knowledgeCandidatesAbsolutePath, "utf8")) as {
    artifactKind?: string;
    candidates?: Array<{ id: string }>;
  };

  if (knowledgeCandidatesData.artifactKind !== "knowledge-candidates") {
    throw new Error("Knowledge candidates JSON artifact has invalid kind.");
  }

  if (!Array.isArray(knowledgeCandidatesData.candidates)) {
    throw new Error("Knowledge candidates JSON artifact is missing candidates.");
  }

  if (knowledgeCandidatesData.candidates.length < 3) {
    throw new Error("Knowledge candidates JSON artifact must include at least three candidates for promotion smoke.");
  }

  await service.resolveBatchKnowledgeBySlug(slug, {
    promotions: [
      {
        knowledgeItemId: knowledgeCandidatesData.candidates[0].id,
        targetStatus: "book_only",
        applicationResult: "helpful",
        note: "Promoted to active book profile during protocol smoke.",
      },
      {
        knowledgeItemId: knowledgeCandidatesData.candidates[1].id,
        targetStatus: "validated_global",
        applicationResult: "helpful",
        note: "Promoted to active global profile during protocol smoke.",
      },
      {
        knowledgeItemId: knowledgeCandidatesData.candidates[2].id,
        targetStatus: "deprecated",
        applicationResult: "harmful",
        note: "Deprecated during protocol smoke to verify downgrade flow.",
      },
    ],
    gateResults: [
      {
        gateCode: "batch-review-required",
        gateStatus: "passed",
        note: "Batch review resolved in protocol smoke.",
      },
      {
        gateCode: "meta-language-check",
        gateStatus: "passed",
        note: "Meta-language check considered complete in protocol smoke.",
      },
      {
        gateCode: "continuity-review",
        gateStatus: "passed",
        note: "Continuity review considered complete in protocol smoke.",
      },
      {
        gateCode: "opening-arc-review",
        gateStatus: "waived",
        note: "Opening arc review already completed for this project.",
      },
    ],
  });
  const writingPack = await service.generateWritingPackBySlug(slug);
  const summary = await service.getWorkProtocolSummaryBySlug(slug);

  if (!summary?.workspace?.knowledge_workflow) {
    throw new Error("Workspace protocol is missing knowledge_workflow.");
  }

  if (!summary.book?.knowledge_state) {
    throw new Error("Book protocol is missing knowledge_state.");
  }

  if (!summary.currentBatchId || !summary.activeGlobalProfile || !summary.activeBookProfile) {
    throw new Error("Protocol summary is missing current knowledge-state fields.");
  }

  const writingPackContent = fs.readFileSync(writingPack.absolutePath, "utf8");
  if (!writingPackContent.includes("profile")) {
    throw new Error("Writing pack does not include knowledge workflow section.");
  }
  if (!writingPackContent.includes("当前是否允许继续正文")) {
    throw new Error("Writing pack does not include drafting gate assessment.");
  }
  if (!writingPackContent.includes("gate 状态")) {
    throw new Error("Writing pack does not include gate status section.");
  }
  if (!writingPackContent.includes("当前相关通用实体")) {
    throw new Error("Writing pack does not include generic entity projection section.");
  }
  if (!writingPackContent.includes("标签投影")) {
    throw new Error("Writing pack does not include tag taxonomy projection section.");
  }
  if (!writingPackContent.includes("任务与匹配投影")) {
    throw new Error("Writing pack does not include task projection section.");
  }

  const initialWritingPackContent = fs.readFileSync(initialWritingPack.absolutePath, "utf8");
  if (!initialWritingPackContent.includes("profile")) {
    throw new Error("Initial writing pack does not include knowledge workflow section.");
  }
  if (!initialWritingPackContent.includes("当前是否允许继续正文")) {
    throw new Error("Initial writing pack does not include drafting gate assessment.");
  }
  if (!initialWritingPackContent.includes("当前相关通用实体")) {
    throw new Error("Initial writing pack does not include generic entity projection section.");
  }

  if (!writingPackContent.includes("latest-knowledge-candidates.json")) {
    throw new Error("Writing pack does not include knowledge candidates section after batch review.");
  }

  const batchReviewContent = fs.readFileSync(batchReview.absolutePath, "utf8");
  if (!batchReviewContent.includes("artifact_kind: batch-review")) {
    throw new Error("Batch review artifact was not generated.");
  }

  if (!fs.existsSync(batchReview.jsonAbsolutePath)) {
    throw new Error("Batch review JSON artifact was not generated.");
  }

  if (!fs.existsSync(batchReview.knowledgeCandidatesAbsolutePath)) {
    throw new Error("Knowledge candidates JSON artifact was not generated.");
  }

  const batchReviewData = JSON.parse(fs.readFileSync(batchReview.jsonAbsolutePath, "utf8")) as {
    artifactKind?: string;
    findings?: unknown[];
    candidatePrompts?: unknown[];
  };

  if (batchReviewData.artifactKind !== "batch-review") {
    throw new Error("Batch review JSON artifact has invalid kind.");
  }

  if (!Array.isArray(batchReviewData.findings) || !Array.isArray(batchReviewData.candidatePrompts)) {
    throw new Error("Batch review JSON artifact is missing structured findings or candidate prompts.");
  }

  if (
    !batchReviewData.candidatePrompts.some(
      (prompt) => typeof prompt === "string" && prompt.includes("当前批次最主要的问题先归类为"),
    )
  ) {
    throw new Error("Batch review JSON artifact is missing root-cause-first prompt.");
  }

  if (
    !batchReviewData.findings.some(
      (finding) =>
        typeof finding === "object" &&
        finding !== null &&
        "riskNature" in finding &&
        (((finding as { riskNature?: unknown }).riskNature === "anchor-gap") ||
          ((finding as { riskNature?: unknown }).riskNature === "knowledge-layer-gap")),
    )
  ) {
    throw new Error("Batch review JSON artifact is missing structured anchoring findings.");
  }

  if (summary.book?.knowledge_state?.current_batch_review_status !== "resolved") {
    throw new Error("Book protocol did not persist resolved batch review status.");
  }

  if (!summary.book?.last_outputs?.latest_knowledge_candidates_file) {
    throw new Error("Book protocol did not persist latest knowledge candidates file.");
  }

  const knowledgeItems = await knowledgeMethodRepository.listKnowledgeItemsForWritingPack({
    projectId: summary.workId,
  });

  if (!knowledgeItems.length) {
    throw new Error("Knowledge method repository did not persist candidate knowledge items.");
  }

  const knowledgeApplications = await knowledgeMethodRepository.listBatchKnowledgeApplications(summary.currentBatchId);
  if (!knowledgeApplications.length) {
    throw new Error("Knowledge method repository did not persist knowledge application records.");
  }

  const knowledgeGates = await knowledgeMethodRepository.listBatchKnowledgeGates(summary.currentBatchId);
  if (!knowledgeGates.length) {
    throw new Error("Knowledge method repository did not persist knowledge gate records.");
  }

  const writingPackApplications = knowledgeApplications.filter((application) => application.packKind === "writing-pack");
  if (!writingPackApplications.length) {
    throw new Error("Writing pack generation did not record applied knowledge items.");
  }

  if (!writingPackApplications.some((application) => application.applicationResult === "helpful")) {
    throw new Error("Knowledge application results did not persist helpful outcomes.");
  }

  if (!writingPackApplications.some((application) => application.applicationResult === "harmful")) {
    throw new Error("Knowledge application results did not persist harmful outcomes.");
  }

  const enabledGates = summary.enabledKnowledgeGates;
  if (enabledGates.length && knowledgeGates.length < enabledGates.length) {
    throw new Error("Persisted knowledge gates do not cover the enabled workflow gates.");
  }

  if (!knowledgeGates.some((gate) => gate.gateStatus === "passed")) {
    throw new Error("Knowledge gate resolution did not persist passed status.");
  }

  if (!knowledgeGates.some((gate) => gate.gateStatus === "waived")) {
    throw new Error("Knowledge gate resolution did not persist waived status.");
  }

  const knowledgeProfiles = await knowledgeMethodRepository.listKnowledgeProfiles();
  if (knowledgeProfiles.length < 2) {
    throw new Error("Knowledge profile records were not created.");
  }

  const bookProfile = knowledgeProfiles.find((profile) => profile.profileKey === summary.activeBookProfile);
  const globalProfile = knowledgeProfiles.find((profile) => profile.profileKey === summary.activeGlobalProfile);
  if (!bookProfile || !globalProfile) {
    throw new Error("Active knowledge profiles were not created.");
  }

  const bookBindings = await knowledgeMethodRepository.listKnowledgeProfileRules(bookProfile.id);
  const globalBindings = await knowledgeMethodRepository.listKnowledgeProfileRules(globalProfile.id);
  if (!bookBindings.length) {
    throw new Error("Book profile did not bind any promoted knowledge items.");
  }
  if (!globalBindings.length) {
    throw new Error("Global profile did not bind any promoted knowledge items.");
  }

  console.log(`[AiFiction Protocol] Slug: ${slug}`);
  console.log(`[AiFiction Protocol] Status: ${summary?.protocolStatus ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Workspace file: ${summary?.workspaceFilePath ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Book file: ${summary?.bookFilePath ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Context pack dir: ${summary?.contextPackDirectoryPath ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Current batch: ${summary?.currentBatchId ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Global profile: ${summary?.activeGlobalProfile ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Book profile: ${summary?.activeBookProfile ?? "N/A"}`);
  console.log(`[AiFiction Protocol] Initial writing pack: ${initialWritingPack.displayPath}`);
  console.log(`[AiFiction Protocol] Writing pack: ${writingPack.displayPath}`);
  console.log(`[AiFiction Protocol] Risk pack: ${riskPack.displayPath}`);
  console.log(`[AiFiction Protocol] Batch review: ${batchReview.displayPath}`);
  console.log(`[AiFiction Protocol] Batch review JSON: ${batchReview.jsonDisplayPath}`);
  console.log(`[AiFiction Protocol] Knowledge candidates JSON: ${batchReview.knowledgeCandidatesDisplayPath}`);
  console.log(`[AiFiction Protocol] Knowledge DB items: ${knowledgeItems.length}`);
  console.log(`[AiFiction Protocol] Knowledge applications: ${knowledgeApplications.length}`);
  console.log(`[AiFiction Protocol] Knowledge gates: ${knowledgeGates.length}`);
}

main().catch((error) => {
  console.error("[AiFiction Protocol] Smoke failed.");
  console.error(error);
  process.exitCode = 1;
});

