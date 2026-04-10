import type {
  BookProtocol,
  WorkProtocolSummary,
  WorkspaceProtocol,
  WorkspaceStarterProfileProtocol,
  WritingPackGateStatusRecord,
} from "../protocol/workspace-protocol.service";
import type {
  WorkbenchProjectSnapshot,
  WorkbenchReviewBundleSummary,
  WorkbenchSemanticProjectionCandidate,
  WorkbenchSourceDocumentSemanticEntitySummary,
  WorkbenchSourceDocumentSemanticSummary,
  WorkbenchSourceRefSummary,
} from "../workbench";

export type LegacySourceDocumentFieldKey =
  | "project_brief"
  | "world_settings"
  | "character_settings"
  | "master_outline"
  | "active_volume_outline";

export interface SourceDocumentPathContext {
  settingsDir: string;
  outlineDir: string;
}

export interface SourceDocumentDefinitionRegistration {
  docKind: string;
  templateKey: string;
  scope: string;
  priority: number;
  legacyFieldKey?: LegacySourceDocumentFieldKey;
  isSourceOfTruthDefault?: boolean;
  defaultSyncPolicy?: string;
  buildDefaultRelativePath?: (context: SourceDocumentPathContext) => string | undefined;
}

export interface SourceDocumentSemanticExtractorRegistration<
  TInput = unknown,
  TSections = unknown,
  TOutput = unknown,
> {
  extractorKey: string;
  supportedDocKinds?: string[];
  supportedTemplateKeys?: string[];
  extractor: (input: TInput, sections: TSections) => TOutput;
}

export interface SourceDocumentSemanticProjectionRegistration {
  projectionKey: string;
  priority?: number;
  buildSummaries: (candidates: WorkbenchSemanticProjectionCandidate[]) => WorkbenchSourceDocumentSemanticSummary[];
}

export interface SourceDocumentSemanticHighlightRenderItem {
  document: WorkbenchSourceDocumentSemanticSummary;
  highlight: WorkbenchSourceDocumentSemanticEntitySummary;
}

export interface SourceDocumentSemanticContextResult {
  documents: WorkbenchSourceDocumentSemanticSummary[];
  highlights: SourceDocumentSemanticHighlightRenderItem[];
}

export interface SourceDocumentSemanticContextRegistration {
  contextKey: string;
  priority?: number;
  buildWritingPackContext: (snapshot: WorkbenchProjectSnapshot) => SourceDocumentSemanticContextResult;
  buildRiskInvestigationPackContext: (
    snapshot: WorkbenchProjectSnapshot,
    bundle: WorkbenchReviewBundleSummary,
    relatedSourceRefs: WorkbenchSourceRefSummary[],
  ) => SourceDocumentSemanticContextResult;
  formatDocumentLine: (document: WorkbenchSourceDocumentSemanticSummary) => string;
  formatHighlightLine: (
    item: SourceDocumentSemanticHighlightRenderItem,
  ) => string;
}

export interface WritingPackGateAssessmentResult {
  mode: "drafting" | "review" | "planning";
  canDraft: boolean;
  blockers: string[];
  nextActions: string[];
}

export interface WritingPackGatePolicyRegistration {
  policyKey: string;
  priority?: number;
  collectPrewriteProtocolBlockers: (book: BookProtocol, taskType?: string) => string[];
  assessWritingPackState: (input: {
    summary: WorkProtocolSummary;
    book: BookProtocol;
    gateStatuses: WritingPackGateStatusRecord[];
  }) => WritingPackGateAssessmentResult;
}

export interface StarterProfileRegistration {
  profileKey: string;
  priority?: number;
  isDefault?: boolean;
  profile: WorkspaceStarterProfileProtocol;
}

export interface StarterProfileProtocolOverlayInput {
  summary: WorkProtocolSummary;
  snapshot: WorkbenchProjectSnapshot;
  starterProfile: WorkspaceStarterProfileProtocol;
  workspace?: WorkspaceProtocol;
  book?: BookProtocol;
}

export interface StarterProfileProtocolOverlayRegistration {
  overlayKey: string;
  profileKeys: string[];
  priority?: number;
  buildWorkspaceProtocolOverlay?: (input: StarterProfileProtocolOverlayInput) => Partial<WorkspaceProtocol> | undefined;
  buildBookProtocolOverlay?: (input: StarterProfileProtocolOverlayInput) => Partial<BookProtocol> | undefined;
}

export type AifictionPluginCapabilityKind =
  | "starter-profile"
  | "starter-profile-protocol-overlay"
  | "source-document-definition"
  | "source-document-semantic-extractor"
  | "source-document-semantic-projection"
  | "source-document-semantic-context"
  | "writing-pack-gate-policy";

export interface AifictionPluginManifest {
  pluginId: string;
  version: string;
  apiVersion?: string;
  displayName: string;
  description?: string;
  builtin?: boolean;
  requiresPlugins?: string[];
  conflictsWith?: string[];
  capabilityKinds: AifictionPluginCapabilityKind[];
}

export interface AifictionPlugin {
  manifest: AifictionPluginManifest;
  starterProfiles?: StarterProfileRegistration[];
  starterProfileProtocolOverlays?: StarterProfileProtocolOverlayRegistration[];
  sourceDocumentDefinitions?: SourceDocumentDefinitionRegistration[];
  sourceDocumentSemanticExtractors?: SourceDocumentSemanticExtractorRegistration<any, any, any>[];
  sourceDocumentSemanticProjections?: SourceDocumentSemanticProjectionRegistration[];
  sourceDocumentSemanticContexts?: SourceDocumentSemanticContextRegistration[];
  writingPackGatePolicies?: WritingPackGatePolicyRegistration[];
}

export interface AifictionPluginBundleDefinition {
  bundleId: string;
  displayName: string;
  description?: string;
  category?: "system" | "official-default" | "topic" | "compatibility" | "utility";
  includesBundles?: string[];
  conflictsWithBundles?: string[];
  recommendedStarterProfiles?: string[];
  pluginIds: string[];
}

export interface AifictionWorkspacePluginConfig {
  api_version?: string;
  bundles?: string[];
  enabled?: string[];
  disabled?: string[];
  strict_mode?: boolean;
}

export interface AifictionPluginLoadRecord {
  pluginId: string;
  displayName?: string;
  status: "loaded" | "skipped" | "blocked" | "error";
  reason?: string;
  capabilityKinds?: AifictionPluginCapabilityKind[];
}

export interface AifictionPluginRuntimeState {
  apiVersion: string;
  source: "default" | "workspace" | "explicit";
  workspaceRoot?: string;
  bundleIds: string[];
  expandedBundleIds: string[];
  selectedPluginIds: string[];
  disabledPluginIds: string[];
  strictMode: boolean;
  loadedPluginIds: string[];
  records: AifictionPluginLoadRecord[];
  hasBlockingIssues: boolean;
}

export interface ConfigureAifictionPluginsOptions {
  source?: "default" | "workspace" | "explicit";
  workspaceRoot?: string;
  pluginIds?: string[];
  disabledPluginIds?: string[];
  bundleIds?: string[];
  strictMode?: boolean;
  availablePlugins?: AifictionPlugin[];
  reset?: boolean;
}
