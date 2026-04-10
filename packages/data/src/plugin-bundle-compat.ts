export const compatibilityBundleUpgradeMap: Record<string, string> = {
  "starter-qidian-male-longform": "topic-qidian-male-longform",
  "starter-qidian-female-longform": "topic-qidian-female-longform",
  "starter-serial-experimental": "topic-serial-experimental",
};

function dedupeStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)),
  );
}

export interface CompatibilityBundleUpgradeSuggestion {
  legacyBundleId: string;
  topicBundleId: string;
}

export function listCompatibilityBundleUpgrades(bundleIds: Array<string | undefined>): CompatibilityBundleUpgradeSuggestion[] {
  const normalizedBundleIds = dedupeStrings(bundleIds);
  const suggestions: CompatibilityBundleUpgradeSuggestion[] = [];

  for (const [legacyBundleId, topicBundleId] of Object.entries(compatibilityBundleUpgradeMap)) {
    if (normalizedBundleIds.includes(legacyBundleId) && !normalizedBundleIds.includes(topicBundleId)) {
      suggestions.push({
        legacyBundleId,
        topicBundleId,
      });
    }
  }

  return suggestions;
}

export function formatCompatibilityBundleAdvice(bundleIds: Array<string | undefined>): string[] {
  return listCompatibilityBundleUpgrades(bundleIds).map(
    ({ legacyBundleId, topicBundleId }) =>
      `bundle ${legacyBundleId} is compatibility-only; prefer ${topicBundleId} or run: plugins:manage normalize-bundles.`,
  );
}

export function normalizeCompatibilityBundleIds(bundleIds: Array<string | undefined>): string[] {
  const normalizedBundleIds = dedupeStrings(bundleIds);
  const nextBundleIds = new Set(normalizedBundleIds);

  for (const [legacyBundleId, topicBundleId] of Object.entries(compatibilityBundleUpgradeMap)) {
    if (!nextBundleIds.has(legacyBundleId)) {
      continue;
    }

    nextBundleIds.delete(legacyBundleId);
    nextBundleIds.add(topicBundleId);
  }

  return Array.from(nextBundleIds);
}
