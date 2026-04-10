import { defaultWorkspaceBookStarters } from "../../protocol/starter-profiles";
import type { AifictionPlugin } from "../types";

export const builtinStarterProfilesPlugin: AifictionPlugin = {
  manifest: {
    pluginId: "builtin.starter-profiles",
    version: "1.0.0",
    apiVersion: "1",
    displayName: "Builtin Starter Profiles",
    description: "Provides builtin starter profiles for common AiFiction project presets.",
    builtin: true,
    capabilityKinds: ["starter-profile"],
  },
  starterProfiles: (defaultWorkspaceBookStarters.profiles ?? []).map((profile) => ({
    profileKey: profile.profile_key ?? "unknown-profile",
    priority: 100,
    isDefault: profile.profile_key === defaultWorkspaceBookStarters.default_profile_key,
    profile,
  })),
};
