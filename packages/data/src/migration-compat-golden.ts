import type { MigrationCompatFixtureKey } from "./migration-compat-fixtures";

export interface MigrationCompatGoldenSnapshot {
  workspace: {
    bundles: string[];
    defaultStarterProfile: string;
    starterProfileCount: number;
    pluginsPresent: boolean;
  };
  book: {
    starterProfileKey: string;
    legacyFieldPaths: {
      projectBrief: string;
      worldSettings: string;
      characterSettings: string;
      masterOutline: string;
      activeVolumeOutline: string;
    };
    sourceDocumentCount: number;
    sourceDocumentMappings: string[];
  };
}

export const migrationCompatGoldenSnapshots: Record<MigrationCompatFixtureKey, MigrationCompatGoldenSnapshot> = {
  "legacy-workspace-bootstrap": {
    workspace: {
      bundles: ["core-default", "topic-qidian-male-longform"],
      defaultStarterProfile: "qidian-male-longform",
      starterProfileCount: 3,
      pluginsPresent: true,
    },
    book: {
      starterProfileKey: "qidian-male-longform",
      legacyFieldPaths: {
        projectBrief: "00-设定/作品定位.md",
        worldSettings: "00-设定/世界设定.md",
        characterSettings: "00-设定/角色设定.md",
        masterOutline: "01-大纲/全书大纲.md",
        activeVolumeOutline: "01-大纲/卷一大纲.md",
      },
      sourceDocumentCount: 6,
      sourceDocumentMappings: [
        "character-setting:00-设定/角色设定.md",
        "organization-setting:00-设定/组织生态设定.md",
        "outline-active-volume:01-大纲/卷一大纲.md",
        "outline-master:01-大纲/全书大纲.md",
        "project-brief:00-设定/作品定位.md",
        "world-setting:00-设定/世界设定.md",
      ],
    },
  },
  "legacy-source-of-truth-legacy-only": {
    workspace: {
      bundles: ["core-default", "topic-qidian-male-longform"],
      defaultStarterProfile: "qidian-male-longform",
      starterProfileCount: 3,
      pluginsPresent: true,
    },
    book: {
      starterProfileKey: "qidian-male-longform",
      legacyFieldPaths: {
        projectBrief: "00-设定/旧版作品定位.md",
        worldSettings: "00-设定/旧版世界设定.md",
        characterSettings: "00-设定/旧版角色设定.md",
        masterOutline: "01-大纲/旧版全书大纲.md",
        activeVolumeOutline: "01-大纲/旧版卷一大纲.md",
      },
      sourceDocumentCount: 6,
      sourceDocumentMappings: [
        "character-setting:00-设定/旧版角色设定.md",
        "organization-setting:00-设定/组织生态设定.md",
        "outline-active-volume:01-大纲/旧版卷一大纲.md",
        "outline-master:01-大纲/旧版全书大纲.md",
        "project-brief:00-设定/旧版作品定位.md",
        "world-setting:00-设定/旧版世界设定.md",
      ],
    },
  },
  "legacy-source-of-truth-mixed-registry": {
    workspace: {
      bundles: ["core-default", "topic-qidian-male-longform"],
      defaultStarterProfile: "qidian-male-longform",
      starterProfileCount: 3,
      pluginsPresent: true,
    },
    book: {
      starterProfileKey: "qidian-male-longform",
      legacyFieldPaths: {
        projectBrief: "00-设定/旧版作品定位.md",
        worldSettings: "00-设定/旧版世界设定.md",
        characterSettings: "00-设定/旧版角色设定.md",
        masterOutline: "01-大纲/旧版全书大纲.md",
        activeVolumeOutline: "01-大纲/旧版卷一大纲.md",
      },
      sourceDocumentCount: 7,
      sourceDocumentMappings: [
        "character-setting:00-设定/旧版角色设定.md",
        "organization-setting:00-设定/组织与交易生态.md",
        "outline-active-volume:01-大纲/旧版卷一大纲.md",
        "outline-master:01-大纲/旧版全书大纲.md",
        "project-brief:00-设定/迁移后作品定位.md",
        "research-note:00-设定/科研体系.md",
        "world-setting:00-设定/旧版世界设定.md",
      ],
    },
  },
};
