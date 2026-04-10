import type {
  AifictionPlugin,
  StarterProfileRegistration,
  StarterProfileProtocolOverlayRegistration,
  SourceDocumentDefinitionRegistration,
  SourceDocumentSemanticContextRegistration,
  SourceDocumentSemanticExtractorRegistration,
  SourceDocumentSemanticProjectionRegistration,
  WritingPackGatePolicyRegistration,
} from "./types";

interface RegisteredSourceDocumentDefinition extends SourceDocumentDefinitionRegistration {
  pluginId: string;
}

interface RegisteredStarterProfile extends StarterProfileRegistration {
  pluginId: string;
}

interface RegisteredStarterProfileProtocolOverlay extends StarterProfileProtocolOverlayRegistration {
  pluginId: string;
}

interface RegisteredSourceDocumentSemanticExtractor extends SourceDocumentSemanticExtractorRegistration {
  pluginId: string;
}

interface RegisteredSourceDocumentSemanticProjection extends SourceDocumentSemanticProjectionRegistration {
  pluginId: string;
}

interface RegisteredSourceDocumentSemanticContext extends SourceDocumentSemanticContextRegistration {
  pluginId: string;
}

interface RegisteredWritingPackGatePolicy extends WritingPackGatePolicyRegistration {
  pluginId: string;
}

export class AifictionPluginRegistry {
  private readonly plugins = new Map<string, AifictionPlugin>();
  private readonly starterProfiles = new Map<string, RegisteredStarterProfile>();
  private readonly starterProfileProtocolOverlays = new Map<string, RegisteredStarterProfileProtocolOverlay>();
  private readonly sourceDocumentDefinitions = new Map<string, RegisteredSourceDocumentDefinition>();
  private readonly sourceDocumentSemanticExtractors = new Map<string, RegisteredSourceDocumentSemanticExtractor>();
  private readonly sourceDocumentSemanticProjections = new Map<string, RegisteredSourceDocumentSemanticProjection>();
  private readonly sourceDocumentSemanticContexts = new Map<string, RegisteredSourceDocumentSemanticContext>();
  private readonly writingPackGatePolicies = new Map<string, RegisteredWritingPackGatePolicy>();

  register(plugin: AifictionPlugin): boolean {
    const existing = this.plugins.get(plugin.manifest.pluginId);
    if (existing) {
      return false;
    }

    for (const definition of plugin.sourceDocumentDefinitions ?? []) {
      const existingDefinition = this.sourceDocumentDefinitions.get(definition.docKind);
      if (existingDefinition && existingDefinition.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Source document definition "${definition.docKind}" is already provided by plugin ${existingDefinition.pluginId}.`,
        );
      }
    }

    for (const starterProfile of plugin.starterProfiles ?? []) {
      const existingStarterProfile = this.starterProfiles.get(starterProfile.profileKey);
      if (existingStarterProfile && existingStarterProfile.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Starter profile "${starterProfile.profileKey}" is already provided by plugin ${existingStarterProfile.pluginId}.`,
        );
      }
    }

    for (const overlay of plugin.starterProfileProtocolOverlays ?? []) {
      const existingOverlay = this.starterProfileProtocolOverlays.get(overlay.overlayKey);
      if (existingOverlay && existingOverlay.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Starter profile protocol overlay "${overlay.overlayKey}" is already provided by plugin ${existingOverlay.pluginId}.`,
        );
      }
    }

    for (const extractor of plugin.sourceDocumentSemanticExtractors ?? []) {
      const existingExtractor = this.sourceDocumentSemanticExtractors.get(extractor.extractorKey);
      if (existingExtractor && existingExtractor.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Source document semantic extractor "${extractor.extractorKey}" is already provided by plugin ${existingExtractor.pluginId}.`,
        );
      }
    }

    for (const projection of plugin.sourceDocumentSemanticProjections ?? []) {
      const existingProjection = this.sourceDocumentSemanticProjections.get(projection.projectionKey);
      if (existingProjection && existingProjection.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Source document semantic projection "${projection.projectionKey}" is already provided by plugin ${existingProjection.pluginId}.`,
        );
      }
    }

    for (const context of plugin.sourceDocumentSemanticContexts ?? []) {
      const existingContext = this.sourceDocumentSemanticContexts.get(context.contextKey);
      if (existingContext && existingContext.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Source document semantic context "${context.contextKey}" is already provided by plugin ${existingContext.pluginId}.`,
        );
      }
    }

    for (const policy of plugin.writingPackGatePolicies ?? []) {
      const existingPolicy = this.writingPackGatePolicies.get(policy.policyKey);
      if (existingPolicy && existingPolicy.pluginId !== plugin.manifest.pluginId) {
        throw new Error(
          `Writing pack gate policy "${policy.policyKey}" is already provided by plugin ${existingPolicy.pluginId}.`,
        );
      }
    }

    this.plugins.set(plugin.manifest.pluginId, plugin);

    for (const starterProfile of plugin.starterProfiles ?? []) {
      this.starterProfiles.set(starterProfile.profileKey, {
        ...starterProfile,
        pluginId: plugin.manifest.pluginId,
      });
    }

    for (const overlay of plugin.starterProfileProtocolOverlays ?? []) {
      this.starterProfileProtocolOverlays.set(overlay.overlayKey, {
        ...overlay,
        pluginId: plugin.manifest.pluginId,
      });
    }

    for (const definition of plugin.sourceDocumentDefinitions ?? []) {
      this.sourceDocumentDefinitions.set(definition.docKind, {
        ...definition,
        pluginId: plugin.manifest.pluginId,
      });
    }

    for (const extractor of plugin.sourceDocumentSemanticExtractors ?? []) {
      this.sourceDocumentSemanticExtractors.set(extractor.extractorKey, {
        ...extractor,
        pluginId: plugin.manifest.pluginId,
      });
    }

    for (const projection of plugin.sourceDocumentSemanticProjections ?? []) {
      this.sourceDocumentSemanticProjections.set(projection.projectionKey, {
        ...projection,
        pluginId: plugin.manifest.pluginId,
      });
    }

    for (const context of plugin.sourceDocumentSemanticContexts ?? []) {
      this.sourceDocumentSemanticContexts.set(context.contextKey, {
        ...context,
        pluginId: plugin.manifest.pluginId,
      });
    }

    for (const policy of plugin.writingPackGatePolicies ?? []) {
      this.writingPackGatePolicies.set(policy.policyKey, {
        ...policy,
        pluginId: plugin.manifest.pluginId,
      });
    }

    return true;
  }

  clear(): void {
    this.plugins.clear();
    this.starterProfiles.clear();
    this.starterProfileProtocolOverlays.clear();
    this.sourceDocumentDefinitions.clear();
    this.sourceDocumentSemanticExtractors.clear();
    this.sourceDocumentSemanticProjections.clear();
    this.sourceDocumentSemanticContexts.clear();
    this.writingPackGatePolicies.clear();
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  getPlugin(pluginId: string): AifictionPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  listPlugins(): AifictionPlugin[] {
    return [...this.plugins.values()].sort((left, right) =>
      left.manifest.displayName.localeCompare(right.manifest.displayName),
    );
  }

  listStarterProfiles(): RegisteredStarterProfile[] {
    return [...this.starterProfiles.values()].sort((left, right) => {
      if (Boolean(left.isDefault) !== Boolean(right.isDefault)) {
        return left.isDefault ? -1 : 1;
      }
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.profileKey.localeCompare(right.profileKey);
    });
  }

  getStarterProfile(profileKey: string): StarterProfileRegistration | undefined {
    return this.starterProfiles.get(profileKey);
  }

  getPreferredDefaultStarterProfile(): StarterProfileRegistration | undefined {
    return this.listStarterProfiles().find((profile) => profile.isDefault) ?? this.listStarterProfiles()[0];
  }

  listStarterProfileProtocolOverlays(profileKey?: string): RegisteredStarterProfileProtocolOverlay[] {
    return [...this.starterProfileProtocolOverlays.values()]
      .filter((overlay) => !profileKey || overlay.profileKeys.includes(profileKey))
      .sort((left, right) => {
        const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return left.overlayKey.localeCompare(right.overlayKey);
      });
  }

  listSourceDocumentDefinitions(): RegisteredSourceDocumentDefinition[] {
    return [...this.sourceDocumentDefinitions.values()].sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }
      return left.docKind.localeCompare(right.docKind);
    });
  }

  getSourceDocumentDefinition(docKind: string): RegisteredSourceDocumentDefinition | undefined {
    return this.sourceDocumentDefinitions.get(docKind);
  }

  listSourceDocumentSemanticExtractors(): RegisteredSourceDocumentSemanticExtractor[] {
    return [...this.sourceDocumentSemanticExtractors.values()].sort((left, right) =>
      left.extractorKey.localeCompare(right.extractorKey),
    );
  }

  getSourceDocumentSemanticExtractor<TInput, TSections, TOutput>(
    extractorKey: string,
  ): SourceDocumentSemanticExtractorRegistration<TInput, TSections, TOutput> | undefined {
    const extractor = this.sourceDocumentSemanticExtractors.get(extractorKey);
    if (!extractor) {
      return undefined;
    }

    return extractor as SourceDocumentSemanticExtractorRegistration<TInput, TSections, TOutput>;
  }

  listSourceDocumentSemanticProjections(): RegisteredSourceDocumentSemanticProjection[] {
    return [...this.sourceDocumentSemanticProjections.values()].sort((left, right) => {
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.projectionKey.localeCompare(right.projectionKey);
    });
  }

  getPreferredSourceDocumentSemanticProjection(): SourceDocumentSemanticProjectionRegistration | undefined {
    return this.listSourceDocumentSemanticProjections()[0];
  }

  listSourceDocumentSemanticContexts(): RegisteredSourceDocumentSemanticContext[] {
    return [...this.sourceDocumentSemanticContexts.values()].sort((left, right) => {
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.contextKey.localeCompare(right.contextKey);
    });
  }

  getPreferredSourceDocumentSemanticContext(): SourceDocumentSemanticContextRegistration | undefined {
    return this.listSourceDocumentSemanticContexts()[0];
  }

  listWritingPackGatePolicies(): RegisteredWritingPackGatePolicy[] {
    return [...this.writingPackGatePolicies.values()].sort((left, right) => {
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.policyKey.localeCompare(right.policyKey);
    });
  }

  getPreferredWritingPackGatePolicy(): WritingPackGatePolicyRegistration | undefined {
    return this.listWritingPackGatePolicies()[0];
  }
}

export function createAifictionPluginRegistry(): AifictionPluginRegistry {
  return new AifictionPluginRegistry();
}

const globalPluginRegistry = createAifictionPluginRegistry();

export function registerAifictionPlugin(plugin: AifictionPlugin): boolean {
  return globalPluginRegistry.register(plugin);
}

export function getAifictionPluginRegistry(): AifictionPluginRegistry {
  return globalPluginRegistry;
}

export function resetAifictionPluginRegistry(): void {
  globalPluginRegistry.clear();
}
