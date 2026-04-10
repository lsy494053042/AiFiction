export type MigrationCompatFixtureKey =
  | "legacy-workspace-bootstrap"
  | "legacy-source-of-truth-legacy-only"
  | "legacy-source-of-truth-mixed-registry";

export interface MigrationCompatFixture {
  fixtureKey: MigrationCompatFixtureKey;
  workspaceName: string;
  profileKey: "qidian-male-longform";
  title: string;
  slug: string;
  rootDirName: string;
}

export const migrationCompatFixtures: MigrationCompatFixture[] = [
  {
    fixtureKey: "legacy-workspace-bootstrap",
    workspaceName: "Migration Compat Legacy Workspace",
    profileKey: "qidian-male-longform",
    title: "迁移兼容-旧工作区",
    slug: "migration-compat-legacy-workspace",
    rootDirName: "migration-compat-legacy-workspace",
  },
  {
    fixtureKey: "legacy-source-of-truth-legacy-only",
    workspaceName: "Migration Compat Legacy Source Of Truth",
    profileKey: "qidian-male-longform",
    title: "迁移兼容-旧真相源",
    slug: "migration-compat-legacy-source-of-truth",
    rootDirName: "migration-compat-legacy-source-of-truth",
  },
  {
    fixtureKey: "legacy-source-of-truth-mixed-registry",
    workspaceName: "Migration Compat Mixed Source Registry",
    profileKey: "qidian-male-longform",
    title: "迁移兼容-混合文档注册",
    slug: "migration-compat-mixed-source-registry",
    rootDirName: "migration-compat-mixed-source-registry",
  },
];
