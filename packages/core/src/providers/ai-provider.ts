import type { PromptBundle } from "../pipeline";

/**
 * 模型调用请求。
 * 这里先统一为文本生成，后面要接结构化输出时可以继续扩展。
 */
export interface TextGenerationRequest {
  stage: PromptBundle["stage"];
  promptBundle: PromptBundle;
}

/**
 * 模型调用返回值。
 * 保留 provider 与 usage 字段，方便后面接不同模型或做成本统计。
 */
export interface TextGenerationResult {
  provider: string;
  model: string;
  content: string;
  usage?: {
    promptTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/**
 * 文本模型提供方接口。
 * 后面不管接 OpenAI、Claude、DeepSeek 还是本地模型，都应该实现这一层。
 */
export interface TextGenerationProvider {
  readonly name: string;
  generate(request: TextGenerationRequest): Promise<TextGenerationResult>;
}

/**
 * 预览用 provider。
 * 不真正调用模型，只返回可读的占位结果，便于先打通主流程。
 */
export class PreviewTextGenerationProvider implements TextGenerationProvider {
  readonly name = "preview-provider";

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    if (request.stage === "draft") {
      return {
        provider: this.name,
        model: "preview-draft-v1",
        content: [
          `【预览草稿】${request.promptBundle.context.chapter.title}`,
          `本章目标：${request.promptBundle.context.chapter.chapterGoal}`,
          `冲突核心：${request.promptBundle.context.chapter.conflict}`,
          `结尾钩子：${request.promptBundle.context.chapter.endingHook}`,
        ].join("\n"),
      };
    }

    return {
      provider: this.name,
      model: "preview-review-v1",
      content: [
        `【预览审校】${request.promptBundle.context.chapter.title}`,
        "总体结论：当前为预览 provider，尚未接入真实模型审校。",
        "建议：后续替换为真实模型后输出结构化审校报告。",
      ].join("\n"),
    };
  }
}