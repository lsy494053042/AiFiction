import type { ChapterMemoryBundle } from "@aifiction/schemas";

import {
  createContinuityCheckPromptBundle,
  createDraftPromptBundle,
  type PromptBundle,
} from "../pipeline";
import type { TextGenerationProvider, TextGenerationResult } from "../providers/ai-provider";

/**
 * 章节工作流执行结果。
 * 把 prompt 包和 provider 返回结果放在一起，方便后续记录运行日志。
 */
export interface ChapterWorkflowExecution {
  promptBundle: PromptBundle;
  generation: TextGenerationResult;
}

/**
 * 章节工作流服务。
 * 这一层只负责“围绕一个章节如何组织流程”，不关心数据库具体怎么存。
 */
export class ChapterWorkflowService {
  constructor(private readonly provider: TextGenerationProvider) {}

  /**
   * 仅准备初稿阶段的 prompt。
   */
  prepareDraft(bundle: ChapterMemoryBundle): PromptBundle {
    return createDraftPromptBundle(bundle);
  }

  /**
   * 执行初稿阶段。
   */
  async runDraft(bundle: ChapterMemoryBundle): Promise<ChapterWorkflowExecution> {
    const promptBundle = this.prepareDraft(bundle);
    const generation = await this.provider.generate({
      stage: "draft",
      promptBundle,
    });

    return {
      promptBundle,
      generation,
    };
  }

  /**
   * 仅准备连续性审校阶段的 prompt。
   */
  prepareContinuityCheck(bundle: ChapterMemoryBundle, draftContent: string): PromptBundle {
    return createContinuityCheckPromptBundle(bundle, draftContent);
  }

  /**
   * 执行连续性审校阶段。
   */
  async runContinuityCheck(
    bundle: ChapterMemoryBundle,
    draftContent: string,
  ): Promise<ChapterWorkflowExecution> {
    const promptBundle = this.prepareContinuityCheck(bundle, draftContent);
    const generation = await this.provider.generate({
      stage: "continuity_check",
      promptBundle,
    });

    return {
      promptBundle,
      generation,
    };
  }
}